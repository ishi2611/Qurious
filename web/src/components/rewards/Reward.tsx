"use client";

import type { RewardType } from "@/lib/content/types";
import BellSignalGame from "./BellSignalGame";
import TeleportLab from "@/components/interactives/TeleportLab";

export default function Reward({ type }: { type: RewardType }) {
  switch (type) {
    case "bell_signal_game":
      return <BellSignalGame />;
    case "teleport_lab":
      return <TeleportLab mode="reward" />;
    case "coming_soon":
      return (
        <p className="text-ink-muted">This reward is still being built.</p>
      );
  }
}
