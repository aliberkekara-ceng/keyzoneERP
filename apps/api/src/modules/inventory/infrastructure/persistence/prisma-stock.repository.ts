import { Prisma, type PrismaClient } from '@prisma/client';
import { StockBalance } from '../../domain/entities/stock-balance.entity.js';
import { StockMovement } from '../../domain/entities/stock-movement.entity.js';
import {
  MovementAlreadyReversedError,
  OptimisticLockError,
} from '../../domain/errors/index.js';
import { StockRepositoryPort } from '../../application/ports/stock.repository.port.js';
import { StockBalanceMapper } from './stock-balance.mapper.js';
import { StockMovementMapper } from './stock-movement.mapper.js';
import {
  PrismaTransactionContext,
  type PrismaTransactionClient,
} from './prisma-transaction-context.js';

/**
 * PrismaStockRepository
 *
 * `StockRepositoryPort` sözleşmesinin Prisma/PostgreSQL implementasyonudur.
 * - `StockBalance` güncellemelerinde `version` üzerinden Optimistic Locking uygular.
 * - `StockMovement` kayıtlarını yalnızca `INSERT` (`appendMovement`) ile yazar (append-only).
 */
export class PrismaStockRepository implements StockRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  private get client(): PrismaClient | PrismaTransactionClient {
    return PrismaTransactionContext.getClient(this.prisma);
  }

  public async findBalance(
    tenantId: string,
    warehouseId: string,
    productId: string,
  ): Promise<StockBalance | null> {
    const record = await this.client.stockBalanceRecord.findUnique({
      where: {
        tenantId_warehouseId_productId: {
          tenantId,
          warehouseId,
          productId,
        },
      },
    });

    if (!record) {
      return null;
    }

    return StockBalanceMapper.toDomain(record);
  }

  public async saveBalance(balance: StockBalance): Promise<void> {
    const data = StockBalanceMapper.toPersistence(balance);
    const client = this.client;

    const existing = await client.stockBalanceRecord.findUnique({
      where: {
        tenantId_warehouseId_productId: {
          tenantId: data.tenantId,
          warehouseId: data.warehouseId,
          productId: data.productId,
        },
      },
      select: { version: true },
    });

    if (!existing) {
      try {
        await client.stockBalanceRecord.create({
          data: {
            ...data,
            version: 1,
          },
        });
        return;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new OptimisticLockError(
            'StockBalance',
            `${data.warehouseId}:${data.productId}`,
            data.version,
          );
        }
        throw error;
      }
    }

    const updated = await client.stockBalanceRecord.updateMany({
      where: {
        tenantId: data.tenantId,
        warehouseId: data.warehouseId,
        productId: data.productId,
        version: data.version,
      },
      data: {
        onHand: data.onHand,
        reserved: data.reserved,
        version: data.version + 1,
      },
    });

    if (updated.count === 0) {
      throw new OptimisticLockError(
        'StockBalance',
        `${data.warehouseId}:${data.productId}`,
        data.version,
      );
    }
  }

  public async findMovementById(
    tenantId: string,
    movementId: string,
  ): Promise<StockMovement | null> {
    const client = this.client;

    const record = await client.stockMovementRecord.findFirst({
      where: {
        id: movementId,
        tenantId,
      },
    });

    if (!record) {
      return null;
    }

    const reversalRecord = await client.stockMovementRecord.findFirst({
      where: {
        tenantId,
        reversesMovementId: record.id,
      },
      select: { id: true },
    });

    return StockMovementMapper.toDomain(record, reversalRecord !== null);
  }

  public async appendMovement(movement: StockMovement): Promise<void> {
    const data = StockMovementMapper.toPersistence(movement);

    try {
      await this.client.stockMovementRecord.create({
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        movement.reversesMovementId
      ) {
        throw new MovementAlreadyReversedError(movement.reversesMovementId);
      }
      throw error;
    }
  }
}

