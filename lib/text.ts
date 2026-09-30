// Text-direction helpers.
//
// dir="auto" on a single title is fine, but a *list* where every row decides
// for itself looks broken: Hebrew rows hug the right edge, English ones the
// left. So for whole sections we decide once: if most letters across the
// album's titles are Hebrew/Arabic, the section is laid out right-to-left.

const RTL = /[֐-׿؀-ۿיִ-﷿ﹰ-﻿]/g;
const LETTER = /\p{L}/gu;

export function rtlShare(texts: string[]) {
  const joined = texts.join(" ");
  const letters = joined.match(LETTER)?.length ?? 0;
  if (!letters) return 0;
  return (joined.match(RTL)?.length ?? 0) / letters;
}

export function sectionDir(texts: string[]): "rtl" | "ltr" {
  return rtlShare(texts) > 0.5 ? "rtl" : "ltr";
}
