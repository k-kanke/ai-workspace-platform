# DB Schema (MVP)
日本語 | [English](./README.md)

MVPのDBは以下の6テーブルで構成します。

- [workspaces](workspaces.md)
- [knowledge](knowledge.md)
- [workspace_knowledge_links](workspace_knowledge_links.md)
- [threads](threads.md)
- [runs](runs.md)
- [messages](messages.md)

## Quick Overview

- **workspaces**: UIの1ペイン（思考空間）を表すルート。
- **knowledge**: ナレッジ本文の実体（独立）。
- **workspace_knowledge_links**: ワークスペースとナレッジの紐付け（多対多）。
- **threads**: ワークスペース内の会話単位（タブ＝スレッド）。
- **runs**: スレッド内でのユーザー入力ごとの実行単位。状態遷移を持つ。
- **messages**: user/assistant の発言ログ。スレッドに紐付く（任意で run にも紐付く）。

## Relations

```mermaid
erDiagram

"workspaces" ||--o{ "threads" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"workspaces" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"knowledge" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (knowledge_id) REFERENCES knowledge (id)"
"threads" ||--o{ "runs" : "FOREIGN KEY (thread_id) REFERENCES threads (id)"
"threads" ||--o{ "messages" : "FOREIGN KEY (thread_id) REFERENCES threads (id)"
"runs" ||--o{ "messages" : "FOREIGN KEY (run_id) REFERENCES runs (id)"

"workspaces" {
  serial id PK "Workspace ID"
  text name "Workspace name"
  text system_prompt "System prompt"
  boolean llm_enabled "LLM enabled"
  timestamptz created_at "Created at"
}
"knowledge" {
  serial id PK "Knowledge ID"
  text name "Knowledge name"
  text content "Knowledge content"
  timestamptz created_at "Created at"
  timestamptz updated_at "Updated at"
}
"workspace_knowledge_links" {
  int workspace_id PK, FK "Workspace ID"
  int knowledge_id PK, FK "Knowledge ID"
  timestamptz created_at "Created at"
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
- 並列度は thread 単位（同一 thread 内は直列）
- 将来的に `agents / knowledge / files` など追加予定
