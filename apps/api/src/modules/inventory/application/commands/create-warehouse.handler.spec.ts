import { describe, it, expect, beforeEach } from 'vitest';
import { CreateWarehouseHandler } from './create-warehouse.handler.js';
import { InMemoryWarehouseRepository } from '../testing/in-memory-warehouse.repository.js';
import { SyncUnitOfWork } from '../testing/sync-unit-of-work.js';
import {
  InvalidWarehouseCodeError,
  InvalidWarehouseNameError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';

describe('CreateWarehouseHandler', () => {
  let warehouseRepo: InMemoryWarehouseRepository;
  let unitOfWork: SyncUnitOfWork;
  let handler: CreateWarehouseHandler;

  const tenantA = 'tenant-alpha';
  const tenantB = 'tenant-beta';

  beforeEach(() => {
    warehouseRepo = new InMemoryWarehouseRepository();
    unitOfWork = new SyncUnitOfWork();
    handler = new CreateWarehouseHandler(warehouseRepo, unitOfWork);
  });

  it('should create and persist a warehouse successfully', async () => {
    const command = {
      tenantId: tenantA,
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

    // Repository'de gerçekten kayıt oluştu mu?
    const saved = await warehouseRepo.findById(tenantA, value.id);
    expect(saved).not.toBeNull();
    expect(saved?.code.value).toBe('WH-IST-01');
  });

  it('should reject creation when warehouse code format is invalid', async () => {
    const command = {
      tenantId: tenantA,
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
      tenantId: tenantA,
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
      tenantId: tenantA,
      code: 'WH-SAME-01',
      name: 'İlk Depo',
    };

    const firstResult = await handler.execute(command);
    expect(firstResult.isSuccess).toBe(true);

    // Aynı tenant'ta aynı kod ile tekrar açma denemesi
    const secondResult = await handler.execute({
      tenantId: tenantA,
      code: 'WH-SAME-01',
      name: 'İkinci Depo',
    });

    expect(secondResult.isFailure).toBe(true);
    expect(secondResult.error).toBeInstanceOf(WarehouseCodeAlreadyExistsError);
    expect(warehouseRepo.getAll()).toHaveLength(1);
  });

  it('should allow same warehouse code in different tenants (multi-tenancy isolation)', async () => {
    const code = 'WH-CENTRAL';

    // Tenant Alpha'da oluştur
    const resA = await handler.execute({
      tenantId: tenantA,
      code,
      name: 'Alpha Depo',
    });
    expect(resA.isSuccess).toBe(true);

    // Tenant Beta'da aynı kodla oluştur (İzole olmalı, izin verilmeli)
    const resB = await handler.execute({
      tenantId: tenantB,
      code,
      name: 'Beta Depo',
    });
    expect(resB.isSuccess).toBe(true);

    expect(warehouseRepo.getAll()).toHaveLength(2);
  });
});

