import { Decimal } from 'decimal.js';
import { Result } from '../../../../shared/kernel/result.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import { StockMovement } from './stock-movement.entity.js';
import { StockPolicy } from '../services/stock-policy.service.js';
import {
  InsufficientStockError,
  InsufficientAvailableStockError,
  InvalidQuantityError,
  UnitMismatchError,
  InvalidArgumentError,
  StockBalanceMismatchError,
  DomainError,
} from '../errors/index.js';

export interface CreateStockBalanceProps {
  tenantId: string;
  warehouseId: string;
  productId: string;
  unit: string;
  initialOnHand?: Decimal | string | number;
  initialReserved?: Decimal | string | number;
}

export interface ReconstituteStockBalanceProps {
  tenantId: string;
  warehouseId: string;
  productId: string;
  unit: string;
  onHand: Decimal;
  reserved: Decimal;
  version: number;
}

/**
 * StockBalance Aggregate Root (Projeksiyon)
 *
 * Bir (tenantId, warehouseId, productId) üçlüsü için hareketlerden türetilen
 * güncel stok bakiyesini ve rezervasyon durumunu korur.
 *
 * Invariant'lar:
 * 1. reserved >= 0
 * 2. allowNegativeStock=false iken: onHand >= 0 ve reserved <= onHand
 * 3. Bakiye sadece StockMovement uygulanarak değişir (Direct mutation yasak).
 */
export class StockBalance {
  private readonly _tenantId: string;
  private readonly _warehouseId: string;
  private readonly _productId: string;
  private readonly _unit: string;
  private _onHand: Decimal;
  private _reserved: Decimal;
  private _version: number;

  private constructor(
    tenantId: string,
    warehouseId: string,
    productId: string,
    unit: string,
    onHand: Decimal,
    reserved: Decimal,
    version: number,
  ) {
    this._tenantId = tenantId;
    this._warehouseId = warehouseId;
    this._productId = productId;
    this._unit = unit;
    this._onHand = onHand;
    this._reserved = reserved;
    this._version = version;
  }

  public get tenantId(): string {
    return this._tenantId;
  }

  public get warehouseId(): string {
    return this._warehouseId;
  }

  public get productId(): string {
    return this._productId;
  }

  public get unit(): string {
    return this._unit;
  }

  public get onHand(): Decimal {
    return this._onHand;
  }

  public get reserved(): Decimal {
    return this._reserved;
  }

  public get version(): number {
    return this._version;
  }

  /**
   * Kullanılabilir miktar: OnHand - Reserved
   * Negatif stok serbest değilse ve bakiye eksiye düşmüşse en az 0 döner.
   */
  public get availableAmount(): Decimal {
    const avail = this._onHand.minus(this._reserved);
    return avail.isNegative() ? new Decimal(0) : avail;
  }

  /**
   * Fabrika Metodu: Sıfır bakiye ile yeni stok dengesi oluşturur
   */
  public static create(
    props: CreateStockBalanceProps,
  ): Result<StockBalance, DomainError> {
    if (!props.tenantId?.trim()) {
      return Result.fail(new InvalidArgumentError('Tenant ID is required.'));
    }
    if (!props.warehouseId?.trim()) {
      return Result.fail(new InvalidArgumentError('Warehouse ID is required.'));
    }
    if (!props.productId?.trim()) {
      return Result.fail(new InvalidArgumentError('Product ID is required.'));
    }
    if (!props.unit?.trim()) {
      return Result.fail(new InvalidArgumentError('Unit is required.'));
    }

    const onHand = props.initialOnHand
      ? new Decimal(props.initialOnHand)
      : new Decimal(0);
    const reserved = props.initialReserved
      ? new Decimal(props.initialReserved)
      : new Decimal(0);

    return Result.ok(
      new StockBalance(
        props.tenantId.trim(),
        props.warehouseId.trim(),
        props.productId.trim(),
        props.unit.trim().toUpperCase(),
        onHand,
        reserved,
        1, // Başlangıç versiyonu
      ),
    );
  }

