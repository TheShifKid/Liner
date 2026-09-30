"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function Box() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);

  // Press "/" anywhere to jump to search (a common keyboard shortcut on
  // sites like GitHub and YouTube).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden>
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        dir="auto"
        placeholder="Search albums, artists…"
        aria-label="Search albums or artists"
        className="h-10 w-full rounded-full border border-line bg-surface pe-10 ps-9 text-sm outline-none transition placeholder:text-muted focus:border-line-strong focus:bg-surface-2"
      />
      <kbd className="num pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-muted sm:block">
        /
      </kbd>
    </form>
  );
}

// useSearchParams() needs a Suspense boundary above it, or Next.js can't
// pre-render the rest of the page while waiting for the URL.
export function SearchBox() {
  return (
    <Suspense fallback={<div className="h-10 w-full max-w-md" />}>
      <Box />
    </Suspense>
  );
}
