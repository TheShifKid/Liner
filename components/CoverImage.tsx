"use client";

import { useState } from "react";
import { coverUrl, placeholderCover } from "@/lib/urls";

// An album cover straight from the Cover Art Archive.
// If it fails, we try once more with the other thumbnail size (a separate
// file, often on a different storage server, so it survives a flaky mirror),
// and only then swap in a generated "blank sleeve" instead of a broken image.
export function CoverImage({
  mbid,
  title,
  artist = "",
  size = 250,
  className = "",
  eager = false,
  draggable,
}: {
  mbid: string;
  title: string;
  artist?: string;
  size?: 250 | 500;
  className?: string;
  eager?: boolean;
  draggable?: boolean;
}) {
  const [attempt, setAttempt] = useState(0); // 0 = asked size, 1 = other size, 2 = sleeve
  const other = size === 250 ? 500 : 250;
  const src = attempt === 0 ? coverUrl(mbid, size) : attempt === 1 ? coverUrl(mbid, other) : placeholderCover(title, artist);
  return (
    // A plain <img>, not next/image: a static site has no image optimizer,
    // and the archive already serves the exact sizes we ask for.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      title={title}
      crossOrigin="anonymous"
      loading={eager ? "eager" : "lazy"}
      draggable={draggable}
      onError={() => setAttempt((a) => Math.min(2, a + 1))}
      className={className}
    />
  );
}
