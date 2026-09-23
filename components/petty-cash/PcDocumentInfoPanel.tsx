// src/components/petty-cash/PcDocumentInfoPanel.tsx
//
// Panel info LENGKAP sebuah dokumen Petty Cash (Pengajuan/Voucher/Deklarasi)
// - requester, departemen, company, site, cost center, tanggal/minggu
// dibutuhkan, item + COA, jalur approval, lampiran, diskusi/riwayat
// penolakan, dan riwayat revisi. Dipakai di dialog detail "Pengajuan Saya",
// dialog approval (semua tahap), halaman Management, dan halaman detail
// cetak `[id]` - satu tempat, bukan markup yang di-duplikasi di tiap file.

import { Badge } from "@/components/ui/badge";
import { PcItemsEditor } from "./PcItemsEditor";
import { PcCoaBreakdown } from "./PcCoaBreakdown";
import { PcRevisionHistory } from "./PcRevisionHistory";
import {
  Attachment,
  PcDocumentRevision,
  PettyCashPengajuanApprover,
  PettyCashPengajuanItem,
} from "@/type";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const InfoField = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </p>
    <p className="text-sm font-medium">{value ?? "-"}</p>
  </div>
);

interface PcDocumentInfoPanelProps {
  requesterName?: string | null;
  requesterEmail?: string | null;
  department: string;
  companyCode: string;
  site?: string | null;
  costCenterName?: string | null;
  budgetName?: string | null;
  budgetRemaining?: number | null;
  neededDate?: string | Date | null;
  weekOfMonth?: number | null;
  showNeededDate?: boolean;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  totalAmount: number;
  attachments: Attachment[];
  approvals: PettyCashPengajuanApprover[];
  discussions?: any[];
  revisions?: PcDocumentRevision[];
}

export function PcDocumentInfoPanel({
  requesterName,
  requesterEmail,
  department,
  companyCode,
  site,
  costCenterName,
  budgetName,
  budgetRemaining,
  neededDate,
  weekOfMonth,
  showNeededDate = true,
  notes,
  items,
  totalAmount,
  attachments,
  approvals,
  discussions,
  revisions,
}: PcDocumentInfoPanelProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-md border p-4 bg-muted/20">
        <InfoField
          icon={User}
          label="Pemohon"
          value={
            requesterEmail ? (
              <span title={requesterEmail}>{requesterName || "-"}</span>
            ) : (
              requesterName
            )
          }
        />
        <InfoField icon={Building2} label="Departemen" value={department} />
        <InfoField icon={Wallet} label="Company" value={companyCode} />
        <InfoField icon={MapPin} label="Site" value={site} />
        {costCenterName && (
          <InfoField
            icon={Wallet}
            label="Cost Center"
            value={costCenterName}
          />
        )}
        {budgetName && (
          <InfoField
            icon={Wallet}
            label="Budget"
            value={
              budgetRemaining != null
                ? `${budgetName} (Sisa ${formatCurrency(budgetRemaining)})`
                : budgetName
            }
          />
        )}
        {showNeededDate && neededDate && (
          <InfoField
            icon={CalendarDays}
            label="Tanggal Dibutuhkan"
            value={formatDate(neededDate)}
          />
        )}
        {showNeededDate && weekOfMonth != null && (
          <InfoField
            icon={CalendarDays}
            label="Minggu ke-"
            value={`Minggu ke-${weekOfMonth}`}
          />
        )}
      </div>

      {notes && (
        <div className="text-sm bg-muted/50 rounded-md p-3 border">
          {notes}
        </div>
      )}

      <PcItemsEditor readOnly initialItems={items} />

      <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
        <PcCoaBreakdown items={items} />
        <div className="text-right sm:ml-auto">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-primary">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Jalur Approval
        </p>
        <div className="space-y-1">
          {approvals.map((app, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm border rounded-md px-3 py-1.5"
            >
              <span>
                {i + 1}. {app.nama}{" "}
                <span className="text-xs text-muted-foreground">
                  ({app.department})
                </span>
              </span>
              <div className="flex items-center gap-2">
                {app.processed_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(app.processed_at)}
                  </span>
                )}
                {app.status === "approved" ? (
                  <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                  </Badge>
                ) : app.status === "rejected" ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" /> Rejected
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" /> Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {attachments?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Lampiran
          </p>
          <div className="grid gap-2">
            {attachments.map((file, i) => (
              <a
                key={i}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline p-2 border rounded-md bg-background truncate block"
              >
                {file.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {discussions && discussions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Catatan / Riwayat
          </p>
          <div className="space-y-2">
            {discussions.map((d: any, i: number) => (
              <div key={i} className="text-sm bg-muted/50 rounded-md p-3 border">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-xs">{d.user_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(d.timestamp).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{d.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <PcRevisionHistory
        revisions={revisions}
        showNeededDate={showNeededDate}
        current={{
          needed_date: neededDate ?? undefined,
          week_of_month: weekOfMonth,
          notes,
          items,
          attachments,
        }}
      />
    </div>
  );
}
