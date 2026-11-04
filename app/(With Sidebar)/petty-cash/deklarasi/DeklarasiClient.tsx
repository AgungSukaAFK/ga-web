// src/app/(With Sidebar)/petty-cash/deklarasi/DeklarasiClient.tsx
//
// Requester bikin Deklarasi dari salah satu Sub-Voucher miliknya (tarikan
// dana parsial, lihat services/pettyCashSubVoucherService.ts) yang sudah
// "Selesai" dibayar Finance dan belum pernah dideklarasikan. Item AWAL
// disalin dari Sub-Voucher itu SENDIRI (`sv.items` - barang yang BENERAN
// ditarik di tarikan ini, lihat PettyCashSubVoucherItem, type/index.ts),
// tapi qty/harga satuan/catatan per baris BOLEH disesuaikan ke pemakaian
// riil (struk asli kadang beda dari rencana) - lihat
// createDeklarasiFromSubVoucher, services/pettyCashDeklarasiService.ts.
// Begitu dikirim, Deklarasi langsung masuk jalur approval-nya sendiri
// (Template Approval ber-approval_type "Approval Deklarasi"). Total
// Deklarasi tidak boleh melebihi nominal tarikan, dan kalau ditolak tarikan
// itu muncul lagi di sini utk diajukan ulang (lihat
// supabase/migrations/0009_petty_cash_pengembalian.sql).
//
// Kalau Deklarasi yang disetujui lebih kecil dari nominal tarikan, sisanya
// bisa dikembalikan lewat tabel "Sisa Dana Bisa Dikembalikan" (wajib bukti
// setor, dikonfirmasi Finance - lihat services/pettyCashPengembalianService.ts).
//
// `?sv=<id>` (deklarasiHref, lib/pcChain.ts) langsung membuka form tarikan itu.
// Di mobile, tabel & form diganti kartu (pemakaian utamanya foto struk dari HP).

"use client";

import { useEffect, useRef, useState } from "react";
import { Content } from "@/components/content";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileDropzone } from "@/components/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { stringifyRichContent } from "@/lib/rich-content";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { useIsMobile } from "@/hooks/use-mobile";
import { paginateRows } from "@/lib/client-list";
import { createClient } from "@/lib/supabase/client";
import { uploadAttachmentDirect } from "@/lib/uploadDirect";
import {
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  Attachment,
  PettyCashDeklarasi,
  PettyCashPengembalian,
  PettyCashSubVoucher,
} from "@/type";
import {
  LIMIT_OPTIONS,
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  PC_PENGEMBALIAN_STATUS_COLORS,
  PC_PENGEMBALIAN_STATUS_COLOR_DEFAULT,
  pcStatusLabel,
} from "@/type/enum";
import {
  fetchMyDeklarasi,
  createDeklarasiFromSubVoucher,
} from "@/services/pettyCashDeklarasiService";
import {
  fetchPendingSubVouchers,
  fetchSubVouchersForDeklarasi,
} from "@/services/pettyCashSubVoucherService";
import {
  SubVoucherWithSisa,
  createPengembalian,
  fetchMyPengembalian,
  fetchSubVouchersForPengembalian,
} from "@/services/pettyCashPengembalianService";
import { pickCurrentDoc } from "@/lib/pcChain";
import { PcPengembalianForm } from "@/components/petty-cash/PcPengembalianForm";
import { PcGlossaryButton } from "@/components/petty-cash/PcGlossary";
import { PcCoaBadge } from "@/components/petty-cash/PcCoaBadge";
import { PcDownloadMenuItems } from "@/components/petty-cash/PcPrintMenu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  FileCheck2,
  FileText,
  CalendarDays,
  X,
  Eye,
  Clock,
  AlertTriangle,
  Undo2,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const StatusBadge = ({
  status,
  colors = PC_DEKLARASI_STATUS_COLORS,
  fallback = PC_DEKLARASI_STATUS_COLOR_DEFAULT,
}: {
  status: string;
  colors?: Record<string, string>;
  fallback?: string;
}) => (
  <Badge className={`whitespace-nowrap ${colors[status] || fallback}`}>
    {pcStatusLabel(status)}
  </Badge>
);

