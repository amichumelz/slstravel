# 💳 Panduan Lengkap Setup Stripe SLS Travel Langkawi
*(Credit/Debit Card, FPX Online Banking & Apple Pay)*

Laman web anda kini telah dilengkapi sistem pembayaran rasmi **Stripe Checkout** yang menyokong:
- 💳 **Kad Kredit & Kad Debit** (Visa, Mastercard, American Express, UnionPay)
- 🏦 **FPX Online Banking Malaysia** (Maybank2u, CIMB Clicks, Public Bank, RHB, Hong Leong, Bank Islam, Affin, dll.)
-  **Apple Pay** (Paparan automatik untuk pengguna iPhone, iPad & Mac di Safari)
- 🤖 **Google Pay** (Paparan automatik untuk peranti Android & Chrome)

---

## ⚡ Langkah 1: Aktifkan Kaedah Pembayaran di Stripe Dashboard

1. Log masuk ke akaun Stripe anda di **[dashboard.stripe.com](https://dashboard.stripe.com/)**.
2. Pergi ke **Settings (Tetapan)** ➡️ **Payment methods (Kaedah pembayaran)** (atau buka terus pautan `dashboard.stripe.com/settings/payment_methods`).
3. Pastikan kaedah pembayaran berikut berstatus **"Active"**:
   - **Cards** (Visa, Mastercard) ➡️ *Active*
   - **FPX** (Malaysian Online Banking) ➡️ *Active* (Klik *Turn on* jika belum)
   - **Apple Pay** ➡️ *Active* (Apple Pay menggunakan sambungan Kad dan diuruskan terus oleh Stripe Checkout)

---

## 🔑 Langkah 2: Dapatkan Stripe Secret Key

1. Di Stripe Dashboard, klik tab **Developers** (kanan atas) ➡️ **API keys**.
2. Anda akan melihat dua jenis kunci:
   - **Publishable key** (`pk_live_...` atau `pk_test_...`)
   - **Secret key** (`sk_live_...` atau `sk_test_...`)
3. Salin **Secret key** (`sk_live_...`). *(Simpan secara rahsia, jangan letak secret key di dalam kod HTML/JS awam).*

> 💡 **Tip:** Anda boleh guna test key terlebih dahulu (`sk_test_...`) untuk mencuba pembayaran secara percuma tanpa caj wang sebenar.

---

## 🚀 Langkah 3: Setup Serverless Endpoint (Paling Mudah: Cloudflare Workers — 100% Percuma)

Kerana GitHub Pages adalah hosting statik, Stripe memerlukan satu fungsi serverless selamat untuk memproses sesi pembayaran tanpa mendedahkan Secret Key anda.

Fail `cloudflare-worker/worker.js` sudah siap dibina dalam projek ini! Ikuti langkah 2 minit ini:

### Kaedah A: Melalui Cloudflare Dashboard (Paling Mudah & Cepat)
1. Buka dan log masuk ke **[dash.cloudflare.com](https://dash.cloudflare.com/)** (Daftar akaun percuma jika belum ada).
2. Klik menu **Workers & Pages** di sidebar sebelah kiri ➡️ Klik **Create application** ➡️ Pilih **Create Worker**.
3. Beri nama (contoh: `sls-stripe-checkout`) ➡️ Klik **Deploy**.
4. Selepas siap deploy, klik butang **Edit code**:
   - Padam kod sedia ada dalam editor Cloudflare.
   - Buka fail `cloudflare-worker/worker.js` dalam projek ini, salin **SEMUA** kodnya, dan tampal (*paste*) ke dalam editor Cloudflare.
   - Klik **Deploy** (kanan atas).
5. Masukkan Secret Key ke Cloudflare:
   - Kembali ke halaman Worker tadi (klik nama Worker di atas).
   - Klik tab **Settings** ➡️ **Variables and Secrets**.
   - Di bahagian **Variables and Secrets**, klik **Add**.
   - Type: **Secret**
   - Variable name: `STRIPE_SECRET_KEY`
   - Value: Tampal Secret Key Stripe anda (`sk_live_...` atau `sk_test_...`).
   - Klik **Deploy** / **Save**.
6. Salin URL Worker anda:
   - Di halaman utama Worker tersebut, salin URL yang dipaparkan (contohnya: `https://sls-stripe-checkout.fatin.workers.dev`).

---

## 🔗 Langkah 4: Masukkan URL Worker ke dalam `index.html`

1. Buka fail `index.html`.
2. Cari bahagian konfigurasi Stripe di bahagian `<script>` (lebih kurang baris 2730):
```javascript
const STRIPE_CONFIG = {
  // Gantikan pautan ini dengan URL Cloudflare Worker anda:
  checkoutEndpoint: 'https://sls-stripe-checkout.your-subdomain.workers.dev',
};
```
3. Gantikan nilai `checkoutEndpoint` dengan URL Cloudflare Worker yang anda salin tadi.
4. Simpan (`Save`) fail `index.html`.

---

## ✅ Langkah 5: Uji Pembayaran di Laman Web

1. Buka laman web anda (`https://saifullangkawiservice.com`).
2. Klik mana-mana kenderaan (contoh: **Sedan** atau **Vellfire**) ➡️ Klik butang **Reserve**.
3. Pilih pakej (Transfer / Half Day / Full Day) dan isi maklumat ringkas (Nama, No Telefon, Tarikh, Masa, Lokasi Ambil).
4. Klik butang emas **"Bayar RM [Jumlah] dengan Stripe"**.
5. Sistem akan membuka halaman **Stripe Checkout**:
   - Pelanggan boleh pilih bayar guna **Kad**, **FPX** (pilih bank: Maybank, CIMB, dll.), atau **Apple Pay**.
6. Selepas pembayaran berjaya:
   - Pelanggan akan dialihkan semula ke laman web anda dengan paparan modal khas: **"🎉 Pembayaran Berjaya!"**.
   - Terdapat butang segera untuk menghantar maklumat tempahan beserta No. Rujukan ke **WhatsApp Chauffeur**.
   - Pemilik laman web (anda) juga menerima rekod tempahan dan resit lengkap di dalam **Stripe Dashboard** (di bawah menu *Payments*).

---

## ❓ Soalan Lazim (FAQ)

### 1. Adakah caj transaksi dikenakan oleh Stripe Malaysia?
Ya, kadar standard Stripe Malaysia adalah:
- Kad Tempatan: 3% + RM 1.00 per transaksi
- Kad Antarabangsa: 4% + RM 1.00 per transaksi
- FPX Online Banking: ~RM 1.00 atau 1.5% (sangat murah untuk transaksi tempatan)

### 2. Bagaimana duit masuk ke akaun bank saya?
Stripe akan memindahkan wang yang diterima secara automatik ke akaun bank perniagaan / peribadi yang anda daftarkan di Stripe mengikut jadual pembayaran (biasanya 2-3 hari bekerja).
