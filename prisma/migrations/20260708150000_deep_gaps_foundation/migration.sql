-- Deep-gaps foundation (DEEP_GAPS_AUDIT.md):
-- A1 item/product master (+ backfill from free-text names),
-- D3 feature flags, B1 idempotency keys,
-- E2 approval delegations, E5 DPDP data-deletion requests.
-- Fully idempotent: safe to run via SQL editor and via `prisma migrate deploy`.

-- ---------------------------------------------------------------------------
-- A1. Item master
-- ---------------------------------------------------------------------------
create table if not exists "items" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "code" text not null,
  "name" text not null,
  "variety" text,
  "grade" text,
  "hsn_code" text,
  "default_uom" "StockUom" not null default 'Box',
  "pack_spec" text,
  "description" text,
  "is_active" boolean not null default true,
  "deleted_at" timestamp(3),
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null default current_timestamp,
  constraint "items_pkey" primary key ("id")
);

do $$ begin
  alter table "items"
    add constraint "items_org_id_fkey" foreign key ("org_id")
    references "organizations"("id") on delete cascade on update cascade;
exception when duplicate_object then null; end $$;

create unique index if not exists "items_org_id_code_key" on "items"("org_id", "code");
create index if not exists "items_org_id_name_idx" on "items"("org_id", "name");
create index if not exists "items_org_id_is_active_idx" on "items"("org_id", "is_active");

-- Nullable FK columns on the three tables that carry free-text item names.
alter table "containers" add column if not exists "item_id" text;
alter table "stock_items" add column if not exists "item_id" text;
alter table "price_list_items" add column if not exists "item_id" text;

do $$ begin
  alter table "containers"
    add constraint "containers_item_id_fkey" foreign key ("item_id")
    references "items"("id") on delete set null on update cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table "stock_items"
    add constraint "stock_items_item_id_fkey" foreign key ("item_id")
    references "items"("id") on delete set null on update cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table "price_list_items"
    add constraint "price_list_items_item_id_fkey" foreign key ("item_id")
    references "items"("id") on delete set null on update cascade;
exception when duplicate_object then null; end $$;

create index if not exists "containers_item_id_idx" on "containers"("item_id");
create index if not exists "stock_items_item_id_idx" on "stock_items"("item_id");
create index if not exists "price_list_items_item_id_idx" on "price_list_items"("item_id");

-- Backfill: one draft item per distinct (case/space-insensitive) name per org,
-- gathered from containers, stock lots, and price-list lines.
insert into "items" ("id", "org_id", "code", "name", "is_active", "created_at", "updated_at")
select
  gen_random_uuid()::text,
  s."org_id",
  'ITM-' || lpad((row_number() over (partition by s."org_id" order by s."name"))::text, 4, '0'),
  s."name",
  true,
  current_timestamp,
  current_timestamp
from (
  select d."org_id", min(d."name") as "name"
  from (
    select "org_id", btrim("item") as "name" from "containers"
      where "item" is not null and btrim("item") <> ''
    union all
    select "org_id", btrim("item") from "stock_items"
      where "item" is not null and btrim("item") <> ''
    union all
    select "org_id", btrim("item") from "price_list_items"
      where "item" is not null and btrim("item") <> ''
  ) d
  group by d."org_id", lower(d."name")
) s
where not exists (
  select 1 from "items" i
  where i."org_id" = s."org_id" and lower(i."name") = lower(s."name")
);

-- Link existing rows to their item by normalized name match.
update "containers" c set "item_id" = i."id"
from "items" i
where c."item_id" is null and c."item" is not null and btrim(c."item") <> ''
  and i."org_id" = c."org_id" and lower(i."name") = lower(btrim(c."item"));

update "stock_items" s set "item_id" = i."id"
from "items" i
where s."item_id" is null and btrim(s."item") <> ''
  and i."org_id" = s."org_id" and lower(i."name") = lower(btrim(s."item"));

update "price_list_items" p set "item_id" = i."id"
from "items" i
where p."item_id" is null and btrim(p."item") <> ''
  and i."org_id" = p."org_id" and lower(i."name") = lower(btrim(p."item"));

