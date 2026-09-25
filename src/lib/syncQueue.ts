// ============================================================
// MoneyReg — Offline kuyruk senkronizasyonu
// Online'a geçince kuyruktaki işlemleri sırayla işler.
// MAX_RETRIES: 3 başarısız denemeden sonra item kuyruktan düşürülür.
// ============================================================

import {
  getQueue,
  removeFromQueue,
  updateItemRetryCount,
  type QueueItem,
} from './offlineQueue';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './transactionQueries';
import { getExchangeRateForDate } from './exchangeRate';
import { uploadReceipt } from './receiptsStorage';
import { emitSyncComplete } from './syncEvents';

const MAX_RETRIES = 3;

// ---------- Tek bir queue item'ı işle ----------

async function processItem(item: QueueItem, userId: string): Promise<boolean> {
  try {
    if (item.type === 'create_transaction') {
      const p = item.payload;

      let exchange_rate_snapshot: number | null = null;
      if (p.currency !== 'TRY') {
        try {
          exchange_rate_snapshot = await getExchangeRateForDate(
            p.currency,
            p.expense_date
          );
        } catch {
          return false;
        }
      }

      let receipt_photo_url = p.receipt_photo_url ?? null;
      if (p.receiptLocalUri) {
        try {
          const up = await uploadReceipt(userId, p.receiptLocalUri);
          if (up.ok) {
            receipt_photo_url = up.path;
          }
        } catch {
          // sessizce yut
        }
      }

      const result = await createTransaction(userId, {
        ...p,
        exchange_rate_snapshot,
        receipt_photo_url,
      });
      return result.ok;
    }

    if (item.type === 'update_transaction') {
      const p = item.payload;
      let exchange_rate_snapshot: number | null = p.exchange_rate_snapshot ?? null;

      if (p.currency !== 'TRY' && exchange_rate_snapshot == null) {
        try {
          exchange_rate_snapshot = await getExchangeRateForDate(
            p.currency,
            p.expense_date
          );
        } catch {
          return false;
        }
      }

      const result = await updateTransaction(userId, p.transactionId, {
        ...p,
        exchange_rate_snapshot,
      });
      return result.ok;
    }

    if (item.type === 'delete_transaction') {
      const result = await deleteTransaction(userId, item.payload.transactionId);
      return result.ok;
    }

    // Bilinmeyen tip → kuyruktan çıkar
    return true;
  } catch {
    return false;
  }
}

// ---------- Tüm kuyruğu işle ----------

export type SyncResult = {
  processed: number;
  failed: number;
  total: number;
};

export async function processQueue(userId: string): Promise<SyncResult> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0, total: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    // 1) Retry limiti kontrolü
    if ((item.retryCount ?? 0) >= MAX_RETRIES) {
      console.warn(
        `[sync] Item dropped after ${MAX_RETRIES} retries:`,
        item.type,
        item.id
      );
      await removeFromQueue(item.id);
      failed++;
      continue;
    }

    // 2) Item'ı işle
    const ok = await processItem(item, userId);

    if (ok) {
      await removeFromQueue(item.id);
      processed++;
    } else {
      // 3) Hata → retryCount artır ve kaydet
      const newRetryCount = (item.retryCount ?? 0) + 1;
      await updateItemRetryCount(item.id, newRetryCount);
      failed++;

      // Ağ hatası olabilir → kuyrukta kalsın, bir sonraki sync'te tekrar dene
      // Ama FIFO garantisi için bu noktada dur
      break;
    }
  }

  // Bir şey işlendiyse dinleyicilere haber ver
  if (processed > 0) {
    emitSyncComplete();
  }

  return { processed, failed, total: queue.length };
}
