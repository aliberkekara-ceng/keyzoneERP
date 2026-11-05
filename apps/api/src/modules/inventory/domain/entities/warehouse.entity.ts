import { AggregateRoot } from '../../../../shared/kernel/aggregate-root.js';
import { Result } from '../../../../shared/kernel/result.js';
import { WarehouseCode } from '../value-objects/warehouse-code.vo.js';
import {
  InvalidWarehouseNameError,
  WarehouseInactiveError,
  WarehouseAlreadyActiveError,
  WarehouseAlreadyInactiveError,
  DomainError,
} from '../errors/index.js';
import {
  WarehouseCreated,
  WarehouseDeactivated,
} from '../events/index.js';

export interface CreateWarehouseProps {
  id?: string;
  tenantId: string;
  code: WarehouseCode;
  name: string;
  allowNegativeStock?: boolean;
}

export interface ReconstituteWarehouseProps {
  id: string;
  tenantId: string;
  code: WarehouseCode;
  name: string;
  isActive: boolean;
  allowNegativeStock: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Warehouse Aggregate Root
 *
 * Depo yaşam döngüsü ve kurallarını (invariants) yöneten aggregate root.
 * Setter içermez; tüm durum değişiklikleri açık iş davranışlarıyla yürütülür.
 */
export class Warehouse extends AggregateRoot<string> {
  private readonly _tenantId: string;
  private readonly _code: WarehouseCode;
  private _name: string;
  private _isActive: boolean;
  private _allowNegativeStock: boolean;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    tenantId: string,
    code: WarehouseCode,
    name: string,
    isActive: boolean,
    allowNegativeStock: boolean,
    version: number,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id);
    this._tenantId = tenantId;
    this._code = code;
    this._name = name;
    this._isActive = isActive;
    this._allowNegativeStock = allowNegativeStock;
    this._version = version;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  // --- Read-Only Getters (Dışarıdan doğrudan atama yapılamaz) ---
  public get tenantId(): string {
    return this._tenantId;
  }

  public get code(): WarehouseCode {
    return this._code;
  }

  public get name(): string {
    return this._name;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get allowNegativeStock(): boolean {
    return this._allowNegativeStock;
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

  /**
   * Fabrika Metodu: Yeni bir depo oluşturur ve WarehouseCreated event'i üretir.
   */
  public static create(
    props: CreateWarehouseProps,
  ): Result<Warehouse, InvalidWarehouseNameError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return Result.fail(new InvalidWarehouseNameError('Tenant ID is required.'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return Result.fail(new InvalidWarehouseNameError('Warehouse name cannot be empty.'));
    }

    const id = props.id ?? crypto.randomUUID();
    const now = new Date();
    const normalizedName = props.name.trim();
    const allowNegativeStock = props.allowNegativeStock ?? false;

    const warehouse = new Warehouse(
      id,
      props.tenantId,
      props.code,
      normalizedName,
      true, // Yeni depo varsayılan olarak aktiftir
      allowNegativeStock,
      1, // İlk versiyon
      now,
      now,
    );

    // Domain Event kaydedilir (Outbox için)
    warehouse.addDomainEvent(
      new WarehouseCreated(
        id,
        props.tenantId,
        props.code.value,
        normalizedName,
        now,
      ),
    );

    return Result.ok(warehouse);
  }

  /**
   * Veritabanından mevcut depoyu yüklemek için kullanılır (Event üretmez).
   */
  public static reconstitute(props: ReconstituteWarehouseProps): Warehouse {
    return new Warehouse(
      props.id,
      props.tenantId,
      props.code,
      props.name,
      props.isActive,
      props.allowNegativeStock,
      props.version,
      props.createdAt,
      props.updatedAt,
    );
  }

  /**
   * Depo adını günceller.
   */
  public rename(newName: string): Result<void, InvalidWarehouseNameError | WarehouseInactiveError> {
    if (!this._isActive) {
      return Result.fail(new WarehouseInactiveError(this._id));
    }

    if (!newName || newName.trim().length === 0) {
      return Result.fail(new InvalidWarehouseNameError('Warehouse name cannot be empty.'));
    }

    this._name = newName.trim();
    this._updatedAt = new Date();
    return Result.ok(undefined);
  }

  /**
   * Depoyu pasif duruma getirir ve WarehouseDeactivated event'i üretir.
   */
  public deactivate(): Result<void, WarehouseAlreadyInactiveError> {
    if (!this._isActive) {
      return Result.fail(new WarehouseAlreadyInactiveError(this._id));
    }

    this._isActive = false;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new WarehouseDeactivated(this._id, this._tenantId, this._updatedAt),
    );

    return Result.ok(undefined);
  }

  /**
   * Pasif depoyu tekrar aktif hale getirir.
   */
  public activate(): Result<void, WarehouseAlreadyActiveError> {
    if (this._isActive) {
      return Result.fail(new WarehouseAlreadyActiveError(this._id));
    }

    this._isActive = true;
    this._updatedAt = new Date();
    return Result.ok(undefined);
  }

  /**
   * Negatif stok politikasını değiştirir.
   */
  public changeNegativeStockPolicy(
    allow: boolean,
  ): Result<void, WarehouseInactiveError> {
    if (!this._isActive) {
      return Result.fail(new WarehouseInactiveError(this._id));
    }

    this._allowNegativeStock = allow;
    this._updatedAt = new Date();
    return Result.ok(undefined);
  }
}
