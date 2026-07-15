// Original/ と dist/ の全ページについて、可視テキストと有効リンク集合の一致を検証する。
// Script は再構築で意図的に落としているため、比較前に原本からも除去する。
import * as cheerio from "cheerio";
import { maskAuthorEmails, unwrapMailto } from "../src/sanitize";
import { walk } from "../src/walk";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function digest(file: string): { text: string; links: string } {
  // 両者を同一のパース→再直列化に通してから、タグ境界に空白を入れて正規化する。
  // 原本の壊れた属性（href"…"）は a タグの入れ子を生み、直列化段階の違いが疑似差分になるため
  // 復元版は mailto リンクを剥がしてテキストを残すため、タグ境界の正規化前に両者とも同じ形に揃える
  const serialized = unwrapMailto(cheerio.load(readFileSync(file, "utf8")).html());
  const $ = cheerio.load(serialized.replaceAll("><", "> <"));
  $("script").remove();
  // ミラー告知バーは復元版で意図的に追加しているため、比較前に除く
  $("div.mirror-note").remove();
  const text = maskAuthorEmails($("body").text()).replaceAll(/\s+/gu, " ").trim();
  const links = $("a[href]")
    .map((_, e) => $(e).attr("href"))
    .get()
    .map((h) => h.replace(/^https?:\/\/(?:www\.)?c20\.jp(?::80)?\/?/i, "/"))
    .filter((h) => h && !h.startsWith("javascript:"))
    .toSorted();
  return { text, links: links.join("|") };
}

// 既知の許容差分: 死んだ Google カスタム検索ウィジェットを落としている2ページ（リンクは一致必須）
const KNOWN_TEXT_DIFF = new Set(["1934/10rikup.html", "text/nm_syo02.html", "taro/zakk0001.html"]);

let textDiff = 0;
let linkDiff = 0;
let n = 0;
const report: string[] = [];
for (const orig of walk(join(ROOT, "original"), [".html"])) {
  const rel = relative(join(ROOT, "original"), orig);
  const built = join(ROOT, "dist", rel);
  const a = digest(orig);
  const b = digest(built);
  n++;
  if (a.text !== b.text && !KNOWN_TEXT_DIFF.has(rel)) {
    textDiff++;
    if (report.length < 8) {
      let i = 0;
      while (a.text[i] === b.text[i]) {
        i++;
      }
      report.push(
        `TEXT ${rel}\n  orig: …${a.text.slice(Math.max(0, i - 40), i + 60)}\n  built:…${b.text.slice(Math.max(0, i - 40), i + 60)}`,
      );
    }
  }
  if (a.links !== b.links) {
    linkDiff++;
    if (report.length < 8) {
      const la = new Set(a.links.split("|"));
      const lb = new Set(b.links.split("|"));
      const onlyA = [...la].filter((x) => !lb.has(x)).slice(0, 3);
      const onlyB = [...lb].filter((x) => !la.has(x)).slice(0, 3);
      report.push(`LINK ${rel}\n  only-orig: ${onlyA}\n  only-built: ${onlyB}`);
    }
  }
}
console.log(`checked ${n} pages: text-mismatch=${textDiff} link-mismatch=${linkDiff}`);
for (const r of report) {
  console.log(r);
}
process.exit(textDiff + linkDiff ? 1 : 0);
