import type { Metadata } from "next";
import { Suspense } from "react";
import { TierListRoute } from "@/components/routes";

export const metadata: Metadata = { title: "Tier list" };

// useSearchParams() inside needs a Suspense boundary in a static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TierListRoute />
    </Suspense>
  );
}
