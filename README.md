# クリック２０世紀 復元ミラー

閉鎖された個人サイト「クリック２０世紀」（旧 c20.jp）を Wayback Machine のアーカイブから復元した非公式ミラーです。

公開URL: https://c20jp.com

## 概要

世界と日本の近現代史を年表・人物紹介で再現した個人サイトで、作者は taro さんです。閉鎖後はアーカイブでしか読めない状態だったため、2006年の最終版から復元しました。UI・本文は原本のまま保ち、技術基盤だけを現代化しています。

## 技術スタック

- **言語**: TypeScript
- **配信**: Cloudflare Workers（static assets + 極小の配信 Worker）
- **サイト生成**: Hono（`toSSG` で静的化）、cheerio（原本 HTML の解析・抽出）
- **ランタイム / パッケージ管理 / テスト**: bun
- **ツールのバージョン固定**: mise
- **型チェック**: tsgo
- **lint / format**: oxc（oxlint / oxfmt）
- **CI/CD**: GitHub Actions
- **依存更新**: Renovate

## アーキテクチャ

アーカイブの生 HTML をそのまま配信するのではなく、構造化データに抽出してから静的サイトへ再生成しています。原本・中間データ・生成物をディレクトリで分離し、データが一方向に流れる構成です。

```
original/  →  content/  →  dist/
（原本）      （構造化データ）  （配信物）
```

各ディレクトリの役割は次のとおりです。

- **original/**: Wayback Machine から取得した原本ミラー。UTF-8 に変換済みで、忠実性検証の基準になります
- **content/**: 原本から抽出した構造化データ。1ページ = 1 JSON で、型付きブロックの列として保持します
- **src/**: Hono アプリ。`render.ts` が markup を再生成し、`sanitize.ts` が公開時の加工を担い、`worker.ts` が配信の入口になります
- **public/**: 復元 CSS・セキュリティヘッダー・404 ページなど、ミラー独自の追加アセット
- **tools/**: パイプラインを構成するスクリプト（download / postprocess / extract / build / verify）
- **dist/**: ビルド出力。git 管理外で、Cloudflare Workers の static assets として配信します

パイプラインは次の各段で処理します。

1. **download**: Wayback Machine の CDX API で全キャプチャを列挙し、URL ごとに最新の HTTP 200 スナップショット（大半が2021年キャプチャ = 2006年の最終状態）を取得します
2. **postprocess**: 原本の文字コードを UTF-8 に変換します
3. **extract**: 原本 HTML を型付きブロックの列（JSON）に抽出します。タイトル・ナビゲーション・年表は構造化し、その他は raw HTML フラグメントとして忠実に保持します
4. **build**: Hono の `toSSG` で全1,595ページを静的生成します
5. **verify**: 原本と生成物の可視テキスト・リンク集合を全ページ比較し、忠実性を確認します

## 開発コマンド

```sh
mise install && bun install   # bun をバージョン固定で導入し依存をインストール
bun run build                 # content/ → dist/ を生成
bun run ci                    # typecheck + test + lint をまとめて実行
bun run deploy                # Cloudflare Workers へデプロイ
```

原本を取り直すときは `bun run download` → `bun run postprocess` → `bun run extract` の順に実行します。

main への push で GitHub Actions が CI → 検証 → デプロイまで自動で行います。コミット時には git フック（`.githooks/`）がメッセージ規約と CI（typecheck + test + lint）を強制します。

## 原本からの変更点

UI・本文は原本のまま保ち、変更は「見た目に出ないメタデータ」と「現在は機能しない要素・不要な要素の除去」に限っています。公開時の加工はすべて `src/sanitize.ts` に集約し、`tools/verify.ts` が同じ規則で原本と配信物を突き合わせます。

### 文字コード・リンク

- 文字コードを Shift_JIS（cp932）から UTF-8 に変換しました。Cloudflare Workers が `charset=utf-8` のヘッダーで配信するため、原本のエンコーディングのままでは文字化けします
- サイト内の絶対リンク（`http://www.c20.jp/…`）を属性のみルート相対に書き換えました。本文テキスト中に登場する URL の表記は原本のまま残しています

### 除去した要素

- スクリプトを全廃しました。原本にあったのは AdSense・停止済みのトラッキングビーコン・レコメンドウィジェット・Google カスタム検索で、いずれも現在は動作せず UI にも寄与しません
- Amazon アソシエイトの 1×1 トラッキングピクセル、2006年版で追加された Google カスタム検索バー・[PR] 広告リンク・ホスティング会社のバナーを除去しました。いずれも `http://` 参照の混在コンテンツで、HTTPS 配信ではブラウザにブロックされます
- 作者への連絡導線（mailto リンクとメールアドレス）を除去しました。リンクは剥がしてテキスト（作者名など）は残し、本文中の生アドレスは伏せ字にしています。ミラー宛の問い合わせが作者本人に届くのを防ぐためです

### 追加した要素

- 全ページの先頭に、復元ミラーであることと運営者（[@ayatakaa_chan](https://x.com/ayatakaa_chan)）を示す告知バーを追加しました
- セキュリティヘッダー（`public/_headers`: HSTS・nosniff・frame-ancestors 等）とカスタム 404 ページを追加しました
- SEO・アクセシビリティのメタデータを追加しました。型別に組み立てた `<title>`、canonical、sitemap.xml、パンくずの JSON-LD、レイアウトテーブルへの `role="presentation"` です。GA4 と Search Console のタグも head に含みます
- Wayback Machine に保存されていなかった CSS 5本（`p.css` `text.css` `them.css` `p_list.css` `t_list.css`）を、現存する CSS の設計と class の使われ方から再構成しました
- HTML5 化（doctype・meta charset・viewport）とモバイル対応を加えました。旧 `body leftmargin` は `public/compat.css` で代替しています

## ライセンスと権利について

- ソースコード（復元パイプラインとサイト生成の仕組み。`src/` `tools/` `public/` と設定ファイル）は MIT ライセンスです。詳細は [LICENSE](LICENSE) を参照してください
- `original/` と `content/` に含まれるアーカイブ済みのサイトコンテンツの著作権は、原作者 taro さんに帰属します。これは MIT ライセンスの対象外で、失われた資料の保存のみを目的として同梱しています

本リポジトリは非営利の復元ミラーであり、権利者からの申し出があれば速やかに該当コンテンツを削除します。
