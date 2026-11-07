import { AggregateRoot } from '../../../../shared/kernel/aggregate-root.js';
import { Result } from '../../../../shared/kernel/result.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import { MovementReference } from '../value-objects/movement-reference.vo.js';
import { ReservationStatus } from './reservation-status.enum.js';
import {
  InvalidArgumentError,
  InvalidQuantityError,
  InvalidReservationStatusTransitionError,
  ReservationExpiredError,
  DomainError,
} from '../errors/index.js';
import {
  StockReserved,
  StockReservationReleased,
  StockReservationConsumed,
} from '../events/index.js';

export interface CreateReservationProps {
  id?: string;
  tenantId: string;
  warehouseId: string;
  productId: string;
  quantity: Quantity;
  reference: MovementReference;
  expiresAt?: Date | null;
  occurredAt?: Date;
}

export interface ReconstituteReservationProps {
  id: string;
  tenantId: string;
  warehouseId: string;
  productId: string;
  quantity: Quantity;
  reference: MovementReference;
  status: ReservationStatus;
  expiresAt: Date | null;
  consumedMovementId?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reservation Aggregate Root
 *
 * Belirli bir depo ve ürüne ait stok miktarını geçici veya kesin olarak bloke eder.
 * Durum makinesi:
 *   [ACTIVE] ─── release() ───> [RELEASED] (Terminal)
 *   [ACTIVE] ─── consume() ───> [CONSUMED] (Terminal)
 *
 * RELEASED veya CONSUMED durumundaki bir rezervasyon başka bir duruma geçirilemez.
 */
export class Reservation extends AggregateRoot<string> {
  private readonly _tenantId: string;
  private readonly _warehouseId: string;
  private readonly _productId: string;
  private readonly _quantity: Quantity;
  private readonly _reference: MovementReference;
  private _status: ReservationStatus;
  private readonly _expiresAt: Date | null;
  private _consumedMovementId: string | null;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    tenantId: string,
    warehouseId: string,
    productId: string,
    quantity: Quantity,
    reference: MovementReference,
    status: ReservationStatus,
    expiresAt: Date | null,
    consumedMovementId: string | null,
    version: number,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id);
    this._tenantId = tenantId;
    this._warehouseId = warehouseId;
    this._productId = productId;
    this._quantity = quantity;
    this._reference = reference;
    this._status = status;
    this._expiresAt = expiresAt;
    this._consumedMovementId = consumedMovementId;
    this._version = version;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  // --- Read-Only Getters ---

  public get tenantId(): string {
    return this._tenantId;
  }

  public get warehouseId(): string {
    return this._warehouseId;
  }

  public get productId(): string {
    return this._productId;
  }

  public get quantity(): Quantity {
    return this._quantity;
  }

  public get reference(): MovementReference {
    return this._reference;
  }

  public get status(): ReservationStatus {
    return this._status;
  }

  public get expiresAt(): Date | null {
    return this._expiresAt;
  }

  public get consumedMovementId(): string | null {
    return this._consumedMovementId;
  }

