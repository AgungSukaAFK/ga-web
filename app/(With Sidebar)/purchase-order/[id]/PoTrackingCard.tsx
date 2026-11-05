"use client";

import { PackageCheck, Target, Truck, UserRound, Wallet } from "lucide-react";
import {
  TrackingCard,
  TrackingCardItem,
  TrackingFact,
} from "@/components/tracking-card";
import { PoItemTrack, PoTracking } from "@/lib/poTracking";

const toCardItem = (item: PoItemTrack): TrackingCardItem => {
  const notes: string[] = [];
  if (item.statusNote) notes.push(`Catatan: ${item.statusNote}`);
  if (item.closedQty > 0) {
    notes.push(`${item.closedQty} ${item.uom} ditutup admin dan tidak dikirim vendor.`);
  }
  if (item.mrQty !== null) {
    notes.push(
      `Item MR ini ${item.mrQty} ${item.uom}. Angka kirim dan terima di bawah adalah gabungan semua PO-nya.`,
    );
  }

  return {
    key: item.index,
    name: item.name,
    meta: [
      `${item.qty} ${item.uom}`.trim(),
      item.arrivedQty > 0 && !item.closedLabel && `tiba ${item.arrivedQty}`,
    ]
      .filter(Boolean)
      .join(" · "),
    notes,
    closed: !!item.closedLabel,
    position: item.position,
    positionState: item.positionState,
    steps: item.steps,
  };
};

export const PoTrackingCard = ({
  tracking,
  paymentTerm,
  className,
}: {
  tracking: PoTracking;
  paymentTerm: string | null | undefined;
  className?: string;
}) => {
  const facts: TrackingFact[] = [];
  if (tracking.waitingOn) {
    facts.push({ icon: UserRound, label: "Menunggu:", value: tracking.waitingOn });
  }
  if (paymentTerm) {
    facts.push({ icon: Wallet, label: "Pembayaran:", value: paymentTerm });
  }
  if (tracking.arrived) {
    facts.push({
      icon: Truck,
      label: "Tiba:",
      value: `${tracking.arrived.items} / ${tracking.arrived.total} barang`,
    });
  }
  if (tracking.received) {
    facts.push({
      icon: PackageCheck,
      label: "Diterima:",
      value: `${tracking.received.items} / ${tracking.received.total} barang`,
    });
  }
  if (tracking.target) {
    facts.push({
      icon: Target,
      label: "Target MR:",
      value: tracking.target.label,
      emphasis: tracking.target.overdue,
    });
  }

  return (
    <TrackingCard
      title="Lacak PO"
      storageKey="po-tracking-collapsed"
      className={className}
      tone={tracking.tone}
      headline={tracking.headline}
      detail={tracking.detail}
      facts={facts}
      steps={tracking.steps}
      currentStepId={tracking.currentStepId}
      items={tracking.items.map(toCardItem)}
    />
  );
};
