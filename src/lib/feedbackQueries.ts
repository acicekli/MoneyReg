// ============================================================
// MoneyReg — Geri bildirim gönderme
// ============================================================

import { supabase } from './supabase';

export type FeedbackCategory = 'bug' | 'feature' | 'other';

export type FeedbackInput = {
  userId: string;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  platform: string;
};

/**
 * Online feedback gönderimi.
 */
export async function submitFeedback(
  input: FeedbackInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: input.userId,
      email: input.email,
      category: input.category,
      message: input.message,
      platform: input.platform,
    });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
