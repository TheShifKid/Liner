"use client";

import { useSearchParams } from "next/navigation";
import { AlbumView } from "./views/AlbumView";
import { ArtistView } from "./views/ArtistView";
import { SearchView } from "./views/SearchView";
import { TierListEditor } from "./views/TiersView";
import { WrappedView } from "./views/WrappedView";

// Each of these reads its id from the URL's query string (?id=…) in the
// browser; see lib/urls.ts for why the site uses query strings. `key` makes
// React start the view fresh when the id changes, instead of reusing the
// previous album's state.

export function AlbumRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <AlbumView key={id} id={id} />;
}

export function ArtistRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <ArtistView key={id} id={id} />;
}

export function SearchRoute() {
  const q = useSearchParams().get("q") ?? "";
  return <SearchView key={q} q={q} />;
}

export function TierListRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <TierListEditor key={id} id={id} />;
}

export function WrappedRoute() {
  const year = Number(useSearchParams().get("year")) || new Date().getFullYear();
  return <WrappedView key={year} year={year} />;
}
