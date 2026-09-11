-- Enforce tenant ownership through every BR-BL-005 economic relationship.
-- The redundant user_id columns make cross-user links impossible even for
-- direct SQL writes, while preserving the intended parent delete behavior.

-- Legacy releases accepted arbitrary timezone strings. Calendar-aware reads
-- require an IANA name, so retain the account and fall back safely to UTC.
UPDATE users AS owner
   SET timezone = 'UTC'
 WHERE NOT EXISTS (
   SELECT 1
     FROM pg_timezone_names AS timezone
    WHERE timezone.name = owner.timezone
 );

UPDATE budgets AS budget
   SET timezone_snapshot = 'UTC'
 WHERE NOT EXISTS (
   SELECT 1
     FROM pg_timezone_names AS timezone
    WHERE timezone.name = budget.timezone_snapshot
 );

UPDATE budget_periods AS period
   SET timezone_snapshot = 'UTC'
 WHERE NOT EXISTS (
   SELECT 1
     FROM pg_timezone_names AS timezone
    WHERE timezone.name = period.timezone_snapshot
 );

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budget_periods_id_user_unique'
       AND conrelid = 'budget_periods'::regclass
  ) THEN
    ALTER TABLE budget_periods
      ADD CONSTRAINT budget_periods_id_user_unique UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_module_instances_id_user_unique'
       AND conrelid = 'user_module_instances'::regclass
  ) THEN
    ALTER TABLE user_module_instances
      ADD CONSTRAINT user_module_instances_id_user_unique UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'damage_events_id_user_unique'
       AND conrelid = 'damage_events'::regclass
  ) THEN
    ALTER TABLE damage_events
      ADD CONSTRAINT damage_events_id_user_unique UNIQUE (id, user_id);
  END IF;
END $$;

-- A category snapshot is immutable history. Deleting the category must never
-- erase its periods; the application archives referenced categories instead.
ALTER TABLE budget_periods
  DROP CONSTRAINT IF EXISTS budget_periods_category_snapshot_fk;
