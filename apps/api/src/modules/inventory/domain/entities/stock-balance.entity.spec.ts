import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { StockBalance } from './stock-balance.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { StockMovementType } from './stock-movement-type.enum.js';
import { StockPolicy } from '../services/stock-policy.service.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import {
  InsufficientStockError,
  InsufficientAvailableStockError,
  InvalidQuantityError,
  UnitMismatchError,
} from '../errors/index.js';

describe('StockBalance Aggregate Root', () => {
  const tenantId = 'tenant-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';
  const unit = 'KG';
  const policy = new StockPolicy();

  const makeMovement = (type: any, amount: string | number) =>
    StockMovement.create({
      tenantId,
      warehouseId,
      productId,
      type,
      quantity: Quantity.of(amount, unit).value,
      createdBy: 'test-user',
    }).value;

  describe('Creation', () => {
    it('should create initial zero balance', () => {
      const res = StockBalance.create({ tenantId, warehouseId, productId, unit });
      expect(res.isSuccess).toBe(true);

      const bal = res.value;
      expect(bal.onHand.toString()).toBe('0');
      expect(bal.reserved.toString()).toBe('0');
      expect(bal.availableAmount.toString()).toBe('0');
      expect(bal.version).toBe(1);
    });
  });

  describe('Table-Driven Movement Tests', () => {
    interface TestCase {
      desc: string;
      initialOnHand: number;
      type: StockMovementType;
      amount: number;
      allowNegative: boolean;
      expectedOnHand?: string;
      expectedError?: any;
    }

    const testCases: TestCase[] = [
      {
        desc: 'RECEIPT: increases onHand',
        initialOnHand: 10,
        type: StockMovementType.RECEIPT,
        amount: 5,
        allowNegative: false,
        expectedOnHand: '15',
      },
      {
        desc: 'ISSUE: decreases onHand when sufficient',
        initialOnHand: 10,
        type: StockMovementType.ISSUE,
        amount: 4,
        allowNegative: false,
        expectedOnHand: '6',
      },
      {
        desc: 'ISSUE: fails when insufficient and negative stock is disallowed',
        initialOnHand: 5,
        type: StockMovementType.ISSUE,
        amount: 10,
        allowNegative: false,
        expectedError: InsufficientStockError,
      },
      {
        desc: 'ISSUE: succeeds into negative when negative stock is allowed',
        initialOnHand: 5,
        type: StockMovementType.ISSUE,
        amount: 10,
        allowNegative: true,
        expectedOnHand: '-5',
      },
      {
        desc: 'TRANSFER_IN: increases onHand',
        initialOnHand: 2,
        type: StockMovementType.TRANSFER_IN,
        amount: 8,
        allowNegative: false,
        expectedOnHand: '10',
      },
      {
        desc: 'TRANSFER_OUT: decreases onHand',
        initialOnHand: 10,
        type: StockMovementType.TRANSFER_OUT,
        amount: 3,
        allowNegative: false,
        expectedOnHand: '7',
      },
      {
        desc: 'ADJUSTMENT_IN: increases onHand',
        initialOnHand: 10,
        type: StockMovementType.ADJUSTMENT_IN,
        amount: 2.5,
        allowNegative: false,
        expectedOnHand: '12.5',
      },
      {
        desc: 'ADJUSTMENT_OUT: decreases onHand',
        initialOnHand: 10,
        type: StockMovementType.ADJUSTMENT_OUT,
        amount: 2.5,
        allowNegative: false,
        expectedOnHand: '7.5',
      },
    ];

    testCases.forEach((tc) => {
      it(tc.desc, () => {
        const bal = StockBalance.create({
          tenantId,
          warehouseId,
          productId,
          unit,
          initialOnHand: tc.initialOnHand,
        }).value;

        const mov = makeMovement(tc.type, tc.amount);
        const res = bal.apply(mov, policy, tc.allowNegative);

        if (tc.expectedError) {
          expect(res.isFailure).toBe(true);
          expect(res.error).toBeInstanceOf(tc.expectedError);
        } else {
          expect(res.isSuccess).toBe(true);
          expect(bal.onHand.toString()).toBe(tc.expectedOnHand);
        }
      });
    });
  });

  describe('Reservation Invariants', () => {
    it('should reserve stock and decrease available amount', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 20,
      }).value;

      const res = bal.reserve(Quantity.of(5, unit).value, policy);
      expect(res.isSuccess).toBe(true);
      expect(bal.onHand.toString()).toBe('20');
      expect(bal.reserved.toString()).toBe('5');
      expect(bal.availableAmount.toString()).toBe('15');
    });

    it('should fail reserving more than available amount', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 10,
      }).value;

      bal.reserve(Quantity.of(7, unit).value, policy);

      // Remaining available is 3. Attempting to reserve 5 must fail.
      const res = bal.reserve(Quantity.of(5, unit).value, policy);
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InsufficientAvailableStockError);
    });

    it('should prevent issue when remaining onHand would drop below reserved', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 10,
      }).value;

      bal.reserve(Quantity.of(4, unit).value, policy); // onHand=10, reserved=4, available=6

      // Issuing 7 would leave onHand=3, which is LESS than reserved(4). Must fail when allowNegative=false.
      const issueMov = makeMovement(StockMovementType.ISSUE, 7);
      const res = bal.apply(issueMov, policy, false);

      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InsufficientAvailableStockError);
    });

    it('should release reserved stock', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 10,
      }).value;

      bal.reserve(Quantity.of(6, unit).value, policy);
      expect(bal.reserved.toString()).toBe('6');

      const releaseRes = bal.releaseReservation(Quantity.of(4, unit).value);
      expect(releaseRes.isSuccess).toBe(true);
      expect(bal.reserved.toString()).toBe('2');
      expect(bal.availableAmount.toString()).toBe('8');
    });

    it('should fail releasing more than currently reserved', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 10,
      }).value;

      bal.reserve(Quantity.of(2, unit).value, policy);

      const res = bal.releaseReservation(Quantity.of(5, unit).value);
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidQuantityError);
    });
  });

  describe('Reversal Invariant (Ters Hareketin Etkisi)', () => {
    it('applying a movement and then applying its reversal restores the exact original balance', () => {
      const initial = 50;
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: initial,
      }).value;

      // 1. Orijinal çıkış hareketi
      const originalMovement = makeMovement(StockMovementType.ISSUE, 15.5);
      bal.apply(originalMovement, policy, false);
      expect(bal.onHand.toString()).toBe('34.5');

      // 2. Ters hareket üret
      const reversalMovement = originalMovement.reverse(undefined, 'user-admin').value;

      // 3. Ters hareketi uygula
      const revApplyRes = bal.apply(reversalMovement, policy, false);
      expect(revApplyRes.isSuccess).toBe(true);

      // Bakiye tam olarak başlangıç değerine dönmüş olmalı
      expect(bal.onHand.toString()).toBe(initial.toString());
    });
  });

  describe('Property-Based Test (Hareket Dizisi = İşaretli Toplam)', () => {
    it('any arbitrary sequence of valid movements results in onHand = sum(signed movements)', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit,
        initialOnHand: 1000,
      }).value;

      let expectedOnHand = new Decimal(1000);

      // 50 adet ardışık rastgele hareket dizisi
      const operations: Array<{ type: StockMovementType; amount: string }> = [
        { type: StockMovementType.RECEIPT, amount: '120.5' },
        { type: StockMovementType.ISSUE, amount: '45.25' },
        { type: StockMovementType.TRANSFER_OUT, amount: '10.0' },
        { type: StockMovementType.TRANSFER_IN, amount: '55.75' },
        { type: StockMovementType.ADJUSTMENT_IN, amount: '3.1234' },
        { type: StockMovementType.ADJUSTMENT_OUT, amount: '1.5' },
        { type: StockMovementType.ISSUE, amount: '80.0' },
        { type: StockMovementType.RECEIPT, amount: '200.0' },
      ];

      for (const op of operations) {
        const mov = makeMovement(op.type, op.amount);
        const res = bal.apply(mov, policy, false);
        expect(res.isSuccess).toBe(true);

        const decAmount = new Decimal(op.amount);
        if (mov.direction === 'IN') {
          expectedOnHand = expectedOnHand.plus(decAmount);
        } else {
          expectedOnHand = expectedOnHand.minus(decAmount);
        }
      }

      // Projeksiyon bakiyesi ile hareketlerin matematiksel toplamı kuruşu kuruşuna eşit olmalı
      expect(bal.onHand.toString()).toBe(expectedOnHand.toString());
    });
  });

  describe('Unit Mismatch Guards', () => {
    it('should reject movement with mismatched unit', () => {
      const bal = StockBalance.create({
        tenantId,
        warehouseId,
        productId,
        unit: 'KG',
      }).value;

      const mismatchedMov = StockMovement.create({
        tenantId,
        warehouseId,
        productId,
        type: StockMovementType.RECEIPT,
        quantity: Quantity.of(10, 'METRE').value,
        createdBy: 'user',
      }).value;

      const res = bal.apply(mismatchedMov, policy, false);
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(UnitMismatchError);
    });
  });
});

