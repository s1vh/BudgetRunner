export const PROD_DEMO_EMAIL = 'nomada@budgetrunner.local'
export const PROD_DEMO_FIXTURE_VERSION = 'mock-v1-live-normalized'

const REFERENCE_NOW = Date.parse('2026-07-16T00:00:00.000Z')

export type DemoTransactionType = 'expense' | 'income'
export type DemoTransactionStatus = 'scheduled' | 'posted'
export type DemoBudgetFrequency = 'weekly' | 'monthly'
export type DemoBudgetScope = 'global' | 'category'
export type DemoBudgetStatus = 'scheduled' | 'active'
export type DemoPeriodStatus = 'open' | 'met' | 'exceeded'
export type DemoModuleSlot = 'cpu' | 'gpu' | 'ram' | 'display' | 'expansion' | 'jammer' | 'network' | 'cooling' | 'projector' | 'power'
export type DemoModuleFamily = 'retrowave' | 'synthwave' | 'vaporwave' | 'hifi_tech'
export type DemoModuleRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type DemoModuleState = 'equipped' | 'destroyed'

export interface ProdDemoFixture {
  generatedAt: string
  profile: {
    displayName: string
    primaryCurrency: string
    locale: string
    timezone: string
    weekStartsOn: number
    guidedTourCompleted: boolean
    preferences: Record<string, boolean>
  }
  targetProgress: {
    level: number
    levelProgressRatio: number
    synthcoins: number
    weeklyStreak: number
    monthlyStreak: number
  }
  categories: Array<{
    id: string
    key: string
    name: string
    icon: string
    color: string
  }>
  transactions: Array<{
    id: string
    type: DemoTransactionType
    status: DemoTransactionStatus
    concept: string
    amountMinor: number
    currency: string
    categoryKey: string
    occurredAt: string
    lockedByReward: boolean
  }>
  budgets: Array<{
    id: string
    periodId: string
    name: string
    frequency: DemoBudgetFrequency
    scope: DemoBudgetScope
    categoryKey: string | null
    limitMinor: number
    currency: string
    status: DemoBudgetStatus
    startsAt: string
    endsAt: string
    periodStatus: DemoPeriodStatus
    spendMinor: number
    surplusMinor: number
    eligibleSurplusMinor: number
    excludedRewardMinor: number
    synthcoinsAwarded: number
    fluxAwarded: number
    excessPercentBp: number
    baseDamage: number
    transactionIds: string[]
  }>
  definitions: Array<{
    sku: string
    name: string
    slot: DemoModuleSlot
    family: DemoModuleFamily
    rarity: DemoModuleRarity
    priceCoins: number
    power: number
    shield: number
    minLevel: number
    description: string
  }>
  modules: Array<{
    id: string
    sku: string
    energy: number
    state: DemoModuleState
    equippedAt: string
    destroyedAt: string | null
  }>
  offers: Array<{
    id: string
    sku: string
    priceCoins: number
    minLevel: number
    expiresAt: string
  }>
  rotation: {
    id: string
    startsAt: string
    endsAt: string
    seed: string
  }
  history: {
    rewardAt: string
    damageAt: string
    purchaseAt: string
    level24At: string
    level23At: string
    level22At: string
    repairAt: string
  }
}

function shifted(iso: string, now: Date) {
  return new Date(Date.parse(iso) + now.getTime() - REFERENCE_NOW).toISOString()
}

