# Budget Runner — Modelo de datos PostgreSQL

## 1. Principios

- PostgreSQL es la fuente de verdad.
- Identificadores UUID.
- Importes monetarios en unidades menores enteras (`BIGINT`).
- Tiempos en UTC (`TIMESTAMPTZ`).
- Toda tabla propiedad del usuario incluye `user_id` e índices compuestos.
- La economía se modifica mediante transacciones SQL y ledger inmutable.
- Las claves idempotentes impiden repetir cierres, compras, reparaciones o daño.
- Se recomienda usar migraciones versionadas y seeds para catálogo, niveles y datos demo.

## 2. Enumeraciones

- `transaction_type`: `expense`, `income`
- `transaction_status`: `scheduled`, `posted`, `voided`
- `budget_frequency`: `weekly`, `monthly`
- `budget_scope`: `global`, `category`
- `budget_status`: `scheduled`, `active`, `paused`, `archived`
- `period_status`: `open`, `processing`, `met`, `exceeded`, `closed`, `cancelled`
- `module_family`: `retrowave`, `synthwave`, `vaporwave`, `hifi_tech`
- `module_slot`: `cpu`, `gpu`, `ram`, `display`, `expansion`, `jammer`, `network`, `cooling`, `projector`, `power`
- `module_rarity`: `common`, `rare`, `epic`, `legendary`, `mythic`
- `module_state`: `equipped`, `replaced`, `destroyed`
- `coin_entry_type`: `budget_reward`, `purchase`, `repair`, `adjustment`
- `flux_entry_type`: `budget_completion`, `achievement_future`, `adjustment`
- `penalty_type`: `purchase_lock`
- `audit_action`: texto controlado por servicio

## 3. Tablas de identidad

### `users`

| Campo | Tipo | Regla |
|---|---|---|
| id | UUID PK | |
| email | CITEXT UNIQUE | normalizado |
| password_hash | TEXT NULL | nulo en cuenta solo Google |
| display_name | VARCHAR(80) | |
| avatar_url | TEXT NULL | |
| primary_currency | CHAR(3) | ISO 4217 |
| locale | VARCHAR(10) | uno de `es-ES`, `en-US`, `fr-FR`, `de-DE`, `ru-RU`, `zh-CN`, `ja-JP`, `ko-KR`; por defecto `en-US` |
| timezone | VARCHAR(64) | IANA |
| week_starts_on | SMALLINT | 1–7 |
| preferences | JSONB | preferencias de interfaz; `helpHints` vale `true` por defecto |
| email_verified_at | TIMESTAMPTZ NULL | |
| guided_tour_completed_at | TIMESTAMPTZ NULL | primera finalización o abandono del tour; `NULL` significa pendiente |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ NULL | soft delete |

### `oauth_accounts`

`id`, `user_id`, `provider`, `provider_subject`, `email`, `created_at`.  
Único: `(provider, provider_subject)`.

### `refresh_sessions`

`id`, `user_id`, `token_hash`, `user_agent`, `ip_hash`, `expires_at`, `revoked_at`, `created_at`, `rotated_from_id`.

### `password_reset_tokens`

`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`.

## 4. Finanzas

### `categories`

`id`, `user_id`, `name`, `icon_key`, `color_token`, `is_system_seed`, `is_archived`, `created_at`, `updated_at`.

Único parcial recomendado: `(user_id, lower(name)) WHERE is_archived = false`.

### `financial_transactions`

| Campo | Tipo |
|---|---|
| id | UUID PK |
| user_id | UUID FK |
| category_id | UUID FK NULL |
| type | transaction_type |
| status | transaction_status |
| concept | VARCHAR(160) |
| amount_minor | BIGINT CHECK > 0 |
| currency | CHAR(3) |
| occurred_at | TIMESTAMPTZ |
| notes | TEXT NULL |
| locked_by_reward | BOOLEAN DEFAULT false |
| created_at / updated_at | TIMESTAMPTZ |

Índices: `(user_id, occurred_at DESC)`, `(user_id, category_id, occurred_at)`, `(user_id, status)`.

## 5. Presupuestos y periodos

### `budgets`

`id`, `user_id`, `name`, `frequency`, `scope`, `category_id NULL`, `limit_minor`, `currency`, `status`, `starts_on`, `timezone_snapshot`, `created_at`, `updated_at`, `archived_at`.

Checks:

- `scope = category` requiere `category_id`.
- `scope = global` requiere `category_id IS NULL`.
- `limit_minor > 0`.

