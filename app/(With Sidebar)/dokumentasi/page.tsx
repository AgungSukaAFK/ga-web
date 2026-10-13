// src/app/(With Sidebar)/dokumentasi/page.tsx
//
// Halaman Dokumentasi & Panduan Pengguna. Isi (teks, langkah, status, FAQ)
// ada di _components/docs-data.tsx - file ini cuma menyusun section &
// menyimpan state bersama: peran yang dipilih user (di-highlight di semua
// section) dan langkah aktif tiap stepper (supaya "Tugas Anda" & diagram
// gambaran besar bisa melompat ke langkah tertentu).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FLOWS, type FlowId } from "./_components/docs-data";
import { FlowStepper } from "./_components/flow-stepper";
import type { RoleId } from "./_components/primitives";
import {
  FaqSection,
  HeroSection,
  JourneySection,
  PaymentSection,
  PrioritySection,
  Section,
  StatusSection,
  TocDesktop,
  TocMobile,
  useActiveSection,
  VendorSection,
} from "./_components/sections";

const ROLE_STORAGE_KEY = "docs-role";

export default function DokumentasiPage() {
  const [role, setRole] = useState<RoleId | null>(null);
  const [steps, setSteps] = useState<Record<FlowId, number>>({
    mr: 0,
    po: 0,
    pc: 0,
  });
  const activeSection = useActiveSection();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY) as RoleId | null;
      if (saved) setRole(saved);
    } catch {}
    // Konten dirender di klien, jadi lompatan ke #hash bawaan browser bisa
    // meleset - ulangi manual setelah mount.
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ block: "start" }),
      );
    }
  }, []);

  const changeRole = (r: RoleId | null) => {
    setRole(r);
    try {
      if (r) localStorage.setItem(ROLE_STORAGE_KEY, r);
      else localStorage.removeItem(ROLE_STORAGE_KEY);
    } catch {}
  };

  const scrollTo = useCallback((id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }, []);

  const jump = useCallback(
    (target: { flow: FlowId; step: number } | string) => {
      if (typeof target === "string") return scrollTo(target);
      setSteps((s) => ({ ...s, [target.flow]: target.step }));
      scrollTo(FLOWS[target.flow].anchor);
    },
    [scrollTo],
  );

  // Setter stabil per alur - FlowStepper memakai onStepChange sebagai
  // dependency timer autoplay, jadi jangan dibuat ulang tiap render.
  const setStep = useMemo(() => {
    const make = (flow: FlowId) => (step: number) =>
      setSteps((s) => ({ ...s, [flow]: step }));
    return { mr: make("mr"), po: make("po"), pc: make("pc") };
  }, []);

  return (
    <div className="col-span-12 min-w-0">
      <TocMobile active={activeSection} onNavigate={scrollTo} />

      <div className="mt-4 grid gap-6 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_200px] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <HeroSection role={role} onRoleChange={changeRole} onJump={jump} />
          <JourneySection role={role} onJump={jump} />

          {(["mr", "po"] as const).map((id) => (
            <Section key={id} id={FLOWS[id].anchor}>
              <FlowStepper
                flow={FLOWS[id]}
                step={steps[id]}
                onStepChange={setStep[id]}
                activeRole={role}
              />
            </Section>
          ))}

          <PaymentSection role={role} />
          <VendorSection />

          <Section id={FLOWS.pc.anchor}>
            <FlowStepper
              flow={FLOWS.pc}
              step={steps.pc}
              onStepChange={setStep.pc}
              activeRole={role}
            />
          </Section>

          <PrioritySection />
          <StatusSection />
          <FaqSection role={role} />
        </div>

        <aside className="hidden lg:block">
          <TocDesktop active={activeSection} onNavigate={scrollTo} />
        </aside>
      </div>
    </div>
  );
}
