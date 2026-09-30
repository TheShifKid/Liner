import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchRoute } from "@/components/routes";

export const metadata: Metadata = { title: "Search" };

// useSearchParams() inside needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchRoute />
    </Suspense>
  );
}