export function buildProdDemoFixture(now = new Date()): ProdDemoFixture {
  if (!Number.isFinite(now.getTime())) throw new Error('A valid reset date is required.')

  const categories = [
    { id: 'd1000000-0000-4000-8000-000000000001', key: 'food', name: 'Raciones Orbitales', icon: 'utensils', color: '#FF007F' },
    { id: 'd1000000-0000-4000-8000-000000000002', key: 'tech', name: 'Tecnología del Cyberdeck', icon: 'cpu', color: '#00FFFF' },
    { id: 'd1000000-0000-4000-8000-000000000003', key: 'home', name: 'Vivienda en la Megaciudad', icon: 'building', color: '#A69DFF' },
    { id: 'd1000000-0000-4000-8000-000000000004', key: 'fuel', name: 'Combustible de Neón', icon: 'fuel', color: '#FFD43F' },
    { id: 'd1000000-0000-4000-8000-000000000005', key: 'fun', name: 'Ocio Holográfico', icon: 'gamepad', color: '#F785C6' },
    { id: 'd1000000-0000-4000-8000-000000000006', key: 'health', name: 'Salud Biónica', icon: 'heart-pulse', color: '#63E063' },
    { id: 'd1000000-0000-4000-8000-000000000007', key: 'income', name: 'Créditos de misión', icon: 'wallet', color: '#00FFFF' },
    { id: 'd1000000-0000-4000-8000-000000000008', key: 'other', name: 'Otros', icon: 'shapes', color: '#986780' },
  ]

  const transactions: ProdDemoFixture['transactions'] = [
    { id: 'd2000000-0000-4000-8000-000000000001', type: 'expense', status: 'posted', concept: 'Neo-Burger', amountMinor: 2450, currency: 'EUR', categoryKey: 'food', occurredAt: shifted('2026-07-12T12:30:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000002', type: 'expense', status: 'posted', concept: 'Cyber Deck Upgrade', amountMinor: 15000, currency: 'EUR', categoryKey: 'tech', occurredAt: shifted('2026-07-14T17:00:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000003', type: 'expense', status: 'posted', concept: 'Holo-Cinema', amountMinor: 3500, currency: 'EUR', categoryKey: 'fun', occurredAt: shifted('2026-07-15T20:15:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000004', type: 'income', status: 'posted', concept: 'Nómina · Nexus Corp', amountMinor: 286500, currency: 'EUR', categoryKey: 'income', occurredAt: shifted('2026-07-01T08:00:00Z', now), lockedByReward: true },
    { id: 'd2000000-0000-4000-8000-000000000005', type: 'expense', status: 'posted', concept: 'Alquiler Sector 7', amountMinor: 87500, currency: 'EUR', categoryKey: 'home', occurredAt: shifted('2026-07-02T09:00:00Z', now), lockedByReward: true },
    { id: 'd2000000-0000-4000-8000-000000000006', type: 'expense', status: 'posted', concept: 'Carga hovercar', amountMinor: 6850, currency: 'EUR', categoryKey: 'fuel', occurredAt: shifted('2026-07-08T18:45:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000007', type: 'expense', status: 'posted', concept: 'Clínica Synapse', amountMinor: 4200, currency: 'EUR', categoryKey: 'health', occurredAt: shifted('2026-07-07T11:20:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000008', type: 'expense', status: 'posted', concept: 'Streaming de la Red', amountMinor: 1599, currency: 'EUR', categoryKey: 'fun', occurredAt: shifted('2026-07-14T07:30:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000009', type: 'expense', status: 'posted', concept: 'Mercado nocturno', amountMinor: 7890, currency: 'EUR', categoryKey: 'food', occurredAt: shifted('2026-07-10T19:10:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000010', type: 'income', status: 'posted', concept: 'Freelance · Vector Labs', amountMinor: 62000, currency: 'EUR', categoryKey: 'income', occurredAt: shifted('2026-07-04T16:00:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000011', type: 'expense', status: 'scheduled', concept: 'Seguro Hovercar', amountMinor: 5400, currency: 'EUR', categoryKey: 'fuel', occurredAt: shifted('2026-07-20T08:00:00Z', now), lockedByReward: false },
    { id: 'd2000000-0000-4000-8000-000000000012', type: 'expense', status: 'posted', concept: 'Cable cuántico', amountMinor: 3200, currency: 'EUR', categoryKey: 'tech', occurredAt: shifted('2026-07-03T13:40:00Z', now), lockedByReward: false },
  ]

  const definitions: ProdDemoFixture['definitions'] = [
    { sku: 'mock.mod-cpu', name: 'Pulse Vector X2', slot: 'cpu', family: 'synthwave', rarity: 'rare', priceCoins: 480, power: 180, shield: 4, minLevel: 1, description: 'Procesador neural optimizado para predicción de ciclos.' },
    { sku: 'mock.mod-gpu', name: 'Mirage Raster 88', slot: 'gpu', family: 'vaporwave', rarity: 'epic', priceCoins: 760, power: 240, shield: 3, minLevel: 1, description: 'Proyecta telemetría financiera en espectro completo.' },
    { sku: 'mock.mod-ram', name: 'Neon Cache 64', slot: 'ram', family: 'synthwave', rarity: 'rare', priceCoins: 390, power: 145, shield: 5, minLevel: 1, description: 'Memoria de baja latencia con matriz luminosa.' },
    { sku: 'mock.mod-display', name: 'Sunset CRT', slot: 'display', family: 'retrowave', rarity: 'common', priceCoins: 210, power: 90, shield: 6, minLevel: 1, description: 'Panel fósforo cálido calibrado para el horizonte.' },
    { sku: 'mock.mod-expansion', name: 'Void Backplane', slot: 'expansion', family: 'hifi_tech', rarity: 'legendary', priceCoins: 1260, power: 280, shield: 7, minLevel: 1, description: 'Bus modular de precisión para subsistemas críticos.' },
    { sku: 'mock.mod-network', name: 'Ghostlink Q7', slot: 'network', family: 'vaporwave', rarity: 'epic', priceCoins: 680, power: 175, shield: 4, minLevel: 1, description: 'Interfaz cuántica con integridad crítica.' },
    { sku: 'mock.mod-cooling', name: 'Arctic Bloom', slot: 'cooling', family: 'vaporwave', rarity: 'rare', priceCoins: 510, power: 105, shield: 8, minLevel: 1, description: 'Criogenia silenciosa de alto blindaje.' },
    { sku: 'mock.mod-projector', name: 'Prism Wraith', slot: 'projector', family: 'retrowave', rarity: 'rare', priceCoins: 320, power: 65, shield: 2, minLevel: 1, description: 'Módulo destruido. No aporta Power ni valor de entrega.' },
    { sku: 'mock.mod-power', name: 'Helios Cell', slot: 'power', family: 'retrowave', rarity: 'epic', priceCoins: 840, power: 220, shield: 6, minLevel: 1, description: 'Fuente de fusión estable con reserva sunset.' },
    { sku: 'mock.offer-1-module', name: 'Signal Reaper', slot: 'jammer', family: 'synthwave', rarity: 'rare', priceCoins: 420, power: 155, shield: 5, minLevel: 8, description: 'Silencia el ruido financiero de banda ancha.' },
    { sku: 'mock.offer-2-module', name: 'Violet Oracle', slot: 'projector', family: 'vaporwave', rarity: 'epic', priceCoins: 790, power: 230, shield: 3, minLevel: 12, description: 'Proyección predictiva con prisma lavanda.' },
    { sku: 'mock.offer-3-module', name: 'Chrome Archive', slot: 'ram', family: 'hifi_tech', rarity: 'rare', priceCoins: 540, power: 135, shield: 8, minLevel: 10, description: 'Memoria blindada de precisión clínica.' },
    { sku: 'mock.offer-4-module', name: 'Solar Flare GX', slot: 'gpu', family: 'retrowave', rarity: 'legendary', priceCoins: 1480, power: 360, shield: 4, minLevel: 20, description: 'Núcleo gráfico de alta potencia inspirado en el ocaso.' },
    { sku: 'mock.offer-5-module', name: 'Zero Wave', slot: 'cooling', family: 'synthwave', rarity: 'common', priceCoins: 260, power: 80, shield: 7, minLevel: 3, description: 'Refrigeración accesible para ciclos estables.' },
    { sku: 'mock.offer-6-module', name: 'Blue Shift', slot: 'network', family: 'hifi_tech', rarity: 'mythic', priceCoins: 2180, power: 410, shield: 9, minLevel: 24, description: 'Enlace de espectro frío, extremadamente raro.' },
  ]

  return {
    generatedAt: now.toISOString(),
    profile: {
      displayName: 'Nómada',
      primaryCurrency: 'EUR',
      locale: 'es-ES',
      timezone: 'Europe/Madrid',
      weekStartsOn: 1,
      guidedTourCompleted: false,
      preferences: {
        reducedMotion: false,
        ambientEffects: true,
        audioReactive: false,
        scanlines: true,
        compactMode: false,
        helpHints: true,
      },
    },
    targetProgress: {
      level: 24,
      levelProgressRatio: 0.71,
      synthcoins: 2380,
      weeklyStreak: 7,
      monthlyStreak: 3,
    },
    categories,
    transactions,
    budgets: [
      {
        id: 'd3000000-0000-4000-8000-000000000001', periodId: 'd3100000-0000-4000-8000-000000000001',
        name: 'Ciclo mensual global', frequency: 'monthly', scope: 'global', categoryKey: null, limitMinor: 225000,
        currency: 'EUR', status: 'active', startsAt: shifted('2026-07-01T00:00:00Z', now), endsAt: shifted('2026-08-01T00:00:00Z', now),
        periodStatus: 'open', spendMinor: 132189, surplusMinor: 92811, eligibleSurplusMinor: 88151, excludedRewardMinor: 4660,
        synthcoinsAwarded: 0, fluxAwarded: 0, excessPercentBp: 0, baseDamage: 0,
        transactionIds: transactions.filter((item) => item.type === 'expense' && item.status === 'posted').map((item) => item.id),
      },
      {
        id: 'd3000000-0000-4000-8000-000000000002', periodId: 'd3100000-0000-4000-8000-000000000002',
        name: 'Ocio Holográfico', frequency: 'weekly', scope: 'category', categoryKey: 'fun', limitMinor: 12000,
        currency: 'EUR', status: 'active', startsAt: shifted('2026-07-14T00:00:00Z', now), endsAt: shifted('2026-07-21T00:00:00Z', now),
        periodStatus: 'open', spendMinor: 5099, surplusMinor: 6901, eligibleSurplusMinor: 6901, excludedRewardMinor: 0,
        synthcoinsAwarded: 0, fluxAwarded: 0, excessPercentBp: 0, baseDamage: 0,
        transactionIds: transactions.filter((item) => item.categoryKey === 'fun' && item.status === 'posted').map((item) => item.id),
      },
      {
        id: 'd3000000-0000-4000-8000-000000000003', periodId: 'd3100000-0000-4000-8000-000000000003',
        name: 'Raciones de la semana', frequency: 'weekly', scope: 'category', categoryKey: 'food', limitMinor: 15000,
        currency: 'EUR', status: 'active', startsAt: shifted('2026-07-07T00:00:00Z', now), endsAt: shifted('2026-07-14T00:00:00Z', now),
        periodStatus: 'met', spendMinor: 10340, surplusMinor: 4660, eligibleSurplusMinor: 4660, excludedRewardMinor: 0,
        synthcoinsAwarded: 46, fluxAwarded: 25, excessPercentBp: 0, baseDamage: 0,
        transactionIds: transactions.filter((item) => item.categoryKey === 'food' && item.status === 'posted').map((item) => item.id),
      },
      {
        id: 'd3000000-0000-4000-8000-000000000004', periodId: 'd3100000-0000-4000-8000-000000000004',
        name: 'Hardware esencial', frequency: 'monthly', scope: 'category', categoryKey: 'tech', limitMinor: 13000,
        currency: 'EUR', status: 'active', startsAt: shifted('2026-07-01T00:00:00Z', now), endsAt: shifted('2026-08-01T00:00:00Z', now),
        periodStatus: 'exceeded', spendMinor: 18200, surplusMinor: 0, eligibleSurplusMinor: 0, excludedRewardMinor: 0,
        synthcoinsAwarded: 0, fluxAwarded: 0, excessPercentBp: 4000, baseDamage: 62,
        transactionIds: transactions.filter((item) => item.categoryKey === 'tech' && item.status === 'posted').map((item) => item.id),
      },
      {
        id: 'd3000000-0000-4000-8000-000000000005', periodId: 'd3100000-0000-4000-8000-000000000005',
        name: 'Combustible agosto', frequency: 'monthly', scope: 'category', categoryKey: 'fuel', limitMinor: 18000,
        currency: 'EUR', status: 'scheduled', startsAt: shifted('2026-08-01T00:00:00Z', now), endsAt: shifted('2026-09-01T00:00:00Z', now),
        periodStatus: 'open', spendMinor: 0, surplusMinor: 18000, eligibleSurplusMinor: 18000, excludedRewardMinor: 0,
        synthcoinsAwarded: 0, fluxAwarded: 0, excessPercentBp: 0, baseDamage: 0, transactionIds: [],
      },
    ],
    definitions,
    modules: [
      { id: 'd4000000-0000-4000-8000-000000000001', sku: 'mock.mod-cpu', energy: 72, state: 'equipped', equippedAt: shifted('2026-06-20T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000002', sku: 'mock.mod-gpu', energy: 100, state: 'equipped', equippedAt: shifted('2026-06-22T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000003', sku: 'mock.mod-ram', energy: 44, state: 'equipped', equippedAt: shifted('2026-06-25T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000004', sku: 'mock.mod-display', energy: 100, state: 'equipped', equippedAt: shifted('2026-06-27T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000005', sku: 'mock.mod-expansion', energy: 100, state: 'equipped', equippedAt: shifted('2026-07-08T21:30:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000006', sku: 'mock.mod-network', energy: 18, state: 'equipped', equippedAt: shifted('2026-06-30T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000007', sku: 'mock.mod-cooling', energy: 100, state: 'equipped', equippedAt: shifted('2026-06-29T12:00:00Z', now), destroyedAt: null },
      { id: 'd4000000-0000-4000-8000-000000000008', sku: 'mock.mod-projector', energy: 0, state: 'destroyed', equippedAt: shifted('2026-06-18T12:00:00Z', now), destroyedAt: shifted('2026-07-02T12:00:00Z', now) },
      { id: 'd4000000-0000-4000-8000-000000000009', sku: 'mock.mod-power', energy: 88, state: 'equipped', equippedAt: shifted('2026-06-24T12:00:00Z', now), destroyedAt: null },
    ],
    offers: definitions.slice(9).map((definition, index) => ({
      id: `d5100000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sku: definition.sku,
      priceCoins: definition.priceCoins,
      minLevel: definition.minLevel,
      expiresAt: shifted('2026-07-21T00:00:00Z', now),
    })),
    rotation: {
      id: 'd5000000-0000-4000-8000-000000000001',
      startsAt: shifted('2026-07-14T00:00:00Z', now),
      endsAt: shifted('2026-07-21T00:00:00Z', now),
      seed: `prod-demo:${PROD_DEMO_FIXTURE_VERSION}`,
    },
    history: {
      rewardAt: shifted('2026-07-14T00:05:00Z', now),
      damageAt: shifted('2026-07-12T00:06:00Z', now),
      purchaseAt: shifted('2026-07-08T21:30:00Z', now),
      level24At: shifted('2026-07-08T21:30:10Z', now),
      level23At: shifted('2026-06-28T00:05:00Z', now),
      level22At: shifted('2026-06-02T18:10:00Z', now),
      repairAt: shifted('2026-07-03T16:20:00Z', now),
    },
  }
}
