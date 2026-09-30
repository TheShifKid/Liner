import type { Metadata } from "next";
import { BackupView } from "@/components/views/BackupView";

export const metadata: Metadata = { title: "Your data" };

export default function DataPage() {
  return <BackupView />;
}
