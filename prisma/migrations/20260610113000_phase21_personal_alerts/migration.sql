-- Phase 21: per-user alert preferences and alert state.

CREATE TABLE "user_alert_preferences" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_alert_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_alert_states" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_alert_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_alert_preferences_user_id_category_key" ON "user_alert_preferences"("user_id", "category");
CREATE INDEX "user_alert_preferences_org_id_idx" ON "user_alert_preferences"("org_id");

CREATE UNIQUE INDEX "user_alert_states_user_id_alert_key_key" ON "user_alert_states"("user_id", "alert_key");
CREATE INDEX "user_alert_states_org_id_idx" ON "user_alert_states"("org_id");
CREATE INDEX "user_alert_states_user_id_category_idx" ON "user_alert_states"("user_id", "category");

ALTER TABLE "user_alert_preferences" ADD CONSTRAINT "user_alert_preferences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_alert_preferences" ADD CONSTRAINT "user_alert_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_alert_states" ADD CONSTRAINT "user_alert_states_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_alert_states" ADD CONSTRAINT "user_alert_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