ALTER TABLE budget_periods
  ADD CONSTRAINT budget_periods_category_snapshot_fk
  FOREIGN KEY (category_id_snapshot, user_id)
  REFERENCES categories(id, user_id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS source_transaction_id UUID;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS type_snapshot transaction_type;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS concept_snapshot VARCHAR(160);
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS amount_minor_snapshot BIGINT;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS currency_snapshot CHAR(3);
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS occurred_at_snapshot TIMESTAMPTZ;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS category_id_snapshot UUID;
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS category_name_snapshot VARCHAR(80);
ALTER TABLE budget_period_transactions ADD COLUMN IF NOT EXISTS adjusts_transaction_id_snapshot UUID;

-- The pre-BR-BL-005 backend only sends period_id, transaction_id and
-- counted_minor. Fill the expanded immutable record for rolling deploys and
-- rollback compatibility; ownership constraints still reject mismatches.
CREATE OR REPLACE FUNCTION fill_budget_period_transaction_compat()
RETURNS TRIGGER AS $$
DECLARE
  source_user_id UUID;
  source_id UUID;
  source_type transaction_type;
  source_concept VARCHAR(160);
  source_amount BIGINT;
  source_currency CHAR(3);
  source_occurred_at TIMESTAMPTZ;
  source_category_id UUID;
  source_category_name VARCHAR(80);
  source_adjusts_id UUID;
BEGIN
  SELECT period.user_id,
         source_tx.id,
         source_tx.type,
         source_tx.concept,
         source_tx.amount_minor,
         source_tx.currency,
         source_tx.occurred_at,
         source_tx.category_id,
         category.name,
         source_tx.adjusts_transaction_id
    INTO source_user_id,
         source_id,
         source_type,
         source_concept,
         source_amount,
         source_currency,
         source_occurred_at,
         source_category_id,
         source_category_name,
         source_adjusts_id
    FROM budget_periods AS period
    JOIN financial_transactions AS source_tx
      ON source_tx.id = NEW.transaction_id AND source_tx.user_id = period.user_id
    LEFT JOIN categories AS category
      ON category.id = source_tx.category_id AND category.user_id = source_tx.user_id
   WHERE period.id = NEW.period_id;

  IF FOUND THEN
    NEW.user_id := coalesce(NEW.user_id, source_user_id);
    NEW.source_transaction_id := coalesce(NEW.source_transaction_id, source_id);
    NEW.type_snapshot := coalesce(NEW.type_snapshot, source_type);
    NEW.concept_snapshot := coalesce(NEW.concept_snapshot, source_concept);
    NEW.amount_minor_snapshot := coalesce(NEW.amount_minor_snapshot, source_amount);
    NEW.currency_snapshot := coalesce(NEW.currency_snapshot, source_currency);
    NEW.occurred_at_snapshot := coalesce(NEW.occurred_at_snapshot, source_occurred_at);
    NEW.category_id_snapshot := coalesce(NEW.category_id_snapshot, source_category_id);
    NEW.category_name_snapshot := coalesce(NEW.category_name_snapshot, source_category_name);
    NEW.adjusts_transaction_id_snapshot := coalesce(NEW.adjusts_transaction_id_snapshot, source_adjusts_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_period_transactions_compat_snapshot ON budget_period_transactions;
CREATE TRIGGER budget_period_transactions_compat_snapshot
  BEFORE INSERT ON budget_period_transactions
  FOR EACH ROW EXECUTE FUNCTION fill_budget_period_transaction_compat();

UPDATE budget_period_transactions AS snapshot
   SET user_id = period.user_id,
       source_transaction_id = tx.id,
       type_snapshot = tx.type,
       concept_snapshot = tx.concept,
       amount_minor_snapshot = snapshot.counted_minor,
       currency_snapshot = tx.currency,
       occurred_at_snapshot = tx.occurred_at,
       category_id_snapshot = tx.category_id,
       category_name_snapshot = category.name,
       adjusts_transaction_id_snapshot = tx.adjusts_transaction_id
  FROM budget_periods AS period,
       financial_transactions AS tx
  LEFT JOIN categories AS category
    ON category.id = tx.category_id AND category.user_id = tx.user_id
 WHERE snapshot.period_id = period.id
   AND snapshot.transaction_id = tx.id
   AND (snapshot.user_id IS NULL OR snapshot.source_transaction_id IS NULL);
ALTER TABLE budget_period_transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN source_transaction_id SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN type_snapshot SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN concept_snapshot SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN amount_minor_snapshot SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN currency_snapshot SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN occurred_at_snapshot SET NOT NULL;
ALTER TABLE budget_period_transactions ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE budget_period_transactions
  DROP CONSTRAINT IF EXISTS budget_period_transactions_period_id_fkey;
ALTER TABLE budget_period_transactions
  DROP CONSTRAINT IF EXISTS budget_period_transactions_transaction_id_fkey;
ALTER TABLE budget_period_transactions
  DROP CONSTRAINT IF EXISTS budget_period_transactions_period_owner_fk;
ALTER TABLE budget_period_transactions
  DROP CONSTRAINT IF EXISTS budget_period_transactions_transaction_owner_fk;
ALTER TABLE budget_period_transactions
  ADD CONSTRAINT budget_period_transactions_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id) ON DELETE CASCADE;
ALTER TABLE budget_period_transactions
  ADD CONSTRAINT budget_period_transactions_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES financial_transactions(id, user_id)
  ON DELETE SET NULL (transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS budget_period_transactions_source_idx
  ON budget_period_transactions(period_id, source_transaction_id);
CREATE INDEX IF NOT EXISTS budget_period_transactions_user_idx
  ON budget_period_transactions(user_id, period_id);

ALTER TABLE reward_allocations
  DROP CONSTRAINT IF EXISTS reward_allocations_period_id_fkey;
ALTER TABLE reward_allocations
  DROP CONSTRAINT IF EXISTS reward_allocations_transaction_id_fkey;
ALTER TABLE reward_allocations
  DROP CONSTRAINT IF EXISTS reward_allocations_period_owner_fk;
ALTER TABLE reward_allocations
  DROP CONSTRAINT IF EXISTS reward_allocations_transaction_owner_fk;
ALTER TABLE reward_allocations
  ADD CONSTRAINT reward_allocations_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id) ON DELETE CASCADE;
ALTER TABLE reward_allocations
  ADD CONSTRAINT reward_allocations_transaction_owner_fk
  FOREIGN KEY (transaction_id, user_id)
  REFERENCES financial_transactions(id, user_id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE store_rotations
  DROP CONSTRAINT IF EXISTS store_rotations_source_period_fk;
ALTER TABLE store_rotations
  DROP CONSTRAINT IF EXISTS store_rotations_source_period_owner_fk;
ALTER TABLE store_rotations
  ADD CONSTRAINT store_rotations_source_period_owner_fk
  FOREIGN KEY (source_period_id, user_id)
  REFERENCES budget_periods(id, user_id)
  ON DELETE SET NULL (source_period_id);

ALTER TABLE synthcoin_ledger
  DROP CONSTRAINT IF EXISTS synthcoin_ledger_period_fk;
ALTER TABLE synthcoin_ledger
  DROP CONSTRAINT IF EXISTS synthcoin_ledger_period_owner_fk;
ALTER TABLE synthcoin_ledger
  ADD CONSTRAINT synthcoin_ledger_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id)
  ON DELETE SET NULL (period_id);

ALTER TABLE flux_ledger
  DROP CONSTRAINT IF EXISTS flux_ledger_period_id_fkey;
ALTER TABLE flux_ledger
  DROP CONSTRAINT IF EXISTS flux_ledger_period_fk;
ALTER TABLE flux_ledger
  DROP CONSTRAINT IF EXISTS flux_ledger_period_owner_fk;
ALTER TABLE flux_ledger
  ADD CONSTRAINT flux_ledger_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id)
  ON DELETE SET NULL (period_id);

