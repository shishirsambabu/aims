# AIMS — Project Memory

## Project Identity
- **Name**: AIMS
- **Full name**: AIMS — Import Management System by Aeden Fruits International Pvt Ltd
- **Purpose**: Internal SaaS for managing fruit container imports: tracking, costing, documentation, profit analysis
- **Owner**: Aeden Fruits International Pvt Ltd, Kochi, Kerala, India

## Tech Stack (NON-NEGOTIABLE — never change without explicit user approval)
- Framework: Next.js 14 (App Router) + TypeScript
- Styling: Tailwind CSS + Shadcn/ui
- Database: Supabase (PostgreSQL) + Prisma ORM
- Auth: Supabase Auth (email/password + magic link)
- State: Zustand
- Tables: TanStack Table v8
- Charts: Recharts
- File Storage: Supabase Storage
- Deploy: Vercel

## UI Design System (STRICT — enforce across all agents)
- Primary color: #0070D2 (Salesforce blue)
- Sidebar: #16325C (dark navy)
- Danger/Loss: #C23934 (red)
- Success/Profit: #2E844A (green)
- Warning: #FFB75D
- Font: DM Sans (headers) + Inter (body) + JetBrains Mono (financial figures)
- Style: Enterprise-grade, Salesforce Lightning-inspired. NEVER generic/plain.

## Domain Rules (critical business logic)
- Every container has BOTH a Container No AND a BL No — both are always searchable and cross-linked
- Currency: USD and AED for imports; INR for local costs and profits
- Ports: Bangalore (INENR1), Mumbai (INNSA1), Kochi (INCOK1/INMAA1)
- Customers: AEDEN (main), NKA
- Key suppliers: COSMOS GROUP, BASSTION FRUIT, AGRO CITY IMPORT & EXPORT, FRESHGOLD SA EXPORTS, UNITED EXPORTS LIMITED, DELTA AGRAR DOO, QINGDAO BLUE BOAT, EVERFRESH AGRICULTURAL TECHNOLOGY, SNAZZY FRUIT COMPANY
- Profit color rule: green > 10% margin, yellow 0–10%, red < 0%
- Document completeness score shown on every container (X/9 docs)

## Container Status Pipeline (in order)
Booked → In Transit → At Port → Customs Clearance → Cleared → In Warehouse → Partially Sold → Fully Sold

## User Roles
- admin: full CRUD + team management
- manager: full CRUD, no team settings
- viewer: read-only

## Modules (all required, build in phase order)
1. Auth & Team Management
2. Container Tracker (core module — 7-tab detail page)
3. Document Manager (linked to containers via Container No + BL No)
4. Shipment Kanban (drag-and-drop pipeline)
5. Payments Tracker
6. Analytics Dashboard (KPI cards + Recharts)
7. Excel Import (from existing tracker sheet)

## File Naming Conventions
- Components: PascalCase (ContainerTable.tsx)
- Hooks: camelCase with use prefix (useContainers.ts)
- API routes: kebab-case (container-costs/route.ts)
- DB tables: snake_case (container_costs)
- Env vars: UPPER_SNAKE_CASE

## Current Phase
@.claude/PROGRESS.md

## Architecture Reference
@.claude/rules/architecture.md

## Agent Registry
@.claude/AGENT_REGISTRY.md
