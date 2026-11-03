import { Decimal } from 'decimal.js';
import { Result } from '../../../../shared/kernel/result.js';
import {
  InvalidQuantityError,
  UnitMismatchError,
} from '../errors/index.js';

/**
 * Quantity Value Object
 *
 * Miktarlar için ondalık hassasiyetli (Decimal), değişmez (immutable) değer nesnesi.
 * float/number hesaplamalarından kaynaklı kayıpları engeller.
 * Q2 Kararı: Ondalıklı miktar desteklenir, maksimum 4 ondalık basamak.
 * Q5 Kararı: v1'de birim kodu normalize string (KG, ADET vb.) olarak tutulur.
 */
export class Quantity {
  public static readonly MAX_DECIMAL_PLACES = 4;

  private constructor(
    private readonly _amount: Decimal,
    private readonly _unit: string,
  ) { }

  public get amount(): Decimal {
    return this._amount;
  }

  public get unit(): string {
    return this._unit;
  }

  public static of(
    amount: Decimal | string | number,
    unit: string,
  ): Result<Quantity, InvalidQuantityError> {
    if (!unit || typeof unit !== 'string' || unit.trim().length === 0) {
      return Result.fail(
        new InvalidQuantityError('Measurement unit code cannot be empty.'),
      );
    }

    const normalizedUnit = unit.trim().toUpperCase();

    let decAmount: Decimal;
    try {
      decAmount = new Decimal(amount);
    } catch {
      return Result.fail(
        new InvalidQuantityError(`Invalid numeric quantity: '${String(amount)}'.`),
      );
    }

    if (decAmount.isNaN() || !decAmount.isFinite()) {
      return Result.fail(
        new InvalidQuantityError('Quantity amount must be a finite number.'),
      );
    }

    if (decAmount.isNegative()) {
      return Result.fail(
        new InvalidQuantityError(
          `Quantity cannot be negative: received '${decAmount.toString()}'.`,
        ),
      );
    }

    if (decAmount.decimalPlaces() > Quantity.MAX_DECIMAL_PLACES) {
      return Result.fail(
        new InvalidQuantityError(
          `Quantity cannot exceed ${Quantity.MAX_DECIMAL_PLACES} decimal places. Received: '${decAmount.toString()}'.`,
        ),
      );
    }

    return Result.ok(new Quantity(decAmount, normalizedUnit));
  }

  public static zero(unit: string): Quantity {
    const res = Quantity.of(0, unit);
    if (res.isFailure) {
      throw res.error;
    }
    return res.value;
  }

  public add(other: Quantity): Result<Quantity, UnitMismatchError> {
    if (this._unit !== other._unit) {
      return Result.fail(new UnitMismatchError(this._unit, other._unit));
    }
    return Quantity.of(this._amount.plus(other._amount), this._unit) as Result<
      Quantity,
      UnitMismatchError
    >;
  }

  public subtract(
    other: Quantity,
  ): Result<Quantity, UnitMismatchError | InvalidQuantityError> {
    if (this._unit !== other._unit) {
      return Result.fail(new UnitMismatchError(this._unit, other._unit));
    }

    const resultAmount = this._amount.minus(other._amount);
    if (resultAmount.isNegative()) {
      return Result.fail(
        new InvalidQuantityError(
          `Insufficient quantity: Cannot subtract '${other._amount.toString()}' from '${this._amount.toString()}'.`,
        ),
      );
    }

    return Quantity.of(resultAmount, this._unit);
  }

  public isGreaterThan(other: Quantity): boolean {
    this.assertSameUnit(other);
    return this._amount.greaterThan(other._amount);
  }

  public isGreaterThanOrEqual(other: Quantity): boolean {
    this.assertSameUnit(other);
    return this._amount.greaterThanOrEqualTo(other._amount);
  }

  public isZero(): boolean {
    return this._amount.isZero();
  }

  public equals(other: Quantity | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return (
      this._unit === other._unit && this._amount.equals(other._amount)
    );
  }

  public toString(): string {
    return `${this._amount.toString()} ${this._unit}`;
  }

  private assertSameUnit(other: Quantity): void {
    if (this._unit !== other._unit) {
      throw new UnitMismatchError(this._unit, other._unit);
    }
  }
}

