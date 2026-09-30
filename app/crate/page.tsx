import type { Metadata } from "next";
import { CrateView } from "@/components/views/CrateView";

export const metadata: Metadata = { title: "Crate" };

export default function CratePage() {
  return <CrateView />;
}
