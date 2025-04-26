# MyPts API Documentation

MyPts is a virtual currency system that allows users to buy, sell, earn, and spend points within the platform. This document outlines the available API endpoints for interacting with the MyPts system.

## Overview

MyPts can be:
- Bought with real money
- Sold for real money
- Earned through platform activities
- Used to purchase products for other profiles
- Donated to other profiles
- Awarded by administrators

## API Endpoints

All MyPts endpoints are protected and require authentication with a valid profile token.

### Base URL

```
/api/my-pts
```

### Get MyPts Balance

Retrieves the current MyPts balance for the authenticated profile.

- **URL**: `/balance`
- **Method**: `GET`
- **Authentication**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "balance": 500,
      "lifetimeEarned": 750,
      "lifetimeSpent": 250,
      "lastTransaction": "2023-06-15T10:30:45Z"
    }
  }
  ```

### Get Transaction History

Retrieves the MyPts transaction history for the authenticated profile.

- **URL**: `/transactions`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `limit` (optional): Number of transactions to return (default: 20)
  - `offset` (optional): Offset for pagination (default: 0)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactions": [
        {
          "_id": "60d21b4667d0d8992e610c85",
          "profileId": "60d21b4667d0d8992e610c80",
          "type": "BUY_MYPTS",
          "amount": 100,
          "balance": 500,
          "description": "Bought 100 MyPts",
          "status": "COMPLETED",
          "metadata": {
            "paymentMethod": "credit_card",
            "paymentId": "pay_123456789"
          },
          "createdAt": "2023-06-15T10:30:45Z",
          "updatedAt": "2023-06-15T10:30:45Z"
        },
        {
          "_id": "60d21b4667d0d8992e610c86",
          "profileId": "60d21b4667d0d8992e610c80",
          "type": "EARN_MYPTS",
          "amount": 50,
          "balance": 400,
          "description": "Earned 50 MyPts for profile completion",
          "status": "COMPLETED",
          "metadata": {
            "activityType": "profile_completion"
          },
          "createdAt": "2023-06-14T15:20:30Z",
          "updatedAt": "2023-06-14T15:20:30Z"
        }
      ],
      "pagination": {
        "total": 10,
        "limit": 20,
        "offset": 0,
        "hasMore": false
      }
    }
  }
  ```

### Get Transactions by Type

Retrieves the MyPts transactions of a specific type for the authenticated profile.

- **URL**: `/transactions/type/:type`
- **Method**: `GET`
- **Authentication**: Required
- **URL Parameters**:
  - `type`: Transaction type (e.g., BUY_MYPTS, SELL_MYPTS, EARN_MYPTS)
- **Query Parameters**:
  - `limit` (optional): Number of transactions to return (default: 20)
  - `offset` (optional): Offset for pagination (default: 0)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactions": [
        {
          "_id": "60d21b4667d0d8992e610c85",
          "profileId": "60d21b4667d0d8992e610c80",
          "type": "BUY_MYPTS",
          "amount": 100,
          "balance": 500,
          "description": "Bought 100 MyPts",
          "status": "COMPLETED",
          "metadata": {
            "paymentMethod": "credit_card",
            "paymentId": "pay_123456789"
          },
          "createdAt": "2023-06-15T10:30:45Z",
          "updatedAt": "2023-06-15T10:30:45Z"
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

## MyPts Management

### Buy MyPts

Buys MyPts with real money (simulated).

- **URL**: `/buy`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "amount": 100,
    "paymentMethod": "credit_card",
    "paymentId": "pay_123456789"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c87",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "BUY_MYPTS",
        "amount": 100,
        "balance": 600,
        "description": "Bought 100 MyPts",
        "status": "COMPLETED",
        "metadata": {
          "paymentMethod": "credit_card",
          "paymentId": "pay_123456789"
        },
        "createdAt": "2023-06-16T09:45:30Z",
        "updatedAt": "2023-06-16T09:45:30Z"
      },
      "newBalance": 600
    }
  }
  ```

### Sell MyPts

Sells MyPts for real money (simulated).

- **URL**: `/sell`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "amount": 50,
    "paymentMethod": "bank_transfer",
    "accountDetails": {
      "accountType": "savings",
      "accountNumber": "1234567890"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c88",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "SELL_MYPTS",
        "amount": -50,
        "balance": 550,
        "description": "Sold 50 MyPts",
        "status": "COMPLETED",
        "metadata": {
          "paymentMethod": "bank_transfer",
          "accountDetails": {
            "accountType": "savings",
            "accountNumber": "1234567890"
          }
        },
        "createdAt": "2023-06-16T10:15:20Z",
        "updatedAt": "2023-06-16T10:15:20Z"
      },
      "newBalance": 550
    }
  }
  ```

