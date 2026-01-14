# Cloud Drive Backend

Cloud-based media storage backend API built with Express.js and Supabase.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **Authentication**: JWT with httpOnly cookies

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account with project created

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your Supabase credentials

4. Run database migration:

   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `migrations/001-initial-schema.sql`
   - Execute the SQL

5. Create storage bucket:

   - Supabase Dashboard → Storage
   - Create bucket named `drive` (private)

6. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Health Check

- `GET /health` - Server health status

### Authentication (Day 2)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Files (Day 3)

- `POST /api/files/init` - Initialize file upload
- `POST /api/files/complete` - Complete file upload
- `GET /api/files/:id` - Get file details
- `PATCH /api/files/:id` - Update file
- `DELETE /api/files/:id` - Delete file

### Folders (Day 4)

- `POST /api/folders` - Create folder
- `GET /api/folders/:id` - Get folder contents
- `PATCH /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Sharing (Day 5)

- `POST /api/shares` - Share resource
- `GET /api/shares/:type/:id` - Get shares
- `DELETE /api/shares/:id` - Revoke share
- `POST /api/link-shares` - Create public link

### Utilities (Day 6)

- `GET /api/search` - Search files/folders
- `POST /api/stars` - Star item
- `DELETE /api/stars` - Unstar item
- `GET /api/trash` - Get trash items

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js          # Environment config
│   │   └── supabase.js     # Supabase client
│   ├── middleware/
│   │   ├── auth.js         # JWT auth middleware
│   │   ├── error-handler.js # Error handling
│   │   └── rate-limit.js   # Rate limiting
│   ├── routes/
│   │   └── index.js        # Route definitions
│   └── app.js              # Express app
├── migrations/
│   └── 001-initial-schema.sql
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `NODE_ENV`                  | Environment (development/production) |
| `PORT`                      | Server port (default: 3001)          |
| `JWT_SECRET`                | Secret for access tokens             |
| `JWT_REFRESH_SECRET`        | Secret for refresh tokens            |
| `SUPABASE_URL`              | Supabase project URL                 |
| `SUPABASE_ANON_KEY`         | Supabase anon key                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key            |
| `SUPABASE_STORAGE_BUCKET`   | Storage bucket name                  |
| `CORS_ORIGIN`               | Allowed frontend origin              |

## License

MIT
