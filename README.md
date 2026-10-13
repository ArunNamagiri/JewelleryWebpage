# Jewellery Shop

Full-stack jewellery store application with a React/Vite frontend and Node.js/Express backend using PostgreSQL/Supabase.

## Stack
- Frontend: React 19 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL / Supabase
- Authentication: JWT + bcrypt password hash
- Storage: Supabase Storage
- Security: Helmet, CORS allow-list, rate limiting, upload validation

## Project structure
```text
backend/
  src/server.js
  src/routes/admin.js
  src/middleware/adminAuth.js
  src/db/migrate.js
frontend/
  src/
```

## Backend setup
1. Open a terminal in `backend`.
2. Copy `.env.example` to `.env`.
3. Fill in the required environment variables.
4. Install dependencies:

```bash
npm install
```

5. Run the database migration:

```bash
npm run migrate
```

6. Start development server:

```bash
npm run dev
```

Production start:

```bash
npm start
```

The API runs on port 5000 by default.

## Frontend setup
Open a second terminal in `frontend`:

```bash
npm install
npm run dev
```

Vite normally serves the frontend at `http://localhost:5173`.

## Health check
Once the backend is running, open:

`http://localhost:5000/api/health`

A healthy response is:

```json
{ "success": true, "status": "healthy" }
```

## Security notes
- Never commit `.env` or paste its contents into source control.
- Use `.env.example` as the safe template.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `JWT_SECRET` private.
- Keep `DB_SSL_REJECT_UNAUTHORIZED=true` in production.
- Set `TRUST_PROXY=true` only when the application is actually behind a trusted reverse proxy.
- Do not expose database credentials in frontend environment variables.
- The admin password should only be stored as a bcrypt hash. Generate one with:

```bash
node src/scripts/hash-password.js "your-password"
```

## Important deployment configuration
Set `FRONTEND_URL` to the exact frontend origin(s), comma-separated if multiple origins are required. Avoid wildcard CORS for an authenticated API.

## Development
Backend and frontend are intentionally separate processes. Run both terminals during local development.

## Docker

The project can run as two containers: an Express API and an Nginx-served React frontend. The database remains external for now.

### Build and run

From the project root:

```bash
docker compose build
docker compose up -d
```

Frontend: http://localhost:8080
Backend health: http://localhost:5000/api/health

### Stop

```bash
docker compose down
```

For local secrets, keep `backend/.env` out of Git and Docker images. If the backend needs database/API credentials inside Compose, provide them through your local environment or an env file that is never committed.