### Earn MyPts

Earns MyPts through platform activities.

- **URL**: `/earn`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "activityType": "daily_login",
    "referenceId": "login_20230616"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c91",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "EARN_MYPTS",
        "amount": 10,
        "balance": 535,
        "description": "Earned 10 MyPts for daily login",
        "status": "COMPLETED",
        "metadata": {
          "activityType": "daily_login",
          "referenceId": "login_20230616"
        },
        "createdAt": "2023-06-16T08:00:15Z",
        "updatedAt": "2023-06-16T08:00:15Z"
      },
      "newBalance": 535,
      "myPtsEarned": 10
    }
  }
  ```

## Product and Donation Transactions

### Purchase Product for Another Profile

Purchases a product for another profile using MyPts.

- **URL**: `/purchase-product`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "amount": 25,
    "toProfileId": "60d21b4667d0d8992e610c81",
    "productId": "prod_123456",
    "productName": "Premium Feature Access"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c89",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "PURCHASE_PRODUCT",
        "amount": -25,
        "balance": 525,
        "description": "Purchased product: Premium Feature Access for profile: 60d21b4667d0d8992e610c81 using 25 MyPts",
        "status": "COMPLETED",
        "metadata": {
          "productId": "prod_123456",
          "productName": "Premium Feature Access",
          "recipientProfileId": "60d21b4667d0d8992e610c81"
        },
        "relatedTransaction": "60d21b4667d0d8992e610c90",
        "createdAt": "2023-06-16T11:30:45Z",
        "updatedAt": "2023-06-16T11:30:45Z"
      },
      "newBalance": 525
    }
  }
  ```

### Donate MyPts to Another Profile

Donates MyPts to another profile.

- **URL**: `/donate`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "amount": 15,
    "toProfileId": "60d21b4667d0d8992e610c81",
    "message": "Thank you for your help!"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c92",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "DONATION_SENT",
        "amount": -15,
        "balance": 510,
        "description": "Donated 15 MyPts to profile: 60d21b4667d0d8992e610c81 - Thank you for your help!",
        "status": "COMPLETED",
        "relatedTransaction": "60d21b4667d0d8992e610c93",
        "createdAt": "2023-06-16T12:45:30Z",
        "updatedAt": "2023-06-16T12:45:30Z"
      },
      "newBalance": 510
    }
  }
  ```

## Admin Operations

### Award MyPts (Admin Only)

Awards MyPts to a profile (admin only).

- **URL**: `/award`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "profileId": "60d21b4667d0d8992e610c80",
    "amount": 100,
    "reason": "Contest winner"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transaction": {
        "_id": "60d21b4667d0d8992e610c92",
        "profileId": "60d21b4667d0d8992e610c80",
        "type": "ADJUSTMENT",
        "amount": 100,
        "balance": 635,
        "description": "Admin award: 100 MyPts - Contest winner",
        "status": "COMPLETED",
        "metadata": {
          "adminId": "60d21b4667d0d8992e610c99"
        },
        "createdAt": "2023-06-16T14:20:30Z",
        "updatedAt": "2023-06-16T14:20:30Z"
      },
      "newBalance": 635
    }
  }
  ```

## Transaction Types

The MyPts system supports the following transaction types:

- `BUY_MYPTS`: User buys MyPts with real money
- `SELL_MYPTS`: User sells MyPts for real money
- `EARN_MYPTS`: User earns MyPts through activities
- `PURCHASE_PRODUCT`: User purchases a product for another profile using MyPts
- `RECEIVE_PRODUCT_PAYMENT`: User receives MyPts from product sale
- `DONATION_SENT`: User donates MyPts to another profile
- `DONATION_RECEIVED`: User receives MyPts as donation
- `REFUND`: MyPts refunded to user
- `EXPIRE`: MyPts expired
- `ADJUSTMENT`: Admin adjustment of MyPts

## Activity Types for Earning MyPts

Users can earn MyPts through the following activities:

- `profile_completion`: 50 MyPts (one-time)
- `daily_login`: 10 MyPts (daily)
- `post_creation`: 5 MyPts (per post)
- `comment`: 2 MyPts (per comment)
- `share`: 3 MyPts (per share)
- `referral`: 100 MyPts (per successful referral)
- `connection_accepted`: 15 MyPts (per connection)

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Example error response:

```json
{
  "success": false,
  "message": "Insufficient MyPts balance",
  "error": "Cannot purchase product for 100 MyPts with a balance of 50"
}
```
