# UI_SPEC.md  
AI Workspace Platform – アプリ画面仕様（MVP）

---

## 目的

本UIは、**複数のAI思考空間（Workspace）を同時に並列実行・観測できる**ことを最優先とする。  
ChatGPTのUIをベースにしつつ、**横並び・並列・独立性**を強調する。

---

## 全体レイアウト

```

+------------------------------------------------------+
| Header                                               |
+------------------------------------------------------+
| Sidebar | Workspace Pane 1 | Pane 2 | Pane 3         |
|         |                  |        |                |
|         |                  |        |                |
|         |                  |        |                |
+------------------------------------------------------+

```

- 横スクロールは禁止
- 最大 **3 Workspace ペイン**
- 画面幅に応じて Pane 数を制限（MVPでは3固定でOK）

---

## Header（上部固定）

### 役割
- アプリ全体のコンテキスト
- グローバル操作の入口

### 要素
- アプリ名（左）
- ユーザー情報 or API Key状態（右・MVPでは省略可）
- 将来用：
  - 設定
  - ログアウト

---

## Sidebar（左ナビゲーション）

### 役割
- 管理系・切り替え系UIを集約
- Workspaceとは独立した操作

### 構成

#### 1. Workspace 管理
- 「New Workspace」ボタン
- Workspace一覧（クリックでアクティブ化）
  - 現在開いているWorkspaceはハイライト
- 最大3つまで同時オープン

#### 2. Agent 選択（MVPでは簡易）
- 現在のAgent名を表示
- MVPでは固定AgentでもOK
- 将来：Agent切替UI

#### 3. Knowledge 管理（MVPでは表示のみ）
- Knowledge一覧
- クリックで「Knowledge詳細画面」へ遷移
- MVPでは閲覧のみ

---

## Workspace Pane（中央〜右）

### 役割
- **1ペイン = 1思考空間**
- 他のペインと完全に独立

### 構成（縦構造）

```

+-----------------------------+
| Workspace Header            |
+-----------------------------+
| Message List (scroll)       |
|                             |
|                             |
+-----------------------------+
| Prompt Input                |
+-----------------------------+

```

---

### Workspace Header

#### 表示内容
- Workspace名（例：`Workspace A`）
- 状態表示
  - idle
  - running
  - queued
  - error
- Close（×）ボタン

#### 意図
- 並列実行中であることを視覚的に示す
- 「今どれが動いているか」を一瞬で分かるようにする

---

### Message List（会話表示）

#### 役割
- user / assistant の会話履歴を時系列表示
- ストリーミング表示対応

#### 表示ルール
- user：
  - 右寄せ or 明確に区別
- assistant：
  - 左寄せ
  - ストリーミング中は「生成中」状態を表示
- スクロール：
  - 下固定（新規メッセージ追従）
  - 過去ログは上にスクロール可能

#### ストリーミング挙動（重要）
- SSEで受信したテキストを **逐次 append**
- 完了まで 1メッセージとして扱う
- 接続中断時：
  - 「reconnecting...」表示（MVPでは簡易）

---

### Prompt Input（下部固定）

#### 要素
- テキストエリア
- Send ボタン
- Enter送信（Shift+Enterで改行）

#### 挙動
- 送信時：
  - 入力欄をクリア
  - 即座に user message を表示
  - Run 作成APIを呼ぶ
  - SSE接続を開始
- 実行中：
  - 送信ボタンを disable（または cancel に変化）

---

## Knowledge 画面（MVP後半 or 将来）

### URL例
- `/knowledge`
- `/knowledge/:id`

### 表示内容
- Knowledge名
- Document一覧
- 更新日時
- 参照中Workspace数（将来）

※ MVPでは詳細編集は不要。  
「存在が分かる」「参照できる」だけでOK。

---

## UI状態管理（重要）

### フロント側で保持する状態
- 開いている Workspace ID 配列（最大3）
- Workspaceごとの
  - messages
  - run_id
  - run_status
- SSE接続状態

### URLとの関係
- MVPでは **URLにWorkspace IDを入れなくてよい**
- 画面状態は完全にクライアント管理

---

## MVPに含めないもの（明示）
- 認証UI
- Agent編集UI
- Knowledge編集UI
- 権限管理UI
- OGP / SEO

---

## UI設計の思想（コーディングエージェント向け）

- Workspaceは「チャット」ではなく「思考単位」
- 並列性を最優先で可視化する
- UIは **状態の可視化装置**
- API / Run / SSE の存在を前提に設計する
- 単一チャットUIに寄せすぎない

---

## MVP完成条件（UI視点）

- 3つのWorkspaceを同時に開ける
- 各Workspaceで独立して入力・実行できる
- 回答がストリーミング表示される
- どのWorkspaceが動いているか分かる
- UIが詰まらず、並列実行できることが体感できる


---
