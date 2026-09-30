import type { Metadata } from "next";
import { Suspense } from "react";
import { AlbumRoute } from "@/components/routes";

export const metadata: Metadata = { title: "Album" };

// useSearchParams() inside needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlbumRoute />
    </Suspense>
  );
}
