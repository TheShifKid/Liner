import type { NextConfig } from "next";

// Liner is a fully static site: `next build` writes plain HTML/CSS/JS files
// into ./out, which GitHub Pages serves as-is. There is no server. Everything
// dynamic (MusicBrainz lookups, your ratings) happens in the browser.
//
// GitHub Pages serves this repo under https://theshifkid.github.io/Liner/,
// i.e. under a sub-path. basePath tells Next.js to prefix every link and
// asset with it. The deploy workflow sets NEXT_PUBLIC_BASE_PATH=/Liner; locally
// it's empty, so `npm run dev` still serves at http://localhost:3100/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // /stats → /stats/index.html, which is how static hosts expect folders.
  trailingSlash: true,
};

export default nextConfig;
