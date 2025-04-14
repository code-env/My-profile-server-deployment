# Architecture Overview

## Project Structure

```
src/
├── app.ts              # Application entry point
├── config/            # Configuration files
├── controllers/       # Request handlers
├── middleware/        # Custom middleware
├── models/           # Database models
├── routes/           # API routes
├── services/         # Business logic
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Key Components

### Models
- **User**: Core user management and authentication
- **Device**: IoT device management and tracking
- **ProfileTemplate**: Template management for user profiles

### Services
- **AuthService**: Handles authentication and authorization
- **DeviceService**: Manages device operations and synchronization
- **SharingService**: Handles resource sharing between users

### Controllers
Controllers handle HTTP requests and delegate business logic to services.

### Middleware
- **Authentication**: JWT validation and user session management
- **Error Handling**: Global error handling and formatting
- **Validation**: Request payload validation using Zod

## Data Flow
1. Request comes through routes
2. Middleware processes the request (auth, validation)
3. Controller handles the request
4. Service executes business logic
5. Models interact with database
6. Response flows back through the chain

## Security Measures
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- HTTP-only cookies
- Input validation

## Database Design
[Add your database schema design here]
