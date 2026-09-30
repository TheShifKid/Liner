import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono, Rubik } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { PlayerProvider, MiniPlayer } from "@/components/Player";
import { SearchBox } from "@/components/SearchBox";

// next/font downloads the fonts at build time and serves them from our own
// origin, so there's no request to Google when the page loads.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// Rubik carries the Hebrew glyphs. It sits second in every font stack, so the
// browser falls back to it character-by-character for Hebrew titles.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin", "hebrew"] });

export const metadata: Metadata = {
  title: { default: "Liner", template: "%s · Liner" },
  description: "Rate albums track by track. Notes on every record.",
};

const NAV = [
  { href: "/diary", label: "Diary" },
  { href: "/tiers", label: "Tiers" },
  { href: "/stats", label: "Stats" },
  { href: "/wrapped", label: "Wrapped" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable} ${rubik.variable}`}
    >
      <body className="min-h-dvh">
        <PlayerProvider>
          <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6">
              <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
                liner<span className="text-low">.</span>
              </Link>
              <SearchBox />
              <nav className="hidden items-center gap-5 text-sm font-medium sm:flex">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="text-ink-2 hover:text-ink">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
            <nav className="flex justify-around border-t border-rule py-2 text-sm font-medium sm:hidden">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2">
                  {n.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-32 pt-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-24 text-xs text-muted">
            Catalogue data from{" "}
            <a className="underline" href="https://musicbrainz.org">
              MusicBrainz
            </a>{" "}
            · covers from the{" "}
            <a className="underline" href="https://coverartarchive.org">
              Cover Art Archive
            </a>{" "}
            · previews by{" "}
            <a className="underline" href="https://www.deezer.com">
              Deezer
            </a>{" "}
            ·{" "}
            <Link className="underline" href="/notes">
              how Liner works
            </Link>
          </footer>
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
