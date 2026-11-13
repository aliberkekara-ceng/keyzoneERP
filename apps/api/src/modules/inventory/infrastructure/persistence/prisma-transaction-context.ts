import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma, PrismaClient } from '@prisma/client';

export type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * PrismaTransactionContext
 *
 * Node.js AsyncLocalStorage kullanarak aktif transaction nesnesini (tx)
 * iş parçacığı bağlamında saklar. Repository'ler metot imzalarını kirletmeden
 * otomatik olarak bu transaction nesnesini kullanır.
 */
export class PrismaTransactionContext {
  private static readonly storage =
    new AsyncLocalStorage<PrismaTransactionClient>();

  public static run<R>(
    tx: PrismaTransactionClient,
    fn: () => Promise<R>,
  ): Promise<R> {
    return this.storage.run(tx, fn);
  }

  public static getStore(): PrismaTransactionClient | undefined {
    return this.storage.getStore();
  }

  public static getClient(
    defaultClient: PrismaClient,
  ): PrismaClient | PrismaTransactionClient {
    return this.storage.getStore() ?? defaultClient;
  }
}