  /**
   * Veritabanından geri yükleme (Reconstitution)
   */
  public static reconstitute(props: ReconstituteStockBalanceProps): StockBalance {
    return new StockBalance(
      props.tenantId,
      props.warehouseId,
      props.productId,
      props.unit,
      props.onHand,
      props.reserved,
      props.version,
    );
  }

  /**
   * Bir stok hareketini bakiyeye uygular (Apply Movement)
   * İş kurallarını (negatif stok, birim, depo uyuşmazlığı) denetler.
   */
  public apply(
    movement: StockMovement,
    policy: StockPolicy,
    allowNegativeStock: boolean,
  ): Result<void, DomainError> {
    // 1. Modül ve bağlam kontrolleri
    if (movement.tenantId !== this._tenantId) {
      return Result.fail(
        new StockBalanceMismatchError('Movement tenant does not match balance tenant.'),
      );
    }
    if (movement.warehouseId !== this._warehouseId) {
      return Result.fail(
        new StockBalanceMismatchError('Movement warehouse does not match balance warehouse.'),
      );
    }
    if (movement.productId !== this._productId) {
      return Result.fail(
        new StockBalanceMismatchError('Movement product does not match balance product.'),
      );
    }
    if (movement.quantity.unit !== this._unit) {
      return Result.fail(new UnitMismatchError(movement.quantity.unit, this._unit));
    }

    const amount = movement.quantity.amount;

    // 2. Giriş Hareketi (IN)
    if (movement.direction === 'IN') {
      this._onHand = policy.calculateNewOnHand(this._onHand, amount, 'IN');
      this._version++;
      return Result.ok(undefined);
    }

    // 3. Çıkış Hareketi (OUT)
    if (!policy.canIssue(this._onHand, amount, allowNegativeStock)) {
      return Result.fail(
        new InsufficientStockError(
          this._warehouseId,
          this._productId,
          movement.quantity.toString(),
          `${this._onHand.toString()} ${this._unit}`,
        ),
      );
    }

    const newOnHand = policy.calculateNewOnHand(this._onHand, amount, 'OUT');

    // Negatif stok kapalıyken eldeki miktar rezerve miktarın altına düşemez
    if (!allowNegativeStock && newOnHand.lessThan(this._reserved)) {
      return Result.fail(
        new InsufficientAvailableStockError(
          this._warehouseId,
          this._productId,
          movement.quantity.toString(),
          `${this.availableAmount.toString()} ${this._unit}`,
        ),
      );
    }

    this._onHand = newOnHand;
    this._version++;
    return Result.ok(undefined);
  }

  /**
   * Stok rezerve eder (Kullanılabilir miktarı azaltır, Reserved miktarını artırır)
   */
  public reserve(
    qty: Quantity,
    policy: StockPolicy,
  ): Result<void, InsufficientAvailableStockError | UnitMismatchError> {
    if (qty.unit !== this._unit) {
      return Result.fail(new UnitMismatchError(qty.unit, this._unit));
    }

    const available = this._onHand.minus(this._reserved);
    if (!policy.canReserve(available, qty.amount)) {
      return Result.fail(
        new InsufficientAvailableStockError(
          this._warehouseId,
          this._productId,
          qty.toString(),
          `${this.availableAmount.toString()} ${this._unit}`,
        ),
      );
    }

    this._reserved = this._reserved.plus(qty.amount);
    this._version++;
    return Result.ok(undefined);
  }

  /**
   * Rezervasyonu serbest bırakır / iptal eder
   */
  public releaseReservation(
    qty: Quantity,
  ): Result<void, InvalidQuantityError | UnitMismatchError> {
    if (qty.unit !== this._unit) {
      return Result.fail(new UnitMismatchError(qty.unit, this._unit));
    }

    if (qty.amount.greaterThan(this._reserved)) {
      return Result.fail(
        new InvalidQuantityError(
          `Cannot release ${qty.toString()}. Currently reserved: ${this._reserved.toString()} ${this._unit}.`,
        ),
      );
    }

    this._reserved = this._reserved.minus(qty.amount);
    this._version++;
    return Result.ok(undefined);
  }
}
