import {
  CurrentTenantPort,
  InventoryPermission,
  InventoryPermissions,
} from '../ports/current-tenant.port.js';

/**
 * FakeCurrentTenant
 *
 * Testlerde aktif kiracı, kullanıcı ve izinlerini (permissions) simüle eden adaptör.
 */
export class FakeCurrentTenant implements CurrentTenantPort {
  private _tenantId: string;
  private _userId: string;
  private _permissions: Set<string>;

  constructor(
    tenantId: string = 'tenant-alpha',
    userId: string = 'user-1',
    permissions: string[] = [InventoryPermissions.WAREHOUSE_MANAGE],
  ) {
    this._tenantId = tenantId;
    this._userId = userId;
    this._permissions = new Set(permissions);
  }

  public getTenantId(): string {
    return this._tenantId;
  }

  public getUserId(): string {
    return this._userId;
  }

  public hasPermission(permission: InventoryPermission | string): boolean {
    return this._permissions.has(permission);
  }

  public setTenantId(tenantId: string): void {
    this._tenantId = tenantId;
  }

  public setPermissions(permissions: string[]): void {
    this._permissions = new Set(permissions);
  }
}

