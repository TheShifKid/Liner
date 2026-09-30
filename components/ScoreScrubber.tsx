"use client";

import { useRef, useState } from "react";
import { clampScore, formatScore, scoreColor } from "@/lib/score";

// A 0–10 rating control you can click, drag, or drive with the keyboard.
//
// It's a custom "slider" rather than <input type="range"> because we want the
// fill to take the score's own color and to snap to half points visually. To
// stay accessible we give it role="slider" + aria-value* attributes, which is
// what screen readers use to announce native sliders.
//
// While you drag, only local state changes (`preview`). The value is sent to
// the server once, on release ("commit on release"), so dragging across the
// bar doesn't fire twenty saves.

export function ScoreScrubber({
  value,
  onCommit,
  size = "md",
  label,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  size?: "md" | "lg";
  label: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const shown = preview ?? value;

  const fromPointer = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    // Map x-position to 0..10 and snap to the nearest 0.5. Tapping the far
    // left edge gives 0, which is a legitimate score, not "cleared".
    return clampScore(((clientX - r.left) / r.width) * 10);
  };

  const commit = (v: number | null) => {
    setPreview(null);
    if (v !== value) onCommit(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const base = value ?? 5;
    const map: Record<string, number | null> = {
      ArrowRight: clampScore(base + 0.5),
      ArrowUp: clampScore(base + 0.5),
      ArrowLeft: clampScore(base - 0.5),
      ArrowDown: clampScore(base - 0.5),
      Home: 0,
      End: 10,
      Delete: null,
      Backspace: null,
    };
    if (e.key in map) {
      e.preventDefault();
      commit(map[e.key]);
    } else if (/^[0-9]$/.test(e.key)) {
      commit(Number(e.key)); // number keys jump to whole scores; End = 10
    }
  };

  const h = size === "lg" ? "h-10" : "h-6";
  const pct = shown === null ? 0 : shown * 10;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={shown ?? undefined}
        aria-valuetext={shown === null ? "not rated" : `${formatScore(shown)} out of 10`}
        onKeyDown={onKey}
        // Pointer Events unify mouse, touch and pen. setPointerCapture keeps
        // delivering moves to this element even if the finger slides off it.
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setPreview(fromPointer(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging) setPreview(fromPointer(e.clientX));
        }}
        onPointerUp={(e) => {
          setDragging(false);
          commit(fromPointer(e.clientX));
        }}
        onPointerCancel={() => {
          setDragging(false);
          setPreview(null);
        }}
        className={`relative w-full cursor-pointer touch-none select-none bg-[var(--unrated)]/60 ${h}`}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-75"
          style={{ width: `${pct}%`, background: scoreColor(shown) }}
        />
        {/* Tick marks at every whole number, like a ruler. */}
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1 border-r border-paper/70 last:border-r-0" />
          ))}
        </div>
      </div>
      <span
        className={`num w-9 shrink-0 text-right font-bold ${size === "lg" ? "text-2xl w-14" : "text-sm"} ${
          shown === null ? "text-muted" : ""
        }`}
      >
        {formatScore(shown)}
      </span>
    </div>
  );
}
