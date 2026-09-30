import type { Metadata } from "next";
import { DiaryView } from "@/components/views/DiaryView";

export const metadata: Metadata = { title: "Diary" };

export default function DiaryPage() {
  return <DiaryView />;
}
