# Hive Project Backend

This backend provides the API for the Hive skill exchange platform.

## Setup

1. Copy `.env.example` to `.env` and update values if needed.
2. Start MongoDB locally or use a MongoDB Atlas connection string.
3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

## Available endpoints

- `GET /api/health` – health check
- `POST /api/auth/register` – register a new user
- `POST /api/auth/login` – login user
- `GET /api/auth/me` – get current logged-in user
- `GET /api/users` – list users
- `GET /api/users/:id` – get one user
- `PUT /api/users/profile` – update profile
- `POST /api/matching/request` – create a match request
- `GET /api/matching` – list match records
- `GET /api/matching/suggestions` – get suggested matches
- `PUT /api/matching/:id/status` – update match status
- `GET /api/admin/stats` – admin dashboard stats
- `GET /api/admin/users` – admin user list

## Notes

The app expects MongoDB to be running. If you are using a remote MongoDB instance, update `MONGO_URI` in the `.env` file.
