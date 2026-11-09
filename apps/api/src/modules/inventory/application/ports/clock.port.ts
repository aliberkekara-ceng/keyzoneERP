/**
 * ClockPort
 *
 * Sistemin zaman kaynağını soyutlayan porttur.
 * Testlerde zamanı dondurmak veya ilerletmek için kullanılır (new Date() doğrudan çağrısını önler).
 */
export interface ClockPort {
  now(): Date;
}

