// Bagian bersama "Lacak MR" dan "Lacak PO": tipe tahapan dan cara menggabungkan
// status tiap barang menjadi satu tahap. Semua fungsi di sini murni. Aturan tiap
// dokumen ada di lib/mrTracking.ts dan lib/poTracking.ts, tampilannya di
// components/tracking-card.tsx.
import { getAdminActionNote } from "@/lib/approvalOverride";
import { Approval, MaterialRequest } from "@/type";

export const EPS = 1e-6;

export const toQty = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export interface TrackingLog {
  action_type: string;
  created_at: string;
  metadata?: {
    instruction?: string;
    reason?: string;
    rejection_reason?: string;
    dp_paid?: boolean;
    bp_paid?: boolean;
  } | null;
  users_with_profiles?: { nama?: string | null } | null;
}

export type TrackState =
  | "done"
  | "active"
  | "partial"
  | "skipped"
  | "deferred" // Tidak menahan barang, tapi masih harus dibereskan (bayar menyusul).
  | "blocked"
  | "failed"
  | "upcoming"
  | "halted"; // Tidak dilanjutkan karena dokumen ditolak/dibatalkan.

export interface TrackEvent {
  at?: string | null;
  label: string;
  note?: string | null;
  itemName?: string;
  tone?: "warning" | "danger";
  // Diproses admin, bukan approver-nya. Bukan `tone`: tone "warning" dibaca
  // sebagai alasan kendala di headline Lacak.
  byAdmin?: boolean;
  // Masih menunggu seseorang - dibuang begitu dokumennya berhenti.
  waiting?: boolean;
}

export interface TrackLink {
  label: string;
  href: string;
}

export interface ItemStep<Id extends string = string> {
  id: Id;
  title: string;
  state: TrackState;
  caption: string;
  owner?: string;
  events: TrackEvent[];
  links: TrackLink[];
}

export interface TrackStep<Id extends string = string> {
  id: Id;
  title: string;
  state: TrackState;
  caption: string;
  summary: string;
  owner?: string;
  at?: string | null;
  events: TrackEvent[];
  links: TrackLink[];
  breakdown: { label: string; count: number; state: TrackState }[];
}

export type TrackTone = "progress" | "attention" | "success" | "failed";

export interface TrackTarget {
  label: string;
  overdue: boolean;
}

export interface StepCopy {
  title: string;
  upcoming: string;
  active: string;
  partial: string;
}

export const SETTLED_STATES: TrackState[] = ["done", "skipped", "deferred"];
export const OPEN_STATES: TrackState[] = ["active", "partial", "blocked"];

export const nextApprover = (approvals: Approval[] | null | undefined) =>
  (approvals || []).find((a) => a.status === "pending");

export const sortEvents = (events: TrackEvent[]) =>
  [...events].sort((a, b) => {
    if (!a.at || !b.at) return a.at ? -1 : b.at ? 1 : 0;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });

export const lastEventAt = (events: TrackEvent[]) =>
  [...events].reverse().find((e) => e.at)?.at;

export const groupBy = (entries: { label: string; state: TrackState }[]) => {
  const groups = new Map<string, TrackStep["breakdown"][number]>();
  for (const { label, state } of entries) {
    const group = groups.get(label);
    if (group) group.count += 1;
    else groups.set(label, { label, state, count: 1 });
  }
  return [...groups.values()];
};

// Judul tahap yang ditolak - menyebut admin kalau admin yang memprosesnya.
export const rejectedCaption = (step: Approval) =>
  getAdminActionNote(step) ?? `Ditolak ${step.nama}`;

export const buildApprovalEvents = (
  approvals: Approval[],
  next: Approval | undefined,
): TrackEvent[] =>
  approvals.map((a) => {
    const role = a.type ? `${a.nama} (${a.type})` : a.nama;
    const adminNote = getAdminActionNote(a, role);
    if (a.status === "approved") {
      return {
        at: a.processed_at,
        label: adminNote ?? `Disetujui ${role}`,
        byAdmin: !!adminNote,
      };
    }
    if (a.status === "rejected") {
      return {
        at: a.processed_at,
        label: adminNote ?? `Ditolak ${role}`,
        note: a.rejection_note,
        tone: "danger",
        byAdmin: !!adminNote,
      };
    }
    return {
      label: a === next ? `Menunggu ${role}` : `Antre: ${role}`,
      waiting: true,
    };
  });

