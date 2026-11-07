import { Decimal } from 'decimal.js';
import { MovementDirection } from '../entities/stock-movement-type.enum.js';

/**
 * StockPolicy Domain Service
 *
 * Stok çıkışları ve rezervasyonlarına dair saf iş kurallarını denetleyen domain servisidir.
 * Framework veya veritabanı bağımlılığı taşımaz.
 */
export class StockPolicy {
  /**
   * Çıkış yapılabilir mi kontrolü:
   * Depoda negatif stok serbestse her zaman true; değilse eldeki miktar çıkışı karşılamalıdır.
   */
  public canIssue(
    onHand: Decimal,
    issueAmount: Decimal,
    allowNegativeStock: boolean,
  ): boolean {
    if (allowNegativeStock) {
      return true;
    }
    return onHand.greaterThanOrEqualTo(issueAmount);
  }

  /**
   * Rezervasyon yapılabilir mi kontrolü:
   * Rezervasyon yalnızca KULLANILABİLİR (OnHand - Reserved) miktar kadar yapılabilir.
   * Negatif stok politikası rezervasyona izin vermez; rezerve fiziksel stoku aşamaz.
   */
  public canReserve(
    availableAmount: Decimal,
    reserveAmount: Decimal,
  ): boolean {
    return availableAmount.greaterThanOrEqualTo(reserveAmount);
  }

  /**
   * Hareket yönüne göre yeni eldeki (on-hand) miktarı hesaplar.
   */
  public calculateNewOnHand(
    currentOnHand: Decimal,
    amount: Decimal,
    direction: MovementDirection,
  ): Decimal {
    if (direction === 'IN') {
      return currentOnHand.plus(amount);
    }
    return currentOnHand.minus(amount);
  }
}

