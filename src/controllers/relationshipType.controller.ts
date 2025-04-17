import { Request, Response } from 'express';
import { RelationshipTypeService } from '../services/relationshipType.service';
import { ProfileType, RelationshipType } from '../models/RelationshipType';

export class RelationshipTypeController {
    /**
     * Create a new relationship type
     */
    static async create(req: Request, res: Response) {
        try {
            const relationship = await RelationshipTypeService.create(req.body);
            res.status(201).json(relationship);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * List all relationship types
     */
    static async list(req: Request, res: Response) {
        try {
            const { profileType, group, search } = req.query;
            const filter: any = {};

            if (profileType) filter.profileType = profileType;
            if (group) filter.group = group;
            if (search) {
                const relationships = await RelationshipTypeService.search(search as string);
                return res.json(relationships);
            }

            const relationships = await RelationshipTypeService.find(filter);
            res.json(relationships);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get a single relationship type
     */
    static async get(req: Request, res: Response) {
        try {
            const relationship = await RelationshipTypeService.findById(req.params.id);
            if (!relationship) {
                return res.status(404).json({ error: 'Relationship type not found' });
            }
            res.json(relationship);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update a relationship type
     */
    static async update(req: Request, res: Response) {
        try {
            const relationship = await RelationshipTypeService.update(
                req.params.id,
                req.body
            );
            if (!relationship) {
                return res.status(404).json({ error: 'Relationship type not found' });
            }
            res.json(relationship);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a relationship type
     */
    static async delete(req: Request, res: Response) {
        try {
            const relationship = await RelationshipTypeService.delete(req.params.id);
            if (!relationship) {
                return res.status(404).json({ error: 'Relationship type not found' });
            }
            res.json({ message: 'Relationship type deleted' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * List relationship categories (enum values)
     */
    static async listCategories(_req: Request, res: Response) {
        res.json({
            categories: Object.values(ProfileType)
        });
    }

    /**
   * Handle bulk creation of relationship types
   */
    static async bulkCreate(req: Request, res: Response) {
        try {
            const { items, skipDuplicates } = req.body;


            if (!Array.isArray(items)) {
                return res.status(400).json({ error: 'Items must be an array' });
            }

            const result = await RelationshipTypeService.bulkCreate(items, {
                skipDuplicates: skipDuplicates !== false
            });

            res.status(201).json({
                message: `Created ${result.created} relationship types`,
                duplicates: result.duplicates,
                errors: result.errors,
            });
        } catch (error) {
            res.status(500).json({
                error: 'Bulk create failed',
                details: (error as Error).message
            });
        }
    }

    /**
     * Bulk Delete relationship types
     */

    static async bulkDelete(req: Request, res: Response) {
        try {
            const { ids } = req.body;

            if (!Array.isArray(ids)) {
                return res.status(400).json({ error: 'IDs must be an array' });
            }

            const result = await RelationshipTypeService.bulkDelete(ids);
            res.status(200).json({
                message: `Deleted ${result.deletedCount} relationship types`,
            });
        } catch (error) {
            res.status(500).json({
                error: 'Bulk delete failed',
                details: (error as Error).message
            });
        }
    }

    /**
     * Delete all relationship types
     */
    static async deleteAll(req: Request, res: Response) {
        try {
            const result = await RelationshipType.deleteMany({});
            res.status(200).json({
                message: `Deleted all relationship types`,
            });
        } catch (error) {
            res.status(500).json({
                error: 'Delete all failed',
                details: (error as Error).message
            });
        }
    }
}