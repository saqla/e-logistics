## App2 要点サマリ（技術/運用/仕様）

この文書は `README-App1.md` をベースに、App2 の「差分」を中心に記載します。共通事項は `README-App1.md` を参照してください。

決定状況の凡例: [=] 変更なし / [*] 差分あり / [?] 検討中

### 技術スタック/構成
- [?] フレームワーク: Next.js App Router + TypeScript + TailwindCSS（App1 同等を想定／差分があれば明記）
- [?] 認証: NextAuth（社内=Credentials、編集=Google OAuth）を継承可否
- [?] DB/ORM: Prisma（PostgreSQL）継承可否（App1 同等のプレビュー差分対応を踏襲するか）
- [=] モノレポ構成: `packages/main-app` と同等構成 or `packages/app2` 新設（要決定）

### ブランチ/運用
- [=] `release`=本番（直接 push 禁止、PR 経由）、`main`=プレビューの運用方針を継承
- [?] `main -> release` のリリースフロー・バックマージ運用は App2 でも同様か
- [?] 表示/認可仕様の競合時ポリシー（App1 は display-layout を優先）

### 認証/認可仕様
- [=] 社内ログイン（Credentials）= 閲覧専用の方針を継承するか
- [=] Google 認証 = 編集可（JWT に `editorVerified`/`editorUntil`）の方針を継承するか
- [=] 個別ログアウト: クッキー `editor_disabled=1` を継承するか
- [?] 必須環境変数の差分（App1: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EDITOR_ALLOWED_EMAILS`, `EDITOR_ALLOWED_DOMAINS`, `EDITOR_DURATION_HOURS`）

### サーバー側ガード（重要）
- [*] App2 の書き込み API 一覧を定義（対象エンドポイントは App2 の機能要件に合わせる）
- [=] 認可条件（`session.editorVerified === true` かつ `editor_disabled` 不在）は継承を基本とし、差分があれば明記

### DB/Prisma の互換対応
- [=] `information_schema.columns` による列有無チェックの方針を継承するか
- [=] 列欠損時の動的 SELECT/INSERT 切替（必要に応じ `$executeRaw` で `id/createdAt/updatedAt` 明示）
- [=] サーバー側の重複排除ロジック（要件に合わせてユニーク性定義を見直し）

### UI/UX ルール（閲覧専用時）
- [=] 編集 UI の非活性/非表示ポリシー（モーダル/入力/セレクト/色変更/管理ボタン）
- [=] 上段メモの閲覧のみ、削除非表示・タップ編集不可
- [=] ボトムメニュー保存ボタンの表示条件（縦端末×閲覧専用時は非表示）
- [=] モーダル内の「保存」を「完了」に統一（混同回避）
- [*] App2 独自 UI がある場合は差分を小節で追加

### レイアウト/レスポンシブ（抜粋）
- [=] 端末別表示日数とブレークポイント（例: iPad 縦=5日、横=12日、lg=12、xl=15、2xl=20）
- [=] モバイル/タブレット縦のヘッダー構成、PC/横での右上ボタン配置
- [*] App2 固有のサイドバー/検索/ロゴ配置などがあれば差分を記載

### バージョン/表示
- [*] 初期バージョン: `0.1.0`（`SiteHeader` の VersionBadge で表示、必要に応じ短縮 SHA 付与）

### デプロイ/環境
- [=] Vercel のプレビュー/本番での挙動差と環境変数の設定
- [=] Google OAuth の承認済み URI（プレビューは安定ドメイン推奨）
- [*] App2 独自の環境変数や連携先があれば列挙

### デバッグ/保守のポイント
- [=] 認可問題の確認（JWT `editorVerified/editorUntil`、`editor_disabled`、API 側 403）
- [=] レイアウト検証（`matchMedia('(orientation: portrait)')` と幅閾値）
- [=] 保存失敗時の確認（DB スキーマ差分/ユニーク制約/重複データ/サーバー側重複排除）

### 未確定事項・要件質問（ドラフト）
- 主要ユースケース/ドメインの違い（App1 と最も異なる点は何か）
- 認証/認可の差分（閲覧専用ロールのルール変更や期間制限の有無）
- 書き込み API の一覧（エンドポイント、HTTP メソッド、入力/出力スキーマ）
- データモデルの差分（主要テーブル、ユニーク制約、下位互換の必要性）
- UI/UX の差分（新規画面、既存画面の廃止/統合、モバイル最適化）
- 連携/外部サービス（新規で必要な API、Webhook、SaaS 連携）
- セキュリティ/監査（監査ログ、IP 制限、個人情報の取り扱い）
- パフォーマンス要件（SLO、想定同時接続、データ量、スループット）
- リリース運用（プレビュー/本番の差分、フラグ制御、切替手順）
- マイグレーション（既存データ移行の有無、手順、リハーサル計画）

---
執筆メモ: 本ファイルは差分ファーストで更新し、詳細仕様は `README-App1.md` を参照します。


