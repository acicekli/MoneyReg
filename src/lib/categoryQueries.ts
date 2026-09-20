// ============================================================
// MoneyReg — Kategori CRUD sorguları
// ============================================================

import { supabase } from './supabase';
import type { Category } from '../types/models';

// ---------- Listeleme ----------

export type CategorizedList = {
  defaults: Category[];   // is_default = true
  custom: Category[];     // created_by = userId
};

/**
 * Kullanıcının eriştiği tüm kategorileri getirir:
 * - Sistem kategorileri (is_default = true)
 * - Kullanıcının kendi oluşturdukları (created_by = userId)
 */
export async function getUserCategories(
  userId: string
): Promise<CategorizedList> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,created_by.eq.${userId}`)
    .order('name', { ascending: true });

  if (error) {
    console.warn('getUserCategories error:', error.message);
    return { defaults: [], custom: [] };
  }

  const all = (data ?? []) as Category[];
  const defaults = all.filter((c) => c.is_default);
  const custom = all.filter((c) => !c.is_default);

  return { defaults, custom };
}

// ---------- Ekleme ----------

export type CreateCategoryResult =
  | { ok: true; category: Category }
  | { ok: false; error: string };

export async function createCategory(
  userId: string,
  name: string,
  icon: string | null
): Promise<CreateCategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: 'Kategori adı boş olamaz.' };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: 'Kategori adı en fazla 40 karakter olabilir.' };
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: trimmed,
      icon: icon?.trim() || null,
      is_default: false,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Kategori oluşturulamadı.' };
  }

  return { ok: true, category: data as Category };
}

// ---------- Güncelleme ----------

export type UpdateCategoryResult =
  | { ok: true; category: Category }
  | { ok: false; error: string };

export async function updateCategory(
  userId: string,
  categoryId: string,
  name: string,
  icon: string | null
): Promise<UpdateCategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: 'Kategori adı boş olamaz.' };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: 'Kategori adı en fazla 40 karakter olabilir.' };
  }

  // Sadece kendi kategorisini güncelleyebilir + is_default olamaz
  const { data, error } = await supabase
    .from('categories')
    .update({
      name: trimmed,
      icon: icon?.trim() || null,
    })
    .eq('id', categoryId)
    .eq('created_by', userId)
    .eq('is_default', false)
    .select('*')
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Kategori güncellenemedi.',
    };
  }

  return { ok: true, category: data as Category };
}

// ---------- Silme ----------

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteCategory(
  userId: string,
  categoryId: string
): Promise<DeleteCategoryResult> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('created_by', userId)
    .eq('is_default', false);

  if (error) {
    // Postgres FK restrict hatası: "violates foreign key constraint"
    const msg = error.message || '';
    if (msg.includes('foreign key') || msg.includes('violates')) {
      return {
        ok: false,
        error: 'Bu kategori kullanımda, silinemez.',
      };
    }
    return { ok: false, error: msg || 'Kategori silinemedi.' };
  }

  return { ok: true };
}
