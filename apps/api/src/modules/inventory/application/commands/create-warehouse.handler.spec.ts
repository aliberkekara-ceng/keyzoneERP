import { describe, it, expect, beforeEach } from 'vitest';
import { CreateWarehouseHandler } from './create-warehouse.handler.js';
import { InMemoryWarehouseRepository } from '../testing/in-memory-warehouse.repository.js';
import { SyncUnitOfWork } from '../testing/sync-unit-of-work.js';
import { FixedClock } from '../testing/fixed-clock.js';
import { FakeCurrentTenant } from '../testing/fake-current-tenant.js';
import { InventoryPermissions } from '../ports/current-tenant.port.js';
import { WarehouseCreated } from '../../domain/events/warehouse-created.event.js';
import {
  InsufficientPermissionError,
  InvalidWarehouseCodeError,
  InvalidWarehouseNameError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';

describe('CreateWarehouseHandler', () => {
  let warehouseRepo: InMemoryWarehouseRepository;
  let unitOfWork: SyncUnitOfWork;
  let clock: FixedClock;
  let currentTenant: FakeCurrentTenant;
  let handler: CreateWarehouseHandler;

  const tenantA = 'tenant-alpha';
  const tenantB = 'tenant-beta';
  const fixedDate = new Date('2026-11-10T12:00:00.000Z');

  beforeEach(() => {
    warehouseRepo = new InMemoryWarehouseRepository();
    unitOfWork = new SyncUnitOfWork();
    clock = new FixedClock(fixedDate);
    currentTenant = new FakeCurrentTenant(tenantA, 'user-admin', [
      InventoryPermissions.WAREHOUSE_MANAGE,
    ]);
    handler = new CreateWarehouseHandler(
      warehouseRepo,
      unitOfWork,
      clock,
      currentTenant,
    );
  });

  it('should create warehouse, use ClockPort time, and collect WarehouseCreated event', async () => {
    const command = {
      code: 'WH-IST-01',
      name: 'İstanbul Ana Depo',
      allowNegativeStock: true,
    };

    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    const value = result.value;
    expect(value.id).toBeDefined();
    expect(value.code).toBe('WH-IST-01');
    expect(value.name).toBe('İstanbul Ana Depo');
    expect(value.isActive).toBe(true);
    expect(value.allowNegativeStock).toBe(true);

    // 1. Repository'de gerçekten kayıt oluştu mu ve ClockPort saati kullanıldı mı?
    const saved = await warehouseRepo.findById(tenantA, value.id);
    expect(saved).not.toBeNull();
    expect(saved?.code.value).toBe('WH-IST-01');
    expect(saved?.createdAt.toISOString()).toBe(fixedDate.toISOString());

    // 2. Aggregate içindeki event kuyruğu boşaltılıp UnitOfWork'e toplandı mı?
    expect(saved?.pullDomainEvents()).toHaveLength(0);
    const collectedEvents = unitOfWork.getCollectedEvents();
    expect(collectedEvents).toHaveLength(1);
    expect(collectedEvents[0]).toBeInstanceOf(WarehouseCreated);
    const createdEvent = collectedEvents[0] as WarehouseCreated;
    expect(createdEvent.aggregateId).toBe(value.id);
    expect(createdEvent.tenantId).toBe(tenantA);
    expect(createdEvent.code).toBe('WH-IST-01');
    expect(createdEvent.occurredAt.toISOString()).toBe(fixedDate.toISOString());
  });

  it('should reject creation when user lacks inventory.warehouse.manage permission', async () => {
    // Kullanıcıya sadece okuma izni verelim, yönetim iznini kaldıralım
    currentTenant.setPermissions([InventoryPermissions.WAREHOUSE_READ]);

    const result = await handler.execute({
      code: 'WH-UNAUTHORIZED',
      name: 'Yetkisiz Depo',
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InsufficientPermissionError);
    expect(warehouseRepo.getAll()).toHaveLength(0);
    expect(unitOfWork.getCollectedEvents()).toHaveLength(0);
  });

  it('should reject creation when warehouse code format is invalid', async () => {
    const command = {
      code: 'x', // 2 karakterden kısa
      name: 'Geçersiz Depo',
    };

    const result = await handler.execute(command);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidWarehouseCodeError);
    expect(warehouseRepo.getAll()).toHaveLength(0);
  });

  it('should reject creation when warehouse name is empty', async () => {
    const command = {
      code: 'WH-ANK-01',
      name: '   ',
    };

    const result = await handler.execute(command);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidWarehouseNameError);
    expect(warehouseRepo.getAll()).toHaveLength(0);
  });

  it('should reject creation when warehouse code already exists in the same tenant', async () => {
    const command = {
      code: 'WH-SAME-01',
      name: 'İlk Depo',
    };

    const firstResult = await handler.execute(command);
    expect(firstResult.isSuccess).toBe(true);

    // Aynı tenant'ta aynı kod ile tekrar açma denemesi
    const secondResult = await handler.execute({
      code: 'WH-SAME-01',
      name: 'İkinci Depo',
    });

    expect(secondResult.isFailure).toBe(true);
    expect(secondResult.error).toBeInstanceOf(WarehouseCodeAlreadyExistsError);
    expect(warehouseRepo.getAll()).toHaveLength(1);
    expect(unitOfWork.getCollectedEvents()).toHaveLength(1);
  });

  it('should allow same warehouse code in different tenants (multi-tenancy isolation)', async () => {
    const code = 'WH-CENTRAL';

    // Tenant Alpha'da oluştur
    currentTenant.setTenantId(tenantA);
    const resA = await handler.execute({
      code,
      name: 'Alpha Depo',
    });
    expect(resA.isSuccess).toBe(true);

    // Tenant Beta'da aynı kodla oluştur (İzole olmalı, izin verilmeli)
    currentTenant.setTenantId(tenantB);
    const resB = await handler.execute({
      code,
      name: 'Beta Depo',
    });
    expect(resB.isSuccess).toBe(true);

    expect(warehouseRepo.getAll()).toHaveLength(2);
    expect(unitOfWork.getCollectedEvents()).toHaveLength(2);
  });
});
