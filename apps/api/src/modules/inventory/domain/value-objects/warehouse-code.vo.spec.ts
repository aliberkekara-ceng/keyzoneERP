import { describe, it, expect } from 'vitest';
import { WarehouseCode } from './warehouse-code.vo.js';
import { InvalidWarehouseCodeError } from '../errors/index.js';

describe('WarehouseCode Value Object', () => {
  it('should create valid warehouse code with normalization', () => {
    const res = WarehouseCode.of('  wh-ist-01  ');
    expect(res.isSuccess).toBe(true);
    expect(res.value.value).toBe('WH-IST-01');
    expect(res.value.toString()).toBe('WH-IST-01');
  });

  it('should accept valid alphanumeric codes with hyphens', () => {
    expect(WarehouseCode.of('A1').isSuccess).toBe(true);
    expect(WarehouseCode.of('MAIN-WAREHOUSE-99').isSuccess).toBe(true);
  });

  it('should reject codes that are too short (< 2 characters)', () => {
    const res = WarehouseCode.of('A');
    expect(res.isFailure).toBe(true);
    expect(res.error).toBeInstanceOf(InvalidWarehouseCodeError);
  });

  it('should reject codes that are too long (> 20 characters)', () => {
    const res = WarehouseCode.of('A-12345678901234567890');
    expect(res.isFailure).toBe(true);
    expect(res.error).toBeInstanceOf(InvalidWarehouseCodeError);
  });

  it('should reject codes with invalid characters (symbols, spaces)', () => {
    expect(WarehouseCode.of('WH_01').isFailure).toBe(true); // underscore not allowed
    expect(WarehouseCode.of('WH 01').isFailure).toBe(true); // space not allowed
    expect(WarehouseCode.of('WH#01').isFailure).toBe(true);
  });

  it('should compare equality correctly', () => {
    const code1 = WarehouseCode.of('WH-01').value;
    const code2 = WarehouseCode.of('wh-01').value;
    const code3 = WarehouseCode.of('WH-02').value;

    expect(code1.equals(code2)).toBe(true);
    expect(code1.equals(code3)).toBe(false);
    expect(code1.equals(null)).toBe(false);
  });
});

