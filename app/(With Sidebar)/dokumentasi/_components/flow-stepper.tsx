"use client";

// Stepper interaktif untuk satu alur (MR/PO/Petty Cash). Dua mode:
// - "visual": indikator langkah + mock UI beranimasi + panduan singkat.
// - "teks"  : semua langkah sekaligus sebagai daftar teks (enak untuk
//             Ctrl+F / dibaca berurutan / dicetak).
// Langkah yang dikerjakan peran pilihan user (activeRole) diberi tanda.
// Indeks langkah dikontrol dari luar supaya tombol "Tugas Anda" & diagram
// gambaran besar bisa melompat ke langkah tertentu.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Lightbulb,
  ListOrdered,
  MousePointerClick,
  Pause,
  Play,
} from "lucide-react";
import type { Flow } from "./docs-data";
import { RoleChip, StatusTransition, type RoleId } from "./primitives";
import { StepVisual } from "./step-visuals";

const AUTOPLAY_MS = 7000;

export function FlowStepper({
  flow,
  step,
  onStepChange,
  activeRole,
}: {
  flow: Flow;
  step: number;
  onStepChange: (step: number) => void;
  activeRole: RoleId | null;
}) {
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const [playing, setPlaying] = useState(false);
  const total = flow.steps.length;
  const current = flow.steps[step];

  useEffect(() => {
    if (!playing || mode !== "visual") return;
    const t = setTimeout(() => onStepChange((step + 1) % total), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, mode, step, total, onStepChange]);

  const go = (i: number) => {
    setPlaying(false);
    onStepChange(Math.max(0, Math.min(total - 1, i)));
  };

  const isMine = (actors: RoleId[]) =>
    !!activeRole && actors.includes(activeRole);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {flow.title}
          </h2>
          <p className="text-sm text-muted-foreground">{flow.subtitle}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "visual"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Visual
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("text");
              setPlaying(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "text"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListOrdered className="h-3.5 w-3.5" /> Panduan teks
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <>
          {/* Indikator langkah */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1 pt-2">
            <ol className="flex min-w-max items-start">
              {flow.steps.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                const mine = isMine(s.actors);
                return (
                  <li key={s.title} className="flex items-start">
                    <button
                      type="button"
                      onClick={() => go(i)}
                      className="group flex w-20 flex-col items-center gap-1.5 text-center sm:w-24"
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                          done && "border-primary bg-primary text-primary-foreground",
                          active &&
                            "docs-ring scale-110 border-primary bg-background text-primary",
                          !done &&
                            !active &&
                            "border-border bg-background text-muted-foreground group-hover:border-primary/50",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {mine && (
                          <span className="absolute -right-1 -top-1 flex h-4 items-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                            Anda
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-tight",
                          active
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {i + 1}. {s.short}
                      </span>
                    </button>
                    {i < total - 1 && (
                      <span className="relative mt-5 h-0.5 w-6 overflow-hidden rounded bg-border sm:w-10">
                        <span
                          className={cn(
                            "absolute inset-0 origin-left bg-primary transition-transform duration-500",
                            i < step ? "scale-x-100" : "scale-x-0",
                          )}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Isi langkah */}
          <div
            key={`${flow.id}-${step}`}
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8"
          >
            <div className="docs-fade-up order-2 lg:order-1">
              <StepVisual id={current.visual} />
            </div>

            <div
              className="docs-fade-up order-1 space-y-4 lg:order-2"
              style={{ animationDelay: "0.05s" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Langkah {step + 1} dari {total}
                </span>
                {current.actors.map((r) => (
                  <RoleChip key={r} role={r} />
                ))}
              </div>
              <h3 className="text-lg font-semibold">{current.title}</h3>
              <p
                className={cn(
                  "rounded-lg border-l-4 bg-muted/40 px-3 py-2 text-sm",
                  isMine(current.actors) ? "border-sky-500" : "border-primary",
                )}
              >
                {current.summary}
              </p>

              {current.menu && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Menu: <span className="font-medium text-foreground">{current.menu}</span>
                </p>
              )}

              <ul className="space-y-2 text-sm text-muted-foreground">
                {current.details.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                      {i + 1}
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>

              {current.status && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Status setelah langkah ini:
                  </p>
                  <StatusTransition {...current.status} />
                </div>
              )}

              {current.tip && (
                <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{current.tip}</span>
                </p>
              )}
            </div>
          </div>

          {/* Navigasi */}
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => go(step - 1)}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlaying((p) => !p)}
              className="text-muted-foreground"
            >
              {playing ? (
                <>
                  <Pause className="h-4 w-4" /> Jeda
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Putar otomatis
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => go(step + 1)}
              disabled={step === total - 1}
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <ol className="relative space-y-6 border-l-2 border-border pl-6">
          {flow.steps.map((s, i) => {
            const Icon = s.icon;
            const mine = isMine(s.actors);
            return (
              <li key={s.title} className="relative">
                <span
                  className={cn(
                    "absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background",
                    mine ? "border-sky-500 text-sky-600" : "border-primary text-primary",
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {i + 1}. {s.title}
                  </h3>
                  {s.actors.map((r) => (
                    <RoleChip key={r} role={r} />
                  ))}
                </div>
                <p className="mt-1 text-sm">{s.summary}</p>
                {s.menu && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Menu: <span className="font-medium text-foreground">{s.menu}</span>
                  </p>
                )}
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {s.details.map((d, j) => (
                    <li key={j}>{d}</li>
                  ))}
                </ul>
                {s.status && (
                  <div className="mt-2">
                    <StatusTransition {...s.status} />
                  </div>
                )}
                {s.tip && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    💡 {s.tip}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
