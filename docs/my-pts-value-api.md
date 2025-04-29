# MyPts Value API Documentation

The MyPts Value API provides endpoints for retrieving and managing the monetary value of MyPts in various currencies.

## Overview

MyPts has a real monetary value that can be expressed in different currencies. As of April 22, 2025:
- 1 MyPts = $0.024 USD
- Total supply: 50,833,912 MyPts
- Total value: ~$1,220,014 USD

The API allows you to:
- Get the current value of MyPts in different currencies
- Calculate the value of a specific amount of MyPts
- Convert currency amounts to equivalent MyPts
- Get historical value data
- Update the value (admin only)

## API Endpoints

### Base URL

```
/api/my-pts-value
```

### Get Current MyPts Value

Retrieves the current value of MyPts in all supported currencies.

- **URL**: `/current`
- **Method**: `GET`
- **Authentication**: Not required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "baseValue": 0.024,
      "baseCurrency": "USD",
      "baseSymbol": "$",
      "effectiveDate": "2025-04-22T10:30:45Z",
      "exchangeRates": [
        {
          "currency": "EUR",
          "rate": 0.8666666666666667,
          "symbol": "€",
          "updatedAt": "2025-04-22T10:30:45Z"
        },
        {
          "currency": "GBP",
          "rate": 0.7458333333333333,
          "symbol": "£",
          "updatedAt": "2025-04-22T10:30:45Z"
        },
        {
          "currency": "XAF",
          "rate": 567.0833333333334,
          "symbol": "FCFA",
          "updatedAt": "2025-04-22T10:30:45Z"
        },
        {
          "currency": "NGN",
          "rate": 1594.1666666666667,
          "symbol": "₦",
          "updatedAt": "2025-04-22T10:30:45Z"
        },
        {
          "currency": "PKR",
          "rate": 280.8333333333333,
          "symbol": "₨",
          "updatedAt": "2025-04-22T10:30:45Z"
        }
      ],
      "totalSupply": 50833912,
      "totalValueUSD": 1220013.888,
      "previousValue": null,
      "changePercentage": null
    }
  }
  ```

### Calculate MyPts Value

Calculates the monetary value of a specific amount of MyPts.

- **URL**: `/calculate`
- **Method**: `GET`
- **Authentication**: Not required
- **Query Parameters**:
  - `amount` (required): Number of MyPts to calculate value for
  - `currency` (optional): Currency code (default: USD)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "myPts": 1000,
      "valuePerMyPt": 0.024,
      "currency": "USD",
      "symbol": "$",
      "totalValue": 24,
      "formattedValue": "$24.00"
    }
  }
  ```

### Convert Currency to MyPts

Converts a currency amount to equivalent MyPts.

- **URL**: `/convert`
- **Method**: `GET`
- **Authentication**: Not required
- **Query Parameters**:
  - `amount` (required): Amount in the specified currency
  - `currency` (optional): Currency code (default: USD)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "currencyAmount": 100,
      "currency": "USD",
      "symbol": "$",
      "valuePerMyPt": 0.024,
      "myPtsAmount": 4166.67,
      "formattedCurrencyValue": "$100.00",
      "formattedMyPtsValue": "4166.67 MyPts"
    }
  }
  ```

### Get Total MyPts Supply

Retrieves information about the total MyPts in circulation and their value.

- **URL**: `/total-supply`
- **Method**: `GET`
- **Authentication**: Not required
- **Query Parameters**:
  - `currency` (optional): Currency code (default: USD)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "totalSupply": 50833912,
      "valuePerMyPt": 0.024,
      "currency": "USD",
      "symbol": "$",
      "totalValue": 1220013.888,
      "formattedValue": "$1220013.89"
    }
  }
  ```

### Get Historical MyPts Values

Retrieves historical MyPts value data.

- **URL**: `/historical`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `limit` (optional): Number of historical records to return (default: 30)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "values": [
        {
          "baseValue": 0.024,
          "baseCurrency": "USD",
          "baseSymbol": "$",
          "effectiveDate": "2025-04-22T10:30:45Z",
          "exchangeRates": [...],
          "totalSupply": 50833912,
          "totalValueUSD": 1220013.888,
          "previousValue": null,
          "changePercentage": null
        },
        {
          "baseValue": 0.023,
          "baseCurrency": "USD",
          "baseSymbol": "$",
          "effectiveDate": "2025-04-15T10:30:45Z",
          "exchangeRates": [...],
          "totalSupply": 50800000,
          "totalValueUSD": 1168400,
          "previousValue": 0.022,
          "changePercentage": 4.55
        }
      ]
    }
  }
  ```

## Admin Endpoints

### Update MyPts Value

Updates the value of MyPts and exchange rates.

- **URL**: `/update`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "baseValue": 0.025,
    "exchangeRates": [
      {
        "currency": "EUR",
        "rate": 0.87,
        "symbol": "€"
      },
      {
        "currency": "GBP",
        "rate": 0.75,
        "symbol": "£"
      },
      {
        "currency": "XAF",
        "rate": 570,
        "symbol": "FCFA"
      },
      {
        "currency": "NGN",
        "rate": 1600,
        "symbol": "₦"
      },
      {
        "currency": "PKR",
        "rate": 285,
        "symbol": "₨"
      }
    ],
    "totalSupply": 51000000
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "value": {
        "_id": "60d21b4667d0d8992e610c85",
        "baseValue": 0.025,
        "baseCurrency": "USD",
        "baseSymbol": "$",
        "exchangeRates": [...],
        "effectiveDate": "2025-04-23T10:30:45Z",
        "previousValue": 0.024,
        "changePercentage": 4.17,
        "totalSupply": 51000000,
        "totalValueUSD": 1275000,
        "createdAt": "2025-04-23T10:30:45Z",
        "updatedAt": "2025-04-23T10:30:45Z"
      },
      "message": "MyPts value updated successfully"
    }
  }
  ```

### Initialize MyPts Value

Initializes the MyPts value system with default values. This endpoint should only be called once when setting up the system.

- **URL**: `/initialize`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "value": {
        "_id": "60d21b4667d0d8992e610c85",
        "baseValue": 0.024,
        "baseCurrency": "USD",
        "baseSymbol": "$",
        "exchangeRates": [...],
        "effectiveDate": "2025-04-22T10:30:45Z",
        "totalSupply": 50833912,
        "totalValueUSD": 1220013.888,
        "createdAt": "2025-04-22T10:30:45Z",
        "updatedAt": "2025-04-22T10:30:45Z"
      },
      "message": "MyPts value initialized successfully"
    }
  }
  ```

## Integration with MyPts Balance

The MyPts balance endpoint now includes value information:

- **URL**: `/api/my-pts/balance`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `currency` (optional): Currency code (default: USD)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "balance": 500,
      "lifetimeEarned": 750,
      "lifetimeSpent": 250,
      "lastTransaction": "2025-04-15T10:30:45Z",
      "value": {
        "valuePerMyPt": 0.024,
        "currency": "USD",
        "symbol": "$",
        "totalValue": 12,
        "formattedValue": "$12.00"
      }
    }
  }
  ```

## Supported Currencies

The MyPts value system currently supports the following currencies:

- USD (US Dollar) - $
- EUR (Euro) - €
- GBP (British Pound) - £
- XAF (Central African CFA Franc) - FCFA
- NGN (Nigerian Naira) - ₦
- PKR (Pakistani Rupee) - ₨

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
  "message": "Exchange rate for JPY not found"
}
```
