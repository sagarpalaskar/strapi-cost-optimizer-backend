# Strapi Cost Optimizer Backend

NestJS backend for the Strapi Admin Clone frontend. This backend provides authentication and content management APIs.

## Features

- ✅ **Proxy User Pool System** - Cost-optimized Strapi integration
- ✅ JWT-based authentication with role assignment
- ✅ User registration and login
- ✅ Redis caching for proxy JWTs
- ✅ Automatic proxy JWT refresh
- ✅ Content type management (proxied to Strapi)
- ✅ Content item CRUD operations (proxied to Strapi)
- ✅ CORS enabled for frontend
- ✅ Input validation
- ✅ PostgreSQL database persistence

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis (for proxy JWT storage)
- **Authentication**: JWT with Passport
- **Validation**: class-validator, class-transformer
- **HTTP Client**: Axios (for Strapi integration)

## Installation

```bash
# Install dependencies (includes Swagger for API docs)
npm install

# Create .env file from template
# Windows PowerShell:
Copy-Item environment.template .env
# Or Windows CMD:
copy environment.template .env
# Or Linux/Mac:
cp environment.template .env

# Edit .env file and update:
# - Database credentials (DB_PASSWORD, etc.)
# - JWT_SECRET (use a strong random string)
# - Strapi proxy user passwords (must match Strapi)
# - Redis configuration if needed

# Make sure PostgreSQL and Redis are running
# Make sure database is created: CREATE DATABASE strapi_cost_optimizer;

# Run the application (tables will be auto-created)
npm run start:dev
```

After starting, Swagger docs will be available at: `http://localhost:3001/api-docs`

**Note:** 
- `.env` file is in `.gitignore` for security (contains passwords)
- Use `environment.template` as a reference
- In development mode, TypeORM automatically creates/updates database tables

## Prerequisites

- Node.js 18+
- PostgreSQL 12+ installed and running
- Redis installed and running (for proxy JWT caching)
- Strapi instance running (for content management)
- A PostgreSQL database created

### Setting up Strapi Proxy Users

Before starting the backend, you need to create 4 proxy users in Strapi:

1. **admin_proxy** - Full administrative access
2. **editor_proxy** - Can edit all content
3. **author_proxy** - Can create and edit own content
4. **viewer_proxy** - Read-only access

**Steps:**
1. Access Strapi admin panel: `http://localhost:1337/admin`
2. Go to Settings → Users (or create via API)
3. Create each proxy user with the usernames above
4. Set passwords matching your `.env` file (or update `.env` to match)
5. Assign appropriate roles/permissions in Strapi

**Note:** The backend will automatically authenticate all proxy users on startup and cache their JWTs in Redis.

### Setting up Redis

**Windows:**
- Download from [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or use WSL
- Or use Docker: `docker run -d -p 6379:6379 redis`

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### Setting up PostgreSQL Database

1. **Install PostgreSQL** (if not already installed):
   - Windows: Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Create a database**:
   ```sql
   CREATE DATABASE strapi_cost_optimizer;
   ```

   Or using psql command line:
   ```bash
   createdb strapi_cost_optimizer
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=strapi_cost_optimizer

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis Configuration (for proxy JWT caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Strapi Configuration (Required for proxy user system)
STRAPI_URL=http://localhost:1337

# Strapi Proxy User Passwords (create these users in Strapi first)
STRAPI_ADMIN_PROXY_PASSWORD=AdminProxy123!
STRAPI_EDITOR_PROXY_PASSWORD=EditorProxy123!
STRAPI_AUTHOR_PROXY_PASSWORD=AuthorProxy123!
STRAPI_VIEWER_PROXY_PASSWORD=ViewerProxy123!

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

**Important:** Update the database credentials to match your PostgreSQL setup!

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server will start on `http://localhost:3001`

**📚 Swagger API Documentation:** Once the server is running, visit `http://localhost:3001/api-docs` for interactive API documentation.

## API Endpoints

### Authentication (Public)

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Authentication (Protected - requires JWT token)

- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - Get all users (admin)

### Content Management (Protected - requires JWT token)

- `GET /api/content-types` - Get all content types
- `GET /api/content-types/:slug` - Get specific content type
- `GET /api/:contentType` - Get all items of a content type
- `GET /api/:contentType/:id` - Get specific content item
- `POST /api/:contentType` - Create new content item
- `PUT /api/:contentType/:id` - Update content item
- `DELETE /api/:contentType/:id` - Delete content item
- `POST /api/:contentType/duplicate/:id` - Duplicate content item

### Health Check

- `GET /health` - Health check endpoint

## Swagger API Documentation

Interactive API documentation is available at: **`http://localhost:3001/api-docs`**

### Features

- ✅ **Interactive API Testing** - Try endpoints directly from the browser
- ✅ **JWT Authentication** - Click "Authorize" button to add your JWT token
- ✅ **Request/Response Examples** - See example payloads and responses
- ✅ **All Endpoints Documented** - Authentication and Content management APIs

### How to Use

1. Start the backend: `npm run start:dev`
2. Open browser: `http://localhost:3001/api-docs`
3. Click **"Authorize"** button (lock icon)
4. Enter your JWT token (get it from login endpoint)
5. Click **"Authorize"** and **"Close"**
6. Now you can test all protected endpoints!

**Tip:** After logging in via `/api/auth/login`, copy the `jwt` from the response and use it in the Swagger authorization.

## Example Requests

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "password123",
    "firstname": "John",
    "lastname": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "john@example.com",
    "password": "password123"
  }'
