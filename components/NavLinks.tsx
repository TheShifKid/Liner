"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/diary", label: "Diary" },
  { href: "/tiers", label: "Tiers" },
  { href: "/stats", label: "Stats" },
  { href: "/wrapped", label: "Wrapped" },
];

// usePathname() tells us the current URL, so the matching link can be marked
// active (aria-current also tells screen readers "you are here").
export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const path = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `flex-1 py-2.5 text-center text-sm font-medium ${active ? "text-text" : "text-muted"}`
                : `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-surface-2 text-text" : "text-text-2 hover:text-text"
                  }`
            }
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
