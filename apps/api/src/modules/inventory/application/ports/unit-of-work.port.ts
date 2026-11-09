/**
 * UnitOfWorkPort
 *
 * Çoklu repository işlemlerini tek bir atomik veritabanı transaction'ı içinde yürütür.
 * Altyapı bağımlılığı taşımaz.
 */
export interface UnitOfWorkPort {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

