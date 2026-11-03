import { Result } from '../../../../shared/kernel/result.js';
import { InvalidReferenceError } from '../errors/index.js';

/**
 * MovementReference Value Object
 *
 * Stok hareketlerinin dayandığı kaynak belgeyi (Sipariş, İrsaliye, Sayım Belgesi vb.)
 * temsil eden değişmez (immutable) değer nesnesi.
 */
export class MovementReference {
  private constructor(
    private readonly _type: string,
    private readonly _id: string,
  ) {}

  public get type(): string {
    return this._type;
  }

  public get id(): string {
    return this._id;
  }

  public static of(
    type: string,
    id: string,
  ): Result<MovementReference, InvalidReferenceError> {
    if (!type || typeof type !== 'string' || type.trim().length === 0) {
      return Result.fail(
        new InvalidReferenceError('Reference type cannot be empty.'),
      );
    }

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return Result.fail(
        new InvalidReferenceError('Reference ID cannot be empty.'),
      );
    }

    const normalizedType = type.trim().toUpperCase();
    const normalizedId = id.trim();

    return Result.ok(new MovementReference(normalizedType, normalizedId));
  }

  public equals(other: MovementReference | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this._type === other._type && this._id === other._id;
  }

  public toString(): string {
    return `${this._type}:${this._id}`;
  }
}