### `budget_periods`

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| budget_id | UUID FK | |
| user_id | UUID FK | redundante para aislamiento e índices |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | extremo exclusivo |
| status | period_status | |
| limit_minor_snapshot | BIGINT | |
| currency_snapshot | CHAR(3) | |
| spend_minor | BIGINT DEFAULT 0 | snapshot de evaluación |
| surplus_minor | BIGINT DEFAULT 0 | |
| eligible_surplus_minor | BIGINT DEFAULT 0 | tras deduplicación |
| synthcoins_awarded | BIGINT DEFAULT 0 | |
| flux_awarded | INTEGER DEFAULT 0 | |
| excess_percent_bp | INTEGER DEFAULT 0 | puntos básicos |
| base_damage | INTEGER DEFAULT 0 | |
| evaluated_at | TIMESTAMPTZ NULL | |
| idempotency_key | UUID UNIQUE | |
| created_at / updated_at | TIMESTAMPTZ | |

Único: `(budget_id, starts_at, ends_at)`.

### `budget_period_transactions`

Snapshot de contribución:

`id`, `period_id`, `transaction_id`, `counted_minor`, `created_at`.  
Único: `(period_id, transaction_id)`.

### `reward_allocations`

Evita doble recompensa:

`id`, `user_id`, `period_id`, `transaction_id`, `allocated_minor`, `allocation_order`, `created_at`.

La suma de `allocated_minor` por transacción nunca debe superar el importe elegible de esa transacción. Aplicar bloqueo de filas durante el cierre.

### `budget_penalties`

`id`, `user_id`, `period_id`, `type`, `starts_at`, `ends_at`, `active`, `created_at`, `released_at`.

Índice: `(user_id, active, ends_at)`.

## 6. Economía y progreso

### `user_progress`

Una fila por usuario:

`user_id PK`, `base_flux`, `active_power`, `family_bonus_power`, `total_flux`, `level`, `synthcoin_balance`, `weekly_streak`, `monthly_streak`, `updated_at`.

Esta tabla es una proyección de lectura rápida. Los ledgers son la fuente auditable.

### `synthcoin_ledger`

| Campo | Tipo |
|---|---|
| id | UUID PK |
| user_id | UUID FK |
| type | coin_entry_type |
| amount | BIGINT | positivo o negativo |
| balance_after | BIGINT CHECK >= 0 |
| period_id | UUID NULL |
| module_instance_id | UUID NULL |
| reference_id | UUID NULL |
| idempotency_key | UUID UNIQUE |
| metadata | JSONB |
| created_at | TIMESTAMPTZ |

### `flux_ledger`

Solo para Flux base persistente:

`id`, `user_id`, `type`, `amount`, `base_flux_after`, `period_id`, `reference_id`, `idempotency_key UNIQUE`, `metadata JSONB`, `created_at`.

Power y bonus no se insertan como Flux base; se recalculan.

### `level_thresholds`

`level PK`, `required_flux UNIQUE`, `created_at`.  
Seed inicial: 1→0, 2→100, 3→250, 4→450 y progresión configurable.

### `level_history`

`id`, `user_id`, `old_level`, `new_level`, `total_flux`, `reason`, `reference_id`, `created_at`.

## 7. Catálogo y cyberdeck

### `module_definitions`

Catálogo global:

| Campo | Tipo |
|---|---|
| id | UUID PK |
| sku | VARCHAR(64) UNIQUE |
| name | VARCHAR(100) |
| slot | module_slot |
| family | module_family |
| rarity | module_rarity |
| price_coins | BIGINT CHECK > 0 |
| power | INTEGER CHECK >= 0 |
| shield | SMALLINT CHECK BETWEEN 0 AND 10 |
| min_level | INTEGER CHECK >= 1 |
| visual_key | VARCHAR(80) |
| description | TEXT |
| active | BOOLEAN |
| created_at / updated_at | TIMESTAMPTZ |

### `user_module_instances`

| Campo | Tipo | Regla |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| definition_id | UUID FK | |
| slot | module_slot | snapshot |
| original_price_coins | BIGINT | snapshot |
| power_snapshot | INTEGER | |
| shield_snapshot | SMALLINT | |
| energy | SMALLINT CHECK BETWEEN 0 AND 100 | empieza 100 |
| state | module_state | |
| equipped_at | TIMESTAMPTZ | |
| replaced_at | TIMESTAMPTZ NULL | |
| destroyed_at | TIMESTAMPTZ NULL | |
| created_at / updated_at | TIMESTAMPTZ | |

Índice único parcial: `(user_id, slot) WHERE state = 'equipped'`.

### `store_rotations`

`id`, `user_id`, `source_period_id`, `starts_at`, `ends_at`, `seed`, `user_level_snapshot`, `status`, `created_at`.

### `store_offers`

