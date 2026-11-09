/**
 * CurrentTenantPort
 *
 * Çalışan isteğin ait olduğu aktif kiracı (tenant) kimliğini sağlar.
 * presentation/guard katmanından application katmanına context taşır.
 */
export interface CurrentTenantPort {
  getTenantId(): string;
}

