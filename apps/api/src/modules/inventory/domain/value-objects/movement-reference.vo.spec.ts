import { describe, it, expect } from 'vitest';
import { MovementReference } from './movement-reference.vo.js';
import { InvalidReferenceError } from '../errors/index.js';

describe('MovementReference Value Object', () => {
  it('should create valid reference with normalization', () => {
    const res = MovementReference.of('  sales_order  ', '  ord-12345  ');
    expect(res.isSuccess).toBe(true);
    expect(res.value.type).toBe('SALES_ORDER');
    expect(res.value.id).toBe('ord-12345');
    expect(res.value.toString()).toBe('SALES_ORDER:ord-12345');
  });

  it('should reject empty reference type', () => {
    const res = MovementReference.of('', 'ord-123');
    expect(res.isFailure).toBe(true);
    expect(res.error).toBeInstanceOf(InvalidReferenceError);
  });

  it('should reject empty reference id', () => {
    const res = MovementReference.of('SALES_ORDER', '   ');
    expect(res.isFailure).toBe(true);
    expect(res.error).toBeInstanceOf(InvalidReferenceError);
  });

  it('should compare equality correctly', () => {
    const ref1 = MovementReference.of('ORDER', '123').value;
    const ref2 = MovementReference.of('order', '123').value;
    const ref3 = MovementReference.of('PURCHASE', '123').value;
    const ref4 = MovementReference.of('ORDER', '456').value;

    expect(ref1.equals(ref2)).toBe(true);
    expect(ref1.equals(ref3)).toBe(false);
    expect(ref1.equals(ref4)).toBe(false);
    expect(ref1.equals(null)).toBe(false);
  });
});

