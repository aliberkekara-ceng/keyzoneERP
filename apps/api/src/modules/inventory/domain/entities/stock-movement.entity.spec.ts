import { describe, it, expect } from 'vitest';
import { StockMovement } from './stock-movement.entity.js';
import { StockMovementType } from './stock-movement-type.enum.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import { MovementReference } from '../value-objects/movement-reference.vo.js';
import {
  InvalidQuantityError,
  MovementAlreadyReversedError,
} from '../errors/index.js';

describe('StockMovement Entity', () => {
  const tenantId = 'tenant-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';
  const qty = Quantity.of('10.5', 'KG').value;
  const ref = MovementReference.of('SALES_ORDER', 'ord-100').value;

  it('should create valid stock movement with positive quantity', () => {
    const res = StockMovement.create({
      tenantId,
      type: StockMovementType.RECEIPT,
      warehouseId,
      productId,
      quantity: qty,
      createdBy: 'user-1',
      reference: ref,
    });

    expect(res.isSuccess).toBe(true);
    const mov = res.value;
    expect(mov.id).toBeDefined();
    expect(mov.direction).toBe('IN');
    expect(mov.isReversed).toBe(false);
    expect(mov.quantity.equals(qty)).toBe(true);
  });

  it('should reject movement with zero quantity', () => {
    const zeroQty = Quantity.zero('KG');
    const res = StockMovement.create({
      tenantId,
      type: StockMovementType.RECEIPT,
      warehouseId,
      productId,
      quantity: zeroQty,
      createdBy: 'user-1',
    });

    expect(res.isFailure).toBe(true);
    expect(res.error).toBeInstanceOf(InvalidQuantityError);
  });

  it('should map movement types to correct IN/OUT directions', () => {
    const make = (type: any) =>
      StockMovement.create({
        tenantId,
        type,
        warehouseId,
        productId,
        quantity: qty,
        createdBy: 'user-1',
      }).value;

    expect(make(StockMovementType.RECEIPT).direction).toBe('IN');
    expect(make(StockMovementType.TRANSFER_IN).direction).toBe('IN');
    expect(make(StockMovementType.ADJUSTMENT_IN).direction).toBe('IN');

    expect(make(StockMovementType.ISSUE).direction).toBe('OUT');
    expect(make(StockMovementType.TRANSFER_OUT).direction).toBe('OUT');
    expect(make(StockMovementType.ADJUSTMENT_OUT).direction).toBe('OUT');
  });

  describe('Reversal (Ters Hareket)', () => {
    it('should generate opposite movement on reversal and link original id', () => {
      const original = StockMovement.create({
        tenantId,
        type: StockMovementType.RECEIPT,
        warehouseId,
        productId,
        quantity: qty,
        createdBy: 'user-1',
        reference: ref,
      }).value;

      const revRes = original.reverse(undefined, 'user-admin', 'Hatalı giriş iptali');
      expect(revRes.isSuccess).toBe(true);

      const reversal = revRes.value;
      expect(reversal.type).toBe(StockMovementType.ADJUSTMENT_OUT);
      expect(reversal.direction).toBe('OUT');
      expect(reversal.quantity.equals(qty)).toBe(true);
      expect(reversal.reversesMovementId).toBe(original.id);
      expect(original.isReversed).toBe(true);
    });

    it('should fail reversing an already reversed movement', () => {
      const mov = StockMovement.create({
        tenantId,
        type: StockMovementType.ISSUE,
        warehouseId,
        productId,
        quantity: qty,
        createdBy: 'user-1',
      }).value;

      const first = mov.reverse(undefined, 'user-admin');
      expect(first.isSuccess).toBe(true);
      expect(first.value.type).toBe(StockMovementType.ADJUSTMENT_IN);
      expect(first.value.direction).toBe('IN');

      const second = mov.reverse(undefined, 'user-admin');
      expect(second.isFailure).toBe(true);
      expect(second.error).toBeInstanceOf(MovementAlreadyReversedError);
    });
  });
});

