import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { StockBalance } from '../../domain/entities/stock-balance.entity.js';
import { StockMovement } from '../../domain/entities/stock-movement.entity.js';
import { StockMovementType } from '../../domain/entities/stock-movement-type.enum.js';
import { Reservation } from '../../domain/entities/reservation.entity.js';
import { ReservationStatus } from '../../domain/entities/reservation-status.enum.js';
import { StockPolicy } from '../../domain/services/stock-policy.service.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import { Quantity } from '../../domain/value-objects/quantity.vo.js';
import { MovementReference } from '../../domain/value-objects/movement-reference.vo.js';
import {
  MovementAlreadyReversedError,
  OptimisticLockError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';
import { FakeCurrentTenant } from '../../application/testing/fake-current-tenant.js';
import { PrismaWarehouseRepository } from './prisma-warehouse.repository.js';
import { PrismaStockRepository } from './prisma-stock.repository.js';
import { PrismaReservationRepository } from './prisma-reservation.repository.js';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';

describe('Inventory Prisma Repositories & PostgreSQL Integration (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let prisma: PrismaClient;
  let warehouseRepo: PrismaWarehouseRepository;
  let stockRepo: PrismaStockRepository;
  let reservationRepo: PrismaReservationRepository;

  const tenantA = 'tenant-alpha';
  const tenantB = 'tenant-beta';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('keyzone_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    // Apply physical DDL migration (tables, indexes, append-only trigger, RLS policies)
    const migrationPath = join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261110180000_init_inventory',
      'migration.sql',
    );
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    await pool.query(migrationSql);

    // Create a non-superuser application role to verify PostgreSQL RLS enforcement
    await pool.query(`
      CREATE ROLE app_tenant_user NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA inventory TO app_tenant_user;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inventory TO app_tenant_user;
    `);

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    warehouseRepo = new PrismaWarehouseRepository(prisma);
    stockRepo = new PrismaStockRepository(prisma);
    reservationRepo = new PrismaReservationRepository(prisma);
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  }, 60_000);

  describe('PrismaWarehouseRepository', () => {
    it('should save and reconstitute a Warehouse aggregate (round-trip)', async () => {
      const code = WarehouseCode.of('wh-ist-01').value;
      const warehouse = Warehouse.create({
        id: 'wh-roundtrip-1',
        tenantId: tenantA,
        code,
        name: 'İstanbul Merkez Depo',
        allowNegativeStock: true,
      }).value;

      await warehouseRepo.save(warehouse);

      const byId = await warehouseRepo.findById(tenantA, warehouse.id);
      expect(byId).not.toBeNull();
      expect(byId!.id).toBe(warehouse.id);
      expect(byId!.tenantId).toBe(tenantA);
      expect(byId!.code.equals(code)).toBe(true);
      expect(byId!.name).toBe('İstanbul Merkez Depo');
      expect(byId!.isActive).toBe(true);
      expect(byId!.allowNegativeStock).toBe(true);
      expect(byId!.version).toBe(1);

      const byCode = await warehouseRepo.findByCode(tenantA, code);
      expect(byCode?.id).toBe(warehouse.id);

      const exists = await warehouseRepo.existsByCode(tenantA, code);
      expect(exists).toBe(true);
    });

    it('should reject duplicate warehouse code within the same tenant but allow it in another tenant', async () => {
      const code = WarehouseCode.of('WH-DUP-01').value;

      const wh1 = Warehouse.create({
        tenantId: tenantA,
        code,
        name: 'Birinci Depo',
      }).value;
      await warehouseRepo.save(wh1);

      const whDuplicateSameTenant = Warehouse.create({
        tenantId: tenantA,
        code,
        name: 'İkinci Depo (Aynı Kod)',
      }).value;

      await expect(
        warehouseRepo.save(whDuplicateSameTenant),
      ).rejects.toBeInstanceOf(WarehouseCodeAlreadyExistsError);

      // Farklı tenant aynı kodu kullanabilir
      const whOtherTenant = Warehouse.create({
        tenantId: tenantB,
        code,
        name: 'Beta Merkez Depo',
      }).value;
      await expect(warehouseRepo.save(whOtherTenant)).resolves.toBeUndefined();
    });

    it('should increment version on update and throw OptimisticLockError on stale version', async () => {
      const code = WarehouseCode.of('WH-LOCK-01').value;
      const created = Warehouse.create({
        id: 'wh-lock-1',
        tenantId: tenantA,
        code,
        name: 'İlk İsim',
      }).value;
      await warehouseRepo.save(created);

      // İki paralel işlem aynı anda version=1 kaydını okur
      const instance1 = (await warehouseRepo.findById(tenantA, created.id))!;
      const instance2 = (await warehouseRepo.findById(tenantA, created.id))!;

      expect(instance1.version).toBe(1);
      expect(instance2.version).toBe(1);

      // 1. işlem depoyu günceller ve kaydeder (DB version -> 2)
      instance1.rename('Güncel İsim 1');
      await warehouseRepo.save(instance1);

      const reloaded = (await warehouseRepo.findById(tenantA, created.id))!;
      expect(reloaded.name).toBe('Güncel İsim 1');
      expect(reloaded.version).toBe(2);

      // 2. işlem eski versiyonla (version=1) kaydetmeye çalışırsa OptimisticLockError fırlatılır
      instance2.rename('Çakışan İsim 2');
      await expect(warehouseRepo.save(instance2)).rejects.toBeInstanceOf(
        OptimisticLockError,
      );
    });
  });

  describe('PrismaStockRepository & Append-Only Ledger Trigger', () => {
    const policy = new StockPolicy();
    const warehouseId = 'wh-stock-1';
    const productId = 'prod-steel-01';

    it('should persist StockMovement and StockBalance atomically via PrismaUnitOfWork', async () => {
      const currentTenant = new FakeCurrentTenant(tenantA, 'user-1');
      const uow = new PrismaUnitOfWork(prisma, currentTenant);

      const balance = StockBalance.create({
        tenantId: tenantA,
        warehouseId,
        productId,
        unit: 'KG',
      }).value;

      const receipt = StockMovement.create({
        id: 'mov-receipt-1',
        tenantId: tenantA,
        type: StockMovementType.RECEIPT,
        warehouseId,
        productId,
        quantity: Quantity.of('125.5025', 'KG').value,
        reference: MovementReference.of('PURCHASE_ORDER', 'PO-101').value,
        createdBy: 'user-1',
        note: 'İlk çelik girişi',
      }).value;

      balance.apply(receipt, policy, false);

      await uow.execute(async () => {
        await stockRepo.appendMovement(receipt);
        await stockRepo.saveBalance(balance);
      });

      const savedBalance = await stockRepo.findBalance(
        tenantA,
        warehouseId,
        productId,
      );
      expect(savedBalance).not.toBeNull();
      expect(savedBalance!.onHand.toString()).toBe('125.5025');
      expect(savedBalance!.version).toBe(1);

      const savedMovement = await stockRepo.findMovementById(
        tenantA,
        receipt.id,
      );
      expect(savedMovement).not.toBeNull();
      expect(savedMovement!.quantity.amount.toString()).toBe('125.5025');
      expect(savedMovement!.isReversed).toBe(false);
    });

    it('should mark movement as reversed when reversal is appended and prevent double reversal', async () => {
      const original = (await stockRepo.findMovementById(
        tenantA,
        'mov-receipt-1',
      ))!;
      const reversal = original.reverse('mov-reversal-1', 'user-admin').value;

      await stockRepo.appendMovement(reversal);

      // Orijinal hareket tekrar okunduğunda isReversed=true dönmeli
      const reloadedOriginal = (await stockRepo.findMovementById(
        tenantA,
        'mov-receipt-1',
      ))!;
      expect(reloadedOriginal.isReversed).toBe(true);

      // Veritabanı seviyesinde aynı hareketi ikinci kez tersine çeviren kayıt reddedilmeli
      const duplicateReversal = StockMovement.create({
        id: 'mov-reversal-duplicate',
        tenantId: tenantA,
        type: StockMovementType.ADJUSTMENT_OUT,
        warehouseId,
        productId,
        quantity: original.quantity,
        reversesMovementId: original.id,
        createdBy: 'user-admin',
      }).value;

      await expect(
        stockRepo.appendMovement(duplicateReversal),
      ).rejects.toBeInstanceOf(MovementAlreadyReversedError);
    });

    it('should physically block UPDATE and DELETE on stock_movements via PostgreSQL trigger', async () => {
      await expect(
        pool.query(
          `UPDATE inventory.stock_movements SET quantity = 999 WHERE id = 'mov-receipt-1'`,
        ),
      ).rejects.toThrow(/stock_movements table is append-only/);

      await expect(
        pool.query(
          `DELETE FROM inventory.stock_movements WHERE id = 'mov-receipt-1'`,
        ),
      ).rejects.toThrow(/stock_movements table is append-only/);
    });
  });

  describe('PrismaReservationRepository', () => {
    it('should save, transition status, and enforce optimistic locking on Reservation', async () => {
      const reservation = Reservation.create({
        id: 'res-int-1',
        tenantId: tenantA,
        warehouseId: 'wh-stock-1',
        productId: 'prod-steel-01',
        quantity: Quantity.of('10', 'KG').value,
        reference: MovementReference.of('SALES_ORDER', 'SO-500').value,
      }).value;

      await reservationRepo.save(reservation);

      const loaded1 = (await reservationRepo.findById(
        tenantA,
        reservation.id,
      ))!;
      const loaded2 = (await reservationRepo.findById(
        tenantA,
        reservation.id,
      ))!;

      loaded1.consume('mov-issue-1');
      await reservationRepo.save(loaded1);

      const afterConsume = (await reservationRepo.findById(
        tenantA,
        reservation.id,
      ))!;
      expect(afterConsume.status).toBe(ReservationStatus.CONSUMED);
      expect(afterConsume.consumedMovementId).toBe('mov-issue-1');
      expect(afterConsume.version).toBe(2);

      // Eski versiyonla (loaded2, version=1) güncelleme denemesi reddedilmeli
      loaded2.release();
      await expect(reservationRepo.save(loaded2)).rejects.toBeInstanceOf(
        OptimisticLockError,
      );
    });
  });

  describe('PostgreSQL Row-Level Security (RLS) Tenant Isolation', () => {
    it('should strictly isolate tenant rows at the database engine level', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE app_tenant_user');
        await client.query(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          [tenantA],
        );

        // Filtresiz SELECT sorgusu atılsa bile yalnızca tenantA kayıtları gelmeli
        const result = await client.query<{ tenant_id: string }>(
          'SELECT tenant_id FROM inventory.warehouses',
        );
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.every((r) => r.tenant_id === tenantA)).toBe(true);

        // tenantA oturumundayken tenantB adına satır ekleme denemesi RLS tarafından engellenmeli
        await expect(
          client.query(
            `INSERT INTO inventory.warehouses (id, tenant_id, code, name) VALUES ('wh-hack', $1, 'HACK-01', 'Hack Depo')`,
            [tenantB],
          ),
        ).rejects.toThrow(/row-level security policy/);

        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
  });
});

