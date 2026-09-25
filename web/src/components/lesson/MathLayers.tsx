"use client";

import { useState } from "react";
import type { MathLayer } from "@/lib/content/types";
import MathBlock from "@/components/ui/MathBlock";
import { Button } from "@/components/ui/Button";

/**
 * Math revealed in layers: nothing shown until "Show me the math", then one level at a time
 * with "Show me more".
 */
export default function MathLayers({
  layers,
  onOpen,
}: {
  layers: MathLayer[];
  onOpen?: (level: number) => void;
}) {
  const levels = [...new Set(layers.map((m) => m.level))].sort();
  const [shown, setShown] = useState(0); // number of levels revealed

  const reveal = () => {
    const next = shown + 1;
    setShown(next);
    onOpen?.(levels[next - 1]);
  };

  const visible = layers.filter((m) => levels.indexOf(m.level) < shown);

  return (
    <div className="space-y-3">
      {visible.map((m, i) => (
        <MathBlock key={i} latex={m.latex} plainEnglish={m.plain_english} />
      ))}
      {shown < levels.length && (
        <Button variant="secondary" onClick={reveal} aria-expanded={shown > 0}>
          {shown === 0 ? "Show me the math" : "Show me more"}
        </Button>
      )}
      {shown === levels.length && shown > 0 && (
        <p className="text-ink-muted text-sm">
          That&apos;s all the math for this step.
        </p>
      )}
    </div>
  );
}
