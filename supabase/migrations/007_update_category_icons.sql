-- ============================================================
-- MoneyReg — Migration 007: Sistem kategori ikonlarını güncelle
-- Sadece is_default=true olan kategoriler etkilenir.
-- Kullanıcı kategorileri (created_by IS NOT NULL) DEĞİŞMEZ.
-- ============================================================

update public.categories set icon = '🛒' where is_default = true and name = 'Market';
update public.categories set icon = '🍽️' where is_default = true and name = 'Yemek';
update public.categories set icon = '🚌' where is_default = true and name = 'Ulaşım';
update public.categories set icon = '🏠' where is_default = true and name = 'Kira';
update public.categories set icon = '🧾' where is_default = true and name = 'Faturalar';
update public.categories set icon = '💊' where is_default = true and name = 'Sağlık';
update public.categories set icon = '🎬' where is_default = true and name = 'Eğlence';
update public.categories set icon = '👕' where is_default = true and name = 'Giyim';
update public.categories set icon = '📌' where is_default = true and name = 'Diğer';
