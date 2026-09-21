# Changelog

Tüm önemli değişiklikler bu dosyada listelenir.

Format: Keep a Changelog

---

## Unreleased — v2 Planlanan

### Planlanan Özellikler

#### Gelir Takibi (büyük özellik)
- transactions.type kolonu ('expense' | 'income')
- Gelir ekleme ekranı
- Gelir/gider ayrımı gösterimi
- Net bakiye hesaplaması
- income renk tokeni geri eklenecek

#### Kişi Bazlı Pay Sistemi
- Her transaction'da "kimler arasında bölüşülecek" bilgisi
- Kişiye özel pay girişi (eşit bölüşüm yerine)
- Borç/alacak hesaplaması kişi payına göre
- transaction_shares tablosu

#### Offline Geliştirmeleri
- Cache TTL (24 saat)
- ReportsScreen offline cache
- CategoriesScreen offline cache
- Fiş görseli offline cache (Storage'dan indir)
- "Senkronize ediliyor..." göstergesi
- Çakışma çözümü (last-write-wins yerine detaylı merge)

#### Raporlar ve Export
- "Özel" tarih aralığı seçici
- ClosingReport PDF export
- Grafik iyileştirmeleri (chart library)
- Kategori trend grafiği
- Aylık karşılaştırma (geçen aya göre %)

#### UX İyileştirmeleri
- Bildirim saati kullanıcı tarafından ayarlanabilir
- Bottom sheet (swipe aksiyonları için)
- Swipe uzun çekme → direkt sil
- Kategori ikon seçici (emoji picker)
- Tema (dark mode)
- Uygulama içi onboarding

#### Teknik İyileştirmeler
- expo-notifications web uyarısı giderilecek
- shadow → boxShadow (tüm ekranlar)
- Ortak Button component
- Ortak Card component
- fontFamily eksiklikleri tamamlanacak
- Error boundary
- Sentry / crash reporting

#### Diğer
- Test kapsamı (unit + integration)
- CI/CD (GitHub Actions)
- space_members davet e-postası (opsiyonel)
- Google/Apple ile giriş
- Hesap silme
- Veri export (CSV / JSON)

---

## 1.0.0 — 2026-09-21

### İlk Sürüm

Kapsamlı bir harcama takip uygulaması. Web + iOS'ta çalışır, Android için de uyumlu.

### Eklenen Özellikler

#### Kimlik Doğrulama
- E-posta + şifre ile kayıt/giriş
- Auth context (global session yönetimi)
- Otomatik profil + kişisel space oluşturma (trigger)

#### Harcama Yönetimi
- Çoklu para birimi (TL / USD / EUR)
- TCMB kur entegrasyonu (Edge Function)
- exchange_rate_snapshot — işlem anındaki kur sabit
- Kategori seçimi (sistem + kullanıcı)
- Tarih seçici (native picker, modal)
- Not ekleme
- Fiş fotoğrafı (kamera/galeri + OCR)
- Harcama düzenleme
- Harcama silme (swipe + UndoToast)

#### Ana Ekran
- Selamlama (display_name)
- Bu ayki toplam harcama
- Görüntüleme para birimi seçici (TL/USD/EUR)
- Son 15 hareket
- "Tüm Harcamalar" butonu (filtreli modal)
- Floating "+" butonu

#### Tüm Harcamalar Modalı
- Zaman filtresi (1 ay / 3 ay / 1 yıl / Tüm)
- Kapsam filtresi (Kişisel / Gruplar / Tümü)
- Kişi filtresi (gruplarda, çoklu seçim)

#### Paylaşımlı Alanlar
- Yeni alan oluşturma
- Davet kodu ile katılma (join_space_by_code RPC)
- Üye listesi (isim + katılma tarihi)
- Üye çıkarma (sadece owner)
- Kendi kendine ayrılma
- Grup detayı (tüm harcamalar)
- Bakiye hesaplaması (eşit bölüşüm)

#### Kategori Yönetimi
- Sistem kategorileri (9 varsayılan)
- Kullanıcı kategorileri ekleme
- Düzenleme + silme
- Silme kısıtı (kullanımda olan silinemez)
- Otomatik "Diğer" seçimi

#### Offline Destek
- Network durumu tespiti (@react-native-community/netinfo)
- Global offline banner
- Cache-first okuma (Home, Groups, GroupDetail)
- AddExpense cache fallback (kategoriler + alanlar)
- Offline yazma kuyruğu (create/update/delete)
- Sync queue (FIFO)
- Sync sonrası otomatik yenileme (event emitter)
- Fiş fotoğrafı offline kuyruğa
- İnternet gerektirenler offline'da disabled

#### Bildirimler
- Haftalık rapor (Pazar 20:00)
- Aylık rapor (ayın son günü 21:00)
- Yıllık rapor (31 Aralık 12:00)
- Ayarlar'dan aç/kapa toggle'ları
- Bildirime dokunma → ReportsScreen'e yönlendirme

#### Raporlar
- Haftalık / Aylık / Yıllık toggle
- Kapsam (Kişisel / Gruplar / Tümü)
- Kategori bazlı yatay bar grafik
- Aylık rapor başlangıç günü seçici (1-31, ay kısaysa son gün)
- Yüzde + TL toplamlar

#### Ayarlar
- E-posta bilgisi
- Ay başı günü (modal + slider)
- Bildirim toggle'ları
- Kategoriler ekranına geçiş
- Çıkış yap

#### Tema / Tasarım
- Defter teması (krem/parşömen tonları)
- Fraunces (başlık) + IBM Plex Sans (gövde)
- Tutarlı buton stilleri
- Tutarlı input/date picker
- BackgroundSilhouette (SVG silüetler, 7 ekran)
- Türkçe para formatı (formatCurrency)
- Kırmızı sadece Sil/uyarı için (tutarlar ink rengi)

### Veritabanı
- 5 tablo: profiles, spaces, space_members, categories, transactions
- RLS policy'leri (tüm tablolarda)
- 7 migration dosyası
- Otomatik profil + space trigger'ı

### Edge Functions
- get-exchange-rate — TCMB XML → JSON (fallback 5 gün)
- parse-receipt — Gemini 3.5 Flash-Lite ile fiş OCR

### Paketler
- expo (SDK 57)
- @supabase/supabase-js
- @react-navigation/native + stack + tabs
- @react-native-community/datetimepicker
- @react-native-community/netinfo
- @react-native-async-storage/async-storage
- expo-image-picker
- expo-notifications
- expo-font + expo-constants
- expo-updates
- @expo-google-fonts/fraunces
- @expo-google-fonts/ibm-plex-sans
- react-native-gesture-handler
- react-native-svg
- date-fns

### Deployment
- EAS Update (preview kanalı, tester'lar için)
- EAS Build (production için hazır — henüz deploy edilmedi)
- Supabase (Postgres + Auth + Storage + Edge Functions)

### Güvenlik
- .env gitignore'da
- .env.example şablon
- RLS tüm tablolarda aktif
- Edge Functions secret'ları Supabase'de
- Anon key public (RLS korur)

---

## Bilinen Sorunlar (v1.0.0)

### Kritik Değil
- expo-notifications web uyarısı (konsolda görünür, zararsız)
- shadow deprecated uyarısı (web'de)
- Bazı dosyalarda fontFamily eksik olabilir
- AllTransactions modalında silme UndoToast yok (basit optimistic)
- Reports ekranı offline'da boş (cache yok)
- CategoriesScreen offline'da kategoriler görünmüyor olabilir

### Bilinen Davranışlar
- Fiş OCR sadece online'da çalışır (offline'da elle doldurma)
- Bildirimler sadece native'de (Expo Go'da kısmi)
- Offline silme 3 saniye undo penceresi sonrası senkronize
- Kapalı space'e yeni harcama eklenemez

---

## Sürüm Geçmişi

| Sürüm | Tarih | Özet |
|-------|-------|------|
| 1.0.0 | 2026-09-21 | İlk sürüm — kapsamlı harcama takip |
| 0.x | 2026-09-14 → 2026-09-21 | Geliştirme aşaması |

---

## Katkı Sağlayanlar

- Geliştirici: @acicekli
- Yardım: Claude (Anthropic) + DeepSeek (yapay zeka asistanları)