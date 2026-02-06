# workspaces

## Description

<details>
<summary><strong>Table Definition</strong></summary>

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

</details>

## Columns

| Name | Type | Default | Nullable | Extra Definition | Children | Parents | Comment |
| ---- | ---- | ------- | -------- | ---------------- | -------- | ------- | ------- |
| id | serial |  | false | PRIMARY KEY | [threads](threads.md), [workspace_knowledge_links](workspace_knowledge_links.md) |  | Workspace ID |
| name | text |  | false |  |  |  | Workspace name |
| system_prompt | text |  | true |  |  |  | System prompt |
| created_at | timestamptz | now() | false | DEFAULT |  |  | Created at |

## Constraints

| Name | Type | Definition |
| ---- | ---- | ---------- |
| workspaces_pkey | PRIMARY KEY | PRIMARY KEY (id) |

## Indexes

| Name | Definition |
| ---- | ---------- |
| workspaces_pkey | PRIMARY KEY (id) |

## Relations

```mermaid
erDiagram

"workspaces" ||--o{ "threads" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"workspaces" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"knowledge" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (knowledge_id) REFERENCES knowledge (id)"

"workspaces" {
  serial id PK "Workspace ID"
  text name "Workspace name"
  text system_prompt "System prompt"
  timestamptz created_at "Created at"
}
"threads" {
  serial id PK "Thread ID"
  int workspace_id FK "Workspace ID"
  text title "Thread title"
  timestamptz created_at "Created at"
}
"workspace_knowledge_links" {
  int workspace_id PK, FK "Workspace ID"
  int knowledge_id PK, FK "Knowledge ID"
  timestamptz created_at "Created at"
}
"knowledge" {
  serial id PK "Knowledge ID"
  text content "Knowledge content"
  timestamptz created_at "Created at"
  timestamptz updated_at "Updated at"
}
```

---

> Generated manually based on db/schema.sql