const MobileCard = ({
  title,
  badge,
  note,
  actions,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-2 rounded-md border p-3">
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 font-mono text-xs font-semibold [overflow-wrap:anywhere]">
        {title}
      </p>
      {badge}
    </div>
    {note}
    <dl className="space-y-1 text-sm">{children}</dl>
    {actions && <div className="flex items-center gap-1.5 pt-1">{actions}</div>}
  </div>
);

const MobileField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex justify-between gap-3">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

const MobileEmpty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
    {children}
  </p>
);

const MobileLoading = () => (
  <div className="flex justify-center rounded-md border p-6">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

type DeclareRow = {
  barang_id: number | null;
  part_name: string;
  category: string | null;
  uom: string | null;
  qty: string;
  unit_price: number;
  note: string;
  // COA baris ini - dibawa apa adanya dari item Voucher asalnya, TIDAK
  // bisa diubah di Deklarasi (lihat komentar coa di PettyCashPengajuanItem,
  // type/index.ts).
  coa: "GMI" | "GIS" | null;
};

export default function DeklarasiClient() {
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);
  const supabase = createClient();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { searchParams, page, limit, setParams, setFilters } =
    useListUrlParams();
  const deepLinkSv = searchParams.get("sv");

  const [userId, setUserId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<PettyCashSubVoucher[]>([]);
  // Sub-voucher yang belum dideklarasikan TAPI belum "Selesai" dibayar
  // Finance - tidak muncul di tabel "Siap Dideklarasikan" di bawah, jadi
  // ditampilkan di alert info sendiri supaya requester tidak bingung kenapa
  // tarikannya "hilang" (lihat komentar fetchPendingSubVouchers,
  // services/pettyCashSubVoucherService.ts).
  const [awaitingPayment, setAwaitingPayment] = useState<PettyCashSubVoucher[]>(
    [],
  );
  const [deklarasiList, setDeklarasiList] = useState<PettyCashDeklarasi[]>([]);
  const [returnable, setReturnable] = useState<SubVoucherWithSisa[]>([]);
  const [pengembalianList, setPengembalianList] = useState<
    PettyCashPengembalian[]
  >([]);
  const [selectedReturn, setSelectedReturn] =
    useState<SubVoucherWithSisa | null>(null);
  const [returning, setReturning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selected, setSelected] = useState<PettyCashSubVoucher | null>(null);
  const [rows, setRows] = useState<DeclareRow[]>([]);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi.");
      setUserId(user.id);

      const [
        eligibleData,
        pendingData,
        deklarasiData,
        returnableData,
        pengembalianData,
      ] = await Promise.all([
        fetchSubVouchersForDeklarasi(user.id),
        fetchPendingSubVouchers(user.id),
        fetchMyDeklarasi(user.id),
        fetchSubVouchersForPengembalian(user.id),
        fetchMyPengembalian(user.id),
      ]);
      setEligible(eligibleData);
      setAwaitingPayment(
        pendingData.filter((sv) => sv.status !== "Selesai"),
      );
      setDeklarasiList(deklarasiData);
      setReturnable(returnableData);
      setPengembalianList(pengembalianData);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDeclareForm = (subVoucher: PettyCashSubVoucher) => {
    setSelected(subVoucher);
    setRows(
      (subVoucher.items ?? []).map((it) => ({
        barang_id: it.barang_id,
        part_name: it.part_name,
        category: it.category,
        uom: it.uom,
        qty: String(it.qty),
        unit_price: it.unit_price,
        note: it.note || "",
        coa: it.coa ?? null,
      })),
    );
    setNotes("");
    setAttachments([]);
  };

  useEffect(() => {
    if (loading || !deepLinkSv) return;
    const target = eligible.find((sv) => String(sv.id) === deepLinkSv);
    if (target) {
      openDeclareForm(target);
    } else {
      toast.info("Tarikan ini sudah tidak perlu dideklarasikan.");
    }
    // replace: tombol Back tidak boleh membuka form-nya lagi.
    router.replace("/petty-cash/deklarasi", { scroll: false });
  }, [loading, deepLinkSv]);

  const closeDeclareForm = () => {
    setSelected(null);
    setRows([]);
  };

  // Tarikan di tabel "Siap Dideklarasikan" yang Deklarasi terakhirnya
  // ditolak (fetchSubVouchersForDeklarasi sudah menyaring yang masih aktif).
  const rejectedOf = (sv: PettyCashSubVoucher) =>
    pickCurrentDoc(sv.petty_cash_deklarasi);

  const updateRow = (index: number, patch: Partial<DeclareRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const totalAmount = rows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (r.unit_price || 0),
    0,
  );
  // Batas yang sama dijaga trigger check_petty_cash_deklarasi_total di DB.
  const overLimit = !!selected && totalAmount > selected.amount;

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const sizeError = getAttachmentSizeError(file);
    if (sizeError) {
      return toast.error("Ukuran file terlalu besar", {
        description: sizeError,
      });
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `petty-cash-deklarasi/${fileName}`;

      const result = await uploadAttachmentDirect(file, filePath);
      if (!result.success) throw new Error(result.message);

      setAttachments((prev) => [...prev, { url: result.url, name: file.name }]);
      toast.success("Lampiran berhasil diunggah");
    } catch (error: any) {
      toast.error("Gagal mengunggah file", {
        description: getUploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!selected || !userId) return;
    if (rows.some((r) => !Number(r.qty) || Number(r.qty) <= 0)) {
      return toast.error("Qty setiap barang wajib diisi dan lebih dari 0.");
    }
    if (overLimit) {
      return toast.error("Total Deklarasi melebihi nominal tarikan.", {
        description: `Maksimal ${formatCurrency(selected.amount)}.`,
      });
    }

    setCreating(true);
    try {
      const deklarasi = await createDeklarasiFromSubVoucher(
        {
          sub_voucher_id: selected.id,
          voucher_id: selected.voucher_id,
          company_code: selected.petty_cash_voucher?.company_code || "",
          department: selected.petty_cash_voucher?.department || "",
          week_of_month: selected.petty_cash_voucher?.week_of_month ?? null,
          site: selected.petty_cash_voucher?.site ?? null,
          notes,
          items: rows.map((r) => ({
            barang_id: r.barang_id,
            part_name: r.part_name,
            category: r.category,
            uom: r.uom,
            qty: Number(r.qty),
            unit_price: r.unit_price,
            subtotal: Number(r.qty) * r.unit_price,
            note: r.note.trim() || null,
            coa: r.coa,
          })),
          total_amount: totalAmount,
          attachments,
        },
        userId,
      );
      toast.success(
        `Deklarasi ${deklarasi.kode_deklarasi} berhasil dikirim dan masuk jalur approval.`,
      );
      closeDeclareForm();
      await loadData();
    } catch (error: any) {
      toast.error("Gagal mengirim deklarasi", { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitPengembalian = async (
    amount: number,
    returnNotes: string,
    proof: Attachment[],
  ) => {
    if (!selectedReturn) return;
    setReturning(true);
    try {
      const pengembalian = await createPengembalian(
        selectedReturn.subVoucher.id,
        selectedReturn.subVoucher.petty_cash_voucher?.company_code || "",
        amount,
        returnNotes,
        proof,
      );
      toast.success(
        `Pengembalian ${pengembalian.kode_pengembalian} terkirim, menunggu konfirmasi Finance.`,
      );
      setSelectedReturn(null);
      await loadData();
    } catch (error: any) {
      toast.error("Gagal mengirim pengembalian", {
        description: error.message,
      });
    } finally {
      setReturning(false);
    }
  };

  const {
    rows: visibleDeklarasi,
    currentPage,
    offset,
  } = paginateRows(deklarasiList, page, limit);

  return (
    <>
      <Content
        title="Deklarasi Petty Cash"
        description="Laporkan pemakaian riil dana Petty Cash yang sudah dicairkan."
        cardAction={
          <div className="flex items-center gap-1">
            <PcGlossaryButton focus="deklarasi" />
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCcw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-8">
          {awaitingPayment.length > 0 && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle className="line-clamp-none">
                {awaitingPayment.length} tarikan masih menunggu pembayaran Finance
              </AlertTitle>
              <AlertDescription>
                {awaitingPayment.map((sv) => sv.kode_sub_voucher).join(", ")} -
                belum bisa dideklarasikan sampai dananya benar-benar
                ditransfer/dibayar Finance.
              </AlertDescription>
            </Alert>
          )}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              Sub-Voucher Siap Dideklarasikan
            </h3>
            {isMobile ? (
              <div className="space-y-2">
                {loading ? (
                  <MobileLoading />
                ) : eligible.length === 0 ? (
                  <MobileEmpty>
                    Belum ada Sub-Voucher yang siap dideklarasikan.
                  </MobileEmpty>
                ) : (
                  eligible.map((sv) => (
                    <MobileCard
                      key={sv.id}
                      title={sv.kode_sub_voucher}
                      note={
                        rejectedOf(sv) && (
                          <Link
                            href={`/petty-cash/deklarasi/${rejectedOf(sv)!.id}`}
                            target="_blank"
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Deklarasi {rejectedOf(sv)!.kode_deklarasi} ditolak
                            - lihat alasan
                          </Link>
                        )
                      }
                      actions={
                        <>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => openDeclareForm(sv)}
                          >
                            {rejectedOf(sv) ? "Ajukan Ulang" : "Buat Deklarasi"}
                          </Button>
                          <RowActionsMenu>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/petty-cash/sub-voucher/${sv.id}`}
                                target="_blank"
                                className="cursor-pointer"
                              >
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </Link>
                            </DropdownMenuItem>
                          </RowActionsMenu>
                        </>
                      }
                    >
                      <MobileField label="Dari Voucher">
                        {sv.petty_cash_voucher?.kode_voucher || "-"}
                      </MobileField>
                      <MobileField label="Nominal Dicairkan">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(sv.amount)}
                        </span>
                      </MobileField>
                      <MobileField label="Ditarik">
                        {formatDate(sv.created_at)}
                      </MobileField>
                    </MobileCard>
                  ))
                )}
              </div>
            ) : (
<StickyHeaderTable
              className="min-w-[750px]"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="w-[200px]">
                    Kode Sub-Voucher
                  </TableHead>
                  <TableHead className="w-[180px]">Dari Voucher</TableHead>
                  <TableHead className="w-[150px] text-right">
                    Nominal Dicairkan
                  </TableHead>
                  <TableHead className="w-[140px]">Ditarik</TableHead>
                  <TableHead className="w-[210px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : eligible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada Sub-Voucher yang siap dideklarasikan.
                    </TableCell>
                  </TableRow>
                ) : (
                  eligible.map((sv, index) => (
                    <TableRow key={sv.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-mono text-xs font-semibold">
                          {sv.kode_sub_voucher}
                        </div>
                        {rejectedOf(sv) && (
                          <Link
                            href={`/petty-cash/deklarasi/${rejectedOf(sv)!.id}`}
                            target="_blank"
                            className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
                          >
                            Deklarasi {rejectedOf(sv)!.kode_deklarasi} ditolak
                            - lihat alasan
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sv.petty_cash_voucher?.kode_voucher || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm tabular-nums">
                        {formatCurrency(sv.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(sv.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" onClick={() => openDeclareForm(sv)}>
                            {rejectedOf(sv) ? "Ajukan Ulang" : "Buat Deklarasi"}
                          </Button>
                          <RowActionsMenu>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/petty-cash/sub-voucher/${sv.id}`}
                                target="_blank"
                                className="cursor-pointer"
                              >
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </Link>
                            </DropdownMenuItem>
                          </RowActionsMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </StickyHeaderTable>
)}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Deklarasi Saya
            </h3>
            {isMobile ? (
              <div className="space-y-2">
                {loading ? (
                  <MobileLoading />
                ) : deklarasiList.length === 0 ? (
                  <MobileEmpty>Belum ada Deklarasi yang dibuat.</MobileEmpty>
                ) : (
                  visibleDeklarasi.map((d) => (
                    <MobileCard
                      key={d.id}
                      title={d.kode_deklarasi}
                      badge={<StatusBadge status={d.status} />}
                      actions={
                        <div className="ml-auto">
                          <RowActionsMenu>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/petty-cash/deklarasi/${d.id}`}
                                target="_blank"
                                className="cursor-pointer"
                              >
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </Link>
                            </DropdownMenuItem>
                            <PcDownloadMenuItems href={`/petty-cash/deklarasi/${d.id}`} />
                          </RowActionsMenu>
                        </div>
                      }
                    >
                      <MobileField label="Dari Voucher">
                        {d.petty_cash_voucher?.kode_voucher || "-"}
                      </MobileField>
                      <MobileField label="Nominal Riil">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(d.total_amount)}
                        </span>
                      </MobileField>
                    </MobileCard>
                  ))
                )}
              </div>
            ) : (
<StickyHeaderTable
              className="min-w-[800px]"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="w-[180px]">Kode Deklarasi</TableHead>
                  <TableHead className="w-[180px]">Dari Voucher</TableHead>
                  <TableHead className="w-[150px] text-right">
                    Nominal Riil
                  </TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[70px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : deklarasiList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada Deklarasi yang dibuat.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleDeklarasi.map((d, index) => (
                    <TableRow key={d.id}>
                      <TableCell>{offset + index + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {d.kode_deklarasi}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.petty_cash_voucher?.kode_voucher || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm tabular-nums">
                        {formatCurrency(d.total_amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/petty-cash/deklarasi/${d.id}`}
                              target="_blank"
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                            </Link>
                          </DropdownMenuItem>
                          <PcDownloadMenuItems href={`/petty-cash/deklarasi/${d.id}`} />
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </StickyHeaderTable>
)}
            <TablePaginationFooter
              currentPage={currentPage}
              totalItems={deklarasiList.length}
              limit={limit}
              limitOptions={LIMIT_OPTIONS}
              itemLabel="deklarasi"
              onPageChange={(value) => setParams({ page: value })}
              onLimitChange={(value) => setFilters({ limit: value })}
              className="mt-6"
            />
          </div>

          {returnable.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-primary" />
                Sisa Dana Bisa Dikembalikan
              </h3>
              {isMobile ? (
                <div className="space-y-2">
                  {returnable.map((r) => (
                    <MobileCard
                      key={r.subVoucher.id}
                      title={r.subVoucher.kode_sub_voucher}
                      actions={
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedReturn(r)}
                        >
                          Kembalikan Sisa
                        </Button>
                      }
                    >
                      <MobileField label="Nominal Tarikan">
                        <span className="tabular-nums">
                          {formatCurrency(r.subVoucher.amount)}
                        </span>
                      </MobileField>
                      <MobileField label="Deklarasi Disetujui">
                        <span className="tabular-nums">
                          {formatCurrency(r.declared)}
                        </span>
                      </MobileField>
                      <MobileField label="Sisa Dana">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(r.sisa)}
                        </span>
                      </MobileField>
                    </MobileCard>
                  ))}
                </div>
              ) : (
<StickyHeaderTable
                className="min-w-[800px]"
                containerClassName="rounded-md border overflow-x-auto"
                header={
                  <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="w-[200px]">
                      Kode Sub-Voucher
                    </TableHead>
                    <TableHead className="w-[150px] text-right">
                      Nominal Tarikan
                    </TableHead>
                    <TableHead className="w-[150px] text-right">
                      Deklarasi Disetujui
                    </TableHead>
                    <TableHead className="w-[150px] text-right">
                      Sisa Dana
                    </TableHead>
                    <TableHead className="w-[210px] text-right">Aksi</TableHead>
                  </TableRow>
                }
              >
                <TableBody>
                  {returnable.map((r, index) => (
                    <TableRow key={r.subVoucher.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {r.subVoucher.kode_sub_voucher}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(r.subVoucher.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(r.declared)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm tabular-nums">
                        {formatCurrency(r.sisa)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReturn(r)}
                        >
                          Kembalikan Sisa
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </StickyHeaderTable>
)}
            </div>
          )}

          {pengembalianList.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-primary" />
                Pengembalian Saya
              </h3>
              {isMobile ? (
                <div className="space-y-2">
                  {pengembalianList.map((pg) => (
                    <MobileCard
                      key={pg.id}
                      title={pg.kode_pengembalian}
                      badge={
                        <StatusBadge
                          status={pg.status}
                          colors={PC_PENGEMBALIAN_STATUS_COLORS}
                          fallback={PC_PENGEMBALIAN_STATUS_COLOR_DEFAULT}
                        />
                      }
                      note={
                        pg.status === "Ditolak" &&
                        pg.reject_reason && (
                          <p className="text-xs text-muted-foreground">
                            Alasan: {pg.reject_reason}
                          </p>
                        )
                      }
                    >
                      <MobileField label="Diajukan">
                        {formatDate(pg.created_at)}
                      </MobileField>
                      <MobileField label="Nominal">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(pg.amount)}
                        </span>
                      </MobileField>
                    </MobileCard>
                  ))}
                </div>
              ) : (
<StickyHeaderTable
                className="min-w-[800px]"
                containerClassName="rounded-md border overflow-x-auto"
                header={
                  <TableRow>
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="w-[220px]">
                      Kode Pengembalian
                    </TableHead>
                    <TableHead className="w-[140px]">Diajukan</TableHead>
                    <TableHead className="w-[150px] text-right">
                      Nominal
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                }
              >
                <TableBody>
                  {pengembalianList.map((pg, index) => (
                    <TableRow key={pg.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {pg.kode_pengembalian}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(pg.created_at)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm tabular-nums">
                        {formatCurrency(pg.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge
                            status={pg.status}
                            colors={PC_PENGEMBALIAN_STATUS_COLORS}
                            fallback={PC_PENGEMBALIAN_STATUS_COLOR_DEFAULT}
                          />
                          {pg.status === "Ditolak" && pg.reject_reason && (
                            <span className="text-[11px] text-muted-foreground">
                              Alasan: {pg.reject_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </StickyHeaderTable>
)}
            </div>
          )}
        </div>
      </Content>

      {/* DIALOG FORM DEKLARASI - QTY/HARGA/CATATAN BOLEH DISESUAIKAN */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && closeDeclareForm()}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Deklarasi dari {selected?.kode_sub_voucher}
            </DialogTitle>
            <DialogDescription>
              Sesuaikan qty/harga satuan tiap barang ke pemakaian riil
              (berdasarkan struk asli).{" "}
              {selected && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Ditarik {formatDate(selected.created_at)} - Nominal
                  Tarikan {formatCurrency(selected.amount)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {isMobile ? (
                <div className="space-y-3">
                  {rows.map((r, i) => (
                    <div key={i} className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium [overflow-wrap:anywhere]">
                            {r.part_name}
                          </p>
                          {r.category && (
                            <p className="text-xs text-muted-foreground">
                              {r.category}
                            </p>
                          )}
                        </div>
                        <PcCoaBadge coa={r.coa} />
                      </div>
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`deklarasi-qty-${i}`}>Qty</Label>
                          <Input
                            id={`deklarasi-qty-${i}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={r.qty}
                            onChange={(e) =>
                              updateRow(i, { qty: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Harga Satuan</Label>
                          <CurrencyInput
                            value={r.unit_price}
                            onValueChange={(val) =>
                              updateRow(i, { unit_price: val })
                            }
                          />
                        </div>
                      </div>
                      <Input
                        aria-label="Catatan barang"
                        value={r.note}
                        onChange={(e) => updateRow(i, { note: e.target.value })}
                        placeholder="Catatan (opsional)"
                      />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(
                            (Number(r.qty) || 0) * (r.unit_price || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
<div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[850px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">
                        Nama Barang
                      </TableHead>
                      <TableHead className="w-[80px]">Company</TableHead>
                      <TableHead className="min-w-[120px]">COA</TableHead>
                      <TableHead className="w-[90px]">Qty</TableHead>
                      <TableHead className="w-[150px]">
                        Harga Satuan
                      </TableHead>
                      <TableHead className="w-[120px] text-right">
                        Subtotal
                      </TableHead>
                      <TableHead className="min-w-[160px]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {r.part_name}
                        </TableCell>
                        <TableCell>
                          <PcCoaBadge coa={r.coa} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.category || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={r.qty}
                            onChange={(e) =>
                              updateRow(i, { qty: e.target.value })
                            }
                            className="h-9 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={r.unit_price}
                            onValueChange={(val) =>
                              updateRow(i, { unit_price: val })
                            }
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(
                            (Number(r.qty) || 0) * (r.unit_price || 0),
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.note}
                            onChange={(e) =>
                              updateRow(i, { note: e.target.value })
                            }
                            placeholder="-"
                            className="h-9"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Nominal Tarikan (maksimal):{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(selected.amount)}
                  </span>
                </div>
                <div className="w-full text-right sm:w-auto">
                  <p className="text-xs text-muted-foreground">
                    Total Deklarasi (riil)
                  </p>
                  <p
                    className={`text-xl font-bold ${overLimit ? "text-destructive" : "text-primary"}`}
                  >
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>

              {overLimit ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Melebihi nominal tarikan</AlertTitle>
                  <AlertDescription>
                    Total Deklarasi tidak boleh lebih dari{" "}
                    {formatCurrency(selected.amount)}. Kelebihan pemakaian
                    diajukan lewat tarikan baru.
                  </AlertDescription>
                </Alert>
              ) : (
                totalAmount < selected.amount && (
                  <p className="text-xs text-muted-foreground">
                    Sisa {formatCurrency(selected.amount - totalAmount)} bisa
                    dikembalikan ke Finance setelah Deklarasi ini disetujui.
                  </p>
                )
              )}

              <div className="space-y-2">
                <Label>
                  Catatan{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Opsional)
                  </span>
                </Label>
                <RichMentionEditor
                  ref={notesEditorRef}
                  placeholder="Konteks/keterangan tambahan, misal alasan selisih nominal..."
                  onChange={() =>
                    setNotes(
                      notesEditorRef.current?.isEmpty()
                        ? ""
                        : stringifyRichContent(
                            notesEditorRef.current?.getJSON() ?? {
                              type: "doc",
                            },
                          ),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Bukti Struk/Nota Asli{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Opsional)
                  </span>
                </Label>
                <FileDropzone
                  id="deklarasi-file-upload"
                  onFiles={handleFileUpload}
                  loading={uploading}
                  title="Upload Bukti Struk/Nota"
                  hint="Seret & lepas atau klik untuk memilih. JPG, PNG, PDF, maks 5MB."
                />

                {attachments.length > 0 && (
                  <div className="grid gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background border rounded-md shadow-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate max-w-[85%]"
                        >
                          {file.name}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sticky di mobile: tombol kirim tetap terlihat di form yang panjang. */}
          <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 border-t bg-background px-6 py-3 sm:static sm:m-0 sm:border-0 sm:p-0">
            <Button
              variant="ghost"
              onClick={closeDeclareForm}
              disabled={creating}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={creating || uploading || overLimit}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Deklarasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG PENGEMBALIAN SISA DANA */}
      <Dialog
        open={!!selectedReturn}
        onOpenChange={(open) => !open && setSelectedReturn(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Kembalikan Sisa {selectedReturn?.subVoucher.kode_sub_voucher}
            </DialogTitle>
            <DialogDescription>
              Setor/transfer sisa dana ke Finance, lalu unggah buktinya. Budget
              bertambah lagi setelah Finance mengkonfirmasi.
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <PcPengembalianForm
              key={selectedReturn.subVoucher.id}
              subVoucherId={selectedReturn.subVoucher.id}
              sisa={selectedReturn.sisa}
              processing={returning}
              onSubmit={handleSubmitPengembalian}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
