// ============================================================
// MoneyReg — Offline kuyruk senkronizasyonu
// Online'a geçince kuyruktaki işlemleri sırayla işler.
//
// Sonuç türleri:
//   ok      → işlem başarılı (veya zaten yapılmış: idempotent) → kuyruktan çıkar
//   network → ağ / oturum sorunu → sayaç ARTMAZ, kuyruk durur, sonra tekrar denenir
//   failed  → kalıcı hata → retryCount artar; MAX_RETRIES'a ulaşınca
//             öğe silinmez, "failed" listesine taşınır ve kullanıcıya haber verilir
//
// Aynı anda tek bir processQueue çalışır (running kilidi).
// Sadece o an giriş yapmış kullanıcının öğeleri işlenir.
// ============================================================

import { supabase } from './supabase';
import {
  getQueue,
  removeFromQueue,
  updateItemRetryCount,
  moveToFailed,
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

type Outcome = 'ok' | 'network' | 'failed';

type ErrLike = { code?: string | null; message?: string } | null | undefined;

/**
 * Supabase/PostgREST hatasını sonuca çevirir.
 * - Kod yok (boş)        → ağ hatası
 * - PGRST30x (JWT vb.)   → oturum yenilenince tekrar denenir → network
 * - 23505 (unique ihlali) → kayıt zaten eklenmiş → ok (idempotent)
 * - diğer kodlar          → kalıcı hata
 */
function classify(err: ErrLike): Outcome {
  if (!err) return 'ok';
  const code = err.code ?? '';
  if (code === '23505') return 'ok';
  if (code === '') return 'network';
  if (code.startsWith('PGRST30')) return 'network';
  return 'failed';
}

// ---------- Tek bir queue item'ı işle ----------

async function processItem(item: QueueItem, userId: string): Promise<Outcome> {
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
          return 'failed';
        }
      }

      let receipt_photo_url = p.receipt_photo_url ?? null;
      if (p.receiptLocalUri) {
        const up = await uploadReceipt(userId, p.receiptLocalUri).catch(
          () => ({ ok: false as const, error: 'upload' })
        );
        if (up.ok) {
          receipt_photo_url = up.path;
        } else if ((item.retryCount ?? 0) < MAX_RETRIES - 1) {
          // Fiş yüklenemedi → harcamayı fişsiz kaydetmeden önce tekrar dene
          return 'failed';
        }
        // Son denemede: fiş olmadan da olsa harcamayı kaydet (veri kaybı olmasın)
      }

      const result = await createTransaction(userId, {
        ...p,
        exchange_rate_snapshot,
        receipt_photo_url,
      });
      return result.ok ? 'ok' : classify({ code: result.code, message: result.error });
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
          return 'failed';
        }
      }

      const result = await updateTransaction(userId, p.transactionId, {
        ...p,
        exchange_rate_snapshot,
      });
      return result.ok ? 'ok' : classify({ code: result.code, message: result.error });
    }

    if (item.type === 'delete_transaction') {
      const result = await deleteTransaction(userId, item.payload.transactionId);
      if (result.ok) return 'ok';
      // Kayıt zaten yoksa silme işlemi başarılı sayılır (idempotent)
      if (result.code === 'not_found') return 'ok';
      return classify({ code: result.code, message: result.error });
    }

    if (item.type === 'create_installment_group') {
      const { rows } = item.payload;
      if (!Array.isArray(rows) || rows.length === 0) return 'ok';
      // Postgres tek insert → atomik (ya hepsi ya hiç).
      // uq_installment_group_number sayesinde tekrar denemede 23505 → ok.
      const { error } = await supabase.from('transactions').insert(rows);
      return classify(error);
    }

    if (item.type === 'delete_installment_group') {
      const { groupId } = item.payload;
      // RLS sadece kendi kayıtlarına izin verir; kayıt yoksa da hata vermez
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('installment_group_id', groupId);
      return classify(error);
    }

    if (item.type === 'submit_feedback') {
      const p = item.payload;
      const { error } = await supabase.from('feedback').insert({
        user_id: p.user_id,
        email: p.email ?? null,
        category: p.category,
        message: p.message,
        platform: p.platform ?? null,
      });
      return classify(error);
    }

    // Bilinmeyen tip → kuyruktan çıkar
    return 'ok';
  } catch {
    // Beklenmeyen istisna (çoğunlukla ağ) → sayaç artırmadan tekrar dene
    return 'network';
  }
}

// ---------- Tüm kuyruğu işle ----------

export type SyncResult = {
  processed: number;
  failed: number;
  total: number;
  /** Kalıcı hata nedeniyle "failed" listesine taşınan öğe sayısı */
  dropped: number;
};

let running = false;

export async function processQueue(userId: string): Promise<SyncResult> {
  // Aynı anda ikinci bir senkronizasyon başlamasın (çift kayıt önlemi)
  if (running) {
    return { processed: 0, failed: 0, total: 0, dropped: 0 };
  }
  running = true;

  try {
    // Sadece bu kullanıcının öğeleri (userId'siz eski öğeler dahil)
    const queue = (await getQueue()).filter(
      (item) => !item.userId || item.userId === userId
    );
    if (queue.length === 0) {
      return { processed: 0, failed: 0, total: 0, dropped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let dropped = 0;

    for (const item of queue) {
      // Eski sürümden kalan, limiti aşmış öğeler
      if ((item.retryCount ?? 0) >= MAX_RETRIES) {
        await moveToFailed(item.id, 'max_retries');
        dropped++;
        failed++;
        continue;
      }

      const outcome = await processItem(item, userId);

      if (outcome === 'ok') {
        await removeFromQueue(item.id);
        processed++;
        continue;
      }

      failed++;

      if (outcome === 'network') {
        // Ağ sorunu: sayaç artmaz. FIFO için dur, sonraki online'da devam et.
        break;
      }

      // Kalıcı hata
      const next = (item.retryCount ?? 0) + 1;
      if (next >= MAX_RETRIES) {
        console.warn(`[sync] Item failed ${MAX_RETRIES} times:`, item.type, item.id);
        await moveToFailed(item.id, 'max_retries');
        dropped++;
        continue; // sıradaki öğeye geç
      }

      await updateItemRetryCount(item.id, next);
      break; // FIFO garantisi
    }

    if (processed > 0) {
      emitSyncComplete();
    }

    return { processed, failed, total: queue.length, dropped };
  } finally {
    running = false;
  }
}
