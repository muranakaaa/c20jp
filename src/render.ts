// Content/pages/*.json のブロック列から旧サイトと同一の markup を再生成する。
// フラグメントは抽出時の HTML を sanitize.ts の公開時加工に通してそのまま埋め込む。
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { html, raw } from "hono/html";
import { isEmptyFragment, sanitizeFragment } from "./sanitize";
import type { HtmlEscapedString } from "hono/utils/html";

// Compat.css の内容ハッシュ。link に ?v= として付け、更新のたびに URL を変えてキャッシュを確実に更新する
// （このモジュールはビルド時のみ実行される。配信 Worker は worker.ts で、render は import しない）
const COMPAT_CSS_VERSION = createHash("sha256")
  .update(readFileSync(join(import.meta.dirname, "..", "public", "compat.css")))
  .digest("hex")
  .slice(0, 8);

export interface TimelineCell {
  id: string | null;
  cls: string | null;
  html: string;
}

export interface TimelineRow {
  cls: string;
  cells: TimelineCell[];
}

export type Block =
  | { type: "edit_bar"; kind: string; html: string }
  | { type: "navi" | "title" | "title2" | "navi2" | "cyu" | "taro" | "fnavi"; html: string }
  | { type: "headline"; cells: string[] }
  | { type: "timeline"; rows: TimelineRow[] }
  | { type: "base_break"; cls: string }
  | { type: "raw"; tag: string; attrs: Record<string, string>; html: string };

export interface PageDoc {
  path: string;
  type: string;
  title: string;
  description: string | null;
  css: string[];
  baseClass: string;
  blocks: Block[];
}

const VOID_TAGS = new Set(["br", "img", "hr", "input"]);

function attrString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${String(v).replaceAll('"', "&quot;")}"`)
    .join("");
}

