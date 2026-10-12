# StudentMate backend — MongoDB Atlas + Render

This is the API only. The current StudentMate frontend still saves in localStorage until its login and sync integration are added after deployment. Do not paste database passwords into chat or GitHub.

## Deploy step by step

1. Extract this ZIP. Create a GitHub repository named `studentmate-backend` and upload its contents. `package.json`, `server.js` and `render.yaml` must be at the repository root. Include `.gitignore` and `package-lock.json`; never upload `.env` or `node_modules`.
2. In MongoDB Atlas, create a dedicated database user with `readWrite` access to the `studentmate` database only. Use that user's credentials, not your Atlas account login. Keep other project databases separate.
3. In Render: New → Web Service → connect the GitHub repository. Runtime: Node. Build command: `npm ci`. Start command: `npm start`. Health check: `/health`. Choose an available region and the instance plan you intend to use. The supplied optional Blueprint uses the Free plan.
4. Add these environment variables in Render (not GitHub):

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Your Atlas driver connection string with the dedicated database user's password filled in. URL-encode special characters in the username/password. |
| `MONGODB_DB` | `studentmate` |
| `ALLOWED_ORIGINS` | `https://studentmate-master.openpond.chatgpt.site` |
| `NODE_ENV` | `production` |

Render supplies `PORT`; do not set it manually there.

5. In the Render service's Connect → Outbound section, copy every listed outbound IP/CIDR range and add it to Atlas Database & Network Access → IP Access List. This allows the backend to reach Atlas. If the first deploy fails while access is being configured, redeploy after the changes take effect.
6. Open `https://YOUR-SERVICE.onrender.com/health`. Success returns `{"status":"ok","database":"connected"}`. This checks an actual database ping.
7. Give Boo the Render service URL (not the connection string or password). The next step is to add frontend register/login, authenticated cloud saves, conflict handling, and an explicit option to import existing local records. Until then, the live frontend remains local-only.

## Local development

Use Node.js 22 or newer. Run `npm ci`. Copy `.env.example` to `.env` and fill in your own secrets. Add `http://localhost:...` to `ALLOWED_ORIGINS` if testing a local frontend, and authorize your development machine's IP in Atlas. Run `npm run dev`.

## API contract

All payloads are JSON. Register/login return an opaque token with a seven-day expiry. Send it as `Authorization: Bearer TOKEN` on authenticated requests. Passwords are hashed with scrypt; session tokens are hashed before storage. Logout deletes the session. Data access is always limited to the signed-in user. CORS restricts browser origins but authentication protects the API independently.

| Method | Endpoint | Body / response |
| --- | --- | --- |
| GET | `/health` | Database readiness |
| POST | `/api/auth/register` | `{name,email,password}`; password 12–128 characters |
| POST | `/api/auth/login` | `{email,password}` |
| POST | `/api/auth/logout` | Authenticated; revokes token |
| GET | `/api/workspace` | Authenticated; returns `{data,revision}` |
| PUT | `/api/workspace` | Authenticated; body `{data,revision}`; returns next revision |

Workspace contains `name`, `subjects`, `tasks`, `notes`, `schedule`, `sessions`, `focus`, and `break`, using the current frontend format. PUT replaces the signed-in user's workspace only. Revision checks prevent silent overwrites from another device: a stale revision returns HTTP 409. Import/export backups belong to the frontend. The API does not silently import existing browser records.

The API creates an email uniqueness index and TTL session expiry index at startup. Authentication and API rate limits are in-memory per instance. Email verification and password reset are not implemented in this initial backend.

## Checks

`npm test` verifies password hashing, payload validation, authenticated access, per-user isolation and revision conflicts using a local test database stub. It does not claim an Atlas connection; `/health` after deployment verifies that separately.
