import { describe, it, expect } from 'vitest';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { StockBalance } from '../../domain/entities/stock-balance.entity.js';
import { StockMovement } from '../../domain/entities/stock-movement.entity.js';
import { StockMovementType } from '../../domain/entities/stock-movement-type.enum.js';
import { Reservation } from '../../domain/entities/reservation.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import { Quantity } from '../../domain/value-objects/quantity.vo.js';
import { MovementReference } from '../../domain/value-objects/movement-reference.vo.js';
import { WarehouseMapper } from './warehouse.mapper.js';
import { StockBalanceMapper } from './stock-balance.mapper.js';
import { StockMovementMapper } from './stock-movement.mapper.js';
import { ReservationMapper } from './reservation.mapper.js';

describe('Inventory Persistence Mappers', () => {
  const tenantId = 'tenant-001';
  const now = new Date('2026-11-12T00:00:00.000Z');

  it('WarehouseMapper should round-trip Warehouse aggregate without losing fields', () => {
    const warehouse = Warehouse.create({
      id: 'wh-100',
      tenantId,
      code: WarehouseCode.of('wh-ank-01').value,
      name: 'Ankara Ana Depo',
      allowNegativeStock: true,
      createdAt: now,
    }).value;

    const persistenceData = WarehouseMapper.toPersistence(warehouse);
    expect(persistenceData.code).toBe('WH-ANK-01');
    expect(persistenceData.version).toBe(1);

    const reconstituted = WarehouseMapper.toDomain(persistenceData);
    expect(reconstituted.id).toBe(warehouse.id);
    expect(reconstituted.tenantId).toBe(warehouse.tenantId);
    expect(reconstituted.code.equals(warehouse.code)).toBe(true);
    expect(reconstituted.name).toBe(warehouse.name);
    expect(reconstituted.isActive).toBe(true);
    expect(reconstituted.allowNegativeStock).toBe(true);
    expect(reconstituted.version).toBe(1);
    expect(reconstituted.pullDomainEvents()).toHaveLength(0);
  });

  it('StockBalanceMapper should round-trip StockBalance preserving 4-decimal precision', () => {
    const balance = StockBalance.create({
      tenantId,
      warehouseId: 'wh-100',
      productId: 'prod-200',
      unit: 'KG',
      initialOnHand: '1250.7525',
      initialReserved: '40.125',
    }).value;

    const persistenceData = StockBalanceMapper.toPersistence(balance);
    expect(persistenceData.onHand.toString()).toBe('1250.7525');
    expect(persistenceData.reserved.toString()).toBe('40.125');

    const reconstituted = StockBalanceMapper.toDomain({
      ...persistenceData,
      createdAt: now,
      updatedAt: now,
    });

    expect(reconstituted.tenantId).toBe(tenantId);
    expect(reconstituted.warehouseId).toBe('wh-100');
    expect(reconstituted.productId).toBe('prod-200');
    expect(reconstituted.unit).toBe('KG');
    expect(reconstituted.onHand.toString()).toBe('1250.7525');
    expect(reconstituted.reserved.toString()).toBe('40.125');
    expect(reconstituted.version).toBe(1);
  });

  it('StockMovementMapper should round-trip StockMovement with reference and isReversed flag', () => {
    const movement = StockMovement.create({
      id: 'mov-300',
      tenantId,
      type: StockMovementType.RECEIPT,
      warehouseId: 'wh-100',
      productId: 'prod-200',
      quantity: Quantity.of('15.5', 'KG').value,
      occurredAt: now,
      reference: MovementReference.of('PURCHASE_ORDER', 'po-99').value,
      createdBy: 'user-admin',
      note: 'İlk mal kabul',
    }).value;

    const persistenceData = StockMovementMapper.toPersistence(movement);
    expect(persistenceData.quantity.toString()).toBe('15.5');
    expect(persistenceData.referenceType).toBe('PURCHASE_ORDER');
    expect(persistenceData.referenceId).toBe('po-99');

    const reconstituted = StockMovementMapper.toDomain(
      {
        ...persistenceData,
        createdAt: now,
      },
      true,
    );

    expect(reconstituted.id).toBe('mov-300');
    expect(reconstituted.type).toBe(StockMovementType.RECEIPT);
    expect(reconstituted.quantity.amount.toString()).toBe('15.5');
    expect(reconstituted.quantity.unit).toBe('KG');
    expect(reconstituted.reference?.type).toBe('PURCHASE_ORDER');
    expect(reconstituted.reference?.id).toBe('po-99');
    expect(reconstituted.isReversed).toBe(true);
    expect(reconstituted.note).toBe('İlk mal kabul');
  });

  it('ReservationMapper should round-trip Reservation aggregate', () => {
    const expiresAt = new Date('2026-12-01T00:00:00.000Z');
    const reservation = Reservation.create({
      id: 'res-400',
      tenantId,
      warehouseId: 'wh-100',
      productId: 'prod-200',
      quantity: Quantity.of('8', 'ADET').value,
      reference: MovementReference.of('SALES_ORDER', 'so-55').value,
      expiresAt,
      occurredAt: now,
    }).value;

    const persistenceData = ReservationMapper.toPersistence(reservation);
    const reconstituted = ReservationMapper.toDomain(persistenceData);

    expect(reconstituted.id).toBe('res-400');
    expect(reconstituted.status).toBe(reservation.status);
    expect(reconstituted.quantity.amount.toString()).toBe('8');
    expect(reconstituted.reference.type).toBe('SALES_ORDER');
    expect(reconstituted.reference.id).toBe('so-55');
    expect(reconstituted.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
    expect(reconstituted.version).toBe(1);
    expect(reconstituted.pullDomainEvents()).toHaveLength(0);
  });
});

