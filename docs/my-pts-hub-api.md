# MyPts Hub API Documentation

The MyPts Hub API provides endpoints for managing the global supply of MyPts in the system. It serves as the central authority for tracking and controlling the total MyPts in circulation.

## Overview

The MyPts Hub manages:
- Total MyPts supply (50,833,912 MyPts initially)
- Circulating supply (MyPts held by profiles)
- Reserve supply (MyPts held by the system)
- Maximum supply cap (optional)
- MyPts value ($0.024 USD per MyPt initially)

The API allows administrators to:
- Issue new MyPts
- Move MyPts between reserve and circulation
- Adjust the maximum supply cap
- Update the value per MyPt
- Verify system consistency
- Reconcile discrepancies

## Key Concepts

### Supply States

MyPts can exist in two states:
1. **Circulating Supply**: MyPts currently held by profiles
2. **Reserve Supply**: MyPts held by the system, not yet distributed to profiles

The total supply is the sum of circulating and reserve supply.

### Supply Operations

The system supports several operations:
- **Issue**: Create new MyPts (added to reserve)
- **Burn**: Destroy existing MyPts (removed from circulation)
- **Move to Circulation**: Transfer MyPts from reserve to circulation
- **Move to Reserve**: Transfer MyPts from circulation to reserve
- **Adjust Max Supply**: Change or remove the maximum supply cap

## API Endpoints

### Base URL

```
/api/my-pts-hub
```

### Get Hub State

Retrieves the current state of the MyPts Hub.

- **URL**: `/state`
- **Method**: `GET`
- **Authentication**: Not required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "totalSupply": 50833912,
      "circulatingSupply": 50833912,
      "reserveSupply": 0,
      "maxSupply": null,
      "valuePerMyPt": 0.024,
      "lastAdjustment": "2025-04-22T10:30:45Z",
      "updatedAt": "2025-04-22T10:30:45Z"
    }
  }
  ```

### Get Supply Logs

Retrieves logs of supply operations with filtering and pagination.

- **URL**: `/logs`
- **Method**: `GET`
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `action` (optional): Filter by action type (ISSUE, BURN, RESERVE_TO_CIRCULATION, CIRCULATION_TO_RESERVE, ADJUST_MAX_SUPPLY)
  - `startDate` (optional): Filter by start date (ISO format)
  - `endDate` (optional): Filter by end date (ISO format)
  - `adminId` (optional): Filter by admin ID
  - `limit` (optional): Number of logs to return (default: 20)
  - `offset` (optional): Offset for pagination (default: 0)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "logs": [
        {
          "_id": "60d21b4667d0d8992e610c85",
          "action": "ISSUE",
          "amount": 1000000,
          "reason": "Initial supply increase",
          "adminId": "60d21b4667d0d8992e610c99",
          "totalSupplyBefore": 50833912,
          "totalSupplyAfter": 51833912,
          "circulatingSupplyBefore": 50833912,
          "circulatingSupplyAfter": 50833912,
          "reserveSupplyBefore": 0,
          "reserveSupplyAfter": 1000000,
          "valuePerMyPt": 0.024,
          "createdAt": "2025-04-23T10:30:45Z"
        }
      ],
      "pagination": {
        "total": 5,
        "limit": 20,
        "offset": 0,
        "hasMore": false
      }
    }
  }
  ```

## Admin Endpoints

### Issue MyPts

Issues new MyPts into the system (added to reserve).

- **URL**: `/issue`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "amount": 1000000,
    "reason": "Expanding supply for new market",
    "metadata": {
      "marketId": "asia-pacific",
      "projectedGrowth": 25
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully issued 1000000 MyPts",
      "totalSupply": 51833912,
      "reserveSupply": 1000000,
      "circulatingSupply": 50833912
    }
  }
  ```

### Move to Circulation

Moves MyPts from reserve to circulation.

- **URL**: `/move-to-circulation`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "amount": 500000,
    "reason": "Distribution for marketing campaign",
    "metadata": {
      "campaignId": "summer-2025",
      "targetProfiles": 10000
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully moved 500000 MyPts from reserve to circulation",
      "reserveSupply": 500000,
      "circulatingSupply": 51333912
    }
  }
  ```

### Move to Reserve

Moves MyPts from circulation to reserve.

- **URL**: `/move-to-reserve`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "amount": 200000,
    "reason": "Reclaiming unused promotional MyPts",
    "metadata": {
      "promotionId": "spring-2025",
      "expirationDate": "2025-03-31"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully moved 200000 MyPts from circulation to reserve",
      "reserveSupply": 700000,
      "circulatingSupply": 51133912
    }
  }
  ```

### Adjust Maximum Supply

Sets or removes the maximum supply cap.

- **URL**: `/adjust-max-supply`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "maxSupply": 60000000,
    "reason": "Setting supply cap to control inflation"
  }
  ```
  or to remove the cap:
  ```json
  {
    "maxSupply": null,
    "reason": "Removing supply cap for market expansion"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully set maximum supply to 60000000 MyPts",
      "maxSupply": 60000000,
      "totalSupply": 51833912
    }
  }
  ```

### Update Value Per MyPt

Updates the value of one MyPt in USD.

- **URL**: `/update-value`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "value": 0.025
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully updated value per MyPt to $0.025",
      "valuePerMyPt": 0.025,
      "totalValueUSD": 1295847.8
    }
  }
  ```

### Verify System Consistency

Verifies that the hub's circulating supply matches the sum of all profile balances.

- **URL**: `/verify-consistency`
- **Method**: `GET`
- **Authentication**: Required (Admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "hubCirculatingSupply": 51133912,
      "actualCirculatingSupply": 51133912,
      "difference": 0,
      "isConsistent": true,
      "message": "System is consistent"
    }
  }
  ```

### Reconcile Supply

Reconciles any discrepancy between the hub's circulating supply and the actual sum of profile balances.

- **URL**: `/reconcile`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "reason": "Monthly reconciliation - May 2025"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully reconciled system supply",
      "previousCirculating": 51133912,
      "actualCirculating": 51133900,
      "difference": -12,
      "action": "Moved 12 MyPts to reserve to match actual circulation"
    }
  }
  ```

## Integration with MyPts Operations

The MyPts Hub is integrated with the following operations:

### Buying MyPts

When a profile buys MyPts:
1. The system checks if there are enough MyPts in reserve
2. If not, it automatically issues more MyPts
3. MyPts are moved from reserve to circulation
4. The profile's balance is increased

### Selling MyPts

When a profile sells MyPts:
1. The profile's balance is decreased
2. MyPts are moved from circulation to reserve

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `500 Internal Server Error`: Server error

Example error response:

```json
{
  "success": false,
  "message": "Cannot move 1000000 MyPts to circulation when only 500000 are in reserve"
}
```