-- ---------------------------------------------------------------------------
-- D3. Feature flags / kill switches
-- ---------------------------------------------------------------------------
create table if not exists "feature_flags" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "key" text not null,
  "enabled" boolean not null default false,
  "description" text,
  "updated_by_id" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null default current_timestamp,
  constraint "feature_flags_pkey" primary key ("id")
);

do $$ begin
  alter table "feature_flags"
    add constraint "feature_flags_org_id_fkey" foreign key ("org_id")
    references "organizations"("id") on delete cascade on update cascade;
exception when duplicate_object then null; end $$;

create unique index if not exists "feature_flags_org_id_key_key" on "feature_flags"("org_id", "key");

-- Seed the maintenance-mode kill switch (disabled) for every org.
insert into "feature_flags" ("id", "org_id", "key", "enabled", "description")
select gen_random_uuid()::text, o."id", 'maintenance_mode', false,
       'When enabled, a maintenance banner is shown and users are warned before writes.'
from "organizations" o
where not exists (
  select 1 from "feature_flags" f
  where f."org_id" = o."id" and f."key" = 'maintenance_mode'
);

-- ---------------------------------------------------------------------------
-- B1. Idempotency keys (duplicate-submission guard for money POST routes)
-- ---------------------------------------------------------------------------
create table if not exists "idempotency_keys" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "user_id" text not null,
  "scope" text not null,
  "key" text not null,
  "response_status" integer,
  "response_body" jsonb,
  "created_at" timestamp(3) not null default current_timestamp,
  constraint "idempotency_keys_pkey" primary key ("id")
);

do $$ begin
  alter table "idempotency_keys"
    add constraint "idempotency_keys_org_id_fkey" foreign key ("org_id")
    references "organizations"("id") on delete cascade on update cascade;
exception when duplicate_object then null; end $$;

create unique index if not exists "idempotency_keys_org_id_scope_key_key" on "idempotency_keys"("org_id", "scope", "key");
create index if not exists "idempotency_keys_created_at_idx" on "idempotency_keys"("created_at");

-- ---------------------------------------------------------------------------
-- E2. Approval delegations (out-of-office approvers)
-- ---------------------------------------------------------------------------
create table if not exists "approval_delegations" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "from_user_id" text not null,
  "to_user_id" text not null,
  "scope" text not null default 'all',
  "starts_at" timestamp(3) not null,
  "ends_at" timestamp(3) not null,
  "reason" text,
  "revoked_at" timestamp(3),
  "created_by_id" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null default current_timestamp,
  constraint "approval_delegations_pkey" primary key ("id")
);

do $$ begin
  alter table "approval_delegations"
    add constraint "approval_delegations_org_id_fkey" foreign key ("org_id")
    references "organizations"("id") on delete cascade on update cascade;
exception when duplicate_object then null; end $$;

create index if not exists "approval_delegations_org_id_to_user_id_ends_at_idx" on "approval_delegations"("org_id", "to_user_id", "ends_at");
create index if not exists "approval_delegations_org_id_from_user_id_ends_at_idx" on "approval_delegations"("org_id", "from_user_id", "ends_at");

-- ---------------------------------------------------------------------------
-- E5. DPDP data-deletion request log
-- ---------------------------------------------------------------------------
create table if not exists "data_deletion_requests" (
  "id" text not null default gen_random_uuid()::text,
  "org_id" text not null,
  "customer_id" text,
  "subject_name" text not null,
  "subject_contact" text,
  "reason" text,
  "status" text not null default 'Open',
  "requested_at" timestamp(3) not null default current_timestamp,
  "resolved_by_id" text,
  "resolved_at" timestamp(3),
  "resolution_notes" text,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null default current_timestamp,
  constraint "data_deletion_requests_pkey" primary key ("id")
);

do $$ begin
  alter table "data_deletion_requests"
    add constraint "data_deletion_requests_org_id_fkey" foreign key ("org_id")
    references "organizations"("id") on delete cascade on update cascade;
exception when duplicate_object then null; end $$;

create index if not exists "data_deletion_requests_org_id_status_idx" on "data_deletion_requests"("org_id", "status");
