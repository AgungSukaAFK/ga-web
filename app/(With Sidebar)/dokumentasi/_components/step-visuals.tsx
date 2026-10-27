// Mock UI ilustratif untuk tiap langkah stepper - BUKAN screenshot, cuma
// tiruan ringkas tampilan aplikasi (pakai komponen/warna yang sama) supaya
// otomatis ikut tema & tidak basi kalau UI aslinya berubah sedikit. Semua
// animasi pakai class docs-* di globals.css; komponen di-remount tiap ganti
// langkah (key di FlowStepper) supaya animasinya diputar ulang.

import { cn } from "@/lib/utils";
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  Lock,
  Paperclip,
  QrCode,
  Receipt,
  Truck,
  Upload,
  X,
} from "lucide-react";
import {
  MockButton,
  MockField,
  MockWindow,
  StatusPill,
} from "./primitives";

function Delay({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <div
      className={cn("docs-fade-up", className)}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** Rantai approver berurutan - centang muncul satu per satu. */
function ApprovalChain({
  steps,
}: {
  steps: { name: string; role: string; state: "done" | "current" | "next" }[];
}) {
  return (
    <ol className="relative space-y-3 pl-1">
      <span className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
      {steps.map((s, i) => (
        <li
          key={s.name}
          className="docs-fade-up relative flex items-center gap-3"
          style={{ animationDelay: `${0.25 + i * 0.45}s` }}
        >
          <span
            className={cn(
              "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-background",
              s.state === "done" && "border-green-500 bg-green-500 text-white",
              s.state === "current" && "docs-ring border-primary text-primary",
              s.state === "next" && "border-dashed text-muted-foreground",
            )}
          >
            {s.state === "done" ? (
              <Check className="h-3.5 w-3.5" />
            ) : s.state === "current" ? (
              <Clock className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[10px]">{i + 1}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.name}</p>
            <p className="text-[10px] text-muted-foreground">{s.role}</p>
          </div>
          {s.state === "done" && (
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
              Approved
            </span>
          )}
          {s.state === "current" && (
            <span className="text-[10px] font-medium text-primary">
              Giliran sekarang
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

// ===========================================================================
// MATERIAL REQUEST
// ===========================================================================

function MrCreate() {
  const items = [
    { name: "Ban Luar 1000-20", qty: 4, harga: 3_250_000 },
    { name: "Oli Mesin 15W-40", qty: 10, harga: 410_000 },
  ];
  const total = items.reduce((s, i) => s + i.qty * i.harga, 0);
  return (
    <MockWindow title="Material Request › Buat MR Baru">
      <div className="grid grid-cols-2 gap-2">
        <MockField label="Kategori" value="Replace" delay={0.1} />
        <MockField label="Tujuan Site" value="Site Kaltim" delay={0.2} />
      </div>
      <MockField
        label="Prioritas"
        delay={0.3}
        highlight
        value={
          <div className="flex gap-1">
            {["P0", "P1", "P2", "P3", "P4"].map((p) => (
              <span
                key={p}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  p === "P1"
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {p}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">
              Due date: +10 hari
            </span>
          </div>
        }
      />
      <Delay delay={0.45} className="rounded-md border">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground">
          <span>Barang</span>
          <span>Qty</span>
          <span className="text-right">Estimasi Harga</span>
        </div>
        {items.map((it, i) => (
          <div
            key={it.name}
            className="docs-fade-up grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 py-1"
            style={{ animationDelay: `${0.6 + i * 0.3}s` }}
          >
            <span className="truncate">{it.name}</span>
            <span>{it.qty}</span>
            <span className="text-right tabular-nums">
              {it.harga.toLocaleString("id-ID")}
            </span>
          </div>
        ))}
        <div
          className="docs-pop flex items-center justify-between border-t bg-primary/5 px-2 py-1.5 font-semibold"
          style={{ animationDelay: "1.3s" }}
        >
          <span>Total Estimasi (otomatis)</span>
          <span className="tabular-nums">Rp {total.toLocaleString("id-ID")}</span>
        </div>
      </Delay>
      <Delay delay={1.5} className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Paperclip className="h-3 w-3" /> foto-kerusakan.jpg
          <Link2 className="ml-1 h-3 w-3" /> link file besar
        </span>
        <MockButton pulse>Buat Material Request</MockButton>
      </Delay>
    </MockWindow>
  );
}

function MrValidate() {
  return (
    <MockWindow title="Approval & Validation › Validasi MR">
      <MockField
        label="Cost Center (wajib dipilih GA)"
        highlight
        delay={0.1}
        value={
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-medium">CC-OPS Site Kaltim</span>
              <span className="text-muted-foreground">sisa Rp 84 jt</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="docs-grow-x h-full w-[62%] rounded-full bg-emerald-500" />
            </div>
          </div>
        }
      />
      <MockField
        label="Template Approval"
        delay={0.35}
        value="MR Operasional Site (Manager → GM → Direksi)"
      />
      <Delay delay={0.6} className="flex flex-wrap gap-1.5">
        {["Manager", "GM", "Direksi"].map((n) => (
          <span key={n} className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px]">
            {n}
          </span>
        ))}
        <span className="rounded-full border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground">
          + tambah approver
        </span>
      </Delay>
      <Delay delay={0.85} className="flex justify-end gap-2">
        <MockButton variant="outline">On Hold</MockButton>
        <MockButton pulse>Validasi &amp; Mulai Approval</MockButton>
      </Delay>
    </MockWindow>
  );
}

function MrApproval() {
  return (
    <MockWindow title="Approval & Validation › MR/GMI/X/2026/0123">
      <ApprovalChain
        steps={[
          { name: "Budi Santoso", role: "Manager Operasional", state: "done" },
          { name: "Sari Wulandari", role: "General Manager", state: "done" },
          { name: "Hendra Gunawan", role: "Direksi", state: "current" },
        ]}
      />
      <Delay delay={1.6} className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-[10px] text-muted-foreground">
          💬 Diskusi: &quot;Ban lama sudah gundul, foto terlampir&quot;
        </span>
        <div className="flex gap-1.5">
          <MockButton variant="danger">
            <X className="h-3 w-3" /> Reject
          </MockButton>
          <MockButton pulse>
            <Check className="h-3 w-3" /> Approve
          </MockButton>
        </div>
      </Delay>
    </MockWindow>
  );
}

function MrBudget() {
  return (
    <MockWindow title="Cost Center › CC-OPS Site Kaltim">
      <Delay delay={0.1}>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Budget saat ini</span>
          <span className="font-semibold tabular-nums">Rp 84.000.000</span>
        </div>
        <div className="relative mt-2 h-4 overflow-hidden rounded-full bg-muted">
          <div
            className="docs-shrink-budget absolute inset-y-0 left-0 rounded-full bg-emerald-500"
            style={
              {
                "--docs-from": "100%",
                "--docs-to": "79%",
              } as React.CSSProperties
            }
          />
        </div>
      </Delay>
      <Delay
        delay={1.4}
        className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      >
        <span>− Total Estimasi MR/GMI/X/2026/0123</span>
        <span className="font-semibold tabular-nums">Rp 17.100.000</span>
      </Delay>
      <Delay delay={1.8} className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">Sisa budget</span>
        <span className="font-semibold tabular-nums">Rp 66.900.000</span>
      </Delay>
      <Delay delay={2.1} className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <FileText className="h-3 w-3" /> Tercatat otomatis di riwayat transaksi
        Cost Center
      </Delay>
    </MockWindow>
  );
}

// ===========================================================================
// PURCHASE ORDER
// ===========================================================================

function PoCreate() {
  return (
    <MockWindow title="Purchase Order › Buat PO">
      <MockField
        label="Dari MR"
        delay={0.1}
        value={
          <div className="flex items-center justify-between">
            <span>MR/GMI/X/2026/0123</span>
            <StatusPill status="Waiting PO" />
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <MockField
          label="Vendor"
          delay={0.25}
          value={
            <span>
              PT Sumber Ban <span className="text-muted-foreground">(HO)</span>
            </span>
          }
        />
        <MockField label="Payment Term" delay={0.4} value="Termin 30 Hari" />
      </div>
      <Delay delay={0.55} className="rounded-md border">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-2 py-1">
          <span>Ban Luar 1000-20 × 4</span>
          <span className="tabular-nums">12.800.000</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-2 py-1">
          <span>Oli Mesin 15W-40 × 10</span>
          <span className="tabular-nums">3.950.000</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 border-t px-2 py-1 text-muted-foreground">
          <span>PPN 11%</span>
          <span className="tabular-nums">1.842.500</span>
        </div>
      </Delay>
      <Delay delay={0.8} className="flex justify-end">
        <MockButton pulse>Ajukan</MockButton>
      </Delay>
    </MockWindow>
  );
}

function PoValidate() {
  return (
    <MockWindow title="Approval & Validation › Validasi PO">
      <MockField
        label="Template Approval PO"
        delay={0.1}
        highlight
        value="PO Termin (Receiver → Payment Validator)"
      />
      <Delay delay={0.4} className="flex flex-wrap items-center gap-1.5">
        {["Dept. Head", "Receiver", "Payment Validator"].map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px]">
              {n}
            </span>
            {i < 2 && <span className="text-muted-foreground">→</span>}
          </span>
        ))}
      </Delay>
      <Delay
        delay={0.7}
        className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      >
        ⚠️ Pastikan urutan Receiver &amp; Payment Validator sesuai metode
        pembayaran PO.
      </Delay>
      <Delay delay={0.9} className="flex justify-end">
        <MockButton pulse>Validasi</MockButton>
      </Delay>
    </MockWindow>
  );
}

function PoApproval() {
  return (
    <MockWindow title="Purchase Order › PO/GMI/X/2026/0456">
      <ApprovalChain
        steps={[
          { name: "Dept. Head", role: "Menyetujui", state: "done" },
          { name: "Payment Validator", role: "Finance", state: "current" },
          { name: "Receiver", role: "GA / Warehouse", state: "next" },
        ]}
      />
      <Delay delay={1.5} className="space-y-2 rounded-md border bg-muted/40 p-2.5">
        <p className="font-medium">Dialog Payment Validator</p>
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Check className="h-2.5 w-2.5" />
            </span>
            DP lunas
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3.5 w-3.5 rounded-sm border" /> BP lunas
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Paperclip className="h-3 w-3" /> bukti-transfer.pdf (wajib)
        </span>
      </Delay>
    </MockWindow>
  );
}

function PoReceive() {
  const rows = [
    { name: "Ban Luar 1000-20", po: 4, got: 4 },
    { name: "Oli Mesin 15W-40", po: 10, got: 6 },
  ];
  return (
    <MockWindow title="Purchase Order › Terima Barang (checklist)">
      <div className="rounded-md border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground">
          <span>Barang</span>
          <span>Qty PO</span>
          <span>Diterima</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="docs-fade-up grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-2 py-1.5"
            style={{ animationDelay: `${0.2 + i * 0.4}s` }}
          >
            <span className="truncate">{r.name}</span>
            <span className="text-center">{r.po}</span>
            <span className="rounded border px-1.5 text-center font-semibold">
              {r.got}
            </span>
            {r.got === r.po ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <span className="text-[10px] font-semibold text-amber-600">
                −{r.po - r.got}
              </span>
            )}
          </div>
        ))}
      </div>
      <Delay delay={1.2} className="grid grid-cols-2 gap-2">
        <div className="rounded-md border p-2 text-center">
          <p className="mb-1 text-[10px] text-muted-foreground">Semua qty sesuai</p>
          <StatusPill status="Full Received" />
        </div>
        <div className="rounded-md border border-amber-300 p-2 text-center ring-2 ring-amber-200 dark:ring-amber-900">
          <p className="mb-1 text-[10px] text-muted-foreground">Ada yang kurang</p>
          <StatusPill status="Partial Receive" />
        </div>
      </Delay>
      <Delay delay={1.5} className="text-[10px] text-muted-foreground">
        Checklist bisa diedit ulang kapan saja &amp; riwayatnya bisa dicetak.
      </Delay>
    </MockWindow>
  );
}

function PoDeliver() {
  return (
    <MockWindow title="Konfirmasi Penerimaan oleh Requester">
      <Delay delay={0.1} className="relative h-10 rounded-md border bg-muted/40">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium">
          GA
        </span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium">
          Requester
        </span>
        <div className="absolute inset-x-10 top-1/2 h-px border-t border-dashed" />
        <div className="absolute inset-x-10 top-1/2 -translate-y-1/2">
          <Truck
            className="docs-travel-x absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-amber-600"
            style={{ "--docs-duration": "3.5s" } as React.CSSProperties}
          />
        </div>
      </Delay>
      <Delay delay={0.4}>
        <StatusPill status="On Delivery" domain="item" label="Dalam Pengiriman" />
      </Delay>
      <Delay delay={0.7} className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5 rounded-md border p-2.5">
          <p className="font-medium">Cara 1 · Dari detail MR</p>
          <MockButton pulse>
            <Upload className="h-3 w-3" /> Konfirmasi Barang Diterima
          </MockButton>
          <p className="text-[10px] text-muted-foreground">Upload foto/file bukti</p>
        </div>
        <div className="space-y-1.5 rounded-md border p-2.5">
          <p className="font-medium">Cara 2 · Scan QR BAST</p>
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded border bg-background">
            <QrCode className="h-10 w-10" />
            <span className="docs-scan absolute inset-x-1 h-0.5 rounded bg-primary/70" />
          </div>
          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Camera className="h-3 w-3" /> foto langsung dari kamera
          </p>
        </div>
      </Delay>
      <Delay delay={1.1} className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Hasil:</span>
        <StatusPill status="Completed" domain="item" label="Barang Diterima User" />
      </Delay>
    </MockWindow>
  );
}

// ===========================================================================
// PETTY CASH
// ===========================================================================

function PcInput() {
  const syarat = [
    "Departemen punya Template Approval Pengajuan",
    "Departemen/site punya Budget Petty Cash aktif",
    "Tidak ada tarikan dana yang belum dideklarasikan",
  ];
  return (
    <MockWindow title="Petty Cash › Pengajuan Saya › Input Pengajuan">
      <Delay delay={0.1} className="space-y-1.5 rounded-md border bg-muted/40 p-2.5">
        <p className="font-medium">Cek kelayakan otomatis</p>
        {syarat.map((s, i) => (
          <p
            key={s}
            className="docs-fade-up flex items-center gap-1.5"
            style={{ animationDelay: `${0.3 + i * 0.3}s` }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" /> {s}
          </p>
        ))}
      </Delay>
      <Delay delay={1.3} className="rounded-md border">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-2 py-1">
          <span>Air Mineral Galon × 10</span>
          <span className="tabular-nums">200.000</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 px-2 py-1">
          <span>ATK - Kertas A4 × 5</span>
          <span className="tabular-nums">275.000</span>
        </div>
      </Delay>
      <Delay delay={1.6} className="flex justify-end">
        <MockButton pulse>Submit Pengajuan</MockButton>
      </Delay>
    </MockWindow>
  );
}

function PcApproval({ doc }: { doc: string }) {
  return (
    <MockWindow title={`Approval Petty Cash › ${doc}`}>
      <ApprovalChain
        steps={[
          { name: "Dept. Head", role: "Menyetujui", state: "done" },
          { name: "Finance", role: "Menyetujui", state: "current" },
        ]}
      />
      <Delay delay={1.2} className="flex items-center justify-between border-t pt-3">
        <span className="text-[10px] text-muted-foreground">
          Ditolak? Alasan dicatat &amp; jalur berhenti.
        </span>
        <MockButton pulse>
          <Check className="h-3 w-3" /> Approve
        </MockButton>
      </Delay>
    </MockWindow>
  );
}

function PcVoucher() {
  return (
    <MockWindow title="Petty Cash › Pengajuan Voucher">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Delay delay={0.1} className="rounded-md border p-2">
          <p className="font-medium">Pengajuan</p>
          <p className="text-[10px] text-muted-foreground">2 barang · Rp 475.000</p>
          <StatusPill status="Approved" domain="pc" className="mt-1" />
        </Delay>
        <Delay delay={0.5}>
          <span className="flex flex-col items-center text-[10px] text-muted-foreground">
            <span className="text-lg">→</span>salin
          </span>
        </Delay>
        <Delay delay={0.8} className="rounded-md border border-primary p-2 ring-2 ring-primary/20">
          <p className="flex items-center gap-1 font-medium">
            Voucher <Lock className="h-3 w-3" />
          </p>
          <p className="text-[10px] text-muted-foreground">2 barang · Rp 475.000</p>
          <StatusPill status="In Approval" domain="pc" className="mt-1" />
        </Delay>
      </div>
      <Delay delay={1.2} className="text-[10px] text-muted-foreground">
        Isi Voucher = salinan persis Pengajuan (tidak bisa diedit). 1 Pengajuan
        hanya bisa menjadi 1 Voucher.
      </Delay>
    </MockWindow>
  );
}

function PcTarikDana() {
  return (
    <MockWindow title="Pengajuan Voucher › Voucher Saya › Tarik Dana">
      <Delay delay={0.1}>
        <div className="flex justify-between text-[11px]">
          <span className="font-medium">Voucher Rp 475.000</span>
          <span className="text-muted-foreground">sudah ditarik 2×</span>
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-muted">
          <div
            className="docs-grow-x h-full w-[42%] bg-sky-500"
            style={{ animationDelay: "0.3s" }}
          />
          <div
            className="docs-grow-x h-full w-[30%] bg-indigo-500"
            style={{ animationDelay: "1s" }}
          />
        </div>
        <div className="mt-1 flex gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> SV1
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> SV2
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> sisa
          </span>
        </div>
      </Delay>
      <Delay delay={1.4} className="space-y-1 rounded-md border p-2">
        <p className="font-medium">Pilih barang &amp; qty yang ditarik</p>
        <p className="flex items-center gap-1.5">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Check className="h-2.5 w-2.5" />
          </span>
          ATK - Kertas A4 · qty <b>2</b> dari 5
        </p>
      </Delay>
      <Delay delay={1.7} className="flex items-center justify-between">
        <StatusPill status="Menunggu Pembayaran" domain="pc" />
        <MockButton pulse>Tarik Dana</MockButton>
      </Delay>
    </MockWindow>
  );
}

function PcBayar() {
  return (
    <MockWindow title="Approval Petty Cash › Pembayaran Sub-Voucher">
      <MockField
        label="Sub-Voucher"
        delay={0.1}
        value={
          <div className="flex items-center justify-between">
            <span>…/PC-VCR/X/2026/GA/007-SV2</span>
            <span className="tabular-nums">Rp 110.000</span>
          </div>
        }
      />
      <MockField
        label="Bukti transfer (wajib)"
        delay={0.35}
        highlight
        value={
          <span className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> transfer-sv2.jpg
          </span>
        }
      />
      <Delay delay={0.7} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusPill status="Menunggu Pembayaran" domain="pc" className="opacity-60" />
          <span className="text-muted-foreground">→</span>
          <span className="docs-pop" style={{ animationDelay: "1.1s" }}>
            <StatusPill status="Selesai" domain="pc" />
          </span>
        </div>
        <MockButton pulse>Selesaikan</MockButton>
      </Delay>
    </MockWindow>
  );
}

function PcDeklarasi() {
  return (
    <MockWindow title="Petty Cash › Deklarasi">
      <Delay delay={0.1} className="flex items-center gap-3 rounded-md border p-2.5">
        <Receipt className="h-8 w-8 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Laporkan pemakaian riil</p>
          <p className="text-[10px] text-muted-foreground">
            Qty/harga disesuaikan dengan struk asli + upload foto struk
          </p>
        </div>
      </Delay>
      <Delay delay={0.5} className="space-y-1">
        {["SV1 · Rp 200.000", "SV2 · Rp 110.000"].map((sv, i) => (
          <div
            key={sv}
            className="docs-fade-up flex items-center justify-between rounded-md border px-2 py-1"
            style={{ animationDelay: `${0.6 + i * 0.35}s` }}
          >
            <span>{sv}</span>
            <StatusPill status="Approved" domain="pc" />
          </div>
        ))}
      </Delay>
      <Delay delay={1.5} className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          Semua tarikan dideklarasikan &amp; disetujui →
        </span>
        <span className="docs-pop" style={{ animationDelay: "1.8s" }}>
          <StatusPill status="Selesai" domain="pc" label="Voucher Selesai" />
        </span>
      </Delay>
    </MockWindow>
  );
}

// ===========================================================================

export type VisualId =
  | "mr-create"
  | "mr-validate"
  | "mr-approval"
  | "mr-budget"
  | "po-create"
  | "po-validate"
  | "po-approval"
  | "po-receive"
  | "po-deliver"
  | "pc-input"
  | "pc-approval-pengajuan"
  | "pc-voucher"
  | "pc-approval-voucher"
  | "pc-tarik"
  | "pc-bayar"
  | "pc-deklarasi";

export function StepVisual({ id }: { id: VisualId }) {
  switch (id) {
    case "mr-create":
      return <MrCreate />;
    case "mr-validate":
      return <MrValidate />;
    case "mr-approval":
      return <MrApproval />;
    case "mr-budget":
      return <MrBudget />;
    case "po-create":
      return <PoCreate />;
    case "po-validate":
      return <PoValidate />;
    case "po-approval":
      return <PoApproval />;
    case "po-receive":
      return <PoReceive />;
    case "po-deliver":
      return <PoDeliver />;
    case "pc-input":
      return <PcInput />;
    case "pc-approval-pengajuan":
      return <PcApproval doc="Pengajuan" />;
    case "pc-voucher":
      return <PcVoucher />;
    case "pc-approval-voucher":
      return <PcApproval doc="Voucher" />;
    case "pc-tarik":
      return <PcTarikDana />;
    case "pc-bayar":
      return <PcBayar />;
    case "pc-deklarasi":
      return <PcDeklarasi />;
  }
}
