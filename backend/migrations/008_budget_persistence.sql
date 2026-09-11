-- Persisted budgets, immutable period snapshots and auditable rewards.
--
-- This migration is deliberately additive. Production previously received an
-- earlier budget prototype (005_firebase_and_budgets.sql), while a database
-- created from main does not have those objects. Every statement below is safe
-- for both histories.

DO $$ BEGIN
  CREATE TYPE budget_frequency AS ENUM ('weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE budget_scope AS ENUM ('global', 'category');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE budget_status AS ENUM ('scheduled', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE period_status AS ENUM ('open', 'processing', 'met', 'exceeded', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flux_entry_type AS ENUM ('budget_completion', 'achievement_future', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS budgets (
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
CREATE INDEX IF NOT EXISTS budgets_user_status_idx ON budgets(user_id, status, starts_on);

CREATE TABLE IF NOT EXISTS budget_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone_snapshot VARCHAR(64) NOT NULL,
  frequency_snapshot budget_frequency NOT NULL,
  scope_snapshot budget_scope NOT NULL,
  category_id_snapshot UUID,
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
  CONSTRAINT budget_periods_category_snapshot_fk
    FOREIGN KEY (category_id_snapshot, user_id) REFERENCES categories(id, user_id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at),
  CONSTRAINT budget_periods_scope_snapshot_check
    CHECK ((scope_snapshot = 'category' AND category_id_snapshot IS NOT NULL)
        OR (scope_snapshot = 'global' AND category_id_snapshot IS NULL)),
  UNIQUE (budget_id, starts_at, ends_at)
);

-- Columns absent from the production prototype become immutable snapshots.
ALTER TABLE budget_periods ADD COLUMN IF NOT EXISTS frequency_snapshot budget_frequency;
ALTER TABLE budget_periods ADD COLUMN IF NOT EXISTS scope_snapshot budget_scope;
ALTER TABLE budget_periods ADD COLUMN IF NOT EXISTS category_id_snapshot UUID;

-- Expand/contract compatibility: the production prototype does not send the
-- snapshot columns. Keep old binaries writable during migrate -> deploy and a
-- possible rollback until a future contract migration removes this trigger.
CREATE OR REPLACE FUNCTION fill_budget_period_snapshots_compat()
RETURNS TRIGGER AS $$
DECLARE
  template budgets%ROWTYPE;
BEGIN
  IF NEW.frequency_snapshot IS NULL OR NEW.scope_snapshot IS NULL THEN
    SELECT * INTO template
      FROM budgets
     WHERE id = NEW.budget_id AND user_id = NEW.user_id;
    IF FOUND THEN
      NEW.frequency_snapshot := coalesce(NEW.frequency_snapshot, template.frequency);
      NEW.scope_snapshot := coalesce(NEW.scope_snapshot, template.scope);
      IF NEW.category_id_snapshot IS NULL AND template.scope = 'category' THEN
        NEW.category_id_snapshot := template.category_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_periods_compat_snapshots ON budget_periods;
CREATE TRIGGER budget_periods_compat_snapshots
  BEFORE INSERT OR UPDATE OF budget_id, user_id, frequency_snapshot, scope_snapshot, category_id_snapshot
  ON budget_periods
  FOR EACH ROW EXECUTE FUNCTION fill_budget_period_snapshots_compat();

UPDATE budget_periods AS period
   SET frequency_snapshot = budget.frequency,
       scope_snapshot = budget.scope,
       category_id_snapshot = budget.category_id
  FROM budgets AS budget
 WHERE period.budget_id = budget.id
   AND (period.frequency_snapshot IS NULL OR period.scope_snapshot IS NULL);

