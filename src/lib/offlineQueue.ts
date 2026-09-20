// ============================================================
// MoneyReg — Offline yazma kuyruğu
// Offline iken create/update/delete işlemleri burada saklanır.
// Online'a geçince sırayla (FIFO) işlenir.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline-queue:v1';

export type QueueItemType =
  | 'create_transaction'
  | 'update_transaction'
  | 'delete_transaction';

export type QueueItem = {
  id: string;                    // client-side unique id
  type: QueueItemType;
  payload: any;
  createdAt: number;
};

// ---------- UUID üret (offline için) ----------

export function generateClientId(): string {
  // RFC4122 v4 benzeri basit üretici
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

// ---------- Kuyruk okuma/yazma ----------

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // sessiz
  }
}

// ---------- Public API ----------

export async function enqueue(
  type: QueueItemType,
  payload: any
): Promise<QueueItem> {
  const item: QueueItem = {
    id: generateClientId(),
    type,
    payload,
    createdAt: Date.now(),
  };
  const queue = await getQueue();
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function removeFromQueue(itemId: string): Promise<void> {
  const queue = await getQueue();
  const next = queue.filter((q) => q.id !== itemId);
  await saveQueue(next);
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // sessiz
  }
}

export async function getQueueSize(): Promise<number> {
  const q = await getQueue();
  return q.length;
}
