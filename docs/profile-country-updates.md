# Profile Country Information Update

This script updates the country information in all profiles associated with a specific user.

## Usage

### From Command Line

To update all profiles for a specific user, run:

```bash
# Using npm script
npm run update-profile-country <userId>

# Directly using ts-node
npx ts-node src/scripts/update-user-profile-country.ts <userId>
```

Replace `<userId>` with the MongoDB ObjectId of the user whose profiles you want to update.

### Programmatically

You can also import and use the function in your code:

```typescript
import { updateUserProfileCountries } from '../scripts/update-user-profile-country';

// To update profiles for a user (userId must be a string)
const result = await updateUserProfileCountries(userId, true);
console.log(result.message);
// result contains: { success: boolean, updatedCount: number, message: string }
```

The second parameter (`true` in the example) controls whether the function should establish its own database connection.
- Set to `true` when calling from outside a context that already has a database connection
- Set to `false` when calling from within a controller or service that already has a database connection

## Automatic Updates

This script is automatically called whenever a user's country information is updated through:
1. The admin user update endpoint (`PUT /auth/users/:id`)
2. The regular user update endpoint (`PUT /api/users/update`)

## How It Works

The script:
1. Finds all profiles where the user is set as the creator
2. Updates the country name and ISO country code for each profile
3. Preserves existing coordinate data or sets defaults if none exist

The country code is derived from a comprehensive mapping of country names to ISO codes.
