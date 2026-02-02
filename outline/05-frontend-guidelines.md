# 🎨 05. Frontend Guidelines & UI Standards

Dokumen ini menjadi acuan standar pengembangan antarmuka (UI) dan User Experience (UX) di **Garuda Procure**.

## 1. Tech Stack & Styling

- **Framework:** Next.js 14+ (App Router).
- **Styling:** Tailwind CSS.
- **Component Library:** Shadcn/UI (Radix UI base).
- **Icons:** Lucide React.
- **Font:** Inter (via `next/font/google`).

## 2. Global State Management

**Library:** Zustand
**File:** `lib/zustand/store.ts`

Gunakan Zustand hanya untuk state global yang benar-benar perlu diakses lintas komponen (misal: Toggle Sidebar).
Untuk state lokal (form input, modal open/close), gunakan `useState` React biasa.

```typescript
// Contoh penggunaan
const { isMenuOpen, setMenuOpen } = useStore();
```
