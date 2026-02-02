# 🏗️ 04. Service Architecture & Integration

Dokumen ini menjelaskan lapisan data dan logika backend aplikasi **Garuda Procure**.
Aplikasi ini menggunakan pola **Service Layer** untuk memisahkan UI Components dari logika database Supabase.

---

## 🔌 1. Core Architecture

**Library:** `@supabase/supabase-js`
**Instance:** `lib/supabase/client.ts`

Semua service mengimpor `createClient` untuk membuat koneksi ke Supabase.

```typescript
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```
