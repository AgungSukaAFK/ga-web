"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  Hourglass,
  Info,
  Minus,
  PackageCheck,
  Route,
  SkipForward,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateWithTime, cn } from "@/lib/utils";
import {
  ItemStep,
  SETTLED_STATES,
  TrackEvent,
  TrackState,
  TrackStep,
  TrackTone,
} from "@/lib/tracking";

export interface TrackingCardItem {
  key: string | number;
  name: string;
  meta: string;
  notes: string[];
  closed: boolean;
  position: string;
  positionState: TrackState;
  steps: ItemStep[];
}

export interface TrackingFact {
  icon: typeof Check;
  label: string;
  value: string;
  emphasis?: boolean;
}

const VISIBLE_ITEMS = 5;
const VISIBLE_EVENTS = 6;

const STATE_STYLES: Record<
  TrackState,
  { label: string; hint: string; node: string; bar: string; text: string; icon: typeof Check }
> = {
  done: {
    label: "Selesai",
    hint: "Tahap ini sudah beres.",
    node: "border-emerald-600 bg-emerald-600 text-white",
    bar: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: Check,
  },
  active: {
    label: "Sedang berjalan",
    hint: "Dokumen sedang berada di tahap ini.",
    node: "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
    bar: "bg-primary",
    text: "text-primary",
    icon: Clock,
  },
  partial: {
    label: "Sebagian",
    hint: "Sebagian barang atau qty sudah lewat tahap ini.",
    node: "border-amber-500 bg-amber-500 text-white ring-4 ring-amber-500/20",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    icon: CircleDot,
  },
  skipped: {
    label: "Dilewati",
    hint: "Tahap ini tidak diperlukan untuk barang tersebut.",
    node: "border-dashed border-muted-foreground/50 bg-background text-muted-foreground",
    bar: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    icon: SkipForward,
  },
  deferred: {
    label: "Menyusul",
    hint: "Tidak menahan barang, tapi masih perlu dibereskan.",
    node: "border-sky-600 bg-background text-sky-700 dark:text-sky-400",
    bar: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-400",
    icon: Hourglass,
  },
  blocked: {
    label: "Perlu tindakan",
    hint: "Tahap ini tertahan sampai kendalanya dibereskan.",
    node: "border-orange-600 bg-orange-600 text-white ring-4 ring-orange-600/20",
    bar: "bg-orange-600",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
  },
  failed: {
    label: "Berhenti",
    hint: "Dokumen ditolak atau dibatalkan di tahap ini.",
    node: "border-red-600 bg-red-600 text-white",
    bar: "bg-red-600",
    text: "text-red-700 dark:text-red-400",
    icon: X,
  },
  upcoming: {
    label: "Belum dimulai",
    hint: "Dokumen belum sampai ke tahap ini.",
    node: "border-border bg-background text-muted-foreground",
    bar: "bg-muted",
    text: "text-muted-foreground",
    icon: Clock,
  },
  halted: {
    label: "Tidak dilanjutkan",
    hint: "Tahap ini tidak akan dijalankan.",
    node: "border-border bg-muted text-muted-foreground",
    bar: "bg-muted",
    text: "text-muted-foreground",
    icon: Minus,
  },
};

