import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono, Rubik } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { SearchBox } from "@/components/SearchBox";

// next/font downloads the fonts at build time and serves them from our own
// origin, so there's no request to Google when the page loads.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// Rubik carries the Hebrew glyphs. It sits second in every font stack, so the
// browser falls back to it character by character for Hebrew titles.
const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin", "hebrew"] });

export const metadata: Metadata = {
  title: { default: "Liner", template: "%s · Liner" },
  description: "Rate albums track by track. Notes on every record.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable} ${rubik.variable}`}>
      <body className="min-h-dvh overflow-x-clip">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-8">
            <Link href="/" aria-label="Liner home" className="shrink-0">
              <Logo />
            </Link>
            <SearchBox />
            <nav className="ms-auto hidden items-center gap-1 md:flex">
              <NavLinks />
            </nav>
          </div>
          <nav className="flex border-t border-line md:hidden">
            <NavLinks mobile />
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-muted">
            <span>
              Data from{" "}
              <a className="underline hover:text-text" href="https://musicbrainz.org">
                MusicBrainz
              </a>{" "}
              · covers from the{" "}
              <a className="underline hover:text-text" href="https://coverartarchive.org">
                Cover Art Archive
              </a>
            </span>
            <span className="flex gap-4">
              <Link className="underline hover:text-text" href="/data">
                Your data &amp; backup
              </Link>
              <Link className="underline hover:text-text" href="/notes">
                How Liner works
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
