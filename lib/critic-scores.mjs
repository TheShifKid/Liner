// Critic scores, read from Wikipedia.
//
// Nearly every notable album's Wikipedia article has a "Professional
// ratings" box: Metacritic's score plus a list of reviews (AllMusic 4.5/5,
// Pitchfork 8.7/10, Robert Christgau A−, …). Editors keep these up to date
// and cite every one. There's no API for "critic scores", but that box is
// structured wikitext, a template call like:
//
//   {{Album ratings
//   | MC = 96/100<ref>…</ref>
//   | rev1 = [[AllMusic]]
//   | rev1Score = {{Rating|5|5}}
//   | rev2 = [[Entertainment Weekly]]
//   | rev2Score = B+
//   }}
//
// This file turns that text into numbers on Liner's 0–100 scale. It's plain
// JavaScript (.mjs) so both the chart builder (Node) and the album page (the
// browser) can import the very same code.

// Letter grades (Christgau, Entertainment Weekly, The A.V. Club…).
const LETTERS = { "A+": 100, A: 95, "A-": 90, "B+": 85, B: 80, "B-": 75, "C+": 70, C: 65, "C-": 60, "D+": 55, D: 50, "D-": 45, "E+": 40, E: 35, "E-": 30, F: 20 };

// The three names editors use for the same box.
const BOX = /\{\{\s*(?:album|music)\s+(?:ratings|reviews)\s*(?=[|}\n])/gi;

// Find each box and cut it out by counting braces ("bracket matching"),
// because the box contains nested {{templates}} of its own.
function boxes(text) {
  const out = [];
  for (const m of text.matchAll(BOX)) {
    let depth = 0;
    for (let i = m.index; i < text.length - 1; i++) {
      if (text[i] === "{" && text[i + 1] === "{") {
        depth++;
        i++;
      } else if (text[i] === "}" && text[i + 1] === "}") {
        depth--;
        i++;
        if (depth === 0) {
          out.push(text.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return out;
}

const strip = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");

// "[[Pitchfork (website)|Pitchfork]]" / "''[[Rolling Stone]]''" → "Pitchfork" / "Rolling Stone"
const cleanName = (s) =>
  s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

/** One review's text → 0–100, or null if it isn't a score we understand. */
export function parseScore(raw) {
  const s = raw.replace(/[−–—]/g, "-").trim();
  let m = s.match(/\{\{\s*rating\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/i); // {{Rating|4.5|5}}
  if (m) return ratio(+m[1], +m[2]);
  m = s.match(/\{\{\s*rating-(\d+)\s*\|\s*([\d.]+)/i); // old {{Rating-5|4}}
  if (m) return ratio(+m[2], +m[1]);
  const plain = cleanName(s);
  m = plain.match(/([\d.]+)\s*(?:\/|out of)\s*(\d+)/i); // 8.7/10, 4 out of 5
  if (m) return ratio(+m[1], +m[2]);
  m = plain.match(/^\(?([A-F][+-]?)\)?(?:\s|$)/); // A-, (B+)
  if (m && m[1] in LETTERS) return LETTERS[m[1]];
  return null;
}

function ratio(x, of) {
  if (!(of > 0) || !(x >= 0) || x > of) return null;
  return Math.round((x / of) * 100);
}

/**
 * Every review in an article's rating boxes.
 * @param {string} wikitext
 * @returns {{ metacritic: number | null, reviews: { source: string, score: number }[] }}
 */
export function parseRatingBoxes(wikitext) {
  let metacritic = null;
  const reviews = [];
  for (const box of boxes(strip(wikitext))) {
    const params = {};
    // Parameters sit one per line: "| rev1Score = {{Rating|5|5}}"
    for (const line of box.split(/\n\s*\|/).slice(1)) {
      const eq = line.indexOf("=");
      if (eq > 0) params[line.slice(0, eq).trim().toLowerCase().replace(/\s+/g, "")] = line.slice(eq + 1).replace(/\}\}\s*$/, "").trim();
    }
    if (params.mc && metacritic === null) metacritic = parseScore(params.mc);
    for (let n = 1; n <= 30; n++) {
      const raw = params[`rev${n}score`];
      if (!raw) continue;
      const score = parseScore(raw);
      const source = cleanName(params[`rev${n}`] ?? "");
      if (score !== null && source) reviews.push({ source, score });
    }
  }
  return { metacritic, reviews };
}

/**
 * One critic score per album: the average of the reviews, with Metacritic
 * (itself an average of dozens of critics) counting as four reviews.
 * @param {{ metacritic: number | null, reviews: { score: number }[] }} p
 */
export function criticScore(p) {
  let sum = 0;
  let weight = 0;
  if (p.metacritic !== null) {
    sum += p.metacritic * 4;
    weight += 4;
  }
  for (const r of p.reviews) {
    sum += r.score;
    weight += 1;
  }
  if (!weight) return null;
  return { score: Math.round(sum / weight), weight, reviews: p.reviews.length };
}