  public get version(): number {
    return this._version;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public isActive(): boolean {
    return this._status === ReservationStatus.ACTIVE;
  }

  public isReleased(): boolean {
    return this._status === ReservationStatus.RELEASED;
  }

  public isConsumed(): boolean {
    return this._status === ReservationStatus.CONSUMED;
  }

  public isExpired(now: Date = new Date()): boolean {
    if (!this._expiresAt) {
      return false;
    }
    return now.getTime() > this._expiresAt.getTime();
  }

  // --- Factory Methods ---

  /**
   * Yeni rezervasyon oluşturma (Client Intent)
   */
  public static create(
    props: CreateReservationProps,
  ): Result<Reservation, DomainError> {
    if (!props.tenantId?.trim()) {
      return Result.fail(new InvalidArgumentError('Tenant ID is required.'));
    }
    if (!props.warehouseId?.trim()) {
      return Result.fail(new InvalidArgumentError('Warehouse ID is required.'));
    }
    if (!props.productId?.trim()) {
      return Result.fail(new InvalidArgumentError('Product ID is required.'));
    }
    if (!props.reference) {
      return Result.fail(new InvalidArgumentError('MovementReference is required.'));
    }
    if (!props.quantity || props.quantity.isZero()) {
      return Result.fail(
        new InvalidQuantityError('Reservation quantity must be greater than zero.'),
      );
    }

    const now = props.occurredAt ?? new Date();

    if (props.expiresAt && props.expiresAt.getTime() <= now.getTime()) {
      return Result.fail(
        new InvalidArgumentError('Reservation expiration date must be in the future.'),
      );
    }

    const id = props.id ?? crypto.randomUUID();

    const reservation = new Reservation(
      id,
      props.tenantId.trim(),
      props.warehouseId.trim(),
      props.productId.trim(),
      props.quantity,
      props.reference,
      ReservationStatus.ACTIVE,
      props.expiresAt ?? null,
      null, // Henüz tüketilmedi
      1, // Başlangıç versiyonu
      now,
      now,
    );

    // Domain event outbox için aggregate içinde toplanır
    reservation.addDomainEvent(
      new StockReserved(
        id,
        reservation.tenantId,
        reservation.warehouseId,
        reservation.productId,
        {
          amount: reservation.quantity.amount.toString(),
          unit: reservation.quantity.unit,
        },
        {
          type: reservation.reference.type,
          id: reservation.reference.id,
        },
        reservation.expiresAt,
        now,
      ),
    );

    return Result.ok(reservation);
  }

  /**
   * Veritabanından geri yükleme (Reconstitution)
   */
  public static reconstitute(
    props: ReconstituteReservationProps,
  ): Reservation {
    return new Reservation(
      props.id,
      props.tenantId,
      props.warehouseId,
      props.productId,
      props.quantity,
      props.reference,
      props.status,
      props.expiresAt,
      props.consumedMovementId ?? null,
      props.version,
      props.createdAt,
      props.updatedAt,
    );
  }

  // --- State Transitions (Behavior Methods) ---

  /**
   * Rezervasyonu serbest bırakır (ACTIVE -> RELEASED)
   */
  public release(now: Date = new Date()): Result<void, DomainError> {
    if (this._status !== ReservationStatus.ACTIVE) {
      return Result.fail(
        new InvalidReservationStatusTransitionError(
          this._id,
          this._status,
          ReservationStatus.RELEASED,
        ),
      );
    }

    this._status = ReservationStatus.RELEASED;
    this._updatedAt = now;

    this.addDomainEvent(
      new StockReservationReleased(
        this._id,
        this._tenantId,
        this._warehouseId,
        this._productId,
        {
          amount: this._quantity.amount.toString(),
          unit: this._quantity.unit,
        },
        now,
      ),
    );

    return Result.ok(undefined);
  }

  /**
   * Rezervasyonu stok çıkışı ile tüketir (ACTIVE -> CONSUMED)
   */
  public consume(
    movementId: string,
    now: Date = new Date(),
  ): Result<void, DomainError> {
    if (!movementId?.trim()) {
      return Result.fail(
        new InvalidArgumentError('Consumed stock movement ID is required.'),
      );
    }

    if (this._status !== ReservationStatus.ACTIVE) {
      return Result.fail(
        new InvalidReservationStatusTransitionError(
          this._id,
          this._status,
          ReservationStatus.CONSUMED,
        ),
      );
    }

    if (this.isExpired(now)) {
      return Result.fail(
        new ReservationExpiredError(this._id, this._expiresAt!),
      );
    }

    this._status = ReservationStatus.CONSUMED;
    this._consumedMovementId = movementId.trim();
    this._updatedAt = now;

    this.addDomainEvent(
      new StockReservationConsumed(
        this._id,
        this._tenantId,
        this._warehouseId,
        this._productId,
        {
          amount: this._quantity.amount.toString(),
          unit: this._quantity.unit,
        },
        this._consumedMovementId,
        now,
      ),
    );

    return Result.ok(undefined);
  }
}

