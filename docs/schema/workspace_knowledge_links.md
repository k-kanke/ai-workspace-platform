# workspace_knowledge_links

## Description

<details>
<summary><strong>Table Definition</strong></summary>

```sql
CREATE TABLE IF NOT EXISTS workspace_knowledge_links (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, knowledge_id)
);
```

</details>

## Columns

| Name | Type | Default | Nullable | Extra Definition | Children | Parents | Comment |
| ---- | ---- | ------- | -------- | ---------------- | -------- | ------- | ------- |
| workspace_id | integer |  | false | PRIMARY KEY |  | [workspaces](workspaces.md) | Workspace ID |
| knowledge_id | integer |  | false | PRIMARY KEY |  | [knowledge](knowledge.md) | Knowledge ID |
| created_at | timestamptz | now() | false | DEFAULT |  |  | Created at |

## Constraints

| Name | Type | Definition |
| ---- | ---- | ---------- |
| workspace_knowledge_links_pkey | PRIMARY KEY | PRIMARY KEY (workspace_id, knowledge_id) |
| workspace_knowledge_links_workspace_id_fkey | FOREIGN KEY | FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE |
| workspace_knowledge_links_knowledge_id_fkey | FOREIGN KEY | FOREIGN KEY (knowledge_id) REFERENCES knowledge(id) ON DELETE CASCADE |

## Indexes

| Name | Definition |
| ---- | ---------- |
| workspace_knowledge_links_pkey | PRIMARY KEY (workspace_id, knowledge_id) |
| idx_workspace_knowledge_links_workspace_id | (workspace_id) |
| idx_workspace_knowledge_links_knowledge_id | (knowledge_id) |

## Relations

```mermaid
erDiagram

"workspaces" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (workspace_id) REFERENCES workspaces (id)"
"knowledge" ||--o{ "workspace_knowledge_links" : "FOREIGN KEY (knowledge_id) REFERENCES knowledge (id)"

"workspace_knowledge_links" {
  int workspace_id PK, FK "Workspace ID"
  int knowledge_id PK, FK "Knowledge ID"
  timestamptz created_at "Created at"
}
"workspaces" {
  serial id PK "Workspace ID"
  text name "Workspace name"
  text system_prompt "System prompt"
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
