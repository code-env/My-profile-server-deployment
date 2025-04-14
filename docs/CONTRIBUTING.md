# Contributing Guide

## Development Setup

1. **Prerequisites**
   - Node.js (v18 or higher)
   - MongoDB
   - TypeScript knowledge
   - Git

2. **Environment Setup**
   ```bash
   npm install
   cp .env.example .env
   # Configure your .env file
   ```

## Coding Standards

### TypeScript
- Use strict mode
- Properly type all functions and variables
- Use interfaces for complex objects
- Document public APIs with JSDoc comments

### Code Style
- Use ESLint and Prettier configurations
- Follow naming conventions:
  - PascalCase for classes and interfaces
  - camelCase for variables and functions
  - UPPER_CASE for constants

### Git Workflow
1. Create feature branch from develop
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make changes and commit using conventional commits
   ```bash
   git commit -m "feat: add new feature"
   ```
3. Push and create PR to develop

### Testing
- Write unit tests for services
- Write integration tests for APIs
- Maintain test coverage above 80%

## Documentation
- Update API documentation for new endpoints
- Add JSDoc comments for new functions
- Update README.md if needed

## Code Review Process
1. Self-review your code
2. Request review from at least one team member
3. Address review comments
4. Squash commits before merging

## Release Process
[Add your release process here]
