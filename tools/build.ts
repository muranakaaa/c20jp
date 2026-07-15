// Hono アプリを toSSG で dist/ に静的化し、CSS などの静的アセットをコピーする。
import { toSSG } from "hono/ssg";
import * as fsp from "node:fs/promises";
import { appendFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { app } from "../src/app";

const ROOT = join(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const result = await toSSG(app, fsp, { dir: DIST });
if (!result.success) {
  console.error(result.error);
  process.exit(1);
}
console.log(`generated ${result.files?.length ?? 0} files`);

// 静的アセット: 原本の CSS・画像 + 復元 CSS（public/）。jquery.js はスクリプト全廃に伴い含めない
const ASSETS = [
  "a.css",
  "all.css",
  "b.css",
  "c.css",
  "other.css",
  "top.css",
  "include/include.css",
];
for (const a of ASSETS) {
  const src = join(ROOT, "original", a);
  if (existsSync(src)) {
    cpSync(src, join(DIST, a));
  }
}
if (existsSync(join(ROOT, "public"))) {
  cpSync(join(ROOT, "public"), DIST, { recursive: true });
}
console.log("assets copied");

// Sitemap（sitemap.xml）と robots.txt の Sitemap 行（SITE_ORIGIN 設定時のみ）
const origin = process.env.SITE_ORIGIN?.replace(/\/$/u, "") ?? "";
if (origin) {
  const urls = (result.files ?? [])
    .map((f) => relative(DIST, f).replaceAll("\\", "/"))
    .filter((f) => f.endsWith(".html") && f !== "404.html")
    .map((f) => `${origin}/${f === "index.html" ? "" : f}`)
    .toSorted();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `<url><loc>${u}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  writeFileSync(join(DIST, "sitemap.xml"), xml);
  appendFileSync(join(DIST, "robots.txt"), `Sitemap: ${origin}/sitemap.xml\n`);
  console.log(`sitemap: ${urls.length} urls`);
} else {
  console.log("SITE_ORIGIN 未設定のため sitemap / canonical / JSON-LD は出力していない");
}