ALTER TABLE budget_penalties
  DROP CONSTRAINT IF EXISTS budget_penalties_period_fk;
ALTER TABLE budget_penalties
  DROP CONSTRAINT IF EXISTS budget_penalties_period_owner_fk;
ALTER TABLE budget_penalties
  ADD CONSTRAINT budget_penalties_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id) ON DELETE CASCADE;

ALTER TABLE damage_events
  DROP CONSTRAINT IF EXISTS damage_events_period_fk;
ALTER TABLE damage_events
  DROP CONSTRAINT IF EXISTS damage_events_period_owner_fk;
ALTER TABLE damage_events
  ADD CONSTRAINT damage_events_period_owner_fk
  FOREIGN KEY (period_id, user_id)
  REFERENCES budget_periods(id, user_id) ON DELETE CASCADE;

ALTER TABLE module_damage_events ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE OR REPLACE FUNCTION fill_module_damage_owner_compat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
      FROM damage_events
     WHERE id = NEW.damage_event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS module_damage_events_compat_owner ON module_damage_events;
CREATE TRIGGER module_damage_events_compat_owner
  BEFORE INSERT ON module_damage_events
  FOR EACH ROW EXECUTE FUNCTION fill_module_damage_owner_compat();

UPDATE module_damage_events AS detail
   SET user_id = damage.user_id
  FROM damage_events AS damage
 WHERE detail.damage_event_id = damage.id
   AND detail.user_id IS NULL;
ALTER TABLE module_damage_events ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE module_damage_events
  DROP CONSTRAINT IF EXISTS module_damage_events_damage_event_id_fkey;
ALTER TABLE module_damage_events
  DROP CONSTRAINT IF EXISTS module_damage_events_module_instance_id_fkey;
ALTER TABLE module_damage_events
  DROP CONSTRAINT IF EXISTS module_damage_events_damage_owner_fk;
ALTER TABLE module_damage_events
  DROP CONSTRAINT IF EXISTS module_damage_events_module_owner_fk;
ALTER TABLE module_damage_events
  ADD CONSTRAINT module_damage_events_damage_owner_fk
  FOREIGN KEY (damage_event_id, user_id)
  REFERENCES damage_events(id, user_id) ON DELETE CASCADE;
ALTER TABLE module_damage_events
  ADD CONSTRAINT module_damage_events_module_owner_fk
  FOREIGN KEY (module_instance_id, user_id)
  REFERENCES user_module_instances(id, user_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS module_damage_events_user_idx
  ON module_damage_events(user_id, damage_event_id);
