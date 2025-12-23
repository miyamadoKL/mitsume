# MSWを活用した統合テスト実装プラン

## 概要

現在のテストは`vi.mock`で各APIを個別にモックしているため、実際のAPI呼び出しフローがテストされていない。MSW (Mock Service Worker) を活用することで、実際のHTTPリクエスト/レスポンスをインターセプトし、より現実に近い統合テストを実現する。

## 現状分析

### 既存のMSW資産
- `src/mocks/handlers.ts`: 312行の完全なAPIハンドラー定義（未活用）
- `src/mocks/server.ts`: MSWサーバー設定済み（未活用）

### 現在のテスト方式
```typescript
// 現状: vi.mockで直接モック
vi.mock('@/services/api', () => ({
  dashboardApi: { getAll: vi.fn() }
}))
```

### 目標のテスト方式
```typescript
// 目標: MSWでHTTPレベルでインターセプト
// 実際のaxios呼び出し → MSWがインターセプト → モックレスポンス返却
```

---

## 実装ステップ

### Phase 1: テストインフラ整備

#### 1.1 テストセットアップファイルの更新
**ファイル**: `src/test/setup.ts`

```typescript
import { server } from '@/mocks/server'
import { beforeAll, afterAll, afterEach } from 'vitest'

// MSWサーバーのライフサイクル管理
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

**ポイント**:
- `onUnhandledRequest: 'error'`: 未定義のAPIリクエストをエラーとして検出
- `resetHandlers()`: 各テスト後にハンドラーをリセット

#### 1.2 MSWハンドラーのbaseURL修正
**ファイル**: `src/mocks/handlers.ts`

現在のハンドラーは `http://localhost:5173/api/...` を使用しているが、テスト環境ではaxiosの`baseURL`が相対パス(`/api`)のため、MSWが正しくインターセプトできない可能性がある。

**修正案**:
```typescript
// 現状
const BASE_URL = 'http://localhost:5173'
http.post(`${BASE_URL}/api/auth/login`, ...)

// 修正後（相対パスでもマッチするように）
http.post('*/api/auth/login', ...)
// または
http.post('/api/auth/login', ...)
```

#### 1.3 統合テスト用ユーティリティ作成
**ファイル**: `src/test/integration-utils.tsx`

```typescript
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'

interface RenderAppOptions {
  initialEntries?: string[]
  initialToken?: string
}

export function renderApp(options: RenderAppOptions = {}) {
  const { initialEntries = ['/'], initialToken } = options

  if (initialToken) {
    localStorage.setItem('token', initialToken)
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  )
}

export const mockToken = 'mock-jwt-token'
```

---

### Phase 2: 統合テストファイル作成

#### 2.1 認証フロー統合テスト
**ファイル**: `src/test/integration/auth.integration.test.tsx`

**テストケース**:
| テスト名 | 説明 |
|---------|------|
| ログイン成功 → クエリページへ遷移 | 完全な認証フローをテスト |
| ログイン失敗 → エラー表示 | 無効な認証情報でのエラーハンドリング |
| 登録成功 → クエリページへ遷移 | 新規ユーザー登録フロー |
| 未認証でのページアクセス → ログインへリダイレクト | ProtectedRouteの動作確認 |
| トークン期限切れ → 自動ログアウト | 401レスポンスハンドリング |
| Google OAuth開始 | `/api/auth/google`のURLを受け取り、リンクが設定されること |
| 登録失敗 → エラー表示 | メール重複等のエラーハンドリング |
| AuthCallback処理 | OAuthコールバック時のトークン設定と遷移 |
| ログアウト → ログインページへ遷移 | ログアウトボタンクリック後の状態クリアとリダイレクト |

```typescript
describe('認証フロー統合テスト', () => {
  it('ログイン成功後、クエリページへ遷移する', async () => {
    renderApp({ initialEntries: ['/login'] })

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })
  })
})
```

#### 2.2 クエリ実行フロー統合テスト
**ファイル**: `src/test/integration/query.integration.test.tsx`

