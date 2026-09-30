"use client";

import { useEffect, useRef } from "react";
import { coverUrl } from "@/lib/urls";

// Tints the album page with the cover's own color.
//
// How: draw the cover onto a tiny 24×24 <canvas>, read the pixels back, and
// average them, weighting each pixel by how *colorful* it is (saturation), so
// a black-and-white border doesn't drown out the one red element. Reading
// pixels from another site's image is only allowed because the Cover Art
// Archive sends CORS headers and we request the image with crossOrigin;
// otherwise the canvas would be "tainted" and getImageData() would throw.
//
// The result is written to a CSS variable (--tint) on the wrapper, and the
// hero's gradient reads that variable, so no React re-render is needed.

export function CoverTint({ mbid, children, className = "" }: { mbid: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // ask for CORS, so we may read the pixels
    img.src = coverUrl(mbid, 250);
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < px.length; i += 4) {
          const [pr, pg, pb] = [px[i], px[i + 1], px[i + 2]];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          const weight = 0.08 + sat * sat; // colorful pixels count far more
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          w += weight;
        }
        ref.current?.style.setProperty("--tint", `rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})`);
      } catch {
        /* keep the neutral default tint */
      }
    };
  }, [mbid]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
