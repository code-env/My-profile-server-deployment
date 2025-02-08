# MyProfile Backend

A secure and scalable authentication system built with Node.js, TypeScript, and MongoDB.

## Features

- 🔐 Secure Authentication System
  - JWT-based authentication with access and refresh tokens
  - Password hashing using bcrypt
  - Rate limiting for login attempts
  - Account locking after multiple failed attempts
  - HTTP-only cookies for refresh tokens
  - Token rotation
  - Input validation using Zod

- 🛡️ Security Features
  - CORS protection
  - Helmet security headers
  - Rate limiting
  - Cookie security
  - Password strength requirements
  - Brute force protection

- 📝 TypeScript Support
  - Type-safe development
  - Interface definitions
  - Zod schema validation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- TypeScript

## Installation

1. Clone the repository:
   ```bash
   git clone <https://github.com/Brilydal123/My-profile-server.git>
   cd my-profile-ltd
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Update the environment variables in `.env` with your configuration

## Development

Start the development server:
```bash
npm run dev
```

## Build

Build the project:
```bash
npm run build
```

## Production

Start the production server:
```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
  - Required fields: email, password, firstName, lastName

- `POST /api/auth/login` - Login user
  - Required fields: email, password

- `POST /api/auth/refresh-token` - Refresh access token
  - Requires refresh token in HTTP-only cookie

- `POST /api/auth/logout` - Logout user
  - Requires authentication

## Flutter Integration Guide

### API Endpoints

#### Authentication Endpoints
- `POST /api/auth/register` - Register a new user
  - Body: `{ email, password, name }`
  - Response: `{ message, user }`

- `POST /api/auth/login` - User login
  - Body: `{ email, password }`
  - Response: `{ accessToken, user }`

- `POST /api/auth/refresh` - Refresh access token
  - Uses HTTP-only refresh token cookie
  - Response: `{ accessToken }`

- `POST /api/auth/logout` - User logout
  - Invalidates refresh token
  - Response: `{ message }`

#### Two-Factor Authentication (2FA)
- `POST /api/auth/2fa/generate` - Generate 2FA secret
  - Response: `{ secret, qrCode }`

- `POST /api/auth/2fa/verify` - Verify 2FA token
  - Body: `{ token }`
  - Response: `{ message }`

- `POST /api/auth/2fa/disable` - Disable 2FA
  - Response: `{ message }`

### Flutter Implementation Example
```dart
// Example of login request in Flutter
Future<void> login(String email, String password) async {
  try {
    final response = await http.post(
      Uri.parse('${baseUrl}/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      // Store access token securely using flutter_secure_storage
      await storage.write(key: 'accessToken', value: data['accessToken']);
    }
  } catch (e) {
    print('Login error: $e');
  }
}

## Security Features

### SSL/TLS Configuration
The application uses SSL/TLS encryption for secure data transmission. In production:
- SSL/TLS certificates are required
- Minimum TLS version is 1.2
- Strong cipher suites are enforced
- HSTS is enabled

### Helmet.js Security Headers
```typescript
// Implemented security headers:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));

## Application Monitoring

### Logging System
- Winston logger implementation for structured logging
- Log levels: error, warn, info, debug
- Log rotation and archival
- Performance metrics logging

### Health Monitoring
- Endpoint health checks
- Database connection monitoring
- Memory usage tracking
- Response time metrics
- Error rate monitoring

### Monitoring Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status (protected)
- `GET /metrics` - Performance metrics (protected)

## Development Guidelines

### Code Documentation Standards
- Use JSDoc comments for all functions and classes
- Document parameter types and return values
- Include usage examples for complex functions
- Add TODO comments for future improvements

### Best Practices
- Follow TypeScript strict mode guidelines
- Use dependency injection for better testability
- Implement proper error handling and logging
- Follow REST API best practices
- Use async/await for asynchronous operations

### Error Handling
```typescript
// Example of proper error handling
try {
  // Operation
} catch (error) {
  logger.error('Operation failed:', {
    error: error.message,
    stack: error.stack,
    context: {
      userId: req.user?.id,
      operation: 'operationName'
    }
  });
  return res.status(500).json({
    message: 'An error occurred',
    code: 'OPERATION_FAILED'
  });
}

## Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/myprofile
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGIN=http://localhost:3000
```

## Project Structure

```
src/
├── config/         # Configuration files and environment setup
├── controllers/    # Request handlers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # Route definitions
├── services/       # Business logic
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc)
- `refactor:` - Code changes that neither fixes a bug nor adds a feature
- `perf:` - Code changes that improve performance
- `test:` - Adding missing tests
- `chore:` - Changes to the build process or auxiliary tools

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Error Handling

The API uses the following error status codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 422: Unprocessable Entity
- 500: Internal Server Error

## Frontend Integration

### Authentication Flow

1. **Registration**:
   ```typescript
   const response = await axios.post('/api/auth/register', {
     email: string,
     password: string,
     firstName: string,
     lastName: string
   });
   ```

2. **Login**:
   ```typescript
   const response = await axios.post('/api/auth/login', {
     email: string,
     password: string
   });
   // Store access token
   localStorage.setItem('accessToken', response.data.accessToken);
   ```

3. **Making Authenticated Requests**:
   ```typescript
   axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('accessToken')}`;
   ```

4. **Token Refresh**:
   ```typescript
   // Add axios interceptor for automatic token refresh
   axios.interceptors.response.use(
     (response) => response,
     async (error) => {
       if (error.response.status === 401) {
         const response = await axios.post('/api/auth/refresh-token');
         localStorage.setItem('accessToken', response.data.accessToken);
         error.config.headers['Authorization'] = `Bearer ${response.data.accessToken}`;
         return axios(error.config);
       }
       return Promise.reject(error);
     }
   );
   ```

## Security Considerations

1. **CORS Configuration**: The API is configured to accept requests only from whitelisted origins
2. **Rate Limiting**: API endpoints are protected against brute force attacks
3. **Input Validation**: All input is validated using Zod schemas
4. **Password Security**: Passwords are hashed using bcrypt with salt rounds
5. **Token Security**: JWTs are signed and verified with secure secrets

## Deployment

### Docker

```bash
# Build the image
docker build -t myprofile-backend .

# Run the container
docker run -p 5000:5000 myprofile-backend
```

### Manual Deployment

1. Set up environment variables
2. Install dependencies: `npm install --production`
3. Build the project: `npm run build`
4. Start the server: `npm start`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support
