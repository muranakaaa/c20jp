# c20.jp — クリック２０世紀 復元ミラー

「クリック２０世紀」（c20.jp、閉鎖済み）の Wayback Machine アーカイブからの復元。

世界と日本の近現代史を年表・人物紹介で再現した個人サイトで、2000年代に運営されていた。作者は taro さん（サイト表記「クリック ２０世紀 by taro」）。閉鎖後はアーカイブでしか読めない状態だったため、保存されているスナップショットから復元した。

本ミラーは元サイトと作者への敬意に基づく保存目的のもので、UI・本文には手を加えていない。技術基盤のみ現代化している（後述）。

## 構成

アーカイブの生 HTML をそのまま配信するのではなく、構造化データ + SSG に再構築している。

```
original/   Wayback Machine から取得した原本ミラー（UTF-8 変換済み。検証の基準）
content/    原本から抽出した構造化データ（1ページ = 1 JSON。ブロック列モデル）
src/        Hono アプリ（render.ts がブロック列から markup を再生成、sanitize.ts が公開時加工の正本）
public/     復元 CSS など追加アセット
tools/      download / extract / build / verify スクリプト
dist/       ビルド出力（git 管理外。Workers static assets として配信）
```

- 抽出: ページを「型付きブロックの列」として JSON 化。タイトル・ナビゲーション・年表（timeline）は構造化し、その他は raw HTML フラグメントとして忠実に保持
- ビルド: Hono の `toSSG` で全1,595ページを静的生成
- 検証: `tools/verify.ts` が原本と生成物の可視テキスト・リンク集合を全ページ比較する

## 開発環境

実行・パッケージ管理・テストは bun、ツールのバージョン固定は mise、型チェックは tsgo、lint と format は oxc（oxlint / oxfmt）。

```sh
mise install      # bun をバージョン固定で導入
bun install
bun run download   # Wayback Machine → original/（再取得時のみ）
bun run postprocess # original/ を UTF-8 化（再取得時のみ）
bun run extract   # original/ → content/
bun run build     # content/ → dist/
bun run verify    # original/ と dist/ の一致検証
bun run ci        # typecheck + test + check をまとめて実行
bun run deploy    # build + wrangler deploy
```

デプロイ先の Cloudflare アカウントは環境変数 `CLOUDFLARE_ACCOUNT_ID` で指定する。git 管理外の `mise.local.toml` に置くと mise が自動で export する。

```toml
[env]
CLOUDFLARE_ACCOUNT_ID = "<自分のアカウントID>"
```

未設定のまま `bun run deploy` すると、ログイン中アカウントへの誤デプロイを防ぐためガードが止める。

## 原本からの変更点

- 文字コードを Shift_JIS（cp932）から UTF-8 に変換（Workers の配信ヘッダーが charset=utf-8 のため）
- サイト内絶対リンク（`http://www.c20.jp/…`）をルート相対に書き換え
- スクリプトを全廃（原本にあったのは AdSense・停止済みトラッキングビーコン・死んだレコメンドウィジェット・Google カスタム検索のみで、UI に寄与しない）。Amazon アソシエイトの 1x1 トラッキングピクセルも除去
- 作者への連絡導線（mailto リンク・メールアドレス）を除去。リンクは剥がしてテキストは残し、本文中の生アドレスは伏せ字にした（ミラー宛の問い合わせが作者本人に届くのを防ぐため）
- 全ページ先頭に、復元ミラーであることと運営者（[@ayatakaa_chan](https://x.com/ayatakaa_chan)）を示す告知バーを追加
- セキュリティヘッダーを追加（`public/_headers`: HSTS・nosniff・frame-ancestors 等）。404 ページ（`public/404.html`）もミラー独自に追加
- Wayback Machine に保存されていなかった CSS 5本（`p.css` `text.css` `them.css` `p_list.css` `t_list.css`）は、現存 CSS の設計言語と class 使用状況から再構成（`public/` 配下、ファイル冒頭に復元版と明記）
- HTML5 化（doctype・meta charset・viewport。旧 `body leftmargin` は `public/compat.css` で代替）
- SEO・アクセシビリティのメタデータを追加（`<title>` の型別テンプレート・canonical・sitemap.xml・パンくずの JSON-LD・レイアウトテーブルへの `role="presentation"`）。canonical / sitemap / JSON-LD は環境変数 `SITE_ORIGIN` の設定時のみ出力される

## 復元の経緯

1. Wayback Machine の CDX API で `c20.jp` 配下の全スナップショット URL を列挙（HTTP 200 のみ、同一 URL は最新を採用）
2. 各ページを `https://web.archive.org/web/<timestamp>id_/<url>`（原本形式）で取得 → `original/`
3. 上記の抽出・再構築パイプラインで `dist/` を生成

## 権利について

コンテンツの著作権は元サイト「クリック２０世紀」の作者 taro さんに帰属する。本リポジトリは閉鎖により失われたコンテンツの保存を目的とした非営利のミラーであり、権利者からの申し出があれば速やかに削除する。
