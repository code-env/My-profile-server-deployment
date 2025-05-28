import { VaultSubcategory } from '../models/Vault';

export async function up() {
  try {
    // Drop the old unique index
    await VaultSubcategory.collection.dropIndex('vaultId_1_categoryId_1_name_1');
    console.log('Successfully dropped old unique index on VaultSubcategory');
  } catch (error) {
    console.error('Error dropping index:', error);
    throw error;
  }
}

export async function down() {
  try {
    // Recreate the old unique index
    await VaultSubcategory.collection.createIndex(
      { vaultId: 1, categoryId: 1, name: 1 },
      { unique: true }
    );
    console.log('Successfully recreated old unique index on VaultSubcategory');
  } catch (error) {
    console.error('Error recreating index:', error);
    throw error;
  }
} 