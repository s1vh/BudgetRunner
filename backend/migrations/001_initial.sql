CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE transaction_type AS ENUM ('expense', 'income');
CREATE TYPE transaction_status AS ENUM ('scheduled', 'posted', 'voided');
CREATE TYPE module_family AS ENUM ('retrowave', 'synthwave', 'vaporwave', 'hifi_tech');
CREATE TYPE module_slot AS ENUM ('cpu', 'gpu', 'ram', 'display', 'expansion', 'jammer', 'network', 'cooling', 'projector', 'power');
CREATE TYPE module_rarity AS ENUM ('common', 'rare', 'epic', 'legendary', 'mythic');
CREATE TYPE module_state AS ENUM ('equipped', 'replaced', 'destroyed');
CREATE TYPE coin_entry_type AS ENUM ('budget_reward', 'purchase', 'repair', 'adjustment');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name VARCHAR(80) NOT NULL,
  avatar_url TEXT,
  primary_currency CHAR(3) NOT NULL DEFAULT 'EUR',
  locale VARCHAR(10) NOT NULL DEFAULT 'es-ES',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid',
  week_starts_on SMALLINT NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 1 AND 7),
  preferences JSONB NOT NULL DEFAULT '{"reducedMotion":false,"ambientEffects":true,"audioReactive":true,"scanlines":true,"compactMode":false}'::jsonb,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_from_id UUID REFERENCES refresh_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_sessions_user_active_idx ON refresh_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  icon_key VARCHAR(64) NOT NULL DEFAULT 'shapes',
  color_token VARCHAR(16) NOT NULL DEFAULT '#986780',
  is_system_seed BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX categories_user_name_active_idx ON categories(user_id, lower(name)) WHERE is_archived = false;

CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'posted',
  concept VARCHAR(160) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  locked_by_reward BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id)
);
CREATE INDEX financial_transactions_user_date_idx ON financial_transactions(user_id, occurred_at DESC);
CREATE INDEX financial_transactions_user_category_date_idx ON financial_transactions(user_id, category_id, occurred_at DESC);
CREATE INDEX financial_transactions_user_status_idx ON financial_transactions(user_id, status);

CREATE TABLE level_thresholds (
  level INTEGER PRIMARY KEY CHECK (level >= 1),
  required_flux INTEGER NOT NULL UNIQUE CHECK (required_flux >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE family_bonus_rules (
  minimum_count INTEGER PRIMARY KEY CHECK (minimum_count >= 2),
  bonus_percent_bp INTEGER NOT NULL CHECK (bonus_percent_bp >= 0)
);

CREATE TABLE user_progress (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_flux INTEGER NOT NULL DEFAULT 0 CHECK (base_flux >= 0),
  active_power INTEGER NOT NULL DEFAULT 0 CHECK (active_power >= 0),
  family_bonus_power INTEGER NOT NULL DEFAULT 0 CHECK (family_bonus_power >= 0),
  total_flux INTEGER NOT NULL DEFAULT 0 CHECK (total_flux >= 0),
  level INTEGER NOT NULL DEFAULT 1 REFERENCES level_thresholds(level),
  synthcoin_balance BIGINT NOT NULL DEFAULT 0 CHECK (synthcoin_balance >= 0),
  weekly_streak INTEGER NOT NULL DEFAULT 0 CHECK (weekly_streak >= 0),
  monthly_streak INTEGER NOT NULL DEFAULT 0 CHECK (monthly_streak >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  total_flux INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE module_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slot module_slot NOT NULL,
  family module_family NOT NULL,
  rarity module_rarity NOT NULL,
  price_coins BIGINT NOT NULL CHECK (price_coins > 0),
  power INTEGER NOT NULL CHECK (power >= 0),
  shield SMALLINT NOT NULL CHECK (shield BETWEEN 0 AND 10),
  min_level INTEGER NOT NULL CHECK (min_level >= 1),
  visual_key VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_module_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES module_definitions(id),
  slot module_slot NOT NULL,
  original_price_coins BIGINT NOT NULL CHECK (original_price_coins > 0),
  power_snapshot INTEGER NOT NULL CHECK (power_snapshot >= 0),
  shield_snapshot SMALLINT NOT NULL CHECK (shield_snapshot BETWEEN 0 AND 10),
  energy SMALLINT NOT NULL DEFAULT 100 CHECK (energy BETWEEN 0 AND 100),
  state module_state NOT NULL DEFAULT 'equipped',
  equipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replaced_at TIMESTAMPTZ,
  destroyed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (state <> 'destroyed' OR energy = 0)
);
CREATE UNIQUE INDEX user_module_instances_equipped_slot_idx ON user_module_instances(user_id, slot) WHERE state = 'equipped';
CREATE INDEX user_module_instances_user_state_idx ON user_module_instances(user_id, state);

CREATE TABLE store_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_period_id UUID,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  seed TEXT NOT NULL,
  user_level_snapshot INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX store_rotations_user_active_idx ON store_rotations(user_id) WHERE status = 'active';

CREATE TABLE store_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_id UUID NOT NULL REFERENCES store_rotations(id) ON DELETE CASCADE,
  module_definition_id UUID NOT NULL REFERENCES module_definitions(id),
  price_snapshot BIGINT NOT NULL CHECK (price_snapshot > 0),
  min_level_snapshot INTEGER NOT NULL CHECK (min_level_snapshot >= 1),
  expires_at TIMESTAMPTZ NOT NULL,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rotation_id, module_definition_id)
);

CREATE TABLE synthcoin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type coin_entry_type NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  period_id UUID,
  module_instance_id UUID REFERENCES user_module_instances(id),
  reference_id UUID,
  idempotency_key UUID NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX synthcoin_ledger_user_date_idx ON synthcoin_ledger(user_id, created_at DESC);

CREATE TABLE module_purchase_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES store_offers(id),
  new_instance_id UUID NOT NULL REFERENCES user_module_instances(id),
  replaced_instance_id UUID REFERENCES user_module_instances(id),
  new_price BIGINT NOT NULL,
  trade_in_value BIGINT NOT NULL,
  net_cost BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE module_repair_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_instance_id UUID NOT NULL REFERENCES user_module_instances(id),
  energy_before SMALLINT NOT NULL,
  energy_after SMALLINT NOT NULL,
  damage_percent_bp INTEGER NOT NULL,
  original_price BIGINT NOT NULL,
  repair_cost BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID,
  type TEXT NOT NULL DEFAULT 'purchase_lock',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);
CREATE INDEX budget_penalties_user_active_idx ON budget_penalties(user_id, active, ends_at);

CREATE TABLE damage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID,
  base_damage INTEGER NOT NULL CHECK (base_damage >= 0),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE module_damage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_event_id UUID NOT NULL REFERENCES damage_events(id) ON DELETE CASCADE,
  module_instance_id UUID NOT NULL REFERENCES user_module_instances(id),
  shield_snapshot SMALLINT NOT NULL,
  energy_before SMALLINT NOT NULL,
  damage_applied INTEGER NOT NULL,
  energy_after SMALLINT NOT NULL,
  destroyed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (damage_event_id, module_instance_id)
);

CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(80) NOT NULL,
  idempotency_key UUID NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, idempotency_key)
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type VARCHAR(32) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  request_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_user_date_idx ON audit_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER financial_transactions_set_updated_at BEFORE UPDATE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER module_definitions_set_updated_at BEFORE UPDATE ON module_definitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_module_instances_set_updated_at BEFORE UPDATE ON user_module_instances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
