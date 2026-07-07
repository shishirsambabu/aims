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
    'organizations','users','suppliers','warehouses','containers',
    'stock_items','stock_movements','gate_passes','gate_pass_lines',
    'customers','customer_contacts','customer_kyc_documents',
    'price_lists','price_list_items','sales_orders','sales_order_lines',
    'sales_order_revisions','crm_leads','crm_opportunities','crm_tasks',
    'sales_quotes','sales_quote_lines','sales_quote_revisions',
    'warehouse_locations','warehouse_cycle_counts','warehouse_cycle_count_lines',
    'customer_receipts','customer_receipt_allocations',
    'sales_invoices','sales_invoice_lines','sales_returns','sales_return_lines','credit_notes',
    'bank_statement_lines','journal_entries','journal_entry_lines',
    'finance_period_closes','customer_disputes',
    'cold_room_readings','temperature_breach_tasks',
    'shipment_items',
    'container_costs','sales','payments','documents','activity_log',
    'user_alert_preferences','user_alert_states','document_automation_jobs',
    'integration_connections','integration_runs','integration_errors',
    'external_references'
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
