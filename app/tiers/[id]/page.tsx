import type { Metadata } from "next";
import { TierListEditor } from "@/components/views/TiersView";

export const metadata: Metadata = { title: "Tier list" };

export default async function TierListPage(props: PageProps<"/tiers/[id]">) {
  const { id } = await props.params;
  return <TierListEditor id={id} />;
}
