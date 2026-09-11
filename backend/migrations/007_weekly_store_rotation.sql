-- Weekly Cyberdeck store windows are global and fixed at Sunday 02:00 UTC.
-- source_period_id remains nullable for compatibility with rotations created by older releases.
-- Rotations from the previous period-based policy must not remain visible after
-- the weekly policy is installed; the first store read or the cron creates the
-- canonical replacement for the current window.
UPDATE store_rotations
   SET status = 'expired'
 WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS store_rotations_user_window_idx
  ON store_rotations(user_id, starts_at)
  WHERE source_period_id IS NULL;

CREATE INDEX IF NOT EXISTS store_rotations_window_status_idx
  ON store_rotations(starts_at, ends_at, status);

-- The original catalog only had two level-one definitions. These street-tier modules
-- provide enough variety for six genuinely random, immediately purchasable offers.
INSERT INTO module_definitions
  (sku, name, slot, family, rarity, price_coins, power, shield, min_level, visual_key, description)
VALUES
  ('CPU-CHROMA-LITE', 'Chroma Thread', 'cpu', 'retrowave', 'common', 180, 28, 2, 1, 'cpu-chroma-lite', 'Procesador ligero afinado para rutinas urbanas de baja latencia.'),
  ('GPU-PIXEL-DRIFT', 'Pixel Drift G1', 'gpu', 'vaporwave', 'common', 220, 36, 2, 1, 'gpu-pixel-drift', 'Núcleo gráfico compacto para telemetría y señales de neón.'),
  ('RAM-STATIC-32', 'Static Cache 32', 'ram', 'hifi_tech', 'common', 160, 24, 3, 1, 'ram-static-32', 'Memoria blindada básica con sincronización estable.'),
  ('DISPLAY-NIGHTLINE', 'Nightline Glass', 'display', 'retrowave', 'common', 190, 26, 4, 1, 'display-nightline', 'Pantalla de fósforo oscuro preparada para recorridos nocturnos.'),
  ('JAMMER-HUSH-MK1', 'Hush MK-I', 'jammer', 'synthwave', 'common', 260, 30, 5, 1, 'jammer-hush-mk1', 'Inhibidor de corto alcance para ocultar señales financieras.'),
  ('NETWORK-LATTICE-C', 'Lattice Link C', 'network', 'hifi_tech', 'common', 230, 32, 3, 1, 'network-lattice-c', 'Enlace de malla sencillo con rutas cuánticas redundantes.'),
  ('COOLING-FROSTLINE', 'Frostline Loop', 'cooling', 'vaporwave', 'common', 200, 22, 6, 1, 'cooling-frostline', 'Refrigeración asequible para mantener estables los ciclos.'),
  ('PROJECTOR-NEON-DUST', 'Neon Dust Array', 'projector', 'synthwave', 'rare', 300, 45, 2, 1, 'projector-neon-dust', 'Proyector atmosférico de partículas con una firma luminosa tenue.'),
  ('POWER-EMBER-CELL', 'Ember Cell', 'power', 'retrowave', 'rare', 330, 50, 5, 1, 'power-ember-cell', 'Celda de fusión de iniciación con reserva térmica encapsulada.')
ON CONFLICT (sku) DO UPDATE SET
  name = excluded.name,
  slot = excluded.slot,
  family = excluded.family,
  rarity = excluded.rarity,
  price_coins = excluded.price_coins,
  power = excluded.power,
  shield = excluded.shield,
  min_level = excluded.min_level,
  visual_key = excluded.visual_key,
  description = excluded.description,
  active = true;
