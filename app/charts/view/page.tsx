import type { Metadata } from "next";
import { Suspense } from "react";
import { ChartRoute } from "@/components/routes";

export const metadata: Metadata = { title: "Chart" };

// useSearchParams() inside needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChartRoute />
    </Suspense>
  );
}
