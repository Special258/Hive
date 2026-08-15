# HIVE 2.0 - Core Architectural Rules & Design Guidelines

When working in this repository, strictly adhere to the following principles:

## 1. Architectural Constraints
- **Stack**: Maintain the existing hybrid architecture (Vanilla JavaScript on the frontend, Node.js/Express on the backend). Do NOT migrate the entire project to React.
- **Data Persistence**: The source of truth is the local flat-file database (`data/hive-data.json`). Maintain this portable paradigm.
- **Real-Time Strategy**: Only use Socket.IO for features that genuinely benefit from it (Live Sessions, Participant Updates, Admin Actions). Use standard API fetching for generic analytics.

## 2. Security & Moderation
- **Authorization**: Always enforce role-based access control (RBAC) on the server side (`requireAdmin`). Return strict `401 Unauthorized` or `403 Forbidden` status codes. Never rely solely on frontend UI hiding for secure endpoints.

## 3. Design Aesthetics
- **Visual Excellence**: HIVE is a modern, premium Skill Exchange platform. Do not fall back to generic templates or a basic MVP look.
- **Styling**: Use vibrant, harmonious color palettes, modern typography, and smooth gradients. 
- **Interactivity**: Add subtle micro-animations (e.g. hover states, transitions) to make the UI feel alive and responsive across all device sizes.

## 4. Development Workflow
- Follow this systematic approach for all modifications: `INSPECT -> UNDERSTAND -> AUDIT -> PLAN -> IMPLEMENT -> TEST -> FIX -> POLISH`.
- **Zero Destruction**: Do NOT blindly rewrite the application or remove working functionality unless strictly instructed.
- **Comprehensive E2E Verification**: Before finalizing any major changes, verify data persistence, authentication states, and UI responsiveness.
