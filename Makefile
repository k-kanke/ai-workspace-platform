COMPOSE ?= docker compose
DB_SERVICE ?= db
DB_USER ?= app
DB_NAME ?= workspace
MIG_DIR ?= migrations
MIG_DIR_IN_CONTAINER ?= /docker-entrypoint-initdb.d

.PHONY: migrate migrate-one db-psql db-triggers db-funcs

migrate:
	@$(COMPOSE) exec -T $(DB_SERVICE) sh -lc \
	'for f in $(MIG_DIR_IN_CONTAINER)/*.sql; do \
	  echo "==> applying $$f"; \
	  psql -v ON_ERROR_STOP=1 -U $(DB_USER) -d $(DB_NAME) -f "$$f"; \
	done'

# make migrate-one FILE=migrations/xxxx.sql
migrate-one:
	@if [ -z "$(FILE)" ]; then \
	  echo "Usage: make migrate-one FILE=migrations/<file>.sql"; \
	  exit 1; \
	fi
	@$(COMPOSE) exec -T $(DB_SERVICE) sh -lc \
	'psql -v ON_ERROR_STOP=1 -U $(DB_USER) -d $(DB_NAME) -f "$(MIG_DIR_IN_CONTAINER)/$$(basename $(FILE))"'

db-psql:
	@$(COMPOSE) exec $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME)

db-triggers:
	@$(COMPOSE) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME) -c \
	"SELECT tgname FROM pg_trigger WHERE tgrelid = 'messages'::regclass;"

db-funcs:
	@$(COMPOSE) exec -T $(DB_SERVICE) psql -U $(DB_USER) -d $(DB_NAME) -c \
	"SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE proname='notify_assistant_message';"

