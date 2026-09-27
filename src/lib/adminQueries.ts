// ============================================================
// MoneyReg — Admin sorguları (feedback yönetimi)
// ============================================================

import { supabase } from './supabase';

export type FeedbackItem = {
  id: string;
  user_id: string;
  email: string | null;
  category: 'bug' | 'feature' | 'other';
  message: string;
  platform: string | null;
  created_at: string;
};

/**
 * Kullanıcının admin olup olmadığını kontrol eder.
 */
export async function isCurrentUserAdmin(
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_admin === true;
}

/**
 * Tüm feedback'leri getirir (sadece admin).
 * En yeniden en eskiye sıralı.
 */
export async function getAllFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getAllFeedback error:', error.message);
    return [];
  }
  return (data ?? []) as FeedbackItem[];
}

/**
 * Bir feedback'i siler (sadece admin).
 */
export async function deleteFeedback(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('feedback')
    .delete()
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
