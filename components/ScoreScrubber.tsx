"use client";

import { useRef, useState } from "react";
import { clampScore, formatScore, scoreColor } from "@/lib/score";

// A 0–100 rating control: a bar you click or drag, plus a score chip you can
// click to type an exact number.
//
// It's a custom "slider" rather than <input type="range"> because we want the
// fill to take the score's own color. To stay accessible it carries
// role="slider" and aria-value* attributes, which is what screen readers use
// to announce native sliders.
//
// While you drag, only local state changes (`preview`). The value is saved
// once, on release ("commit on release"), so a drag isn't twenty saves.

export function ScoreScrubber({
  value,
  onCommit,
  label,
  variant = "row",
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  label: string;
  variant?: "row" | "hero";
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [typing, setTyping] = useState(false);
  const shown = preview ?? value;
  const hero = variant === "hero";

  // The bar may be inside a right-to-left section, where 0 is on the right.
  const fromPointer = (clientX: number) => {
    const el = bar.current!;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const frac = rtl ? (r.right - clientX) / r.width : (clientX - r.left) / r.width;
    return clampScore(frac * 100);
  };

  const commit = (v: number | null) => {
    setPreview(null);
    if (v !== value) onCommit(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const base = value ?? 50;
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, number | null> = {
      ArrowRight: base + step,
      ArrowUp: base + step,
      ArrowLeft: base - step,
      ArrowDown: base - step,
      PageUp: base + 10,
      PageDown: base - 10,
      Home: 0,
      End: 100,
      Delete: null,
      Backspace: null,
    };
    if (e.key in map) {
      e.preventDefault();
      const v = map[e.key];
      commit(v === null ? null : clampScore(v));
    } else if (e.key === "Enter") {
      setTyping(true);
    }
  };

  const pct = shown === null ? 0 : shown;

  return (
    <div className={`flex items-center ${hero ? "gap-4" : "gap-3"}`}>
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown ?? undefined}
        aria-valuetext={shown === null ? "not rated" : `${formatScore(shown)} out of 100`}
        onKeyDown={onKey}
        // Pointer Events unify mouse, touch and pen. setPointerCapture keeps
        // sending moves here even if the finger slides off the bar.
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setPreview(fromPointer(e.clientX));
        }}
        onPointerMove={(e) => dragging && setPreview(fromPointer(e.clientX))}
        onPointerUp={(e) => {
          setDragging(false);
          commit(fromPointer(e.clientX));
        }}
        onPointerCancel={() => {
          setDragging(false);
          setPreview(null);
        }}
        // The visible bar is thin, but the element is tall: a big invisible
        // hit area makes it easy to grab on a phone.
        className={`group/bar relative flex flex-1 cursor-pointer touch-none select-none items-center ${hero ? "h-10" : "h-8"}`}
      >
        <div className={`relative w-full overflow-hidden rounded-full bg-[var(--unrated)] ${hero ? "h-3" : "h-1.5 group-hover/bar:h-2"} transition-[height]`}>
          <div
            className="absolute inset-y-0 start-0 rounded-full"
            style={{ width: `${pct}%`, background: scoreColor(shown), transition: dragging ? "none" : "width 120ms" }}
          />
        </div>
        {shown !== null && (
          <div
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-bg shadow ${
              hero ? "h-5 w-5" : "h-3.5 w-3.5 opacity-0 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100"
            } ${dragging ? "opacity-100" : ""}`}
            style={{ insetInlineStart: `calc(${pct}% - ${hero ? 10 : 7}px)`, background: scoreColor(shown) }}
          />
        )}
      </div>

      {typing ? (
        <input
          autoFocus
          inputMode="numeric"
          defaultValue={value ?? ""}
          aria-label={`${label}, type 0 to 100`}
          onBlur={(e) => {
            setTyping(false);
            const raw = e.target.value.trim();
            commit(raw === "" ? null : clampScore(Number(raw) || 0));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setTyping(false);
          }}
          className={`num rounded-md border border-line-strong bg-surface text-center font-bold outline-none ${
            hero ? "h-12 w-20 text-2xl" : "h-7 w-11 text-sm"
          }`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setTyping(true)}
          title="Click to type a score"
          className={`num shrink-0 rounded-md font-bold transition ${hero ? "h-12 w-20 text-2xl" : "h-7 w-11 text-sm"} ${
            shown === null ? "border border-dashed border-line-strong text-muted hover:border-text-2" : "text-[#10130d]"
          }`}
          style={shown === null ? undefined : { background: scoreColor(shown) }}
        >
          {formatScore(shown)}
        </button>
      )}
    </div>
  );
}