const TONE_STYLES: Record<TrackTone, { icon: typeof Check; box: string }> = {
  progress: { icon: Route, box: "bg-primary/10 text-primary" },
  attention: {
    icon: AlertTriangle,
    box: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400",
  },
  success: {
    icon: PackageCheck,
    box: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  failed: {
    icon: X,
    box: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  },
};

const LEGEND_STATES: TrackState[] = [
  "done",
  "active",
  "partial",
  "skipped",
  "deferred",
  "blocked",
  "failed",
];

const formatShortDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

const readCollapsed = (key: string) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const saveCollapsed = (key: string, collapsed: boolean) => {
  try {
    window.localStorage.setItem(key, collapsed ? "1" : "0");
  } catch {
    // Pilihan ini cuma kenyamanan - tetap berfungsi tanpa penyimpanan.
  }
};

const StateIcon = ({
  state,
  number,
  className,
}: {
  state: TrackState;
  number?: number;
  className?: string;
}) => {
  const Icon = STATE_STYLES[state].icon;
  if (state === "upcoming" && number) {
    return <span className="text-xs font-semibold">{number}</span>;
  }
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
};

const StateNode = ({
  state,
  number,
  size = "md",
}: {
  state: TrackState;
  number?: number;
  size?: "sm" | "md";
}) => (
  <span
    className={cn(
      "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2",
      size === "md" ? "h-8 w-8" : "h-6 w-6",
      STATE_STYLES[state].node,
    )}
  >
    <StateIcon
      state={state}
      number={number}
      className={size === "sm" ? "h-3 w-3" : undefined}
    />
  </span>
);

const EventList = ({ events }: { events: TrackEvent[] }) => {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return null;
  const visible = showAll ? events : events.slice(-VISIBLE_EVENTS);
  const hidden = events.length - visible.length;

  return (
    <div>
      {hidden > 0 && (
        <button
          type="button"
          className="mb-2 text-xs font-medium text-primary hover:underline"
          onClick={() => setShowAll(true)}
        >
          Lihat {hidden} catatan sebelumnya
        </button>
      )}
      <ul className="space-y-2">
        {visible.map((event, index) => (
          <li key={index} className="flex gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                event.tone === "danger"
                  ? "bg-red-600"
                  : event.tone === "warning"
                    ? "bg-orange-500"
                    : "bg-muted-foreground/40",
              )}
            />
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <p>
                {event.label}
                {event.itemName && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {event.itemName}
                  </span>
                )}
              </p>
              {event.note && (
                <p className="text-xs text-muted-foreground">{event.note}</p>
              )}
              {event.at && (
                <p className="text-xs text-muted-foreground">
                  {formatDateWithTime(event.at)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const DocLinks = ({ links }: { links: TrackStep["links"] }) =>
  links.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border px-2 py-1 font-mono text-xs hover:bg-muted [overflow-wrap:anywhere]"
        >
          {link.label}
        </Link>
      ))}
    </div>
  ) : null;

const StepDetail = ({ step }: { step: TrackStep }) => {
  const style = STATE_STYLES[step.state];
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{step.title}</h3>
        <span className={cn("text-xs font-medium", style.text)}>
          {style.label}
        </span>
      </div>
      {step.summary && (
        <p className="text-sm text-muted-foreground">{step.summary}</p>
      )}
      {step.owner && (
        <p className="text-sm">
          <span className="text-muted-foreground">Ditangani: </span>
          <span className="font-medium">{step.owner}</span>
        </p>
      )}
      {step.breakdown.length > 0 && (
        <ul className="space-y-1">
          {step.breakdown.map((group) => (
            <li key={group.label} className="flex items-center gap-2 text-sm">
              <StateIcon
                state={group.state}
                className={cn("h-3.5 w-3.5", STATE_STYLES[group.state].text)}
              />
              <span>
                {group.count} barang: {group.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      <EventList events={step.events} />
      <DocLinks links={step.links} />
    </div>
  );
};

const Stepper = ({
  steps,
  currentStepId,
}: {
  steps: TrackStep[];
  currentStepId: string;
}) => {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedId = pickedId ?? currentStepId;
  const selected = steps.find((step) => step.id === selectedId) || steps[0];

  return (
    <div className="@container">
      <ol className="flex flex-col @3xl:flex-row">
        {steps.map((step, index) => {
          const isSelected = step.id === selected.id;
          const isSettled = SETTLED_STATES.includes(step.state);
          return (
            <li key={step.id} className="relative min-w-0 flex-1">
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-0 left-[1.4375rem] top-10 w-0.5",
                    "@3xl:bottom-auto @3xl:left-[calc(50%+1.25rem)] @3xl:right-[calc(-50%+1.25rem)] @3xl:top-[1.4375rem] @3xl:h-0.5 @3xl:w-auto",
                    isSettled ? "bg-emerald-600" : "bg-border",
                  )}
                />
              )}
              <button
                type="button"
                aria-pressed={isSelected}
                aria-current={step.id === currentStepId ? "step" : undefined}
                onClick={() => setPickedId(step.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "@3xl:flex-col @3xl:items-center @3xl:gap-2 @3xl:text-center",
                  isSelected && "bg-muted/60",
                )}
              >
                <StateNode state={step.state} number={index + 1} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight @3xl:text-xs">
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs leading-tight [overflow-wrap:anywhere]",
                      STATE_STYLES[step.state].text,
                    )}
                  >
                    {step.caption}
                  </span>
                  {step.at && SETTLED_STATES.includes(step.state) && (
                    <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">
                      {formatShortDate(step.at)}
                    </span>
                  )}
                </span>
              </button>
              {isSelected && (
                <div className="pb-2 pl-11 pt-1 @3xl:hidden">
                  <StepDetail step={step} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 hidden @3xl:block">
        <StepDetail step={selected} />
      </div>
    </div>
  );
};

const ItemStepRow = ({ step }: { step: ItemStep }) => (
  <li className="flex gap-3">
    <StateNode state={step.state} size="sm" />
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-sm font-medium leading-6">
        {step.title}
        <span
          className={cn("ml-2 text-xs font-normal", STATE_STYLES[step.state].text)}
        >
          {step.caption}
        </span>
      </p>
      {step.owner && (
        <p className="text-xs text-muted-foreground">Ditangani: {step.owner}</p>
      )}
      <EventList events={step.events} />
      <DocLinks links={step.links} />
    </div>
  </li>
);

const ItemRow = ({ item }: { item: TrackingCardItem }) => {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @2xl:grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_auto]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium [overflow-wrap:anywhere]">
            {item.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {item.meta}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform @2xl:order-last",
            open && "rotate-180",
          )}
        />
        <span
          aria-hidden
          className="col-span-2 flex gap-1 @2xl:col-span-1"
        >
          {item.steps.map((step) => (
            <span
              key={step.id}
              title={`${step.title}: ${step.caption}`}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                STATE_STYLES[step.state].bar,
              )}
            />
          ))}
        </span>
        <span
          className={cn(
            "col-span-2 text-xs font-medium [overflow-wrap:anywhere] @2xl:col-span-1",
            STATE_STYLES[item.positionState].text,
          )}
        >
          {item.position}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t bg-muted/20 p-3">
          {item.notes.map((note) => (
            <p
              key={note}
              className="text-sm text-muted-foreground [overflow-wrap:anywhere]"
            >
              {note}
            </p>
          ))}
          {!item.closed && (
            <ol className="space-y-3">
              {item.steps.map((step) => (
                <ItemStepRow key={step.id} step={step} />
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
};

const ItemList = ({ items }: { items: TrackingCardItem[] }) => {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;
  const visible = showAll ? items : items.slice(0, VISIBLE_ITEMS);

  return (
    <section className="@container space-y-2">
      <h3 className="text-sm font-semibold">Posisi tiap barang</h3>
      <ul className="divide-y overflow-hidden rounded-lg border">
        {visible.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </ul>
      {items.length > VISIBLE_ITEMS && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua ${items.length} barang`}
        </Button>
      )}
    </section>
  );
};

const Legend = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className="shrink-0">
        <Info className="mr-1 h-4 w-4" /> Keterangan
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      <ul className="space-y-2">
        {LEGEND_STATES.map((state) => (
          <li key={state} className="flex gap-2">
            <StateNode state={state} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{STATE_STYLES[state].label}</p>
              <p className="text-xs text-muted-foreground">
                {STATE_STYLES[state].hint}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </PopoverContent>
  </Popover>
);

const Fact = ({ icon: Icon, label, value, emphasis }: TrackingFact) => (
  <div className="flex min-w-0 items-center gap-2 text-sm">
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    <span className="text-muted-foreground">{label}</span>
    <span
      className={cn(
        "min-w-0 font-medium [overflow-wrap:anywhere]",
        emphasis && "text-red-700 dark:text-red-400",
      )}
    >
      {value}
    </span>
  </div>
);

export const TrackingCard = ({
  title,
  storageKey,
  className,
  tone: toneName,
  headline,
  detail,
  facts,
  steps,
  currentStepId,
  items,
}: {
  title: string;
  storageKey: string;
  className?: string;
  tone: TrackTone;
  headline: string;
  detail: string | null;
  facts: TrackingFact[];
  steps: TrackStep[];
  currentStepId: string;
  items: TrackingCardItem[];
}) => {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
  const tone = TONE_STYLES[toneName];
  const ToneIcon = tone.icon;

  const toggle = () => {
    setCollapsed(!collapsed);
    saveCollapsed(storageKey, !collapsed);
  };

  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              tone.box,
            )}
          >
            <ToneIcon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted-foreground">
              {title}
            </span>
            <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">
              {headline}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              {collapsed ? "Tampilkan" : "Sembunyikan"}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "h-4 w-4 transition-transform",
                !collapsed && "rotate-180",
              )}
            />
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-4 border-t p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              {detail && (
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {detail}
                </p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {facts.map((fact) => (
                  <Fact key={fact.label} {...fact} />
                ))}
              </div>
            </div>
            <Legend />
          </div>

          <Stepper steps={steps} currentStepId={currentStepId} />
          <ItemList items={items} />
        </div>
      )}
    </Card>
  );
};
