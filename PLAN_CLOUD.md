# PLAN_CLOUD.md

## 目的

ローカルで完成させたMVP（DB + API + Worker + Web）を、**TerraformでAWS上に同等構成として移植**する。  
最終的には以下を満たす：

- API/Workerは **ECS Fargate** 上で稼働
- DBは **RDS PostgreSQL**
- フロントは **S3 + CloudFront** で静的配信（Next.js SPA）
- APIは **ALB** 経由で公開（SSE対応）
- 構成は **Terraformで再現可能**（環境差分は変数で吸収）

---

## クラウド構成（MVP）

### コンポーネント一覧
- **VPC**（2AZ）
  - Public Subnet ×2（ALB / NAT）
  - Private Subnet ×2（ECS tasks / RDS）
- **NAT Gateway**（Private→Internet用：LLM APIなど）
- **Security Groups**
  - ALB SG：Internet→443（80はリダイレクト用に任意）
  - API Task SG：ALB SG→APIポートのみ
  - Worker Task SG：inbound原則なし
  - RDS SG：API/Worker SG→5432のみ
- **ECR**
  - `api` イメージ
  - `worker` イメージ
- **ECS Fargate**
  - `api-service`（ALB配下 / SSE）
  - `worker-service`（内部実行）
- **ALB**
  - `api.example.com` を想定（独自ドメインは任意）
  - SSE用に idle timeout を調整（後述）
- **RDS PostgreSQL**
  - MVPテーブル：workspaces / messages / runs
- **S3 + CloudFront**
  - `app.example.com` を想定（独自ドメインは任意）
  - SPAフォールバック：403/404 → `/index.html`
- **Secrets**
  - SSM Parameter Store or Secrets Manager（DB URL / LLM KEYなど）
- **Logs**
  - CloudWatch Logs（api/worker）

---

## ドメイン設計（任意だが推奨）
- `app.<domain>` → CloudFront
- `api.<domain>` → ALB

独自ドメインを使わない場合、CloudFront/ALBのDNS名で動作確認可能。

---

## SSE（ストリーミング）対応の注意点（必須）

### ALB
- **idle timeoutを延長**（例：300〜900秒）
- health check：`/healthz` 等の軽量エンドポイント

### アプリ側
- SSEの接続維持のため、定期的に **pingイベント** を送る（15〜30秒間隔）
- 切断時の再接続方針（EventSourceの挙動＋必要ならクライアント制御）

---

## Terraform リポジトリ構成（Monorepo内）

```

infra/terraform/
envs/
dev/
main.tf
variables.tf
terraform.tfvars
modules/
network/
iam/
ecr/
rds/
alb/
ecs_api/
ecs_worker/
cloudfront_s3/
observability/     # optional

```

---

## 変数設計（例）

- `project_name`
- `aws_region`（基本 ap-northeast-1）
- `vpc_cidr`
- `container_port`（api）
- `db_instance_class`
- `db_name`, `db_username`
- `frontend_bucket_name`
- `api_domain`, `app_domain`（任意）
- `enable_custom_domain`（true/false）
- `alb_idle_timeout_seconds`

---

## 移植の流れ（推奨順）

### Phase C1：AWS基盤（ネットワーク）
1. VPC（2AZ）
2. Public/Private Subnet
3. IGW + Route tables
4. NAT Gateway（片系でもOK）
5. Security Groups（ALB/API/Worker/RDS）

**ゴール**：ECSやRDSを置けるネットワークが出来上がる。

---

### Phase C2：永続層（RDS）
1. RDS PostgreSQL（private subnet）
2. サブネットグループ作成
3. パラメータ・バックアップ（MVPは最小）
4. 接続情報の置き場所を決める
   - Secrets Manager or SSM

**ゴール**：アプリが接続できるDBができる。

---

### Phase C3：コンテナ基盤（ECR / ECS）
1. ECR repo 作成（api/worker）
2. ECS Cluster 作成
3. CloudWatch Logs（log group）

**ゴール**：ECSタスクを起動できる状態。

---

### Phase C4：API公開（ALB + ECS API Service）
1. ALB 作成（public subnets）
2. Listener（443、必要なら80→443リダイレクト）
3. Target Group
4. Health check path
5. ECS Task Definition（api）
6. ECS Service（api：ALB紐付け）

**ゴール**：`/healthz` が外部から通り、APIが稼働する。

---

### Phase C5：Worker（ECS Worker Service）
1. ECS Task Definition（worker）
2. ECS Service（worker：ALBなし）
3. workerのスケール設計（desired count、並列度）

**ゴール**：Runが非同期に処理される。

---

### Phase C6：Frontend配信（S3 + CloudFront）
1. S3 bucket作成（静的サイト用）
2. CloudFront distribution
3. OAC（推奨）でS3を非公開化
4. SPAフォールバック
   - 403/404 → `/index.html`
5. キャッシュ戦略（MVPは最小）
6. デプロイ手順確立
   - `next build` → 静的成果物をS3へ

**ゴール**：ブラウザからUIが開き、APIに接続できる。

---

### Phase C7：運用（最小）
- CloudWatch Logsの確認
- 主要メトリクス（任意）
- 失敗時の復旧手順（最低限）

---

## CI/CD（クラウド移植後）

### API / Worker
- GitHub Actions
  - Docker build → ECR push
  - ECS service update（task definition更新）

### Web
- GitHub Actions
  - Next build/export
  - S3 sync
  - CloudFront invalidation

### Terraform
- PR：terraform plan
- main：apply（MVPは手動推奨）

---

## 受け入れ条件（クラウド移植完了の定義）

- `app` にアクセスするとSPAが表示される
- 3ペインで入力できる
- `api` が疎通できる
- SSEで回答がストリーミング表示される
- workerがrunを処理し、DBに保存される
- RDS上に run/message/workspace が永続化されている

---

## リスクと回避策（MVP）

- SSEが途中で切れる
  - ALB idle timeout延長
  - pingイベント送信
- NATなしで外部APIに出られない
  - private subnet + NATを必ず用意
- Secrets管理が雑になる
  - SSM/Secretsに統一（env直書き禁止）

---

## 今後の拡張（MVP後）
- Knowledge（pgvector）導入
- Multi-KB参照
- Suggest/Approve更新フロー
- WAF、Rate limiting
- Observability（trace/metrics）

---
