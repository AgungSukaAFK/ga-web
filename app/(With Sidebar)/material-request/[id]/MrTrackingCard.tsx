"use client";

import { PackageCheck, Target, UserRound } from "lucide-react";
import {
  TrackingCard,
  TrackingCardItem,
  TrackingFact,
} from "@/components/tracking-card";
import { ItemTrack, MrTracking } from "@/lib/mrTracking";

const toCardItem = (item: ItemTrack): TrackingCardItem => {
  const { order } = item;
  const notes: string[] = [];
  if (order.status_note) notes.push(`Catatan: ${order.status_note}`);
  if (order.qty_before_close && order.qty_before_close !== order.qty) {
    notes.push(`Semula ${order.qty_before_close} ${order.uom}, sisanya ditutup admin.`);
  }
  const received =
    item.receivedQty > 0 && !item.closedLabel
      ? ` · diterima ${item.receivedQty}`
      : "";

  return {
    key: item.index,
    name: order.name,
    meta: `${item.qty} ${order.uom}${received}`,
    notes,
    closed: !!item.closedLabel,
    position: item.position,
    positionState: item.positionState,
    // Link PO cukup muncul sekali, di tahap PO.
    steps: item.steps.map((step) =>
      step.id === "po" ? step : { ...step, links: [] },
    ),
  };
};

export const MrTrackingCard = ({
  tracking,
  className,
}: {
  tracking: MrTracking;
  className?: string;
}) => {
  const facts: TrackingFact[] = [];
  if (tracking.waitingOn) {
    facts.push({ icon: UserRound, label: "Menunggu:", value: tracking.waitingOn });
  }
  if (tracking.received && tracking.received.total > 0) {
    facts.push({
      icon: PackageCheck,
      label: "Diterima:",
      value: `${tracking.received.items} / ${tracking.received.total} barang`,
    });
  }
  if (tracking.target) {
    facts.push({
      icon: Target,
      label: "Target:",
      value: tracking.target.label,
      emphasis: tracking.target.overdue,
    });
  }

  return (
    <TrackingCard
      title="Lacak MR"
      storageKey="mr-tracking-collapsed"
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
