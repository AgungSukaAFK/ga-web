# ⚙️ 03. Workflow Logic & Business Rules

Dokumen ini menjelaskan aturan bisnis inti (Core Business Logic) yang mengatur perubahan status, alur persetujuan (approval), dan penomoran dokumen dalam sistem **Garuda Procure**.

## 🔄 1. Sequential Approval System (The Heart)

Sistem ini menggunakan **Sequential Approval** (berurutan), bukan paralel. User B tidak boleh menyetujui dokumen sebelum User A selesai.

### Logic "My Turn"

**File Reference:** `services/approvalService.ts`

Sebuah dokumen (MR/PO) dianggap "Giliran Saya" (`My Turn`) jika dan hanya jika:

1.  **User Match:** User ID saya ada di dalam array `approvals`.
2.  **Status Pending:** Status approval saya masih `pending`.
3.  **Predecessor Check:** SEMUA approver yang berada di urutan **sebelum** saya sudah berstatus `approved`.

```typescript
// Pseudo-code Logic (Jangan diubah!)
const myIndex = approvals.findIndex(
  (a) => a.userid === myUserId && a.status === "pending",
);
const isTurn = approvals
  .slice(0, myIndex)
  .every((a) => a.status === "approved");
```
