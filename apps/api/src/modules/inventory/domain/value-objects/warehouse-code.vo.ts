import { Result } from '../../../../shared/kernel/result.js';
import { InvalidWarehouseCodeError } from '../errors/index.js';

/**
 * WarehouseCode Value Object
 *
 * Depo kodları için biçim doğrulamalı, değişmez (immutable) değer nesnesi.
 * Kural: 2–20 karakter, yalnızca büyük harf, rakam ve tire (-).
 * Otomatik olarak büyük harfe normalize edilir.
 */
export class WarehouseCode {
  private static readonly CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;

  private constructor(private readonly _value: string) { }

  public get value(): string {
    return this._value;
  }

  public static of(
    rawCode: string,
  ): Result<WarehouseCode, InvalidWarehouseCodeError> {
    if (!rawCode || typeof rawCode !== 'string') {
      return Result.fail(new InvalidWarehouseCodeError(String(rawCode)));
    }

    const normalized = rawCode.trim().toUpperCase();

    if (!WarehouseCode.CODE_PATTERN.test(normalized)) {
      return Result.fail(new InvalidWarehouseCodeError(normalized));
    }

    return Result.ok(new WarehouseCode(normalized));
  }

  public equals(other: WarehouseCode | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}

