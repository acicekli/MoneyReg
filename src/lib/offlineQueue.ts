// ============================================================
// MoneyReg — Offline yazma kuyruğu
// Offline iken create/update/delete işlemleri burada saklanır.
// Online'a geçince sırayla (FIFO) işlenir.
//
// - Tüm okuma-değiştirme-yazma işlemleri tek bir kilit (promise zinciri)
//   üzerinden geçer → eşzamanlı enqueue/remove birbirini ezmez.
// - Her öğe oluşturan kullanıcıya bağlanır (userId); başka bir hesap
//   giriş yapınca eski kullanıcının öğeleri o hesaba yazılmaz.
// - Kalıcı hata veren öğeler silinmez, "failed" listesine taşınır.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'offline-queue:v1';
const FAILED_KEY = 'offline-queue:failed:v1';
const FAILED_MAX = 50;

export type QueueItemType =
  | 'create_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'create_installment_group'
  | 'delete_installment_group'
  | 'submit_feedback';

export type QueueItem = {
  id: string;                    // client-side unique id
  type: QueueItemType;
  payload: any;
  createdAt: number;
  retryCount?: number;           // Kalıcı (sayılan) başarısız deneme sayısı
  userId?: string;               // Öğeyi kuyruğa ekleyen kullanıcı
};

// ---------- UUID üret (offline için) ----------

export function generateClientId(): string {
  // Mümkünse güvenli rastgele kaynak (Hermes/web crypto)
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  // Yedek: RFC4122 v4 benzeri basit üretici
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) out += '-';
    if (i === 12) {
      out += '4'; // version
    } else if (i === 16) {
      out += hex[(Math.random() * 4) | 8]; // variant
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}

// ---------- Kilit (mutex) ----------

let lockChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ---------- İç okuma/yazma ----------

async function readList(key: string): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    // sessiz
  }
}

// ---------- Public API ----------

export async function getQueue(): Promise<QueueItem[]> {
  return readList(QUEUE_KEY);
}

export async function enqueue(
  type: QueueItemType,
  payload: any
): Promise<QueueItem> {
  // Oturum yerel depodan okunur → offline iken de çalışır
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id;
  } catch {
    // oturum okunamadı → userId'siz kaydedilir
  }

  const item: QueueItem = {
    id: generateClientId(),
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    userId,
  };

  await withLock(async () => {
    const queue = await readList(QUEUE_KEY);
    queue.push(item);
    await writeList(QUEUE_KEY, queue);
  });

  return item;
}

export async function removeFromQueue(itemId: string): Promise<void> {
  await withLock(async () => {
    const queue = await readList(QUEUE_KEY);
    await writeList(
      QUEUE_KEY,
      queue.filter((q) => q.id !== itemId)
    );
  });
}

export async function clearQueue(): Promise<void> {
  await withLock(async () => {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch {
      // sessiz
    }
  });
}

export async function getQueueSize(): Promise<number> {
  const q = await getQueue();
  return q.length;
}

/**
 * Bir item'ın retryCount değerini belirtilen değere ayarla.
 */
export async function updateItemRetryCount(
  itemId: string,
  retryCount: number
): Promise<void> {
  await withLock(async () => {
    const queue = await readList(QUEUE_KEY);
    const idx = queue.findIndex((q) => q.id === itemId);
    if (idx < 0) return;
    queue[idx] = { ...queue[idx], retryCount };
    await writeList(QUEUE_KEY, queue);
  });
}

/**
 * Kalıcı hata veren item'ı kuyruktan çıkarıp "failed" listesine taşır.
 * Veri tamamen kaybolmaz; en fazla FAILED_MAX kayıt tutulur.
 */
export async function moveToFailed(
  itemId: string,
  reason?: string
): Promise<void> {
  await withLock(async () => {
    const queue = await readList(QUEUE_KEY);
    const item = queue.find((q) => q.id === itemId);
    if (!item) return;

    const failed = await readList(FAILED_KEY);
    failed.push({
      ...item,
      payload: { ...item.payload, __failReason: reason ?? null },
    });
    await writeList(FAILED_KEY, failed.slice(-FAILED_MAX));
    await writeList(
      QUEUE_KEY,
      queue.filter((q) => q.id !== itemId)
    );
  });
}

export async function getFailedItems(): Promise<QueueItem[]> {
  return readList(FAILED_KEY);
}
