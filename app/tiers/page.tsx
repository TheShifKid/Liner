import type { Metadata } from "next";
import { TiersView } from "@/components/views/TiersView";

export const metadata: Metadata = { title: "Tier lists" };

export default function TiersPage() {
  return <TiersView />;
}
