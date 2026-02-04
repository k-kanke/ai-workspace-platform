# DB Schema (MVP)

MVPのDBは以下の5テーブルで構成します。

- [workspaces](workspaces.md)
- [workspace_knowledge](workspace_knowledge.md)
- [threads](threads.md)
- [runs](runs.md)
- [messages](messages.md)

## Quick Overview

- **workspaces**: UIの1ペイン（思考空間）を表すルート。
- **workspace_knowledge**: ワークスペース単位のナレッジ（1:1）。
- **threads**: ワークスペース内の会話単位（タブ＝スレッド）。
- **runs**: スレッド内でのユーザー入力ごとの実行単位。状態遷移を持つ。
- **messages**: user/assistant の発言ログ。スレッドに紐付く（任意で run にも紐付く）。

## Relations

```mermaid
erDiagram

"workspaces" ||--o{ "threads" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"workspaces" ||--o| "workspace_knowledge" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"threads" ||--o{ "runs" : "FOREIGN KEY (thread_id) REFERENCES threads (id)"
"threads" ||--o{ "messages" : "FOREIGN KEY (thread_id) REFERENCES threads (id)"
"runs" ||--o{ "messages" : "FOREIGN KEY (run_id) REFERENCES runs (id)"

"workspaces" {
  serial id PK "Workspace ID"
  text name "Workspace name"
  text system_prompt "System prompt"
  timestamptz created_at "Created at"
}
"workspace_knowledge" {
  int workspace_id PK, FK "Workspace ID"
  text content "Knowledge content"
  timestamptz updated_at "Updated at"
}
"threads" {
  serial id PK "Thread ID"
  int workspace_id FK "Workspace ID"
  text title "Thread title"
  timestamptz created_at "Created at"
}
"runs" {
  serial id PK "Run ID"
  int thread_id FK "Thread ID"
  text status "Run status"
  timestamptz created_at "Created at"
  timestamptz updated_at "Updated at"
}
"messages" {
  serial id PK "Message ID"
  int thread_id FK "Thread ID"
  int run_id FK "Run ID"
  text role "user / assistant"
  text content "Message content"
  timestamptz created_at "Created at"
}
```

## Notes

- `runs.status` は `queued / running / succeeded / failed / cancelled`
- `messages.run_id` は Run 未紐付けの履歴がある可能性に備えて nullable
- 並列度は thread 単位（同一 thread 内は直列推奨）
- MVPではシンプル優先。将来的に `agents / knowledge / files` など追加予定