function renderBlock(b: Block): HtmlEscapedString {
  switch (b.type) {
    case "edit_bar":
    case "navi":
    case "title":
    case "title2":
    case "navi2":
    case "cyu":
    case "taro":
    case "fnavi": {
      const cls = b.type === "edit_bar" ? b.kind : b.type;
      return raw(`<div class="${cls}">${sanitizeFragment(b.html)}</div>`);
    }
    case "headline": {
      return raw(
        `<table role="presentation" class="headline"><tr>${b.cells
          .map((c) => `<td class="headline">${sanitizeFragment(c)}</td>`)
          .join("")}</tr></table>`,
      );
    }
    case "timeline": {
      return raw(
        `<table class="line">${b.rows
          .map(
            (r) =>
              `<tr${r.cls ? ` class="${r.cls}"` : ""}>${r.cells
                .map(
                  (c) =>
                    `<td${c.id ? ` id="${c.id}"` : ""}${c.cls ? ` class="${c.cls}"` : ""}>${sanitizeFragment(c.html)}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("\n")}</table>`,
      );
    }
    case "raw": {
      if (b.tag === "script") {
        return raw("");
      }
      const inner = sanitizeFragment(b.html);
      // 広告・検索を除去した結果、中身が空になった table などの器は出力しない
      // （固定幅の空殻がモバイルで横あふれを起こすため）
      if (b.tag === "table" && isEmptyFragment(inner)) {
        return raw("");
      }
      if (VOID_TAGS.has(b.tag)) {
        return raw(`<${b.tag}${attrString(b.attrs)}>`);
      }
      return raw(`<${b.tag}${attrString(b.attrs)}>${inner}</${b.tag}>`);
    }
    default: {
      return raw("");
    }
  }
}

const SITE_NAME = "クリック２０世紀";
// 正典 URL（canonical）の生成元。デプロイ先確定後に mise.toml の [env] で設定する（未設定なら canonical は出力しない）
const SITE_ORIGIN = process.env.SITE_ORIGIN?.replace(/\/$/u, "") ?? "";
// Search Console の所有権確認 meta と GA4。いずれも公開値で、未設定なら出力しない（ビルド時 env）
const GSC_VERIFICATION = process.env.GSC_VERIFICATION ?? "";
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID ?? "";
// 告知バーに当てる Webフォントの CSS（アカウント固有・ドメインロック。未設定なら読み込まない）
const WEBFONT_CSS = process.env.WEBFONT_CSS ?? "";

// Head に入れる計測タグ。GA4 は SSG なので全ページにビルド時に焼き込む
function headExtras(): string {
  const parts: string[] = [];
  if (WEBFONT_CSS) {
    parts.push(`<link rel="stylesheet" href="${WEBFONT_CSS}">`);
  }
  if (GSC_VERIFICATION) {
    parts.push(`<meta name="google-site-verification" content="${GSC_VERIFICATION}">`);
  }
  if (GA_MEASUREMENT_ID) {
    parts.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');</script>`,
    );
  }
  return parts.join("\n");
}

function canonicalHref(path: string): string {
  if (!SITE_ORIGIN) {
    return "";
  }
  // トップの index.html は / に正規化（ディレクトリアクセスと二重に到達できるため片方を正典にする）
  const p = path === "index.html" ? "" : path;
  return `<link rel="canonical" href="${SITE_ORIGIN}/${p}">`;
}

function attr(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

// OGP / Twitter Card。SNS でリンクを共有したときのカード表示用。head のメタデータのみで本文には触れない
function ogTags(doc: PageDoc): string {
  if (!SITE_ORIGIN) {
    return "";
  }
  const url = `${SITE_ORIGIN}/${doc.path === "index.html" ? "" : doc.path}`;
  const desc = doc.description ?? "";
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${attr(SITE_NAME)}">`,
    `<meta property="og:title" content="${attr(buildTitle(doc))}">`,
    desc ? `<meta property="og:description" content="${attr(desc)}">` : "",
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta name="twitter:card" content="summary">`,
  ]
    .filter(Boolean)
    .join("\n");
}

function toHalfWidth(s: string): string {
  return s
    .replaceAll(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCodePoint((c.codePointAt(0) ?? 0) - 0xfe_e0),
    )
    .replaceAll("　", " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return s.replaceAll(/<[^>]*>/g, "").trim();
}

// SEO 用の <title> を型別テンプレートで組み立てる。画面表示（div.title 等）は原本のまま
export function buildTitle(doc: PageDoc): string {
  // 原本タイトルは「ページ名　／ 中間ラベル　／ クリック ２０世紀」形式。サイト名部分を除いて分解する
  const parts = doc.title
    .split(/\s*／\s*/)
    .map((p) => toHalfWidth(p))
    .filter((p) => p && p !== "クリック 20世紀");
  const name = parts[0] ?? "";
  const middles = parts.slice(1);

  const title2Block = doc.blocks.find((b) => b.type === "title2");
  const title2 =
    title2Block && "html" in title2Block ? toHalfWidth(stripTags(title2Block.html)) : "";

  switch (doc.type) {
    case "top": {
      return `${SITE_NAME}｜世界と日本の近現代史年表`;
    }
    case "year": {
      return title2
        ? `${name.replace(/年$/, "")}年の年表（${title2}）｜${SITE_NAME}`
        : `${name}の年表｜${SITE_NAME}`;
    }
    case "article":
    case "detail": {
      return /^\d{4}/.test(title2) ? `${name}（${title2}）｜${SITE_NAME}` : `${name}｜${SITE_NAME}`;
    }
    case "person": {
      return `${name}｜人物ファイル｜${SITE_NAME}`;
    }
    case "text": {
      return `${name}｜参考書籍｜${SITE_NAME}`;
    }
    case "person_list":
    case "text_list": {
      return `${name.replace(/\s*（(?<kana>.+?)）/u, "（$<kana>行）")}｜${SITE_NAME}`;
    }
    default: {
      return [name, ...middles, SITE_NAME].join("｜");
    }
  }
}

// パンくず（navi ブロック）と WebSite の構造化データ。SITE_ORIGIN 未設定なら出力しない
function jsonLd(doc: PageDoc): string {
  if (!SITE_ORIGIN) {
    return "";
  }
  const data: object[] = [];
  if (doc.type === "top") {
    data.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
    });
  }
  const navi = doc.blocks.find((b) => b.type === "navi");
  if (navi && "html" in navi) {
    // 「目次 ＞ 年表 ＞ 事項 ＞ 詳細」部分だけ（「／ 他」以降は対象外）
    const scope = navi.html.split("／")[0] ?? "";
    const re =
      /<a href="(?<href>[^"]+)"[^>]*>(?<label>[^<]+)<\/a>|<span class="now">(?<cur>[^<]+)<\/span>/gu;
    const items: { name: string; item: string }[] = [];
    const self = `${SITE_ORIGIN}/${doc.path === "index.html" ? "" : doc.path}`;
    for (const m of scope.matchAll(re)) {
      if (m.groups?.cur) {
        items.push({ name: m.groups.cur.trim(), item: self });
      } else if (m.groups?.href && !m.groups.href.startsWith("javascript:")) {
        const url = new URL(m.groups.href, `${SITE_ORIGIN}/${doc.path}`).href.replace(
          /\/index\.html$/u,
          "/",
        );
        items.push({ name: (m.groups.label ?? "").trim(), item: url });
      }
    }
    if (items.length >= 2) {
      data.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: it.item,
        })),
      });
    }
  }
  return data
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`)
    .join("\n");
}

function cssHref(orig: string): string {
  // 原本の相対参照をルート絶対に正規化する（例: ../all.css → /all.css、../include/include.css → /include/include.css）
  const name = orig.split("/").pop();
  return orig.includes("include/") ? `/include/${name}` : `/${name}`;
}

export function renderPage(doc: PageDoc): HtmlEscapedString | Promise<HtmlEscapedString> {
  // Base_break でテーブル単位に分割し、旧サイトのシェル構造を再現する
  const sections: { cls: string; blocks: Block[] }[] = [{ cls: doc.baseClass, blocks: [] }];
  for (const b of doc.blocks) {
    if (b.type === "base_break") {
      sections.push({ cls: b.cls, blocks: [] });
    } else {
      sections.at(-1)?.blocks.push(b);
    }
  }

  return html`<!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${buildTitle(doc)}</title>
        ${doc.description ? html`<meta name="description" content="${doc.description}" />` : ""}
        ${raw(doc.css.map((c) => `<link rel="stylesheet" href="${cssHref(c)}">`).join("\n"))}
        <link rel="stylesheet" href="/compat.css?v=${COMPAT_CSS_VERSION}" />
        ${raw(canonicalHref(doc.path))} ${raw(ogTags(doc))} ${raw(jsonLd(doc))} ${raw(headExtras())}
      </head>
      <body>
        <div class="mirror-note">
          本サイトは、閉鎖された「クリック２０世紀」（c20.jp、作者:
          taroさん）をアーカイブから復元した非公式ミラーです。 運営:
          <a href="https://x.com/ayatakaa_chan" target="_blank" rel="noopener">@ayatakaa_chan</a
          >　ソース:
          <a href="https://github.com/muranakaaa/c20jp" target="_blank" rel="noopener">GitHub</a>
        </div>
        ${raw(
          sections
            .map(
              (s) =>
                `<table role="presentation" align="center" class="${s.cls}"><tr><td>\n${s.blocks
                  .map((b) => renderBlock(b).toString())
                  .join("\n")}\n</td></tr></table>`,
            )
            .join("\n"),
        )}
      </body>
    </html>`;
}
