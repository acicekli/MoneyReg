// ============================================================
// MoneyReg — Sync event emitter
// processQueue tamamlandığında dinleyicilere haber verir.
// Basit bir pub/sub mekanizması (RxJS gerekmez).
// ============================================================

type SyncListener = () => void;

const listeners = new Set<SyncListener>();

/**
 * Sync tamamlandığında çağrılacak fonksiyonu kaydet.
 * Dönen fonksiyon, aboneliği iptal eder.
 */
export function onSyncComplete(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Tüm dinleyicilere sync tamamlandı haberini gönder.
 */
export function emitSyncComplete(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // sessizce yut
    }
  });
}