```

### Get Content Types (Protected)
```bash
curl -X GET http://localhost:3001/api/content-types \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Project Structure

```
src/
├── auth/               # Authentication module
│   ├── dto/           # Data Transfer Objects
│   ├── guards/        # Auth guards
│   ├── strategies/    # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── content/           # Content management module
│   ├── content.controller.ts
│   ├── content.service.ts
│   └── content.module.ts
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

## Integration with Frontend

The frontend (`strapi-admin-clone`) should point to this backend:

1. Update frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

2. The frontend will automatically use this backend for all API calls.

## Strapi Integration (Optional)

If you want to proxy requests to Strapi:

1. Set `STRAPI_URL` in `.env`
2. Update `ContentService` to make real Strapi API calls
3. Currently uses mock data for development

## Development

```bash
# Watch mode
npm run start:dev

# Build
npm run build

# Format code
npm run format

# Lint
npm run lint

# Test
npm run test
```

## Proxy User Pool System

This backend implements a **cost-optimized proxy user system** for Strapi:

### How It Works

1. **Proxy Users in Strapi**: 4 generic proxy users (`admin_proxy`, `editor_proxy`, `author_proxy`, `viewer_proxy`)
2. **Role Mapping**: Application users are assigned roles (admin, editor, author, viewer) that map to proxy users
3. **JWT Caching**: Proxy JWTs are cached in Redis (automatically refreshed when expired)
4. **Request Forwarding**: All Strapi requests use the appropriate proxy JWT based on user role

### Flow

```
User Request → Validate Custom JWT → Extract Role → Get Proxy JWT from Redis → Forward to Strapi
```

### Benefits

- ✅ **Cost Optimization**: Only 4 users in Strapi regardless of application user count
- ✅ **Performance**: JWTs cached in Redis, no re-authentication per request
- ✅ **Security**: Custom JWT validation + Strapi permissions
- ✅ **Scalability**: Handle unlimited application users

## Database

The application uses **PostgreSQL** with TypeORM for data persistence.

### Database Entities

- **User** (`users` table) - User accounts and authentication
- **ContentType** (`content_types` table) - Content type definitions
- **ContentItem** (`content_items` table) - Content items/entries

### Auto-Seeding

On first startup, the application automatically seeds initial content types:
- Articles
- Products
- Pages

### Database Migrations

In development, TypeORM automatically synchronizes the schema (`synchronize: true`).
For production:
1. Disable `synchronize` in database configuration
2. Use TypeORM migrations: `npm run typeorm migration:generate`
3. Run migrations: `npm run typeorm migration:run`

## Notes

- Uses PostgreSQL for persistent data storage
- All content endpoints are protected with JWT authentication
- CORS is enabled for `http://localhost:3000` by default
- Tables are auto-created in development mode
