import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WrappedView } from "@/components/views/WrappedView";

export async function generateMetadata(props: PageProps<"/wrapped/[year]">): Promise<Metadata> {
  const { year } = await props.params;
  return { title: `Wrapped ${year}` };
}

export default async function WrappedPage(props: PageProps<"/wrapped/[year]">) {
  const { year: raw } = await props.params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 3000) notFound();
  return <WrappedView year={year} />;
}
