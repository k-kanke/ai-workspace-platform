# workspaces

## Description

<details>
<summary><strong>Table Definition</strong></summary>

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

</details>

## Columns

| Name | Type | Default | Nullable | Extra Definition | Children | Parents | Comment |
| ---- | ---- | ------- | -------- | ---------------- | -------- | ------- | ------- |
| id | serial |  | false | PRIMARY KEY | [runs](runs.md), [messages](messages.md) |  | Workspace ID |
| name | text |  | false |  |  |  | Workspace name |
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

"workspaces" ||--o{ "runs" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"workspaces" ||--o{ "messages" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"

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

---

> Generated manually based on db/schema.sql
