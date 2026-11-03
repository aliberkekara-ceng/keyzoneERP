import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { Quantity } from './quantity.vo.js';
import {
  InvalidQuantityError,
  UnitMismatchError,
} from '../errors/index.js';

describe('Quantity Value Object', () => {
  describe('Creation & Validation', () => {
    it('should create a valid Quantity with number, string and Decimal', () => {
      const q1 = Quantity.of(10, 'KG');
      const q2 = Quantity.of('10.5', 'KG');
      const q3 = Quantity.of(new Decimal('10.5555'), 'KG');

      expect(q1.isSuccess).toBe(true);
      expect(q1.value.amount.toString()).toBe('10');
      expect(q1.value.unit).toBe('KG');

      expect(q2.isSuccess).toBe(true);
      expect(q2.value.amount.toString()).toBe('10.5');

      expect(q3.isSuccess).toBe(true);
      expect(q3.value.amount.toString()).toBe('10.5555');
    });

    it('should normalize unit codes to uppercase and trimmed', () => {
      const q = Quantity.of(5, '  kg  ');
      expect(q.isSuccess).toBe(true);
      expect(q.value.unit).toBe('KG');
    });

    it('should create zero quantity', () => {
      const q = Quantity.zero('ADET');
      expect(q.isZero()).toBe(true);
      expect(q.amount.toString()).toBe('0');
      expect(q.unit).toBe('ADET');
    });

    it('should reject negative quantities', () => {
      const res = Quantity.of(-1, 'KG');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidQuantityError);
      expect(res.error.message).toContain('Quantity cannot be negative');
    });

    it('should reject quantities with more than 4 decimal places (Q2 rule)', () => {
      const res = Quantity.of('1.12345', 'KG');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidQuantityError);
      expect(res.error.message).toContain('cannot exceed 4 decimal places');
    });

    it('should accept quantities with exactly 4 decimal places', () => {
      const res = Quantity.of('1.1234', 'KG');
      expect(res.isSuccess).toBe(true);
    });

    it('should reject invalid non-numeric inputs', () => {
      const res = Quantity.of('invalid-number', 'KG');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidQuantityError);
    });

    it('should reject empty unit codes', () => {
      const res = Quantity.of(10, '   ');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidQuantityError);
    });
  });

  describe('Precision (Preventing IEEE 754 float errors)', () => {
    it('should precisely calculate 0.1 + 0.2 without binary float loss', () => {
      const q1 = Quantity.of('0.1', 'KG').value;
      const q2 = Quantity.of('0.2', 'KG').value;

      const result = q1.add(q2);

      expect(result.isSuccess).toBe(true);
      // In JS float: 0.1 + 0.2 = 0.30000000000000004
      // In Quantity (Decimal): exactly '0.3'
      expect(result.value.amount.toString()).toBe('0.3');
    });
  });

  describe('Arithmetic Operations', () => {
    it('should add quantities with same unit', () => {
      const q1 = Quantity.of('15.25', 'KG').value;
      const q2 = Quantity.of('4.75', 'KG').value;

      const sum = q1.add(q2);

      expect(sum.isSuccess).toBe(true);
      expect(sum.value.amount.toString()).toBe('20');
      expect(sum.value.unit).toBe('KG');
    });

    it('should fail adding quantities with mismatched units', () => {
      const q1 = Quantity.of(10, 'KG').value;
      const q2 = Quantity.of(5, 'METRE').value;

      const sum = q1.add(q2);

      expect(sum.isFailure).toBe(true);
      expect(sum.error).toBeInstanceOf(UnitMismatchError);
    });

    it('should subtract quantities with same unit', () => {
      const q1 = Quantity.of('20.5', 'KG').value;
      const q2 = Quantity.of('5.5', 'KG').value;

      const diff = q1.subtract(q2);

      expect(diff.isSuccess).toBe(true);
      expect(diff.value.amount.toString()).toBe('15');
    });

    it('should fail subtracting when resulting quantity would be negative', () => {
      const q1 = Quantity.of(5, 'KG').value;
      const q2 = Quantity.of(10, 'KG').value;

      const diff = q1.subtract(q2);

      expect(diff.isFailure).toBe(true);
      expect(diff.error).toBeInstanceOf(InvalidQuantityError);
      expect(diff.error.message).toContain('Insufficient quantity');
    });

    it('should fail subtracting with mismatched units', () => {
      const q1 = Quantity.of(10, 'KG').value;
      const q2 = Quantity.of(5, 'ADET').value;

      const diff = q1.subtract(q2);

      expect(diff.isFailure).toBe(true);
      expect(diff.error).toBeInstanceOf(UnitMismatchError);
    });
  });

  describe('Comparison & Equality', () => {
    it('should compare values correctly', () => {
      const qSmall = Quantity.of('5.5', 'KG').value;
      const qLarge = Quantity.of('10.2', 'KG').value;

      expect(qLarge.isGreaterThan(qSmall)).toBe(true);
      expect(qSmall.isGreaterThan(qLarge)).toBe(false);
      expect(qLarge.isGreaterThanOrEqual(qSmall)).toBe(true);
    });

    it('should throw UnitMismatchError on comparison with different unit', () => {
      const qKg = Quantity.of(10, 'KG').value;
      const qMetre = Quantity.of(5, 'METRE').value;

      expect(() => qKg.isGreaterThan(qMetre)).toThrow(UnitMismatchError);
    });

    it('should determine equality based on both value and unit', () => {
      const q1 = Quantity.of('10.0', 'KG').value;
      const q2 = Quantity.of('10', 'KG').value;
      const q3 = Quantity.of('10', 'ADET').value;
      const q4 = Quantity.of('11', 'KG').value;

      expect(q1.equals(q2)).toBe(true);
      expect(q1.equals(q3)).toBe(false);
      expect(q1.equals(q4)).toBe(false);
      expect(q1.equals(null)).toBe(false);
    });
  });
});

