# Mitsume - Trino SQL Client

Trinoに接続してSQLクエリを実行するWebベースのGUIアプリケーション。

## 機能

- SQLクエリエディタ（Monaco Editor）
- クエリ結果のテーブル表示
- CSV/TSV形式でのエクスポート
- クエリの保存・管理
- クエリ実行履歴
- ダッシュボード作成（ドラッグ&ドロップ対応）
- 多様なチャートタイプ（棒グラフ、折れ線グラフ、円グラフなど）
- ユーザー認証（パスワード認証 + Google OAuth）

## 技術スタック

### バックエンド
- Go 1.21+
- Gin (Web フレームワーク)
- PostgreSQL (メタデータ保存)
- trino-go-client (Trino接続)

### フロントエンド
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Monaco Editor (SQLエディタ)
- Apache ECharts (チャート)
- react-grid-layout (ダッシュボードレイアウト)
- Zustand (状態管理)

## セットアップ

### 必要条件

- Docker & Docker Compose
- Go 1.21+ (ローカル開発用)
- Node.js 20+ (ローカル開発用)

### Docker Composeで起動

```bash
# 環境変数ファイルをコピー
cp .env.example .env

# 起動
docker-compose up -d

# ログ確認
docker-compose logs -f
```

アプリケーションにアクセス:
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:8080
- Trino: http://localhost:8090

### ローカル開発

#### バックエンド

```bash
cd backend

# 依存関係のインストール
go mod download

# 起動
go run ./cmd/server
```

#### フロントエンド

```bash
cd frontend

# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

## 設定

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|------------|
| SERVER_PORT | サーバーポート | 8080 |
| DB_HOST | PostgreSQLホスト | localhost |
| DB_PORT | PostgreSQLポート | 5432 |
| DB_USER | PostgreSQLユーザー | mitsume |
| DB_PASSWORD | PostgreSQLパスワード | mitsume |
| DB_NAME | データベース名 | mitsume |
| TRINO_HOST | Trinoホスト | localhost |
| TRINO_PORT | Trinoポート | 8080 |
| TRINO_USER | Trinoユーザー | mitsume |
| TRINO_CATALOG | デフォルトカタログ | memory |
| TRINO_SCHEMA | デフォルトスキーマ | default |
| JWT_SECRET | JWT署名キー | (必須) |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | (任意) |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | (任意) |

### Google OAuth設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. OAuth 2.0 クライアントIDを作成
3. 承認済みリダイレクトURIに `http://localhost:8080/api/auth/google/callback` を追加
4. Client IDとClient Secretを環境変数に設定

## API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/google` - Google OAuth開始
- `GET /api/auth/google/callback` - Google OAuthコールバック
- `GET /api/auth/me` - 現在のユーザー情報

### クエリ
- `POST /api/queries/execute` - クエリ実行
- `GET /api/queries/saved` - 保存クエリ一覧
- `POST /api/queries/saved` - クエリ保存
- `PUT /api/queries/saved/:id` - クエリ更新
- `DELETE /api/queries/saved/:id` - クエリ削除
- `GET /api/queries/history` - 実行履歴

### エクスポート
- `POST /api/export/csv` - CSV形式でダウンロード
- `POST /api/export/tsv` - TSV形式でダウンロード

### ダッシュボード
- `GET /api/dashboards` - ダッシュボード一覧
- `POST /api/dashboards` - ダッシュボード作成
- `GET /api/dashboards/:id` - ダッシュボード取得
- `PUT /api/dashboards/:id` - ダッシュボード更新
- `DELETE /api/dashboards/:id` - ダッシュボード削除
- `POST /api/dashboards/:id/widgets` - ウィジェット追加
- `PUT /api/dashboards/:id/widgets/:widgetId` - ウィジェット更新
- `DELETE /api/dashboards/:id/widgets/:widgetId` - ウィジェット削除

## ライセンス

MIT
