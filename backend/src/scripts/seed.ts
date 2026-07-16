import bcrypt from 'bcryptjs'
import { closeDatabase, withTransaction } from '../db.js'
import { recalculateProgress } from '../progress.js'

const demoEmail = 'nomada@budgetrunner.local'
const demoPassword = 'NeonRunner!2026'

const categories = [
  ['Combustible de Neón', 'fuel', '#FF007F'], ['Raciones Orbitales', 'utensils', '#00FFFF'],
  ['Mantenimiento del Hovercar', 'wrench', '#8B00FF'], ['Suscripciones de la Red', 'radio', '#A69DFF'],
  ['Ocio Holográfico', 'gamepad', '#F785C6'], ['Salud Biónica', 'heart-pulse', '#FF6E84'],
  ['Vivienda en la Megaciudad', 'building', '#FFD43F'], ['Tecnología del Cyberdeck', 'cpu', '#7DD3FC'],
  ['Otros', 'shapes', '#986780'],
] as const

const modules = [
  { sku: 'CPU-PULSE-X2', name: 'Pulse Vector X2', slot: 'cpu', family: 'synthwave', rarity: 'rare', price: 420, power: 80, shield: 4, minLevel: 1, energy: 100, description: 'Procesador neuronal con coprocesador de impulsos vectoriales.' },
  { sku: 'GPU-PRISM-M7', name: 'Prism Core M7', slot: 'gpu', family: 'vaporwave', rarity: 'epic', price: 680, power: 125, shield: 3, minLevel: 3, energy: 88, description: 'Núcleo holográfico para renderizado espectral de baja latencia.' },
  { sku: 'RAM-DREAM-64', name: 'DreamCache 64', slot: 'ram', family: 'vaporwave', rarity: 'rare', price: 360, power: 65, shield: 5, minLevel: 2, energy: 100, description: 'Memoria cristalina con persistencia de sueños sintéticos.' },
  { sku: 'DISPLAY-AURORA', name: 'Aurora Glass', slot: 'display', family: 'retrowave', rarity: 'rare', price: 310, power: 55, shield: 6, minLevel: 2, energy: 100, description: 'Pantalla de fósforo neón con rejilla ultrafina.' },
  { sku: 'EXPANSION-HEXALINK', name: 'HexaLink Board', slot: 'expansion', family: 'synthwave', rarity: 'common', price: 240, power: 42, shield: 5, minLevel: 1, energy: 100, description: 'Bus modular de seis canales para periféricos clandestinos.' },
  { sku: 'JAMMER-GHOST-Q7', name: 'Ghostlink Q7', slot: 'jammer', family: 'hifi_tech', rarity: 'epic', price: 720, power: 110, shield: 7, minLevel: 4, energy: 18, description: 'Supresor cuántico de firmas y telemetría hostil.' },
  { sku: 'NETWORK-QUANTUM', name: 'Quantum Mesh NIC', slot: 'network', family: 'retrowave', rarity: 'epic', price: 640, power: 105, shield: 4, minLevel: 3, energy: 100, description: 'Interfaz de red entrelazada para la megamalla orbital.' },
  { sku: 'COOLING-CRYO', name: 'Cryo Veil', slot: 'cooling', family: 'vaporwave', rarity: 'rare', price: 390, power: 60, shield: 8, minLevel: 2, energy: 72, description: 'Circuito criogénico silencioso con vapor de neón.' },
  { sku: 'PROJECTOR-MIRAGE', name: 'Mirage Array', slot: 'projector', family: 'synthwave', rarity: 'epic', price: 750, power: 130, shield: 2, minLevel: 4, energy: 100, description: 'Matriz de proyección volumétrica de alcance urbano.' },
  { sku: 'POWER-SOLAR-HEART', name: 'Solar Heart', slot: 'power', family: 'hifi_tech', rarity: 'legendary', price: 980, power: 170, shield: 8, minLevel: 6, energy: 100, description: 'Celda de fusión encapsulada con pulso solar estable.' },
  { sku: 'CPU-NEURAL-FORGE', name: 'Neural Forge V4', slot: 'cpu', family: 'retrowave', rarity: 'epic', price: 800, power: 145, shield: 3, minLevel: 4, description: 'Forja lógica para cargas predictivas de alta intensidad.' },
  { sku: 'GPU-SPECTRA-NOVA', name: 'Spectra Nova', slot: 'gpu', family: 'synthwave', rarity: 'legendary', price: 1100, power: 205, shield: 4, minLevel: 7, description: 'Renderizador fotónico de espectro completo.' },
  { sku: 'NETWORK-ZERO-LATENCY', name: 'Zero Latency Gate', slot: 'network', family: 'hifi_tech', rarity: 'rare', price: 520, power: 88, shield: 7, minLevel: 3, description: 'Puerta de enlace endurecida para redes de borde.' },
  { sku: 'POWER-VOID-CELL', name: 'Void Cell R9', slot: 'power', family: 'vaporwave', rarity: 'mythic', price: 1600, power: 260, shield: 9, minLevel: 10, description: 'Fuente de vacío experimental con blindaje multicapas.' },
  { sku: 'PROJECTOR-SUNSET', name: 'Sunset Projector', slot: 'projector', family: 'retrowave', rarity: 'rare', price: 490, power: 82, shield: 5, minLevel: 3, description: 'Proyector outrun de óptica cálida y baja firma.' },
  { sku: 'COOLING-ABSOLUTE', name: 'Absolute Zero Loop', slot: 'cooling', family: 'hifi_tech', rarity: 'epic', price: 690, power: 95, shield: 10, minLevel: 5, description: 'Bucle térmico defensivo de máxima resistencia.' },
] as const

