// 原本フラグメント（content/ の raw HTML）を配信用に加工する規則の正本。
// Wayback 原本に忠実な content/ をそのまま保ち、公開時の加工はすべてここに集約する。
// Verify（tools/verify.ts）も同じ規則を使って原本と配信物を比較する。

// 作者への連絡導線は残さない（ミラー宛の問い合わせが本人に届いてしまうため）。
// リンクだけ剥がし、作者名などのテキストは残す
export function unwrapMailto(s: string): string {
  return s.replaceAll(/<a [^>]*href="mailto:[^"]*"[^>]*>(?<txt>[\s\S]*?)<\/a>/giu, "$<txt>");
}

// 本文中の生メールアドレスも伏せ字にする
export function maskAuthorEmails(s: string): string {
  return s.replaceAll(/uh@usleaf2001\.com|taro@c20\.jp/gu, "＊＊＊");
}

// 原本のスクリプトは AdSense・停止済みトラッキング・死んだウィジェットのみで UI に寄与しない。
// 2006年版で追加された広告・Google カスタム検索バー。すべて http 参照の混在コンテンツで、
// 本番の HTTPS 配信では動かない（検索フォームは Shift_JIS 前提で壊れている）。
// Script / Amazon ビーコン / CSE 検索フォーム / ブランディング CSS import / [PR] 広告リンクを除去する
export function stripDeadEmbeds(s: string): string {
  return s
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
    .replaceAll(/<img [^>]*assoc-amazon[^>]*>/giu, "")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
    .replaceAll(/<form[^>]*id="cse-search-box"[\s\S]*?<\/form>/giu, "")
    .replaceAll(/<div class="cse-branding-[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/giu, "")
    .replaceAll(/<a [^>]*href="https?:\/\/www\.europawatch\.jp[^"]*"[^>]*>[\s\S]*?<\/a>/giu, "");
}

// 編集残骸の壊れリンク（href"…" 等）は再直列化でゴミ属性になるため、属性なしの <a> に正規化する
// （原本でもリンクとして機能していないテキスト）
export function normalizeBrokenAnchors(s: string): string {
  return s.replaceAll(/<a [^>]*"=""[^>]*>/giu, "<a>");
}

// レイアウト用リンクグリッドの table に role="presentation" を付ける
// （スクリーンリーダー対策。年表 table.line はデータ表なので対象外）
export function markLayoutTables(s: string): string {
  return s.replaceAll(
    /<table class="(?<cls>lt|list|list2|tb|tb2)"/gu,
    '<table role="presentation" class="$<cls>"',
  );
}

// サイト内絶対リンクは href/src 属性に限ってルート相対化する（本文テキスト中の URL 表記は原本のまま）
export function relativizeInternalLinks(s: string): string {
  return s.replaceAll(
    /(?<attr>href|src)="https?:\/\/(?:www\.)?c20\.jp(?::80)?\/?/giu,
    '$<attr>="/',
  );
}

// 配信用フラグメントへの全加工
export function sanitizeFragment(s: string | null | undefined): string {
  if (!s) {
    return "";
  }
  const steps = [
    stripDeadEmbeds,
    unwrapMailto,
    normalizeBrokenAnchors,
    maskAuthorEmails,
    markLayoutTables,
    relativizeInternalLinks,
  ];
  return steps.reduce((acc, step) => step(acc), s);
}
