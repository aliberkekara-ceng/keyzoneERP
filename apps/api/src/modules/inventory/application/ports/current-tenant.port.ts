/**
 * Modül İzin Sabitleri (§7)
 */
export const InventoryPermissions = {
  WAREHOUSE_READ: 'inventory.warehouse.read',
  WAREHOUSE_MANAGE: 'inventory.warehouse.manage',
  STOCK_READ: 'inventory.stock.read',
  STOCK_RECEIVE: 'inventory.stock.receive',
  STOCK_ISSUE: 'inventory.stock.issue',
  STOCK_TRANSFER: 'inventory.stock.transfer',
  STOCK_ADJUST: 'inventory.stock.adjust',
  STOCK_RESERVE: 'inventory.stock.reserve',
} as const;

export type InventoryPermission =
  (typeof InventoryPermissions)[keyof typeof InventoryPermissions];

/**
 * CurrentTenantPort
 *
 * Çalışan isteğin ait olduğu aktif kiracı (tenant), kullanıcı ve yetki (permission)
 * bağlamını application katmanına sağlar.
 */
export interface CurrentTenantPort {
  getTenantId(): string;
  getUserId(): string;
  hasPermission(permission: InventoryPermission | string): boolean;
}