ALTER TABLE budget_periods ALTER COLUMN frequency_snapshot SET NOT NULL;
ALTER TABLE budget_periods ALTER COLUMN scope_snapshot SET NOT NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_periods_category_snapshot_fk'
       AND conrelid = 'budget_periods'::regclass
       AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE budget_periods
      DROP CONSTRAINT budget_periods_category_snapshot_fk;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_periods_scope_snapshot_check'
       AND conrelid = 'budget_periods'::regclass
  ) THEN
    ALTER TABLE budget_periods
      ADD CONSTRAINT budget_periods_scope_snapshot_check
      CHECK ((scope_snapshot = 'category' AND category_id_snapshot IS NOT NULL)
          OR (scope_snapshot = 'global' AND category_id_snapshot IS NULL));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_periods_category_snapshot_fk'
       AND conrelid = 'budget_periods'::regclass
  ) THEN
    ALTER TABLE budget_periods
      ADD CONSTRAINT budget_periods_category_snapshot_fk
      FOREIGN KEY (category_id_snapshot, user_id)
      REFERENCES categories(id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS budget_periods_due_idx
  ON budget_periods(ends_at, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS budget_periods_user_date_idx
  ON budget_periods(user_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS budget_period_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  counted_minor BIGINT NOT NULL CHECK (counted_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, transaction_id)
);
CREATE INDEX IF NOT EXISTS budget_period_transactions_transaction_idx
  ON budget_period_transactions(transaction_id);

CREATE TABLE IF NOT EXISTS reward_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  allocated_minor BIGINT NOT NULL CHECK (allocated_minor > 0),
  allocation_order INTEGER NOT NULL CHECK (allocation_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, transaction_id)
);
CREATE INDEX IF NOT EXISTS reward_allocations_transaction_idx
  ON reward_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS reward_allocations_user_period_idx
  ON reward_allocations(user_id, period_id);

-- Normalize delete behavior across the fresh-main and legacy-production
-- migration histories. Account cleanup may remove source rows, while normal
-- API edits remain protected by application rules for rewarded transactions.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_period_transactions_transaction_id_fkey'
       AND conrelid = 'budget_period_transactions'::regclass
       AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE budget_period_transactions
      DROP CONSTRAINT budget_period_transactions_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_period_transactions_transaction_id_fkey'
       AND conrelid = 'budget_period_transactions'::regclass
  ) THEN
    ALTER TABLE budget_period_transactions
      ADD CONSTRAINT budget_period_transactions_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'reward_allocations_transaction_id_fkey'
       AND conrelid = 'reward_allocations'::regclass
       AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE reward_allocations
      DROP CONSTRAINT reward_allocations_transaction_id_fkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'reward_allocations_transaction_id_fkey'
       AND conrelid = 'reward_allocations'::regclass
  ) THEN
    ALTER TABLE reward_allocations
      ADD CONSTRAINT reward_allocations_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'module_damage_events_module_instance_id_fkey'
       AND conrelid = 'module_damage_events'::regclass
       AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE module_damage_events
      DROP CONSTRAINT module_damage_events_module_instance_id_fkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'module_damage_events_module_instance_id_fkey'
       AND conrelid = 'module_damage_events'::regclass
  ) THEN
    ALTER TABLE module_damage_events
      ADD CONSTRAINT module_damage_events_module_instance_id_fkey
      FOREIGN KEY (module_instance_id) REFERENCES user_module_instances(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS flux_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type flux_entry_type NOT NULL,
  amount INTEGER NOT NULL,
  base_flux_after INTEGER NOT NULL CHECK (base_flux_after >= 0),
  period_id UUID REFERENCES budget_periods(id) ON DELETE SET NULL,
  reference_id UUID,
  idempotency_key UUID NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_ledger_user_date_idx ON flux_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS job_runs (
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
CREATE INDEX IF NOT EXISTS job_runs_type_date_idx ON job_runs(job_type, started_at DESC);

-- Compensating operations preserve rewarded originals and explicitly link the
-- inverse transaction used to correct them.
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS adjusts_transaction_id UUID;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS adjustment_reason VARCHAR(500);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'financial_transactions_id_user_unique'
       AND conrelid = 'financial_transactions'::regclass
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT financial_transactions_id_user_unique UNIQUE (id, user_id);
  END IF;
END $$;

ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_adjusts_transaction_fk;
ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_adjusts_transaction_fk
  FOREIGN KEY (adjusts_transaction_id, user_id)
  REFERENCES financial_transactions(id, user_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'financial_transactions_not_self_adjustment'
       AND conrelid = 'financial_transactions'::regclass
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT financial_transactions_not_self_adjustment
      CHECK (adjusts_transaction_id IS NULL OR adjusts_transaction_id <> id);
  END IF;
END $$;

DROP INDEX IF EXISTS financial_transactions_adjustment_idx;
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_one_adjustment_idx
  ON financial_transactions(adjusts_transaction_id)
  WHERE adjusts_transaction_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'store_rotations_source_period_fk'
       AND conrelid = 'store_rotations'::regclass
  ) THEN
    ALTER TABLE store_rotations
      ADD CONSTRAINT store_rotations_source_period_fk
      FOREIGN KEY (source_period_id) REFERENCES budget_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'synthcoin_ledger_period_fk'
       AND conrelid = 'synthcoin_ledger'::regclass
  ) THEN
    ALTER TABLE synthcoin_ledger
      ADD CONSTRAINT synthcoin_ledger_period_fk
      FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_penalties_period_fk'
       AND conrelid = 'budget_penalties'::regclass
  ) THEN
    ALTER TABLE budget_penalties
      ADD CONSTRAINT budget_penalties_period_fk
      FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'damage_events_period_fk'
       AND conrelid = 'damage_events'::regclass
  ) THEN
    ALTER TABLE damage_events
      ADD CONSTRAINT damage_events_period_fk
      FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS budget_penalties_period_idx
  ON budget_penalties(period_id) WHERE period_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS damage_events_period_idx
  ON damage_events(period_id) WHERE period_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'budgets_set_updated_at' AND tgrelid = 'budgets'::regclass
  ) THEN
    CREATE TRIGGER budgets_set_updated_at
      BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'budget_periods_set_updated_at' AND tgrelid = 'budget_periods'::regclass
  ) THEN
    CREATE TRIGGER budget_periods_set_updated_at
      BEFORE UPDATE ON budget_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
