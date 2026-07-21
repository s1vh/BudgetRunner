CREATE TYPE budget_frequency AS ENUM ('weekly', 'monthly');
CREATE TYPE budget_scope AS ENUM ('global', 'category');
CREATE TYPE budget_status AS ENUM ('scheduled', 'active', 'paused', 'archived');
CREATE TYPE period_status AS ENUM ('open', 'processing', 'met', 'exceeded', 'closed', 'cancelled');
CREATE TYPE flux_entry_type AS ENUM ('budget_completion', 'achievement_future', 'adjustment');

ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128);
CREATE UNIQUE INDEX users_firebase_uid_idx ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  frequency budget_frequency NOT NULL,
  scope budget_scope NOT NULL,
  category_id UUID,
  limit_minor BIGINT NOT NULL CHECK (limit_minor > 0),
  currency CHAR(3) NOT NULL,
  status budget_status NOT NULL DEFAULT 'scheduled',
  starts_on DATE NOT NULL,
  timezone_snapshot VARCHAR(64) NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id),
  CHECK ((scope = 'category' AND category_id IS NOT NULL) OR (scope = 'global' AND category_id IS NULL)),
  CHECK ((status = 'archived' AND archived_at IS NOT NULL) OR status <> 'archived')
);
CREATE INDEX budgets_user_status_idx ON budgets(user_id, status, starts_on);

CREATE TABLE budget_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone_snapshot VARCHAR(64) NOT NULL,
  status period_status NOT NULL DEFAULT 'open',
  limit_minor_snapshot BIGINT NOT NULL CHECK (limit_minor_snapshot > 0),
  currency_snapshot CHAR(3) NOT NULL,
  spend_minor BIGINT NOT NULL DEFAULT 0 CHECK (spend_minor >= 0),
  surplus_minor BIGINT NOT NULL DEFAULT 0 CHECK (surplus_minor >= 0),
  eligible_surplus_minor BIGINT NOT NULL DEFAULT 0 CHECK (eligible_surplus_minor >= 0),
  excluded_reward_minor BIGINT NOT NULL DEFAULT 0 CHECK (excluded_reward_minor >= 0),
  synthcoins_awarded BIGINT NOT NULL DEFAULT 0 CHECK (synthcoins_awarded >= 0),
  flux_awarded INTEGER NOT NULL DEFAULT 0 CHECK (flux_awarded >= 0),
  excess_percent_bp INTEGER NOT NULL DEFAULT 0 CHECK (excess_percent_bp >= 0),
  base_damage INTEGER NOT NULL DEFAULT 0 CHECK (base_damage >= 0),
  evaluated_at TIMESTAMPTZ,
  idempotency_key UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (budget_id, user_id) REFERENCES budgets(id, user_id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at),
  UNIQUE (budget_id, starts_at, ends_at)
);
CREATE INDEX budget_periods_due_idx ON budget_periods(ends_at, status) WHERE status = 'open';
CREATE INDEX budget_periods_user_date_idx ON budget_periods(user_id, starts_at DESC);

CREATE TABLE budget_period_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id),
  counted_minor BIGINT NOT NULL CHECK (counted_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, transaction_id)
);
CREATE INDEX budget_period_transactions_transaction_idx ON budget_period_transactions(transaction_id);

CREATE TABLE reward_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id),
  allocated_minor BIGINT NOT NULL CHECK (allocated_minor > 0),
  allocation_order INTEGER NOT NULL CHECK (allocation_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, transaction_id)
);
CREATE INDEX reward_allocations_transaction_idx ON reward_allocations(transaction_id);
CREATE INDEX reward_allocations_user_period_idx ON reward_allocations(user_id, period_id);

CREATE TABLE flux_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type flux_entry_type NOT NULL,
  amount INTEGER NOT NULL,
  base_flux_after INTEGER NOT NULL CHECK (base_flux_after >= 0),
  period_id UUID REFERENCES budget_periods(id),
  reference_id UUID,
  idempotency_key UUID NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX flux_ledger_user_date_idx ON flux_ledger(user_id, created_at DESC);

CREATE TABLE job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(80) NOT NULL,
  scope_id UUID,
  idempotency_key UUID NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX job_runs_type_date_idx ON job_runs(job_type, started_at DESC);

ALTER TABLE store_rotations
  ADD CONSTRAINT store_rotations_source_period_fk
  FOREIGN KEY (source_period_id) REFERENCES budget_periods(id) ON DELETE SET NULL;
ALTER TABLE synthcoin_ledger
  ADD CONSTRAINT synthcoin_ledger_period_fk
  FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE SET NULL;
ALTER TABLE budget_penalties
  ADD CONSTRAINT budget_penalties_period_fk
  FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE CASCADE;
ALTER TABLE damage_events
  ADD CONSTRAINT damage_events_period_fk
  FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX budget_penalties_period_idx ON budget_penalties(period_id) WHERE period_id IS NOT NULL;
CREATE UNIQUE INDEX damage_events_period_idx ON damage_events(period_id) WHERE period_id IS NOT NULL;

CREATE TRIGGER budgets_set_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER budget_periods_set_updated_at BEFORE UPDATE ON budget_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

