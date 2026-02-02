# 🗄️ 02. Data Schema & Type Definitions

Dokumen ini menggabungkan struktur database (Supabase/PostgreSQL) dan definisi tipe TypeScript. Gunakan ini sebagai referensi utama saat membuat query atau memanipulasi data.

> **PENTING:** Sistem ini menggunakan pendekatan **Hybrid Relational-Document**. Data transaksional inti (User, ID, Tanggal) disimpan sebagai kolom SQL, sedangkan detail variatif (Item Barang, History Approval) disimpan sebagai **JSON/JSONB**.

---

## 🔗 1. Core Transactional Tables

### A. Material Request (MR)

**Table:** `public.material_requests`
**TS Interface:** `MaterialRequest`

Permintaan pengadaan barang dari user.

| Column Name      | Type                | Notes & Relations                                                |
| :--------------- | :------------------ | :--------------------------------------------------------------- |
| `id`             | `bigint` (Identity) | Primary Key.                                                     |
| `kode_mr`        | `text`              | Unique. Format: `GMI/MR/...`.                                    |
| `userid`         | `uuid`              | FK ke `auth.users`.                                              |
| `cost_center_id` | `bigint`            | FK ke `public.cost_centers`. **Critical** untuk validasi budget. |
| `company_code`   | `text`              | Filter scope data (GMI/LOURDES).                                 |
| `status`         | `text`              | Workflow state (e.g., 'Pending Approval').                       |
| `level`          | `text`              | Physical tracking (e.g., 'OPEN 1'). Enum check active.           |
| `orders`         | `json`              | **[Detail Structure]** Array of requested items.                 |
| `approvals`      | `jsonb`             | **[Detail Structure]** Workflow history & queue.                 |
| `attachments`    | `json`              | Array file path di storage bucket `mr`.                          |
| `prioritas`      | `text`              | Enum: 'P0' - 'P4'.                                               |

**📦 JSON Structure: `orders`**

```typescript
Array<{
  name: string;
  qty: string; // Note: Disimpan string di MR
  uom: string;
  estimasi_harga: number;
  barang_id?: number; // Nullable (jika barang baru/non-katalog)
  part_number?: string;
  note?: string;
}>;
```
