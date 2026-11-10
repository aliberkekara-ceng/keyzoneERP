-- ============================================================================
-- Migration: 20261110180000_init_inventory
-- Purpose:
--   1. Create `inventory` schema and 4 core tables (warehouses, stock_movements,
--      stock_balances, reservations).
--   2. Enforce physical append-only immutability on `stock_movements` via trigger
--      (blocks UPDATE and DELETE).
--   3. Enforce Row-Level Security (RLS) tenant isolation on all 4 tables.
-- ============================================================================

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- 2. Table: inventory.warehouses
CREATE TABLE "inventory"."warehouses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_warehouses_version_pos" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "uq_warehouses_tenant_code" ON "inventory"."warehouses"("tenant_id", "code");
CREATE INDEX "idx_warehouses_tenant" ON "inventory"."warehouses"("tenant_id");

-- 3. Table: inventory.stock_movements (Append-Only Ledger)
CREATE TABLE "inventory"."stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" NUMERIC(19, 4) NOT NULL,
    "unit_code" VARCHAR(20) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" TEXT,
    "reverses_movement_id" TEXT,
    "created_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_movements_qty_pos" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "uq_stock_movements_reversal"
    ON "inventory"."stock_movements"("tenant_id", "reverses_movement_id")
    WHERE "reverses_movement_id" IS NOT NULL;

CREATE INDEX "idx_stock_movements_lookup"
    ON "inventory"."stock_movements"("tenant_id", "warehouse_id", "product_id", "occurred_at" DESC);

-- 4. Table: inventory.stock_balances (State Projection)
CREATE TABLE "inventory"."stock_balances" (
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "unit_code" VARCHAR(20) NOT NULL,
    "on_hand" NUMERIC(19, 4) NOT NULL DEFAULT 0,
    "reserved" NUMERIC(19, 4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_stock_balances" PRIMARY KEY ("tenant_id", "warehouse_id", "product_id"),
    CONSTRAINT "chk_stock_balances_reserved_nonneg" CHECK ("reserved" >= 0),
    CONSTRAINT "chk_stock_balances_version_pos" CHECK ("version" >= 1)
);

CREATE INDEX "idx_stock_balances_warehouse" ON "inventory"."stock_balances"("tenant_id", "warehouse_id");

-- 5. Table: inventory.reservations
CREATE TABLE "inventory"."reservations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" NUMERIC(19, 4) NOT NULL,
    "unit_code" VARCHAR(20) NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "consumed_movement_id" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_reservations_qty_pos" CHECK ("quantity" > 0),
    CONSTRAINT "chk_reservations_version_pos" CHECK ("version" >= 1)
);

CREATE INDEX "idx_reservations_reference"
    ON "inventory"."reservations"("tenant_id", "reference_type", "reference_id");

CREATE INDEX "idx_reservations_active_lookup"
    ON "inventory"."reservations"("tenant_id", "warehouse_id", "product_id", "status");

-- ============================================================================
-- 6. APPEND-ONLY TRIGGER FOR inventory.stock_movements
-- Stok hareketleri hiçbir koşulda güncellenemez (UPDATE) veya silinemez (DELETE).
-- Hata düzeltmeleri yalnızca ters kayıt (reverses_movement_id) INSERT edilerek yapılır.
-- ============================================================================

CREATE OR REPLACE FUNCTION "inventory"."prevent_stock_movements_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements table is append-only: % operation is strictly forbidden.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "trg_stock_movements_append_only"
BEFORE UPDATE OR DELETE ON "inventory"."stock_movements"
FOR EACH ROW
EXECUTE FUNCTION "inventory"."prevent_stock_movements_mutation"();

-- ============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) FOR MULTI-TENANT ISOLATION
-- Her tabloda aktif oturumun `app.current_tenant_id` ayarı ile tenant_id eşleşmesi
-- veritabanı motoru seviyesinde zorunlu kılınır (AGENTS.md §6).
-- ============================================================================

ALTER TABLE "inventory"."warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory"."warehouses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_warehouses" ON "inventory"."warehouses"
    AS PERMISSIVE
    FOR ALL
    USING ("tenant_id" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

ALTER TABLE "inventory"."stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory"."stock_movements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_movements" ON "inventory"."stock_movements"
    AS PERMISSIVE
    FOR ALL
    USING ("tenant_id" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

ALTER TABLE "inventory"."stock_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory"."stock_balances" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_balances" ON "inventory"."stock_balances"
    AS PERMISSIVE
    FOR ALL
    USING ("tenant_id" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

ALTER TABLE "inventory"."reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory"."reservations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_reservations" ON "inventory"."reservations"
    AS PERMISSIVE
    FOR ALL
    USING ("tenant_id" = current_setting('app.current_tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

