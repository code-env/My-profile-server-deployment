# Duplicate Personal Profile Deletion Endpoint

## Overview
This endpoint allows administrators to clean up duplicate personal profiles in the system. It intelligently keeps profiles with non-zero MYPTS balance and deletes duplicates with zero balance.

## Endpoint Details
- **URL**: `DELETE /api/profiles/duplicates/personal`
- **Access**: Admin/SuperAdmin only
- **Authentication**: Required (Bearer token)

## Logic
1. Finds all users who have more than one personal profile (`profileType: 'personal'` and `profileCategory: 'individual'`)
2. For each user with duplicates:
   - If any profiles have non-zero MYPTS balance: keeps the one with highest balance (or most recent if tied)
   - If all profiles have zero balance: keeps the most recently created profile
   - Deletes all other duplicate profiles
3. Logs all profile names and balances before deletion
4. Updates user's profiles array to remove deleted profile references

## Request Example
```bash
curl -X DELETE \
  http://localhost:5000/api/profiles/duplicates/personal \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

## Response Example
```json
{
  "success": true,
  "message": "Duplicate personal profiles deleted successfully",
  "data": {
    "totalUsersProcessed": 5,
    "totalProfilesDeleted": 8,
    "usersWithDuplicates": 5,
    "deletionDetails": [
      {
        "userId": "60f7b3b3b3b3b3b3b3b3b3b3",
        "profilesFound": 3,
        "profilesDeleted": 2,
        "keptProfile": {
          "id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "name": "John Doe",
          "balance": 1500,
          "createdAt": "2023-01-15T10:30:00.000Z"
        },
        "deletedProfiles": [
          {
            "id": "60f7b3b3b3b3b3b3b3b3b3b5",
            "name": "John Doe",
            "balance": 0,
            "createdAt": "2023-01-10T08:20:00.000Z"
          },
          {
            "id": "60f7b3b3b3b3b3b3b3b3b3b6",
            "name": "John Doe",
            "balance": 0,
            "createdAt": "2023-01-12T14:45:00.000Z"
          }
        ]
      }
    ]
  }
}
```

## Safety Features
- Only processes users with more than one personal profile
- Logs all profile information before deletion
- Preserves profiles with MYPTS balance
- Maintains referential integrity by updating user's profiles array
- Admin-only access with role verification

## Logging
The endpoint provides detailed logging including:
- Profile names and balances before deletion
- Which profile is kept and why
- Successful deletions and any errors
- Summary statistics

## Error Handling
- Returns 403 if user is not admin/superadmin
- Returns 500 if deletion process fails
- Individual profile deletion errors are logged but don't stop the process 