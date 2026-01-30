# AI Workspace Platform (MVP)

## プロジェクト概要

本プロジェクトは、**同一ナレッジ・同一Agentを共有しながら、複数のAI思考空間（Workspace）を並列に実行できるAI作業基盤**を構築する。

ChatGPTのような単一会話UIではなく、

- 複数Workspaceを同時に開く
- 各Workspaceは独立した会話・実行（Run）を持つ
- 回答はストリーミング（SSE）で表示される
- AIの実行（Run）とUIイベントを分離する

という構造を採用する。

MVPでは以下を重視する：

- **並列実行できるUI体験**
- **Runベースの非同期実行モデル**
- **ローカルで動かした後、TerraformでAWSへ移植できる構成**

---

## 技術スタック（MVP）

### フロントエンド
- Next.js（TypeScript）
- SPAとして利用（SSRなし）
- 通信：
  - 通常API：fetch
  - ストリーミング：SSE（EventSource）
- ローカルでは `npm run dev`
- 本番では S3 + CloudFront に静的配信

### バックエンド API
- Go
- Echo
- 責務：
  - Workspace / Message / Run の管理
  - Run作成
  - SSEでの回答ストリーミング

### Worker
- Go（別プロセス）
- 責務：
  - DBから queued Run を取得
  - 会話履歴を元に生成処理を実行
  - 結果を逐次DBへ反映

### DB
- PostgreSQL
- MVPでは以下のテーブルのみ使用：
  - workspaces
  - messages
  - runs

### ローカル構成
- コンテナ：
  - PostgreSQL
  - API
  - Worker
- フロントはホスト起動（非コンテナ）

---

## ディレクトリ構成（Monorepo）

```

.
├── apps/
│   ├── web/            # Next.js (SPA)
│   ├── api/            # Go API (Echo + SSE)
│   └── worker/         # Go Worker (Run executor)
│
├── infra/
│   └── terraform/      # AWS (後で使用)
│
├── docs/
│   └── architecture.md # 設計メモ・図
│
├── docker-compose.yml  # ローカル開発用
├── README.md

```

---

## コアコンセプト

### Workspace
- UI上の1ペイン
- 独立した会話履歴を持つ
- 同時に複数（最大3つ）表示可能

### Run
- ユーザー入力ごとに作成される実行単位
- 状態：
  - queued
  - running
  - succeeded
  - failed
  - cancelled
- Runは非同期で Worker により処理される

### Message
- user / assistant の発言
- Workspaceに紐づく

---

## API設計（MVP）

### Run作成
```

POST /workspaces/:id/ask

```

- user message を保存
- run を `queued` 状態で作成

### ストリーム取得
```

GET /runs/:id/stream

```

- SSE
- Workerが生成したテキストを逐次送信

### 会話履歴取得
```

GET /workspaces/:id/messages

```

---

## 実装の進め方（タスクの流れ）

### Phase 1：ローカルで縦切り（最優先）

#### 1. プロジェクト土台
- ディレクトリ構成作成
- docker-compose 作成（Postgres + API + Worker）

#### 2. DBスキーマ（最小）
- workspaces
- messages
- runs

#### 3. API（Echo）
- Run作成エンドポイント
- SSEエンドポイント
- Message取得

#### 4. Worker
- queued Run を取得
- まずは **ダミー生成**（1文字ずつ遅延出力）
- assistant message をDBに保存

#### 5. フロント（Next.js SPA）
- 3列Workspace UI
- 入力欄 + 履歴表示
- SSEでのストリーム描画

この時点で **MVPの価値は完成**。

---

### Phase 2：MVPの完成度向上
- SSE ping（接続維持）
- Run cancel
- エラーハンドリング
- 会話履歴を直近20件に制限
- LLM実APIに切り替え

---

### Phase 3：AWS移植（Terraform）
- VPC
- RDS(Postgres)
- ECS(Fargate)：API / Worker
- ALB（SSE対応）
- S3 + CloudFront（SPA配信）

---

## 設計方針（重要）

- UIイベントとAI実行を分離する
- AIの処理単位は「Run」
- 並列性は Workspace × Run で表現する
- MVPでは **シンプルさ最優先**
- Knowledge / Agent の高度化は後続フェーズで追加

---

## ゴール（MVP）

- ローカルで：
  - 複数Workspaceを同時に開ける
  - 回答がストリーミング表示される
- そのままTerraformでAWSへ載せ替え可能な構造になっている

---
