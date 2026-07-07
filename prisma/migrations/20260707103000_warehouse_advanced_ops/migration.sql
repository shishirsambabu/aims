-- Advanced warehouse/cold-storage operating controls.

create table if not exists public.dock_appointments (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  container_id text references public.containers(id) on delete set null,
  appointment_no text not null,
  bay_code text not null,
  scheduled_start timestamp(3) not null,
  scheduled_end timestamp(3) not null,
  status text not null default 'Scheduled',
  unloading_started_at timestamp(3),
  unloading_completed_at timestamp(3),
  vehicle_no text,
  driver_name text,
  notes text,
  created_by_id text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint dock_appointments_org_no_key unique (org_id, appointment_no)
);

create index if not exists dock_appointments_org_id_idx on public.dock_appointments(org_id);
create index if not exists dock_appointments_warehouse_id_idx on public.dock_appointments(warehouse_id);
create index if not exists dock_appointments_container_id_idx on public.dock_appointments(container_id);
create index if not exists dock_appointments_scheduled_start_idx on public.dock_appointments(scheduled_start);

create table if not exists public.warehouse_putaway_rules (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  location_id text not null references public.warehouse_locations(id) on delete cascade,
  product text not null,
  variety text,
  ripening_state text,
  temperature_min_c numeric(5,2),
  temperature_max_c numeric(5,2),
  fefo_max_days integer,
  priority integer not null default 100,
  is_active boolean not null default true,
  notes text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

create index if not exists warehouse_putaway_rules_org_id_idx on public.warehouse_putaway_rules(org_id);
create index if not exists warehouse_putaway_rules_warehouse_id_idx on public.warehouse_putaway_rules(warehouse_id);
create index if not exists warehouse_putaway_rules_location_id_idx on public.warehouse_putaway_rules(location_id);
create index if not exists warehouse_putaway_rules_product_idx on public.warehouse_putaway_rules(product);

create table if not exists public.repacking_work_orders (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  source_stock_item_id text not null references public.stock_items(id) on delete cascade,
  work_order_no text not null,
  output_item text not null,
  output_grade text,
  pack_spec text,
  planned_input_qty numeric(14,3) not null,
  actual_input_qty numeric(14,3),
  output_qty numeric(14,3),
  wastage_qty numeric(14,3),
  labor_hours numeric(10,2),
  worker_count integer,
  status text not null default 'Draft',
  started_at timestamp(3),
  completed_at timestamp(3),
  notes text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint repacking_work_orders_org_no_key unique (org_id, work_order_no)
);

create index if not exists repacking_work_orders_org_id_idx on public.repacking_work_orders(org_id);
create index if not exists repacking_work_orders_warehouse_id_idx on public.repacking_work_orders(warehouse_id);
create index if not exists repacking_work_orders_source_stock_item_id_idx on public.repacking_work_orders(source_stock_item_id);
create index if not exists repacking_work_orders_status_idx on public.repacking_work_orders(status);

create table if not exists public.qc_sampling_plans (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  stock_item_id text not null references public.stock_items(id) on delete cascade,
  plan_no text not null,
  sample_size integer not null,
  defect_class text,
  defect_count integer not null default 0,
  severity text not null default 'Normal',
  photo_ref text,
  disposition text not null default 'Pending',
  status text not null default 'Open',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint qc_sampling_plans_org_no_key unique (org_id, plan_no)
);

create index if not exists qc_sampling_plans_org_id_idx on public.qc_sampling_plans(org_id);
create index if not exists qc_sampling_plans_warehouse_id_idx on public.qc_sampling_plans(warehouse_id);
create index if not exists qc_sampling_plans_stock_item_id_idx on public.qc_sampling_plans(stock_item_id);
create index if not exists qc_sampling_plans_status_idx on public.qc_sampling_plans(status);

create table if not exists public.warehouse_productivity_logs (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  shift_date timestamp(3) not null,
  shift_name text not null,
  role text not null,
  worker_name text not null,
  task_type text not null,
  qty_handled numeric(14,3) not null,
  uom text not null,
  hours_worked numeric(10,2) not null,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

create index if not exists warehouse_productivity_logs_org_id_idx on public.warehouse_productivity_logs(org_id);
create index if not exists warehouse_productivity_logs_warehouse_id_idx on public.warehouse_productivity_logs(warehouse_id);
create index if not exists warehouse_productivity_logs_shift_date_idx on public.warehouse_productivity_logs(shift_date);
create index if not exists warehouse_productivity_logs_role_idx on public.warehouse_productivity_logs(role);

create table if not exists public.warehouse_exception_approvals (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  warehouse_id text not null references public.warehouses(id) on delete cascade,
  ref_type text not null,
  ref_id text,
  exception_type text not null,
  qty numeric(14,3),
  value_amount numeric(14,2),
  reason text not null,
  status text not null default 'Pending',
  requested_by_id text,
  reviewed_by_id text,
  reviewed_at timestamp(3),
  review_notes text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

create index if not exists warehouse_exception_approvals_org_id_idx on public.warehouse_exception_approvals(org_id);
create index if not exists warehouse_exception_approvals_warehouse_id_idx on public.warehouse_exception_approvals(warehouse_id);
create index if not exists warehouse_exception_approvals_status_idx on public.warehouse_exception_approvals(status);
create index if not exists warehouse_exception_approvals_exception_type_idx on public.warehouse_exception_approvals(exception_type);

create table if not exists public.supplier_claims (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  supplier_id text references public.suppliers(id) on delete set null,
  container_id text references public.containers(id) on delete set null,
  stock_item_id text references public.stock_items(id) on delete set null,
  claim_no text not null,
  claim_type text not null,
  claim_amount numeric(14,2),
  currency text not null default 'USD',
  wastage_qty numeric(14,3),
  qc_photo_ref text,
  status text not null default 'Draft',
  notes text,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint supplier_claims_org_no_key unique (org_id, claim_no)
);

create index if not exists supplier_claims_org_id_idx on public.supplier_claims(org_id);
create index if not exists supplier_claims_supplier_id_idx on public.supplier_claims(supplier_id);
create index if not exists supplier_claims_container_id_idx on public.supplier_claims(container_id);
create index if not exists supplier_claims_stock_item_id_idx on public.supplier_claims(stock_item_id);
create index if not exists supplier_claims_status_idx on public.supplier_claims(status);
