# Azure Easy Auth & Session Management Implementation

## Overview

This implementation adds Azure Easy Auth support and session management to the application. The system can now authenticate users via:
1. **Azure Easy Auth** - Using `X-MS-CLIENT-PRINCIPAL` header (when deployed to Azure App Service)
2. **JWT Authentication** - Traditional JWT tokens (existing functionality)

## Components Created

### 1. Azure Easy Auth Strategy (`src/auth/strategies/azure-easy-auth.strategy.ts`)
- Reads and decodes the `X-MS-CLIENT-PRINCIPAL` header (base64 JSON)
- Extracts user information from Azure claims
- Looks up user in database by `authKey` or `email`
- Automatically updates `authKey` if not set
- Maps Azure roles to application roles

### 2. Session Service (`src/auth/services/session.service.ts`)
- Manages user sessions in-memory (can be migrated to Redis/database)
- Creates, validates, and destroys sessions
- Tracks session statistics
- Automatic cleanup of expired sessions (24 hours inactivity)

### 3. Authentication Guards

#### Azure Easy Auth Guard (`src/auth/guards/azure-easy-auth.guard.ts`)
- Activates only when `X-MS-CLIENT-PRINCIPAL` header is present
- Creates session automatically upon successful authentication

#### Combined Auth Guard (`src/auth/guards/combined-auth.guard.ts`)
- Tries Azure Easy Auth first (if header present)
- Falls back to JWT authentication
- Allows both authentication methods to work seamlessly

## How It Works

### Azure Easy Auth Flow

1. **Request arrives** with `X-MS-CLIENT-PRINCIPAL` header
2. **Header is decoded** from base64 to JSON
3. **User lookup** in database by:
   - `authKey` (from Azure name identifier claim)
   - `email` (from Azure email claim)
4. **Session created** automatically
5. **User authenticated** and request proceeds

### Session Management

- **Session Creation**: Automatically created on login/register/Azure auth
- **Session Validation**: Validates user still exists and is not blocked
- **Session Destruction**: Logout endpoint destroys all user sessions
- **Session Expiration**: Sessions expire after 24 hours of inactivity

## Database Changes

### User Entity
- Added `authKey` column (varchar, nullable)
  - Stores Azure user identifier
  - Used for Azure Easy Auth lookup
  - Auto-populated on first Azure authentication

## API Endpoints

### New Endpoints

#### `POST /api/auth/logout`
- Destroys all sessions for the authenticated user
- Requires authentication (JWT or Azure Easy Auth)
- Returns: `{ message: string, sessionsDestroyed: number }`

#### `GET /api/auth/sessions/stats` (Admin only)
- Returns session statistics
- Requires admin role
- Returns: `{ totalSessions: number, activeUsers: number }`

### Updated Endpoints

#### `POST /api/auth/register`
- Now returns `sessionId` in response
- Response: `{ jwt, user, sessionId }`

#### `POST /api/auth/login`
- Now returns `sessionId` in response
- Response: `{ jwt, user, sessionId }`

#### `GET /api/auth/me`
- Now supports both JWT and Azure Easy Auth
- Uses `CombinedAuthGuard` for flexible authentication

## Usage Examples

### Using Azure Easy Auth

When deployed to Azure App Service with Easy Auth enabled:
- No changes needed in frontend code
- Azure automatically adds `X-MS-CLIENT-PRINCIPAL` header
- Application automatically authenticates user

### Using JWT (Existing)

Continue using JWT tokens as before:
```bash
Authorization: Bearer <jwt-token>
```

### Using Combined Guard

```typescript
@UseGuards(CombinedAuthGuard)
@Get('protected-endpoint')
async protectedEndpoint(@Request() req) {
  // req.user is available from either auth method
  return { user: req.user };
}
```

## Configuration

### Environment Variables

No new environment variables required. The system works out of the box.

### Azure App Service Setup

1. Enable Easy Auth in Azure App Service
2. Configure authentication provider (Azure AD, etc.)
3. Deploy application
4. Users will be automatically authenticated via `X-MS-CLIENT-PRINCIPAL` header

## Session Storage

Currently, sessions are stored in-memory. For production, consider:

1. **Redis** (Recommended)
   - Update `SessionService` to use Redis
   - Better for multi-instance deployments
   - Automatic expiration support

2. **Database**
   - Create `Session` entity
   - Store sessions in PostgreSQL
   - Better for audit trails

## Security Considerations

1. **authKey** is automatically set from Azure claims
2. **User lookup** validates user exists and is not blocked
3. **Sessions** expire after 24 hours of inactivity
4. **Logout** destroys all user sessions
5. **Role mapping** from Azure roles to application roles

## Testing

### Test Azure Easy Auth Locally

You can test Azure Easy Auth locally by adding the header manually:

```bash
curl -H "X-MS-CLIENT-PRINCIPAL: <base64-encoded-json>" http://localhost:3001/api/auth/me
```

Example header value (base64 encoded):
```json
{
  "auth_typ": "aad",
  "name_typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "role_typ": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  "claims": [
    {
      "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "val": "user@example.com"
    },
    {
      "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      "val": "azure-user-id-123"
    }
  ]
}
```

## Migration Notes

- Existing JWT authentication continues to work
- New `authKey` column is nullable (existing users unaffected)
- Sessions are optional (can be used for logout/tracking)
- Azure Easy Auth is optional (only activates when header present)

