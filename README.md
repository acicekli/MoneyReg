# MoneyReg — Harcama Takip Uygulaması
Türkiye'deki kullanıcılar için tasarlanmış, çoklu para birimi destekli, offline-first bir harcama takip uygulaması.

## 🎯 Özellikler
### Temel
📝 Harcama ekleme (TL / USD / EUR)

✏️ Harcama düzenleme ve silme

📂 Kategori yönetimi (sistem + kullanıcı)

📊 Aylık / haftalık / yıllık raporlar

🌍 Görüntüleme para birimi seçici (TL / USD / EUR)

### Paylaşımlı Alanlar (Gruplar)
👥 Shared space oluşturma

🔗 Davet kodu ile katılma

👤 Üye yönetimi (çıkar / ayrıl)

💰 Kişi bazlı harcama dağılımı

📋 Kapanış raporu

### Fiş / OCR
📷 Fiş fotoğrafı çekme / galeriden seçme

🤖 Gemini Vision ile otomatik tutar/kategori/tarih çıkarma

📎 Fiş görüntüleyici (signed URL)

### Offline Destek
📴 Offline'da harcama ekleme/düzenleme/silme (kuyruğa alınır)

🔄 Online'a geçince otomatik senkronizasyon

💾 Cache-first okuma (son görüntülenen veriler)

### Bildirimler
🔔 Haftalık rapor bildirimi (Pazar 20:00)

🔔 Aylık rapor bildirimi (ayın son günü 21:00)

🔔 Yıllık rapor bildirimi (31 Aralık 12:00)

⚙️ Ayarlar'dan aç/kapa

## 🛠️ Teknoloji Yığını
Katman	Teknoloji
Frontend	React Native (Expo SDK 57) + TypeScript
Navigasyon	React Navigation 7
Backend	Supabase (Postgres + Auth + Storage + Functions)
Kur API'si	TCMB XML (Edge Function)
Fiş OCR	Google Gemini 3.5 Flash-Lite (Edge Function)
Offline	AsyncStorage + custom queue
Font	Fraunces (başlık) + IBM Plex Sans (gövde)
## 📂 Proje Yapısı
MoneyReg/

src/

components/ — Ortak UI bileşenleri

lib/ — İş mantığı (Supabase, cache, queue, format)

navigation/ — Stack + Tab yapılandırması

screens/ — Ekranlar

types/ — TypeScript tipleri

theme.ts — Renk + font tokenları

supabase/

functions/ — Edge Functions (Deno)

get-exchange-rate/ — TCMB kur API

parse-receipt/ — Gemini Vision fiş OCR

migrations/ — SQL migration dosyaları

assets/ — İkonlar, splash

App.tsx — Root component

app.config.ts — Expo config

eas.json — EAS build profilleri

## 🗄️ Veritabanı Şeması
### Tablolar
profiles — Kullanıcı profilleri (display_name, month_start_day)

spaces — Kişisel/paylaşımlı alanlar (invite_code)

space_members — Space üyelikleri

categories — Harcama kategorileri (sistem + kullanıcı)

transactions — Harcamalar

### Önemli Kurallar
RLS aktif: Kullanıcı sadece kendi verilerini görür

exchange_rate_snapshot: İşlem anındaki kur, sonradan değişmez

Kategori silme kısıtı: Kullanımda olan kategori silinemez

Kapalı space: Yeni harcama eklenemez

## 🚀 Kurulum
### Gereksinimler
Node.js 18+

Expo CLI

Supabase hesabı

(Opsiyonel) Google AI Studio API key

### Adımlar
Repo'yu klonla:

text
git clone https://github.com/acicekli/MoneyReg.git
cd MoneyReg
Bağımlılıkları yükle:

text
npm install
.env dosyasını oluştur:

text
cp .env.example .env
İçine Supabase URL + anon key yaz

Supabase migration'ları çalıştır (migrations/ altındaki SQL'leri SQL Editor'de sırayla çalıştır)

Edge Functions'ları deploy et:

text
npx supabase functions deploy get-exchange-rate
npx supabase functions deploy parse-receipt
GEMINI_API_KEY secret'ını ekle (Supabase Dashboard → Edge Functions → Secrets)

Uygulamayı çalıştır:

text
npx expo start --web       # Web
npx expo start             # Native (Expo Go)
## 📱 Test / Yayınlama
### Test (Expo Go)
Preview kanalına yayınla:

text
npx eas-cli update --branch preview --message "..."
Tester'lar Expo Go'yu açınca otomatik güncellenir.

### Yayınlama (App Store / Play Store)
Production build:

text
npx eas-cli build --profile production --platform ios
npx eas-cli build --profile production --platform android
Submit:

text
npx eas-cli submit --platform ios
npx eas-cli submit --platform android
## 🔐 Güvenlik Notları
.env gitignore'da (asla push edilmez)

.env.example şablon olarak var

Supabase anon key public (RLS korur)

Edge Functions secret'ları Supabase'de (GEMINI_API_KEY)

RLS policy'leri: Kullanıcı sadece kendi space'lerindeki verilere erişir

## 📝 Lisans
MIT (LICENSE dosyasına bak)

## 🤝 Katkı
Bu proje kişisel kullanım için geliştirilmiştir. Katkı kabul edilir ama öncelik aktif geliştiricinin kararlarıdır.
