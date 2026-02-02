# 🔌 06. Environment & External Integrations

Dokumen ini menjelaskan integrasi pihak ketiga dan variabel lingkungan yang diperlukan agar sistem berjalan dengan benar.

## 1. Environment Variables (`.env`)

**Source:** `.env.example`

| Variable                        | Kegunaan                            | Critical Level |
| :------------------------------ | :---------------------------------- | :------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Endpoint API Supabase.              | **High**       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Key untuk client-side fetch. | **High**       |
| `AWS_ACCESS_KEY_ID`             | Kredensial Amazon SES (Email).      | Medium         |
| `AWS_SECRET_ACCESS_KEY`         | Kredensial Amazon SES (Email).      | Medium         |
| `FONNTE_TOKEN`                  | Token API Fonnte (WhatsApp).        | Medium         |

## 2. External Services

### A. Email Service (AWS SES)

**File:** `lib/amazon_ses/index.ts`

- **Provider:** Amazon Simple Email Service (SES).
- **Fungsi:** Mengirim notifikasi email resmi (PO Approval, Notifikasi User Baru).
- **Rate Limit:** Perhatikan limit pengiriman harian AWS sandbox/production.

### B. WhatsApp Service (Fonnte)

**File:** `lib/fonnte/index.ts`

- **Provider:** Fonnte (Unofficial WA API).
- **Fungsi:** Mengirim notifikasi cepat ke HP user (misal: "Ada MR baru perlu approval").
- **Handling:** Jika token invalid atau kuota habis, pastikan sistem tidak crash (gunakan `try/catch` senyap).

### C. Database (Supabase)

**Instance:** `lib/supabase/client.ts` & `server.ts`

- **Auth:** Menggunakan Supabase Auth (Email/Password).
- **Storage:** Bucket `mr` (untuk lampiran Material Request) dan `avatars`.