// Gabungan satu tahap dari semua barang yang masih aktif.
export const rollUpSteps = <Id extends string>(
  id: Id,
  copy: StepCopy,
  steps: ItemStep[],
): TrackStep<Id> => {
  const total = steps.length;
  const count = (states: TrackState[]) =>
    steps.filter((s) => states.includes(s.state)).length;
  const settled = count(SETTLED_STATES);
  const unit = total === 1 ? steps[0]?.caption : null;

  let state: TrackState;
  let caption: string;
  if (total === 0) {
    state = "halted";
    caption = "Tidak dilanjutkan";
  } else if (count(["skipped"]) === total) {
    state = "skipped";
    caption = unit || steps[0].caption;
  } else if (count(["deferred"]) === total) {
    state = "deferred";
    caption = "Pembayaran menyusul";
  } else if (count(["blocked"]) > 0) {
    state = "blocked";
    caption = unit || `${count(["blocked"])} barang terkendala`;
  } else if (settled === total) {
    state = "done";
    caption = unit || `${total} barang selesai`;
  } else if (settled > 0 || count(["partial"]) > 0) {
    state = "partial";
    caption = unit || (settled > 0 ? `${settled} / ${total} barang` : "Sebagian");
  } else if (count(["active"]) > 0) {
    state = "active";
    caption = unit || `${total} barang`;
  } else {
    state = "upcoming";
    caption = "Belum sampai sini";
  }

  const seen = new Set<string>();
  const events = sortEvents(
    steps
      .flatMap((s) => s.events)
      .filter((e) => {
        const key = `${e.at}|${e.label}|${e.itemName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
  const links = [
    ...new Map(steps.flatMap((s) => s.links).map((l) => [l.href, l])).values(),
  ];
  const owners = [...new Set(steps.map((s) => s.owner).filter(Boolean))];

  return {
    id,
    title: copy.title,
    state,
    caption,
    summary:
      state === "upcoming" || state === "halted"
        ? copy.upcoming
        : state === "active" || state === "partial"
          ? copy[state]
          : steps.find((s) => s.state === state)?.caption || steps[0].caption,
    owner: owners.slice(0, 3).join(", ") || undefined,
    at: lastEventAt(events),
    events,
    links,
    breakdown:
      total > 1
        ? groupBy(steps.map((s) => ({ label: s.caption, state: s.state })))
        : [],
  };
};

export const pendingStep = <Id extends string>(
  id: Id,
  copy: StepCopy,
): TrackStep<Id> => ({
  id,
  title: copy.title,
  state: "upcoming",
  caption: "Belum sampai sini",
  summary: copy.upcoming,
  events: [],
  links: [],
  breakdown: [],
});

// Hentikan alur di tahap pertama yang belum selesai.
const dropWaiting = (events: TrackEvent[]) => events.filter((e) => !e.waiting);

export const markStopped = <Id extends string>(
  steps: TrackStep<Id>[],
  docLabel: string,
  caption: string,
  events: TrackEvent[],
) => {
  const firstOpen = steps.findIndex((s) => !SETTLED_STATES.includes(s.state));
  const stopIndex = firstOpen === -1 ? steps.length - 1 : firstOpen;
  return steps.map((step, index): TrackStep<Id> => {
    if (index < stopIndex) return step;
    if (index === stopIndex) {
      return {
        ...step,
        state: "failed",
        caption,
        summary: `${docLabel} ${caption.toLowerCase()} di tahap ini.`,
        owner: undefined,
        events: [...dropWaiting(step.events), ...events],
      };
    }
    return {
      ...step,
      state: "halted",
      caption: "Tidak dilanjutkan",
      owner: undefined,
      events: dropWaiting(step.events),
    };
  });
};

export const haltAfterFailure = <Id extends string>(steps: TrackStep<Id>[]) => {
  const failedIndex = steps.findIndex((s) => s.state === "failed");
  if (failedIndex === -1) return steps;
  return steps.map((step, index): TrackStep<Id> => {
    if (index < failedIndex) return step;
    const events = dropWaiting(step.events);
    return index === failedIndex
      ? { ...step, events }
      : { ...step, state: "halted", caption: "Tidak dilanjutkan", owner: undefined, events };
  });
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dayDiff = (later: Date, earlier: Date) =>
  Math.round((startOfDay(later) - startOfDay(earlier)) / 86400000);

export const buildTarget = (
  mr: Pick<MaterialRequest, "due_date" | "full_received_at">,
  isFinished: boolean,
  now: Date,
): TrackTarget | null => {
  if (!mr.due_date) return null;
  const due = new Date(mr.due_date);
  if (Number.isNaN(due.getTime())) return null;

  if (isFinished) {
    if (!mr.full_received_at) return null;
    const late = dayDiff(new Date(mr.full_received_at), due);
    return late > 0
      ? { label: `Selesai lewat ${late} hari`, overdue: true }
      : { label: "Selesai tepat waktu", overdue: false };
  }
  const left = dayDiff(due, now);
  if (left < 0) return { label: `Lewat ${-left} hari`, overdue: true };
  if (left === 0) return { label: "Hari ini", overdue: false };
  return { label: `${left} hari lagi`, overdue: false };
};
