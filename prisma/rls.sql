-- AIMS — Supabase Row Level Security (defense in depth)
-- The app enforces org scoping at the application layer (every Prisma query
-- includes org_id). Prisma connects with the service role and BYPASSES RLS, so
-- these policies protect the database from direct anon/authenticated API access
-- (e.g. someone using the public anon key against the REST/GraphQL endpoints).
--
-- Run this ONCE in the Supabase SQL Editor.
-- It enables RLS and denies the anon/authenticated roles all direct table access;
-- the app keeps working because it goes through Prisma (service role).

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','suppliers','containers','shipment_items',
    'container_costs','sales','payments','documents','activity_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    -- Drop any prior AIMS policy, then deny direct anon/authenticated access.
    execute format('drop policy if exists aims_no_direct_access on public.%I;', t);
    execute format(
      'create policy aims_no_direct_access on public.%I for all to anon, authenticated using (false) with check (false);',
      t
    );
  end loop;
end $$;

-- Storage: keep the documents bucket PRIVATE. In the Supabase dashboard:
--   Storage → aims-documents → make bucket Private (no public access).
-- The app serves files via short-lived signed URLs (/api/documents/[id]/file).
