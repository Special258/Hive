# HIVE 2.0 Deployment Guide

HIVE is a real-time peer-to-peer skill-sharing platform built with Vanilla JS, Node.js, Express, and Socket.IO.

## Prerequisites
- **Node.js**: v18 or higher (tested on v25)
- **NPM**: v9 or higher

## Installation
From the root of the project, run:
```bash
npm install
```

## Runtime Dependencies
- `express`: Core web server
- `socket.io`: Real-time WebSockets for the Live Room
- `cors`: Cross-Origin Resource Sharing

*(Note: `puppeteer` is a development-only dependency used exclusively for QA scripts and E2E testing. It can be safely omitted in production.)*

## Configuration & Environment Variables
HIVE 2.0 currently runs natively without external environment variables.
- **Port:** The server runs on port `3001` by default. 
- **Data Location:** The application relies on a local JSON datastore located at `data/hive-data.json`. Ensure this file has read/write permissions for the Node process.

## Starting the Server
To start the production server:
```bash
node server.js
```
The application will be available at `http://localhost:3001` (or your reverse-proxy domain).

To run in the background (using a process manager like PM2):
```bash
pm2 start server.js --name "hive-backend"
```

## Admin Setup
1. The first administrator must be manually configured in `data/hive-data.json` by setting `"role": "admin"`.
2. Login with the configured email and password.
3. The Admin portal will become accessible at `/admin.html`.

## Security & Architecture Limitations (IMPORTANT)
**Local / Demo Suitability Only**
- **Authentication**: Authentication currently uses a rudimentary custom implementation relying on `x-user-email` headers and local `localStorage` tokens. It does not use signed JWTs or robust session stores.
- **Authorization**: API access controls rely heavily on client-side state and email matching. A sophisticated actor can forge headers. 
- **Database**: The datastore is a synchronous read/write JSON file (`data/hive-data.json`). This is NOT scalable for concurrent users and will experience race conditions under heavy load.
- **Production Recommendation**: Do not deploy this to the open internet with real user PII until the authentication system is migrated to Passport/JWT and the datastore is migrated to a real database (e.g., PostgreSQL or MongoDB).

## Backups
- **Process**: Stop the server and simply copy `data/hive-data.json` to a secure location.
- **Restore**: Overwrite `data/hive-data.json` and restart the server.
