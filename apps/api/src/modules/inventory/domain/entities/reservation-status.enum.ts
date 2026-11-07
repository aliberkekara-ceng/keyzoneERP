/**
 * ReservationStatus Enum
 *
 * Stok rezervasyonunun durum makinesi fazları:
 * - ACTIVE: Rezervasyon aktif, stok bloke edilmiş durumda.
 * - RELEASED: Sipariş iptali veya manuel serbest bırakma ile serbest bırakılmış (terminal durum).
 * - CONSUMED: Satış/çıkış hareketi (ISSUE) yapılarak fiilen tüketilmiş (terminal durum).
 */
export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
  CONSUMED = 'CONSUMED',
}

