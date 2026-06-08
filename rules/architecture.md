# Architecture Rules

## Directory Structure (enforce always)
```
fruitgate-pro/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── (dashboard)/layout.tsx       ← sidebar + topnav
│   ├── (dashboard)/page.tsx         ← dashboard home
│   ├── (dashboard)/containers/
│   ├── (dashboard)/documents/
│   ├── (dashboard)/shipments/
│   ├── (dashboard)/payments/
│   ├── (dashboard)/analytics/
│   ├── (dashboard)/settings/
│   └── api/
│       ├── containers/route.ts
│       ├── documents/route.ts
│       ├── payments/route.ts
│       ├── import/route.ts
│       └── analytics/route.ts
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/TopNav.tsx
│   ├── layout/PageHeader.tsx
│   ├── containers/
│   ├── documents/
│   ├── dashboard/
│   └── ui/                          ← shadcn components
├── lib/
│   ├── supabase.ts
│   ├── prisma.ts
│   └── utils.ts
├── hooks/
│   ├── useContainers.ts
│   ├── useDocuments.ts
│   └── usePayments.ts
├── types/index.ts
├── prisma/schema.prisma
└── .env.local
```

## Import Rules
- Use `@/` path alias for all internal imports
- Never import Prisma client directly in components — use API routes or server actions
- Supabase client: use `createClientComponentClient` in components, `createServerComponentClient` in server components

## State Management
- Server state (data from DB): fetch in server components or via SWR/React Query
- Client state (UI state, filters): Zustand store
- Form state: react-hook-form

## Error Handling
- All API routes: return `{ error: string }` with appropriate HTTP status
- All client fetches: handle error state and show toast
- Never expose Prisma errors directly to the client

## Multi-tenancy
- Every Prisma query that touches user data MUST include `where: { org_id: session.org_id }`
- RLS enabled in Supabase as backup, but app-level enforcement is primary
