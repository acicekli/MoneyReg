// ============================================================
// MoneyReg — Fiş fotoğrafı Storage yardımcıları
// Bucket: receipts (private)
// Path formatı: {user_id}/{timestamp}_{random}.jpg
// ============================================================

import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'receipts';

// ---------- Yardımcı ----------

function randomSuffix(len = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function uriToExt(uri: string): string {
  // Çoğunlukla .jpg döner; uzantıyı koruyalım
  const m = uri.match(/\.(jpg|jpeg|png|heic|webp)$/i);
  if (!m) return 'jpg';
  const e = m[1].toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

// ---------- Yükleme ----------

export type UploadReceiptResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Yerel URI'deki fotoğrafı Storage'a yükler.
 * Path: {userId}/{timestamp}_{random}.{ext}
 * Dönen `path` transaction.receipt_photo_url'a yazılır.
 */
export async function uploadReceipt(
  userId: string,
  localUri: string
): Promise<UploadReceiptResult> {
  try {
    const ext = uriToExt(localUri);
    const path = `${userId}/${Date.now()}_${randomSuffix()}.${ext}`;

    // React Native'de Blob çalışmaz → base64 oku, ArrayBuffer'a çevir
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    // Supabase Storage'a yükle
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: false,
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, path };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Yükleme başarısız.' };
  }
}

// ---------- Signed URL ----------

export type SignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Private bucket'tan geçici signed URL üretir.
 * @param expiresIn saniye (default 60)
 */
export async function getSignedReceiptUrl(
  path: string,
  expiresIn = 60
): Promise<SignedUrlResult> {
  if (!path) return { ok: false, error: 'Fiş yolu yok.' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Signed URL alınamadı.' };
  }

  return { ok: true, url: data.signedUrl };
}

// ---------- Silme (ileride lazım olabilir) ----------

export async function deleteReceipt(path: string): Promise<{ ok: boolean }> {
  if (!path) return { ok: false };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return { ok: !error };
}
