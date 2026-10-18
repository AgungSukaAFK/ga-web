# 🔌 06. Environment & External Integrations

Dokumen ini menjelaskan integrasi pihak ketiga dan variabel lingkungan yang diperlukan agar sistem berjalan dengan benar.

## 1. Environment Variables (`.env`)

**Source:** `.env.example`

| Variable                        | Kegunaan                            | Critical Level |
| :------------------------------ | :---------------------------------- | :------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Endpoint API Supabase.              | **High**       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Key untuk client-side fetch. | **High**       |
| `FONNTE_TOKEN`                  | Token API Fonnte (WhatsApp).        | Medium         |

## 2. External Services

> Sistem tidak memakai layanan email. Notifikasi lewat notifikasi in-app/push, feedback user disimpan ke tabel `feedbacks`.

### A. WhatsApp Service (Fonnte)

**File:** `lib/fonnte/index.ts`

- **Provider:** Fonnte (Unofficial WA API).
- **Fungsi:** Mengirim notifikasi cepat ke HP user (misal: "Ada MR baru perlu approval").
- **Handling:** Jika token invalid atau kuota habis, pastikan sistem tidak crash (gunakan `try/catch` senyap).

### B. Database (Supabase)

**Instance:** `lib/supabase/client.ts` & `server.ts`

- **Auth:** Menggunakan Supabase Auth (Email/Password).
- **Storage:** Bucket `mr` (untuk lampiran Material Request) dan `avatars`.
