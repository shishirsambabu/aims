-- Deny direct anon/authenticated API access to every AIMS ERP table.
-- The server-side Prisma connection uses the database owner role.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','users','suppliers','warehouses','containers',
    'stock_items','stock_movements','gate_passes','gate_pass_lines',
    'customers','customer_contacts','customer_kyc_documents',
    'price_lists','price_list_items','sales_orders','sales_order_lines',
    'sales_order_revisions','crm_leads','crm_opportunities','crm_tasks',
    'sales_quotes','sales_quote_lines','sales_quote_revisions',
    'warehouse_locations','warehouse_cycle_counts','warehouse_cycle_count_lines',
    'customer_receipts','customer_receipt_allocations','shipment_items',
    'container_costs','sales','payments','documents','activity_log',
    'user_alert_preferences','user_alert_states','document_automation_jobs',
    'integration_connections','integration_runs','integration_errors',
    'external_references'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS aims_no_direct_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY aims_no_direct_access ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