`id`, `rotation_id`, `module_definition_id`, `price_snapshot`, `min_level_snapshot`, `expires_at`, `purchased_at`, `created_at`.

No se exige una oferta por slot. Único `(rotation_id, module_definition_id)`.

### `module_purchase_events`

`id`, `user_id`, `offer_id`, `new_instance_id`, `replaced_instance_id NULL`, `new_price`, `trade_in_value`, `net_cost`, `balance_before`, `balance_after`, `idempotency_key UNIQUE`, `created_at`.

### `module_repair_events`

`id`, `user_id`, `module_instance_id`, `energy_before`, `energy_after`, `damage_percent_bp`, `original_price`, `repair_cost`, `balance_before`, `balance_after`, `idempotency_key UNIQUE`, `created_at`.

### `damage_events`

`id`, `user_id`, `period_id`, `base_damage`, `created_at`, `idempotency_key UNIQUE`.

### `module_damage_events`

`id`, `damage_event_id`, `module_instance_id`, `shield_snapshot`, `energy_before`, `damage_applied`, `energy_after`, `destroyed`, `created_at`.

Único: `(damage_event_id, module_instance_id)`.

### `family_bonus_rules`

`minimum_count PK`, `bonus_percent_bp`.  
Seed: 2→500, 3→1200, 4→2000, 5→3500.

## 8. Auditoría y operaciones

### `audit_events`

`id`, `user_id NULL`, `actor_type`, `action`, `entity_type`, `entity_id`, `request_id`, `metadata JSONB`, `created_at`.

No almacenar secretos ni datos financieros completos innecesarios.

### `job_runs`

`id`, `job_type`, `scope_id`, `idempotency_key UNIQUE`, `status`, `attempts`, `started_at`, `finished_at`, `error_code`, `created_at`.

## 9. Tablas futuras reservadas

Crear solo cuando se implementen:

- `achievement_definitions`, `user_achievements`
- `seasons`, `season_participants`, `season_scores`
- `leaderboards`, `leaderboard_entries`

No deben condicionar las rutas del MVP.

## 10. Invariantes críticas

1. `synthcoin_balance >= 0`.
2. Máximo un módulo equipado por usuario y slot.
3. Un módulo destruido tiene `energy = 0` y no está equipado.
4. Un módulo reemplazado nunca aporta Power.
5. Cada cierre posee una única clave idempotente.
6. Cada combinación cierre-módulo recibe daño una sola vez.
7. Cada compra o reparación tiene exactamente una entrada de ledger.
8. La suma de asignaciones recompensadas no excede el importe elegible.
9. `total_flux = base_flux + active_power + family_bonus_power`.
10. El nivel corresponde al umbral máximo menor o igual a `total_flux`.
11. Ninguna FK de usuario puede cruzar propietarios.

## 11. Transacciones SQL obligatorias

Usar `SERIALIZABLE` o bloqueo explícito de filas para:

- cierre de presupuesto;
- asignación de recompensas;
- compra/sustitución;
- reparación;
- aplicación de daño;
- recálculo de progreso tras destrucción.

Bloquear en orden estable: usuario/progreso → periodo/oferta → módulo → ledger, para reducir deadlocks.

### 11.1 Construcción y límites defensivos de consultas

- Las rutas y servicios solo pueden llamar a `query` con SQL literal estático. Los valores externos se envían mediante parámetros `$n`; no se concatenan ni interpolan.
- Los filtros opcionales del listado financiero forman parte de una consulta fija y se habilitan mediante parámetros anulables. Cualquier identificador u orden dinámico futuro requerirá una allowlist explícita antes de incorporarse.
- `sqlConstruction.unit.test.ts` recorre el backend y falla si una ruta o servicio intenta ejecutar SQL compuesto en runtime. Las migraciones son la única fuente SQL dinámica admitida y proceden exclusivamente de ficheros versionados del repositorio.
- El pool limita las sentencias a 10 s, la espera de bloqueos a 5 s, el tiempo de cliente a 12 s y una transacción inactiva a 10 s. Un cambio de estos valores exige verificar migraciones, operaciones serializables y latencia real de Neon.
- La detección de entradas con forma de consulta es una barrera complementaria. La seguridad no puede depender de palabras prohibidas ni de que todas las posibles ofuscaciones sean reconocibles.

## 12. Estado de ayuda y tour

La migración `004_help_and_guided_tour.sql` incorpora `helpHints: true` a las preferencias que no lo tuvieran y actualiza el valor por defecto para las cuentas nuevas. No rellena `guided_tour_completed_at`: de este modo, tras aplicar la migración, todas las cuentas existentes de test y todas las cuentas nuevas reciben el tour en su primer login. La fecha se establece de forma idempotente al finalizarlo o salir de él.
