import { Result } from '../../../../shared/kernel/result.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import { MovementReference } from '../value-objects/movement-reference.vo.js';
import {
  StockMovementType,
  getMovementDirection,
  getOppositeMovementType,
  MovementDirection,
} from './stock-movement-type.enum.js';
import {
  InvalidQuantityError,
  MovementAlreadyReversedError,
  InvalidArgumentError,
  DomainError,
} from '../errors/index.js';

export interface CreateStockMovementProps {
  id?: string;
  tenantId: string;
  type: StockMovementType;
  warehouseId: string;
  productId: string;
  quantity: Quantity;
  occurredAt?: Date;
  reference?: MovementReference;
  reversesMovementId?: string;
  createdBy: string;
  note?: string;
}

export interface ReconstituteStockMovementProps {
  id: string;
  tenantId: string;
  type: StockMovementType;
  warehouseId: string;
  productId: string;
  quantity: Quantity;
  occurredAt: Date;
  reference?: MovementReference;
  reversesMovementId?: string;
  isReversed: boolean;
  createdBy: string;
  note?: string;
}

/**
 * StockMovement Entity (Append-Only)
 *
 * Stok hareketleri değiştirilemez ve silinemez tekil ledger kayıtlarıdır.
 * Miktar her zaman pozitiftir; hareketin yönü (giriş/çıkış) tipinden türetilir.
 * Düzeltmeler fiziksel silmeyle değil, ters hareketle (reversal) yapılır.
 */
export class StockMovement {
  private readonly _id: string;
  private readonly _tenantId: string;
  private readonly _type: StockMovementType;
  private readonly _warehouseId: string;
  private readonly _productId: string;
  private readonly _quantity: Quantity;
  private readonly _occurredAt: Date;
  private readonly _reference?: MovementReference;
  private readonly _reversesMovementId?: string;
  private _isReversed: boolean;
  private readonly _createdBy: string;
  private readonly _note?: string;

  private constructor(
    id: string,
    tenantId: string,
    type: StockMovementType,
    warehouseId: string,
    productId: string,
    quantity: Quantity,
    occurredAt: Date,
    reference: MovementReference | undefined,
    reversesMovementId: string | undefined,
    isReversed: boolean,
    createdBy: string,
    note: string | undefined,
  ) {
    this._id = id;
    this._tenantId = tenantId;
    this._type = type;
    this._warehouseId = warehouseId;
    this._productId = productId;
    this._quantity = quantity;
    this._occurredAt = occurredAt;
    this._reference = reference;
    this._reversesMovementId = reversesMovementId;
    this._isReversed = isReversed;
    this._createdBy = createdBy;
    this._note = note;
  }

  public get id(): string {
    return this._id;
  }

  public get tenantId(): string {
    return this._tenantId;
  }

  public get type(): StockMovementType {
    return this._type;
  }

  public get direction(): MovementDirection {
    return getMovementDirection(this._type);
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

  public get occurredAt(): Date {
    return this._occurredAt;
  }

  public get reference(): MovementReference | undefined {
    return this._reference;
  }

  public get reversesMovementId(): string | undefined {
    return this._reversesMovementId;
  }

  public get isReversed(): boolean {
    return this._isReversed;
  }

  public get createdBy(): string {
    return this._createdBy;
  }

  public get note(): string | undefined {
    return this._note;
  }

  /**
   * Fabrika Metodu: Yeni stok hareketi üretimi
   */
  public static create(
    props: CreateStockMovementProps,
  ): Result<StockMovement, DomainError> {
    if (!props.tenantId?.trim()) {
      return Result.fail(new InvalidArgumentError('Tenant ID is required.'));
    }
    if (!props.warehouseId?.trim()) {
      return Result.fail(new InvalidArgumentError('Warehouse ID is required.'));
    }
    if (!props.productId?.trim()) {
      return Result.fail(new InvalidArgumentError('Product ID is required.'));
    }
    if (!props.createdBy?.trim()) {
      return Result.fail(new InvalidArgumentError('CreatedBy user ID is required.'));
    }
    if (props.quantity.isZero()) {
      return Result.fail(
        new InvalidQuantityError('Movement quantity must be greater than zero.'),
      );
    }

    const id = props.id ?? crypto.randomUUID();
    const occurredAt = props.occurredAt ?? new Date();

    return Result.ok(
      new StockMovement(
        id,
        props.tenantId.trim(),
        props.type,
        props.warehouseId.trim(),
        props.productId.trim(),
        props.quantity,
        occurredAt,
        props.reference,
        props.reversesMovementId,
        false, // Başlangıçta tersine çevrilmemiştir
        props.createdBy.trim(),
        props.note?.trim(),
      ),
    );
  }

  /**
   * Veritabanından geri yükleme (Reconstitution)
   */
  public static reconstitute(
    props: ReconstituteStockMovementProps,
  ): StockMovement {
    return new StockMovement(
      props.id,
      props.tenantId,
      props.type,
      props.warehouseId,
      props.productId,
      props.quantity,
      props.occurredAt,
      props.reference,
      props.reversesMovementId,
      props.isReversed,
      props.createdBy,
      props.note,
    );
  }

  /**
   * Hatalı veya iptal edilen bir hareketi tersine çevirir (Reversal).
   * Orijinal hareket işaretlenir ve tam zıt yönde yeni bir hareket döner.
   */
  public reverse(
    reversalId: string | undefined,
    createdBy: string,
    note?: string,
  ): Result<StockMovement, MovementAlreadyReversedError | DomainError> {
    if (this._isReversed) {
      return Result.fail(new MovementAlreadyReversedError(this._id));
    }

    if (!createdBy?.trim()) {
      return Result.fail(new InvalidArgumentError('CreatedBy is required for reversal.'));
    }

    // Orijinal hareket işaretlenir (Aynı hareket iki kez tersine çevrilemez)
    this._isReversed = true;

    // Tam zıt hareket tipi üretilir
    const oppositeType = getOppositeMovementType(this._type);

    return StockMovement.create({
      id: reversalId,
      tenantId: this._tenantId,
      type: oppositeType,
      warehouseId: this._warehouseId,
      productId: this._productId,
      quantity: this._quantity,
      occurredAt: new Date(),
      reference: this._reference,
      reversesMovementId: this._id,
      createdBy,
      note: note ?? `Reversal of movement ${this._id}`,
    });
  }
}
