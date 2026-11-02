# Inventory Module (Stok Yönetimi)

## 1. Modülün Amacı
Inventory modülü, hangi ürünün hangi depoda ne kadar olduğunu güvenilir ve denetlenebilir şekilde tutar. Stok bakiyesi doğrudan güncellenen bir sayı değil, değiştirilemez hareketlerin (ledger/append-only) sonucudur.

## 2. Mimari Derinlik
**Çekirdek Modül → Tam Katmanlı (Clean Architecture + DDD-lite + CQRS-lite)**
- `domain/`: Saf TypeScript. Framework veya ORM bağımlılığı yok.
- `application/`: Command ve Query handler'lar, port arayüzleri.
- `infrastructure/`: Prisma implementasyonları, read model'ler, adaptörler.
- `presentation/`: HTTP controller'lar, DTO'lar, izin guard'ları.

## 3. Modül Sınırı ve Public API
Dış modüllerin erişimine açık tek dosya `index.ts`'tir.
- Dışa açılanlar: `InventoryFacade`, Domain Event tipleri, paylaşılan DTO'lar.
- Gizli kalanlar: Entity'ler, repository implementasyonları, Prisma modelleri ve handler'lar.

## 4. Bağımlılıklar
- **Bağımlı olduğu modüller:** Yok (yalnız Platform/shared kernel: auth, tenant context, outbox, Result, Clock).
- **Catalog:** Opak `ProductId` (UUID) kullanılır; v1'de stub adapter ile çözülür.

