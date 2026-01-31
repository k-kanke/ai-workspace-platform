# DB Schema (MVP)

MVPのDBは以下3テーブルのみで構成します。

- [workspaces](workspaces.md)
- [runs](runs.md)
- [messages](messages.md)

## Quick Overview

- **workspaces**: UIの1ペイン（思考空間）を表すルート。
- **runs**: ユーザー入力ごとの実行単位。状態遷移を持つ。
- **messages**: user/assistant の発言ログ。workspaceに紐付く。

## Relations

```mermaid
erDiagram

"workspaces" ||--o{ "runs" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"workspaces" ||--o{ "messages" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"runs" ||--o{ "messages" : "FOREIGN KEY (run_id) REFERENCES runs (id)"

"workspaces" {
  serial id PK "Workspace ID"
  text name "Workspace name"
  timestamptz created_at "Created at"
}
"runs" {
  serial id PK "Run ID"
  int workspace_id FK "Workspace ID"
  text status "Run status"
  timestamptz created_at "Created at"
  timestamptz updated_at "Updated at"
}
"messages" {
  serial id PK "Message ID"
  int workspace_id FK "Workspace ID"
  int run_id FK "Run ID"
  text role "user / assistant"
  text content "Message content"
  timestamptz created_at "Created at"
}
```

## Notes

- `runs.status` は `queued / running / succeeded / failed / cancelled`
- `messages.run_id` は Run 未紐付けの履歴がある可能性に備えて nullable
- MVPではシンプル優先。将来的に `agents / knowledge / files` など追加予定
