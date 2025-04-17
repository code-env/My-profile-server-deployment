import { RelationshipType, IRelationshipType, ProfileType } from '../models/RelationshipType';
import { FilterQuery, QueryOptions } from 'mongoose';

export class RelationshipTypeService {
    /**
     * Create a new relationship type
     */
    static async create(data: Partial<IRelationshipType>): Promise<IRelationshipType> {
        if (!data.name || !data.profileType) {
            throw new Error('Name and profileType are required');
        }

        const existing = await RelationshipType.findOne({
            name: data.name,
            profileType: data.profileType,
            isApproved: true,
        });

        if (existing) {
            throw new Error('Relationship type already exists');
        }

        return RelationshipType.create({
            ...data,
            isSystemDefined: data.isSystemDefined || false
        });
    }

    /**
     * Find relationship types with filtering and pagination
     */
    static async find(
        filter: FilterQuery<IRelationshipType> = {},
        options: QueryOptions = {}
    ): Promise<IRelationshipType[]> {
        return RelationshipType.find(filter, null, options);
    }

    /**
     * Get a single relationship type by ID
     */
    static async findById(id: string): Promise<IRelationshipType | null> {
        return RelationshipType.findById(id);
    }

    /**
     * Update a relationship type
     */
    static async update(
        id: string,
        data: Partial<IRelationshipType>
    ): Promise<IRelationshipType | null> {
        // Prevent changing system-defined relationships
        if (data.isSystemDefined === false) {
            const existing = await RelationshipType.findById(id);
            if (existing?.isSystemDefined) {
                throw new Error('Cannot modify system-defined relationship types');
            }
        }

        return RelationshipType.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        );
    }

    /**
     * Delete a relationship type
     */
    static async delete(id: string): Promise<IRelationshipType | null> {
        const relationship = await RelationshipType.findById(id);
        if (relationship?.isSystemDefined) {
            throw new Error('Cannot delete system-defined relationship types');
        }
        return RelationshipType.findByIdAndDelete(id);
    }

    /**
     * Search relationship types by name or description
     */
    static async search(query: string): Promise<IRelationshipType[]> {
        return RelationshipType.find({
            $text: { $search: query }
        });
    }

    /**
     * Get relationship types by ProfileType
     */
    static async findByProfileType(
        profileType: ProfileType
    ): Promise<IRelationshipType[]> {
        return RelationshipType.find({ profileType });
    }

    /**
  * Bulk create relationship types with validation and error handling
  */
    static async bulkCreate(
        items: Array<Partial<IRelationshipType>>,
        options: { skipDuplicates?: boolean } = { skipDuplicates: true }
    ): Promise<{
        created: number;
        duplicates: number;
        errors: Array<{ index: number; error: string }>;
    }> {
        const errors: Array<{ index: number; error: string }> = [];
        const duplicateNames = new Set<string>();
        const createdItems: IRelationshipType[] = [];

        // Validate and filter items
        const validItems = await Promise.all(
            items.map(async (item, index) => {
                try {
                    // Required fields check
                    if (!item.name || !item.profileType) {
                        throw new Error('Name and profileType are required');
                    }

                    // Validate profileType enum
                    if (!Object.values(ProfileType).includes(item.profileType as ProfileType)) {
                        throw new Error(`Invalid profileType: ${item.profileType}`);
                    }

                    // Check for duplicates
                    const key = `${item.name.toLowerCase()}_${item.profileType.toLowerCase()}`;
                    if (options.skipDuplicates) {
                        const exists = await RelationshipType.exists({
                            name: { $regex: new RegExp(`^${item.name}$`, 'i') },
                            profileType: item.profileType
                        });
                        if (exists) {
                            duplicateNames.add(key);
                            throw new Error('Duplicate relationship type');
                        }
                    }

                    item.isApproved = true; // Set default value
                    return item;
                } catch (error) {
                    errors.push({ index, error: (error as Error).message });
                    return null;
                }
            })
        );

        // Insert valid items
        const filteredItems = validItems.filter(Boolean) as Array<Partial<IRelationshipType>>;
        if (filteredItems.length > 0) {
            const result = await RelationshipType.insertMany(filteredItems, { ordered: false });
            createdItems.push(...result);
        }

        return {
            created: createdItems.length,
            duplicates: duplicateNames.size,
            errors,
        };
    }


    /**
    * Bulk Delete relationship types by IDs
    */

    static async bulkDelete(ids: string[]): Promise<{ deletedCount: number }> {
        const result = await RelationshipType.deleteMany({ _id: { $in: ids } });
        return { deletedCount: result.deletedCount };
    }
}