## App1 要点サマリ（技術/運用/仕様）

- **技術スタック/構成**
  - Next.js App Router + TypeScript + TailwindCSS
  - 認証: NextAuth（社内=Credentials、編集=Google OAuth）
  - DB/ORM: Prisma（PostgreSQL）。プレビューDB差分に動的対応（例: `lower_assignments.color` 列有無チェック）
  - モノレポ: `packages/main-app` が App1 本体

- **ブランチ/運用**
  - `release`: 本番（直接 push 禁止、PR 経由で反映）
  - `main`: プレビュー（基本 PR 経由）。`main -> release` へ PR、マージ後は必要に応じて `release -> main` バックマージ
  - 競合方針: 画面表示/認可の最新仕様を優先（直近は `display-layout` の挙動を採用）

- **認証/認可仕様**
  - 社内ログイン（Credentials）= 閲覧専用
  - Google 認証 = 編集可（JWT に `editorVerified` と `editorUntil` を付与）
  - クッキー `editor_disabled=1` で個別ログアウト（編集 UI 無効化・表記は「社内ユーザー」へ）
  - 必須環境変数: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EDITOR_ALLOWED_EMAILS`, `EDITOR_ALLOWED_DOMAINS`, `EDITOR_DURATION_HOURS`

- **サーバー側ガード（重要）**
  - 書き込み API はサーバーで認可判定
    - 条件: `session.editorVerified === true` かつ `editor_disabled` クッキーが無い
    - 対象: `/api/schedule` POST、`/api/remarks` POST/PATCH/DELETE、`/api/staff` POST/PATCH/DELETE

- **DB/Prisma の互換対応**
  - `information_schema.columns` で列有無を確認
  - 列欠損時は SELECT/INSERT を動的切替（必要に応じ `$executeRaw` で `id/createdAt/updatedAt` 明示）
  - サーバー側で下段重複（同日×同スタッフ）を排除

- **UI/UX ルール（閲覧専用時）**
  - モーダル/入力/セレクト/色変更/管理ボタンは反応しない/非表示
  - 上段メモ: 閲覧のみ（削除非表示・タップ編集不可）
  - ボトムメニューの保存は縦端末で編集不可時に非表示
  - モーダル内「保存」表記は混同回避のため「完了」に統一

- **レイアウト/レスポンシブ（抜粋）**
  - iPad 縦= 5 日表示、iPad 横= 12 日表示
  - lg=12 日、xl=15 日、2xl=20 日（パディング最適化）。スマホ横の低い高さも考慮
  - スマホ/タブレット縦: ヘッダーはロゴ+社名+バージョンのみ。ダッシュボード直下に「ようこそ/編集ログイン(個別ログアウト)/ログアウト」
  - PC/横: ヘッダー右に「ようこそ...」とボタン。モバイル幅の横向きでも簡易版を表示（Galaxy S5 横対策）
  - 備考（PC 右サイド）検索の下にロゴ表示（幅 50%、`object-contain` で縦横比維持）

- **バージョン/表示**
  - 現行バージョン: `0.5.0`
  - `SiteHeader` の `VersionBadge` で表示（必要に応じて短縮 SHA を付与）

- **デプロイ/環境**
  - Vercel のプレビュー/本番で挙動差あり。環境変数は Preview/Prod 双方に設定
  - Google OAuth の承認済み URI は利用ドメインに合わせ設定（プレビューは安定ドメイン推奨）

- **デバッグ/保守のポイント**
  - 認可問題: JWT の `editorVerified/editorUntil`、`editor_disabled` クッキー、API 側 403 を確認
  - レイアウト: `matchMedia('(orientation: portrait)')` と幅閾値（768/1200/1440/1536）を確認
  - 保存失敗: DB スキーマ差分/ユニーク制約/重複データ（サーバー側重複排除を確認）

以上を初回共有テンプレートとして活用してください。App2 着手時は差分ルールのみ追記すれば運用可能です。