**テストケース**:
| テスト名 | 説明 |
|---------|------|
| クエリ実行 → 結果表示 | 基本的なクエリ実行フロー |
| クエリ実行 → エラー表示 | SQL構文エラー等のハンドリング |
| クエリ保存 → 保存一覧に追加 | 保存クエリCRUD |
| 保存クエリ読み込み → エディタ反映 | 保存クエリの使用 |
| CSV/TSVエクスポート | エクスポート機能 |
| カタログ/スキーマ/テーブル取得 | `/api/catalogs`系のドロップダウン表示 |
| クエリ削除 | 保存クエリの削除と一覧からの除去 |
| クエリ更新 | 保存クエリの名前・内容更新 |
| クエリ履歴表示 | `/api/queries/history`からの履歴取得と表示 |
| 空状態表示 | 保存クエリ・履歴が0件時のプレースホルダー表示 |

#### 2.3 ダッシュボードフロー統合テスト
**ファイル**: `src/test/integration/dashboard.integration.test.tsx`

**テストケース**:
| テスト名 | 説明 |
|---------|------|
| ダッシュボード一覧表示 | リスト取得と表示 |
| 新規ダッシュボード作成 → 詳細ページへ遷移 | 作成フロー |
| ウィジェット追加 | ウィジェットCRUD |
| ウィジェット削除 | グリッドから消えること |
| 保存クエリ紐付けウィジェットのデータ取得 | `getSavedById`/`execute`が呼ばれデータが描画されること |
| ダッシュボード削除 | 削除確認と実行 |
| ダッシュボード更新 | 名前・説明の変更 |
| ウィジェット更新 | チャート設定の変更 |
| ダッシュボード空状態 | ダッシュボード0件時の表示 |
| ダッシュボード404エラー | 存在しないIDへのアクセス時のエラー表示 |

#### 2.4 ナビゲーション統合テスト
**ファイル**: `src/test/integration/navigation.integration.test.tsx`

**テストケース**:
| テスト名 | 説明 |
|---------|------|
| サイドバーナビゲーション | 各ページへの遷移 |
| ブラウザバック/フォワード | 履歴管理 |
| ディープリンク | 直接URL指定でのアクセス |
| SavedQueriesのUseボタン → エディタ反映 | リンク遷移＋状態反映 |
| HistoryのUseボタン → エディタ反映 | リンク遷移＋状態反映 |

---

### Phase 3: MSWハンドラー拡張

#### 3.1 動的レスポンスハンドラー
テストケースに応じて異なるレスポンスを返す機能を追加。

**ファイル**: `src/mocks/handlers.ts` に追加

```typescript
// エラーシナリオ用ハンドラー
export const errorHandlers = {
  loginFailure: http.post('/api/auth/login', () => {
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),

  queryExecutionError: http.post('/api/queries/execute', () => {
    return HttpResponse.json({ error: 'Syntax error' }, { status: 400 })
  }),

  serverError: http.get('*', () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
  }),

  // OAuth開始用
  googleAuth: http.get('/api/auth/google', () => {
    return HttpResponse.json({ url: 'https://accounts.google.com/oauth/mock' })
  }),

  // カタログ/スキーマ/テーブル
  catalogs: http.get('/api/catalogs', () => HttpResponse.json({ catalogs: ['memory'] })),
  schemas: http.get('/api/catalogs/:catalog/schemas', () => HttpResponse.json({ schemas: ['default'] })),
  tables: http.get('/api/catalogs/:catalog/schemas/:schema/tables', () => HttpResponse.json({ tables: ['sample_table'] })),

  // 追加エラーハンドラー
  registerFailure: http.post('/api/auth/register', () => {
    return HttpResponse.json({ error: 'Email already exists' }, { status: 409 })
  }),

  dashboardNotFound: http.get('/api/dashboards/:id', () => {
    return HttpResponse.json({ error: 'Dashboard not found' }, { status: 404 })
  }),

  networkError: http.get('*', () => {
    return HttpResponse.error() // ネットワークエラーをシミュレート
  }),

  // 空データハンドラー
  emptyQueries: http.get('/api/queries/saved', () => HttpResponse.json([])),
  emptyHistory: http.get('/api/queries/history', () => HttpResponse.json([])),
  emptyDashboards: http.get('/api/dashboards', () => HttpResponse.json([])),
}
```

