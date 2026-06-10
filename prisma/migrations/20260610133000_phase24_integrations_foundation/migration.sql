-- Phase 24: provider-agnostic integration foundation.

CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NotConnected',
    "config" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "last_test_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_runs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "mode" TEXT NOT NULL DEFAULT 'Manual',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "records_seen" INTEGER NOT NULL DEFAULT 0,
    "records_changed" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_errors" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "run_id" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Error',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_errors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_connections_org_id_provider_key" ON "integration_connections"("org_id", "provider");
CREATE INDEX "integration_connections_org_id_idx" ON "integration_connections"("org_id");
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections"("provider");

CREATE INDEX "integration_runs_org_id_idx" ON "integration_runs"("org_id");
CREATE INDEX "integration_runs_connection_id_idx" ON "integration_runs"("connection_id");
CREATE INDEX "integration_runs_status_idx" ON "integration_runs"("status");

CREATE INDEX "integration_errors_org_id_idx" ON "integration_errors"("org_id");
CREATE INDEX "integration_errors_connection_id_idx" ON "integration_errors"("connection_id");
CREATE INDEX "integration_errors_run_id_idx" ON "integration_errors"("run_id");

CREATE UNIQUE INDEX "external_references_org_id_provider_entity_type_entity_id_key" ON "external_references"("org_id", "provider", "entity_type", "entity_id");
CREATE INDEX "external_references_org_id_idx" ON "external_references"("org_id");
CREATE INDEX "external_references_provider_external_id_idx" ON "external_references"("provider", "external_id");

ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_runs" ADD CONSTRAINT "integration_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_runs" ADD CONSTRAINT "integration_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_errors" ADD CONSTRAINT "integration_errors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_errors" ADD CONSTRAINT "integration_errors_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_errors" ADD CONSTRAINT "integration_errors_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "integration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
