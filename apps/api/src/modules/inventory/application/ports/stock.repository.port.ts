import { StockBalance } from '../../domain/entities/stock-balance.entity.js';
import { StockMovement } from '../../domain/entities/stock-movement.entity.js';

/**
 * StockRepositoryPort
 *
 * Stok bakiyesi (StockBalance) ve stok hareketleri (StockMovement — append-only)
 * için kalıcılık (persistence) sözleşmesidir.
 * Prisma veya SQL detayları içermez; yalnızca saf domain nesneleriyle konuşur.
 */
export interface StockRepositoryPort {
  findBalance(
    tenantId: string,
    warehouseId: string,
    productId: string,
  ): Promise<StockBalance | null>;

  saveBalance(balance: StockBalance): Promise<void>;

  findMovementById(
    tenantId: string,
    movementId: string,
  ): Promise<StockMovement | null>;

  /**
   * Stok hareketleri append-only'dir; yalnızca eklenir (INSERT), güncellenemez/silinemez.
   */
  appendMovement(movement: StockMovement): Promise<void>;
}