**テストでの使用例**:
```typescript
import { server } from '@/mocks/server'
import { errorHandlers } from '@/mocks/handlers'

it('ログイン失敗時にエラーを表示', async () => {
  server.use(errorHandlers.loginFailure)

  renderApp({ initialEntries: ['/login'] })
  // ... テスト実行
})
```

#### 3.2 レスポンス遅延シミュレーション
ローディング状態のテスト用。

```typescript
import { delay, http, HttpResponse } from 'msw'

export const slowHandlers = {
  slowLogin: http.post('/api/auth/login', async () => {
    await delay(2000)
    return HttpResponse.json({ token: mockToken, user: mockUser })
  }),

  slowQuery: http.post('/api/queries/execute', async () => {
    await delay(3000)
    return HttpResponse.json(mockQueryResult)
  }),

  slowDashboard: http.get('/api/dashboards/:id', async () => {
    await delay(2000)
    return HttpResponse.json(mockDashboards[0])
  }),
}
```

#### 3.3 ローディング状態テスト
各ページでローディングインジケータが正しく表示されることを確認。

```typescript
it('クエリ実行中はローディング表示', async () => {
  server.use(slowHandlers.slowQuery)
  renderApp({ initialEntries: ['/query'], initialToken: mockToken })

  await userEvent.click(screen.getByRole('button', { name: /execute/i }))

  expect(screen.getByRole('button', { name: /execute/i })).toBeDisabled()
  // またはスピナーの存在確認
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})
```

---

### Phase 4: 既存テストのリファクタリング（オプション）

既存の単体テストを維持しつつ、一部を統合テストに移行する選択肢。

#### 移行候補
| 現在のテスト | 移行先 | 理由 |
|------------|-------|------|
| `Login.test.tsx` の一部 | `auth.integration.test.tsx` | フォーム送信〜遷移の完全フロー |
| `Query.test.tsx` のクエリ実行 | `query.integration.test.tsx` | API呼び出し〜結果表示のフロー |

#### 維持するテスト
- Zustandストアの単体テスト（状態管理ロジック）
- ユーティリティ関数のテスト
- 純粋なUIコンポーネントのレンダリングテスト
- MSWを用いない単体テストは、回帰検出の速さを優先して維持する

---

## ファイル構成（実装後）

```
src/
├── test/
│   ├── setup.ts                    # MSWサーバー初期化追加
│   ├── integration-utils.tsx       # 新規: 統合テストユーティリティ
│   └── integration/                # 新規: 統合テストディレクトリ
│       ├── auth.integration.test.tsx
│       ├── query.integration.test.tsx
│       ├── dashboard.integration.test.tsx
│       └── navigation.integration.test.tsx
├── mocks/
│   ├── handlers.ts                 # 既存 + エラーハンドラー追加
│   └── server.ts                   # 既存（変更なし）
└── ...
```

---

## 見積もり工数

| フェーズ | タスク数 | 新規テスト数 |
|---------|---------|-------------|
| Phase 1 | 3ファイル修正/作成 | 0 |
| Phase 2 | 4ファイル作成 | 約30テスト |
| Phase 3 | 1ファイル修正 | 0 |
| Phase 4 | オプション | - |

**合計**: 約30の新規統合テスト追加

---

## 期待される効果

1. **信頼性向上**: 実際のHTTPリクエストフローをテスト
2. **リグレッション検出**: API変更時の影響を早期発見
3. **ドキュメント効果**: テストがユーザーフローの仕様書として機能
4. **既存資産活用**: 312行のMSWハンドラーを有効活用

---

## 注意事項

1. **テスト実行時間**: 統合テストは単体テストより遅い傾向がある
2. **テスト分離**: 各テストは独立して実行できるようにする
3. **LocalStorage管理**: テスト間でトークン状態を適切にクリア
4. **MSWハンドラー順序**: `server.use()`で追加したハンドラーが優先される

---

## 次のアクション

1. このプランのレビューと承認
2. Phase 1から順次実装開始
3. 各フェーズ完了後にテスト実行確認
