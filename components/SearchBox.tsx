"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Box() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      role="search"
      className="flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        dir="auto"
        placeholder="Search albums or artists…"
        aria-label="Search albums or artists"
        className="w-full max-w-md border-b border-ink/30 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted focus:border-ink"
      />
    </form>
  );
}

// useSearchParams() needs a Suspense boundary above it, or Next.js can't
// pre-render the rest of the page while waiting for the URL.
export function SearchBox() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Box />
    </Suspense>
  );
}
