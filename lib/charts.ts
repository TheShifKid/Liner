"use client";

import { asset } from "./urls";

// The charts are static JSON files, generated weekly by
// scripts/build-charts.mjs (critic scores from Wikipedia, listening data from
// ListenBrainz) and published with the site. Reading one is a single small download, no API calls.

export type ChartEntry = {
  rank: number;
  mbid: string;
  title: string;
  artist: string;
  artistMbid: string | null;
  year: number | null;
  genres: string[];
  listeners: number;
  plays: number;
  critic: number | null; // 0–100 average of the critic reviews
  reviews: number;
  metacritic: number | null;
};

export type ChartSummary = {
  id: string;
  name: string;
  kind: "overall" | "year" | "genre" | "decade" | "region";
  basis: "critics" | "listeners"; // what it is ranked by
  count: number;
  top: { mbid: string; title: string; artist: string }[];
};

export type Chart = Omit<ChartSummary, "count" | "top"> & { entries: ChartEntry[] };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(asset(path));
  if (!res.ok) throw new Error(`Couldn't load ${path}`);
  return res.json();
}

export const loadChartIndex = () => getJson<{ generatedAt: string; charts: ChartSummary[] }>("/charts/index.json");

export function loadChart(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error("bad chart id"));
  return getJson<Chart>(`/charts/${id}.json`);
}