async function seed() {
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  await withTransaction(async (client) => {
    let requiredFlux = 0
    let increment = 100
    for (let level = 1; level <= 30; level += 1) {
      if (level > 1) { requiredFlux += increment; increment += 50 }
      await client.query(`
        INSERT INTO level_thresholds (level, required_flux) VALUES ($1, $2)
        ON CONFLICT (level) DO UPDATE SET required_flux = excluded.required_flux
      `, [level, requiredFlux])
    }
    for (const [count, basisPoints] of [[2, 500], [3, 1200], [4, 2000], [5, 3500]]) {
      await client.query(`INSERT INTO family_bonus_rules (minimum_count, bonus_percent_bp) VALUES ($1, $2)
        ON CONFLICT (minimum_count) DO UPDATE SET bonus_percent_bp = excluded.bonus_percent_bp`, [count, basisPoints])
    }

    const userResult = await client.query<{ id: string }>(`
      INSERT INTO users (email, password_hash, display_name, primary_currency, locale, timezone, week_starts_on, email_verified_at)
      VALUES ($1, $2, 'Nómada', 'EUR', 'es-ES', 'Europe/Madrid', 1, now())
      ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, display_name = excluded.display_name
      RETURNING id
    `, [demoEmail, passwordHash])
    const userId = userResult.rows[0]?.id
    if (!userId) throw new Error('Demo user seed failed')
    await client.query(`
      INSERT INTO user_progress (user_id, base_flux, synthcoin_balance, weekly_streak, monthly_streak)
      VALUES ($1, 1200, 2500, 6, 3) ON CONFLICT (user_id) DO NOTHING
    `, [userId])

    const categoryIds = new Map<string, string>()
    for (const [name, icon, color] of categories) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO categories (user_id, name, icon_key, color_token, is_system_seed)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT DO NOTHING RETURNING id
      `, [userId, name, icon, color])
      const id = result.rows[0]?.id ?? (await client.query<{ id: string }>('SELECT id FROM categories WHERE user_id = $1 AND lower(name) = lower($2) AND is_archived = false', [userId, name])).rows[0]?.id
      if (id) categoryIds.set(name, id)
    }

    const now = new Date()
    const transactionSeeds = [
      ['10000000-0000-4000-8000-000000000001', 'income', 'Nómina orbital', 320000, 'Otros', 2],
      ['10000000-0000-4000-8000-000000000002', 'expense', 'Recarga de plasma', 5200, 'Combustible de Neón', 1],
      ['10000000-0000-4000-8000-000000000003', 'expense', 'Raciones del mercado nocturno', 2450, 'Raciones Orbitales', 3],
      ['10000000-0000-4000-8000-000000000004', 'expense', 'Enlace neural premium', 8990, 'Suscripciones de la Red', 5],
      ['10000000-0000-4000-8000-000000000005', 'expense', 'Alineación del hovercar', 12000, 'Mantenimiento del Hovercar', 8],
      ['10000000-0000-4000-8000-000000000006', 'expense', 'Arcade holográfico', 4500, 'Ocio Holográfico', 11],
    ] as const
    for (const [id, type, concept, amount, category, daysAgo] of transactionSeeds) {
      const occurredAt = new Date(now.getTime() - daysAgo * 86_400_000)
      await client.query(`
        INSERT INTO financial_transactions (id, user_id, category_id, type, status, concept, amount_minor, currency, occurred_at)
        VALUES ($1,$2,$3,$4,'posted',$5,$6,'EUR',$7) ON CONFLICT (id) DO NOTHING
      `, [id, userId, categoryIds.get(category), type, concept, amount, occurredAt])
    }
    for (let monthsAgo = 1; monthsAgo <= 6; monthsAgo += 1) {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15, 12))
      const suffix = String(monthsAgo).padStart(2, '0')
      await client.query(`
        INSERT INTO financial_transactions (id, user_id, category_id, type, status, concept, amount_minor, currency, occurred_at)
        VALUES ($1,$2,$3,'income','posted','Contrato de ciclo',$4,'EUR',$5),
               ($6,$2,$7,'expense','posted','Costes del ciclo',$8,'EUR',$5)
        ON CONFLICT (id) DO NOTHING
      `, [
        `20000000-0000-4000-8000-0000000000${suffix}`, userId, categoryIds.get('Otros'), 300000 + monthsAgo * 5000, monthDate,
        `30000000-0000-4000-8000-0000000000${suffix}`, categoryIds.get('Vivienda en la Megaciudad'), 145000 + monthsAgo * 3500,
      ])
    }

    const definitionIds = new Map<string, string>()
    for (const definition of modules) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO module_definitions (sku, name, slot, family, rarity, price_coins, power, shield, min_level, visual_key, description)
        VALUES ($1,$2,$3::module_slot,$4::module_family,$5::module_rarity,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (sku) DO UPDATE SET name = excluded.name, price_coins = excluded.price_coins,
          power = excluded.power, shield = excluded.shield, min_level = excluded.min_level, description = excluded.description
        RETURNING id
      `, [definition.sku, definition.name, definition.slot, definition.family, definition.rarity, definition.price, definition.power, definition.shield, definition.minLevel, definition.sku.toLowerCase(), definition.description])
      const id = result.rows[0]?.id
      if (id) definitionIds.set(definition.sku, id)
    }

    for (const definition of modules.filter((item) => 'energy' in item)) {
      const definitionId = definitionIds.get(definition.sku)
      if (!definitionId) continue
      await client.query(`
        INSERT INTO user_module_instances (user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot, energy, state)
        SELECT $1,$2,$3::module_slot,$4,$5,$6,$7,'equipped'
        WHERE NOT EXISTS (
          SELECT 1 FROM user_module_instances WHERE user_id = $1 AND slot = $3::module_slot AND state IN ('equipped', 'destroyed')
        )
      `, [userId, definitionId, definition.slot, definition.price, definition.power, definition.shield, definition.energy])
    }

    await client.query(`
      INSERT INTO synthcoin_ledger (user_id, type, amount, balance_after, idempotency_key, metadata)
      VALUES ($1, 'adjustment', 2500, 2500, '00000000-0000-4000-8000-000000000001', '{"source":"development-seed"}')
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [userId])

    let rotationId = (await client.query<{ id: string }>(`
      SELECT id FROM store_rotations WHERE user_id = $1 AND status = 'active' AND ends_at > now() LIMIT 1
    `, [userId])).rows[0]?.id
    if (!rotationId) {
      await client.query("UPDATE store_rotations SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId])
      rotationId = (await client.query<{ id: string }>(`
        INSERT INTO store_rotations (user_id, starts_at, ends_at, seed, user_level_snapshot, status)
        VALUES ($1, now(), now() + interval '30 days', 'budget-runner-demo-rotation', 6, 'active') RETURNING id
      `, [userId])).rows[0]?.id
    }
    if (!rotationId) throw new Error('Store rotation seed failed')
    for (const definition of modules.slice(10)) {
      const definitionId = definitionIds.get(definition.sku)
      await client.query(`
        INSERT INTO store_offers (rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at)
        VALUES ($1,$2,$3,$4,now() + interval '30 days') ON CONFLICT (rotation_id, module_definition_id) DO NOTHING
      `, [rotationId, definitionId, definition.price, definition.minLevel])
    }
    await recalculateProgress(client, userId, 'development.seed')
  })
  console.log(`Development seed ready: ${demoEmail} / ${demoPassword}`)
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => { await closeDatabase() })
