/**
 * Inventory Module — Public API
 *
 * AGENTS.md ve MODULE_inventory.md kuralları gereği:
 * Diğer modüller (Sales, Purchasing, Accounting) stok modülüyle YALNIZCA
 * bu dosya üzerinden (Facade, Event tipleri, DTO'lar) iletişim kurabilir.
 * İç klasörlerin (domain, application, infrastructure, presentation) doğrudan import edilmesi yasaktır.
 */

export * from './inventory.module.js';
