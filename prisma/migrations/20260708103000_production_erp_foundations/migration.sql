-- Production-grade ERP foundations: outbound email, GST/Tally metadata,
-- FX rates, procurement purchase orders, and CRM activity history.

alter table "sales_invoices"
  add column if not exists "supplier_gstin" text,
  add column if not exists "customer_gstin" text,
  add column if not exists "place_of_supply" text,
  add column if not exists "irn" text,
  add column if not exists "e_invoice_ack_no" text,
  add column if not exists "e_invoice_qr" text,
  add column if not exists "tally_exported_at" timestamp(3);

alter table "sales_invoice_lines"
  add column if not exists "hsn_code" text;

alter table "credit_notes"
  add column if not exists "irn" text,
  add column if not exists "e_invoice_qr" text,
  add column if not exists "tally_exported_at" timestamp(3);

create table if not exists "crm_activities" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "customer_id" text,
  "lead_id" text,
  "opportunity_id" text,
  "owner_id" text,
  "kind" text not null,
  "direction" text default 'Outbound',
  "subject" text not null,
  "body" text,
  "occurred_at" timestamp(3) not null default current_timestamp,
  "next_action_at" timestamp(3),
  "external_ref" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "crm_activities_pkey" primary key ("id")
);

alter table "crm_activities" add constraint "crm_activities_org_id_fkey" foreign key ("org_id") references "organizations"("id") on delete cascade on update cascade;
alter table "crm_activities" add constraint "crm_activities_customer_id_fkey" foreign key ("customer_id") references "customers"("id") on delete set null on update cascade;
alter table "crm_activities" add constraint "crm_activities_lead_id_fkey" foreign key ("lead_id") references "crm_leads"("id") on delete set null on update cascade;
alter table "crm_activities" add constraint "crm_activities_opportunity_id_fkey" foreign key ("opportunity_id") references "crm_opportunities"("id") on delete set null on update cascade;
alter table "crm_activities" add constraint "crm_activities_owner_id_fkey" foreign key ("owner_id") references "users"("id") on delete set null on update cascade;

create index if not exists "crm_activities_org_id_idx" on "crm_activities"("org_id");
create index if not exists "crm_activities_customer_id_idx" on "crm_activities"("customer_id");
create index if not exists "crm_activities_lead_id_idx" on "crm_activities"("lead_id");
create index if not exists "crm_activities_opportunity_id_idx" on "crm_activities"("opportunity_id");
create index if not exists "crm_activities_owner_id_idx" on "crm_activities"("owner_id");
create index if not exists "crm_activities_occurred_at_idx" on "crm_activities"("occurred_at");

create table if not exists "email_outbox" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "to_email" text not null,
  "cc_email" text,
  "subject" text not null,
  "text_body" text,
  "html_body" text,
  "category" text not null,
  "status" text not null default 'Pending',
  "attempts" integer not null default 0,
  "last_error" text,
  "provider" text,
  "provider_id" text,
  "scheduled_at" timestamp(3) not null default current_timestamp,
  "sent_at" timestamp(3),
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "email_outbox_pkey" primary key ("id")
);

alter table "email_outbox" add constraint "email_outbox_org_id_fkey" foreign key ("org_id") references "organizations"("id") on delete cascade on update cascade;
create index if not exists "email_outbox_org_id_idx" on "email_outbox"("org_id");
create index if not exists "email_outbox_status_scheduled_at_idx" on "email_outbox"("status", "scheduled_at");
create index if not exists "email_outbox_category_idx" on "email_outbox"("category");

create table if not exists "fx_rates" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "rate_date" timestamp(3) not null,
  "from_currency" "Currency" not null,
  "to_currency" "Currency" not null,
  "rate" numeric(14,6) not null,
  "source" text not null default 'Manual',
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "fx_rates_pkey" primary key ("id")
);

alter table "fx_rates" add constraint "fx_rates_org_id_fkey" foreign key ("org_id") references "organizations"("id") on delete cascade on update cascade;
create unique index if not exists "fx_rates_org_id_rate_date_from_currency_to_currency_key" on "fx_rates"("org_id", "rate_date", "from_currency", "to_currency");
create index if not exists "fx_rates_org_id_idx" on "fx_rates"("org_id");
create index if not exists "fx_rates_rate_date_idx" on "fx_rates"("rate_date");

create table if not exists "purchase_orders" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "po_no" text not null,
  "supplier_id" text not null,
  "container_id" text,
  "po_date" timestamp(3) not null,
  "status" text not null default 'Draft',
  "currency" "Currency" not null default 'USD',
  "estimated_goods_value" numeric(14,2) not null default 0,
  "estimated_freight" numeric(14,2) not null default 0,
  "estimated_duties" numeric(14,2) not null default 0,
  "estimated_local_costs" numeric(14,2) not null default 0,
  "actual_landed_cost" numeric(14,2),
  "variance_amount" numeric(14,2),
  "advance_paid_amount" numeric(14,2),
  "notes" text,
  "created_by_id" text,
  "approved_at" timestamp(3),
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "purchase_orders_pkey" primary key ("id")
);

alter table "purchase_orders" add constraint "purchase_orders_org_id_fkey" foreign key ("org_id") references "organizations"("id") on delete cascade on update cascade;
alter table "purchase_orders" add constraint "purchase_orders_supplier_id_fkey" foreign key ("supplier_id") references "suppliers"("id") on delete restrict on update cascade;
alter table "purchase_orders" add constraint "purchase_orders_container_id_fkey" foreign key ("container_id") references "containers"("id") on delete set null on update cascade;
create unique index if not exists "purchase_orders_org_id_po_no_key" on "purchase_orders"("org_id", "po_no");
create index if not exists "purchase_orders_org_id_idx" on "purchase_orders"("org_id");
create index if not exists "purchase_orders_supplier_id_idx" on "purchase_orders"("supplier_id");
create index if not exists "purchase_orders_container_id_idx" on "purchase_orders"("container_id");
create index if not exists "purchase_orders_status_idx" on "purchase_orders"("status");

create table if not exists "purchase_order_lines" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "purchase_order_id" text not null,
  "line_no" integer not null,
  "item" text not null,
  "variety" text,
  "pack_spec" text,
  "qty" numeric(14,3) not null,
  "uom" text not null default 'Box',
  "unit_cost" numeric(14,2) not null,
  "line_total" numeric(14,2) not null,
  "hsn_code" text,
  "notes" text,
  "created_at" timestamp(3) not null default current_timestamp,
  constraint "purchase_order_lines_pkey" primary key ("id")
);

alter table "purchase_order_lines" add constraint "purchase_order_lines_org_id_fkey" foreign key ("org_id") references "organizations"("id") on delete cascade on update cascade;
alter table "purchase_order_lines" add constraint "purchase_order_lines_purchase_order_id_fkey" foreign key ("purchase_order_id") references "purchase_orders"("id") on delete cascade on update cascade;
create unique index if not exists "purchase_order_lines_purchase_order_id_line_no_key" on "purchase_order_lines"("purchase_order_id", "line_no");
create index if not exists "purchase_order_lines_org_id_idx" on "purchase_order_lines"("org_id");
create index if not exists "purchase_order_lines_purchase_order_id_idx" on "purchase_order_lines"("purchase_order_id");
