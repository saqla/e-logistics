# App2: 箱車シフト表（Shift Schedule Management）

このドキュメントは、App2（/shift）の最新仕様・運用・開発手順の要点を新規セッション用にまとめたものです。2025-10-27 時点の main/release 反映内容に準拠しています（アプリ版 0.7.0）。

## 概要
- 目的: 月間のシフト（上段：ルート/車番/メモ、下段：自由メモ）をスタッフ×日付で管理
- 画面:
  - 縦（portrait）: 1週間の曜日ヘッダー＋「日付行→スタッフ行×4人」を週単位で縦に連結
  - 横/PC: 同レイアウトを左、右に「連絡（Contact）＋ルート一覧（RouteDefs）」パネルを常時表示
- 連絡（Contact）: 共通/産直/江D/丸D の4グループ。本文のみ（タイトル不要）で新規/編集/削除
- ルート一覧（RouteDefs）: 6ルート（産直/ドンキ福岡/ドンキ長崎/ユニック/休み/有給）。名称と色（パレット）を編集可

## 主要エンドポイント
- GET/POST `/api/shift`
  - 保存フォーマット: `{ year, month, assignments: { day, staffId, route, carNumber, noteBL, noteBR }[] }`
  - 保存後は当月の最新 assignments を返却（互換DBではrawで取得）。フロントはこれで即時再同期
  - 空保存ガード: 既存がある月に assignments 空なら `noChange: true` を返却（データは保持）
  - 古い本番DB対応: `role` 等の拡張列が無いDBでも保存失敗しないよう raw UPDATE/INSERT にフォールバック

- GET/POST `/api/shift/contact`
  - テーブル自動作成（ensure）。本文のみ必須。カテゴリ（common/sanchoku/esaki/maruno）で4分割

- GET `/api/route-defs` ＋ PATCH `/api/route-defs/[id]`
  - テーブル自動作成（ensure）。初回GETで6ルートを自動登録（enabled=true のみ画面に反映）

- GET `/api/staff`
  - アクティブなスタッフ一覧（並び: 田中→丸山→坂下→伊藤）

## データ互換と互換対応
- 本番DBに `role` 等の拡張列が未導入のため、/api/shift の保存は以下の順で動作:
  1) 拡張列の有無をチェック
  2) あれば Prisma の upsert
  3) 無ければ raw UPDATE（無い場合は raw INSERT）
- GET は enum を text 化して返却（Prisma enum/DB enum不一致の安全化）

## 保存の挙動（重要）
- 送信前に同一キー（`day-staffId`）は「最後の編集」を採用して集約
- 保存後、APIの返却 assignments をそのまま state に反映（返却が空でローカル送信があった場合は短時間で再GETリトライ）
- 空保存ガードにより、既存データを空で上書きしない

## UIメモ
- ルート/車番/メモはセルタップで編集。ポートレートは週単位レイアウト
- 右側パネル（横/PC）は「連絡」＋「ルート一覧」。ポートレートはボトムバーの「連絡」からダイアログで開く
- 入力フィールドのモバイルズームアップ防止（16px指定）
- Dialog の aria 警告は抑止済み（`aria-describedby={undefined}`）

## 既知事象と対処状況
- Vercel 無料枠上限（`api-deployments-free-per-day`）でデプロイ/Promote不可: 解除まで待機が必要
- 以前発生した「portraitのボトム保存後に新規が消える」事象は、
  - サーバの互換保存（raw UPDATE/INSERT）と、保存後の即時再同期（返却→反映＋リトライ）で対処済み
  - それでも残らない場合は、対象セル（年月/日付/スタッフ/どのセルか）を1つ特定し、サーバ/クライアントのログと照合

## ローカル開発（Windows/Node 18+想定）
```bash
# ルート直下で
pnpm i

# Appの開発起動（ポート 3002）
pnpm --filter @e-logistics/main-app dev
```
アクセス: `http://localhost:3002/shift`

### スクリプト/設定
- パッケージ: `packages/main-app`
- Dev: `node scripts/dev-with-ip.js`
- Next: 14.x、TypeScript: 5.x、Prisma: 6.x
- 認証: NextAuth（エディタ権限: `editorVerified`）

### 環境変数（参考）
- `DATABASE_URL`（必須）
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` など（App1と同様）

## ブランチ/リリース運用
- 通常作業: `main`
- 本番: `release` に main をマージ（PR）
- Vercel 事情でデプロイ不能時は、解除後に再Promote/再デプロイ

## 主要ファイル
- UI: `packages/main-app/src/app/shift/page.tsx`
- API: `packages/main-app/src/app/api/shift/route.ts`
- 連絡: `packages/main-app/src/app/api/shift/contact/*`
- ルート一覧: `packages/main-app/src/app/api/route-defs/*`
- BottomBar: `packages/main-app/src/components/BottomBar.tsx`
- Prisma: `packages/main-app/prisma/schema.prisma`

## ルートキー
- 表示ラベル ↔ キー
  - 産直 ↔ SANCHOKU
  - ドンキ(福岡) ↔ DONKI_FUKUOKA（予定表側は ESAKI_DONKI）
  - ドンキ(長崎) ↔ DONKI_NAGASAKI（予定表側は MARUNO_DONKI）
  - ユニック ↔ UNIC / 休み ↔ OFF / 有給 ↔ PAID_LEAVE

## 今後のメンテ
- データ移行（本番DBに拡張列を導入）後は、/api/shift の Prisma 経路のみでも安定動作
- 予定表（App1）自動生成API `/api/schedule/generate-from-shift` は土台実装済み（Map.entries → Array.from 対応済）
- 見直し候補: 保存APIのバルク最適化（現行は安全性優先）

---
不明点や再現手順の共有が必要な場合は、対象の年月/日付/スタッフ/セル種別（ルート/車番/メモ）を合わせて連絡してください。

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


