import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtistRoute } from "@/components/routes";

export const metadata: Metadata = { title: "Artist" };

// useSearchParams() inside needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ArtistRoute />
    </Suspense>
  );
}
