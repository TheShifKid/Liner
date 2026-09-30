import type { Metadata } from "next";
import { StatsView } from "@/components/views/StatsView";

export const metadata: Metadata = { title: "Stats" };

// Computed in your browser from your on-device library (lib/stats.ts).
export default function StatsPage() {
  return <StatsView />;
}
