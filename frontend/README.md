# Jewellery Frontend

React/Vite frontend for the Jewellery Shop application.

## Run locally

```bash
npm install
npm run dev
```

The frontend defaults to `http://localhost:5000` for the backend API. To override it, create `frontend/.env` from `.env.example`:

```env
VITE_API_URL=http://localhost:5000
```

Only public frontend configuration belongs in `VITE_*` variables. Never put database passwords, Supabase service-role keys, JWT secrets, or other server secrets in a Vite environment variable.
