import type {
  Budget,
  CashflowPoint,
  Category,
  CyberModule,
  FinancialTransaction,
  GameEvent,
  ProgressSummary,
  StoreOffer,
  UserProfile,
} from '@/types/domain'

export const categories: Category[] = [
  { id: 'cat-food', name: 'Raciones Orbitales', icon: 'utensils', color: '#FF007F', systemKey: 'systemCategory.food' },
  { id: 'cat-tech', name: 'Tecnología del Cyberdeck', icon: 'cpu', color: '#00FFFF', systemKey: 'systemCategory.technology' },
  { id: 'cat-home', name: 'Vivienda en la Megaciudad', icon: 'building', color: '#A69DFF', systemKey: 'systemCategory.housing' },
  { id: 'cat-fuel', name: 'Combustible de Neón', icon: 'fuel', color: '#FFD43F', systemKey: 'systemCategory.fuel' },
  { id: 'cat-fun', name: 'Ocio Holográfico', icon: 'gamepad', color: '#F785C6', systemKey: 'systemCategory.leisure' },
  { id: 'cat-health', name: 'Salud Biónica', icon: 'heart-pulse', color: '#63E063', systemKey: 'systemCategory.health' },
  { id: 'cat-income', name: 'Créditos de misión', icon: 'wallet', color: '#00FFFF', systemKey: 'systemCategory.missionCredits' },
  { id: 'cat-other', name: 'Otros', icon: 'shapes', color: '#986780', systemKey: 'systemCategory.other' },
]

export const initialTransactions: FinancialTransaction[] = [
  { id: 'tx-001', type: 'expense', status: 'posted', concept: 'Neo-Burger', amountMinor: 2450, currency: 'EUR', categoryId: 'cat-food', categoryName: 'Raciones Orbitales', occurredAt: '2026-07-15T12:30:00Z' },
  { id: 'tx-002', type: 'expense', status: 'posted', concept: 'Cyber Deck Upgrade', amountMinor: 15000, currency: 'EUR', categoryId: 'cat-tech', categoryName: 'Tecnología Cyberdeck', occurredAt: '2026-07-14T17:00:00Z' },
  { id: 'tx-003', type: 'expense', status: 'posted', concept: 'Holo-Cinema', amountMinor: 3500, currency: 'EUR', categoryId: 'cat-fun', categoryName: 'Ocio Holográfico', occurredAt: '2026-07-13T20:15:00Z' },
  { id: 'tx-004', type: 'income', status: 'posted', concept: 'Nómina · Nexus Corp', amountMinor: 286500, currency: 'EUR', categoryId: 'cat-income', categoryName: 'Créditos de misión', occurredAt: '2026-07-01T08:00:00Z', lockedByReward: true },
  { id: 'tx-005', type: 'expense', status: 'posted', concept: 'Alquiler Sector 7', amountMinor: 87500, currency: 'EUR', categoryId: 'cat-home', categoryName: 'Vivienda Megaciudad', occurredAt: '2026-07-02T09:00:00Z', lockedByReward: true },
  { id: 'tx-006', type: 'expense', status: 'posted', concept: 'Carga hovercar', amountMinor: 6850, currency: 'EUR', categoryId: 'cat-fuel', categoryName: 'Combustible de Neón', occurredAt: '2026-07-08T18:45:00Z' },
  { id: 'tx-007', type: 'expense', status: 'posted', concept: 'Clínica Synapse', amountMinor: 4200, currency: 'EUR', categoryId: 'cat-health', categoryName: 'Salud Biónica', occurredAt: '2026-07-07T11:20:00Z' },
  { id: 'tx-008', type: 'expense', status: 'posted', concept: 'Streaming de la Red', amountMinor: 1599, currency: 'EUR', categoryId: 'cat-fun', categoryName: 'Ocio Holográfico', occurredAt: '2026-07-06T07:30:00Z' },
  { id: 'tx-009', type: 'expense', status: 'posted', concept: 'Mercado nocturno', amountMinor: 7890, currency: 'EUR', categoryId: 'cat-food', categoryName: 'Raciones Orbitales', occurredAt: '2026-07-05T19:10:00Z' },
  { id: 'tx-010', type: 'income', status: 'posted', concept: 'Freelance · Vector Labs', amountMinor: 62000, currency: 'EUR', categoryId: 'cat-income', categoryName: 'Créditos de misión', occurredAt: '2026-07-04T16:00:00Z' },
  { id: 'tx-011', type: 'expense', status: 'scheduled', concept: 'Seguro Hovercar', amountMinor: 5400, currency: 'EUR', categoryId: 'cat-fuel', categoryName: 'Combustible de Neón', occurredAt: '2026-07-20T08:00:00Z' },
  { id: 'tx-012', type: 'expense', status: 'posted', concept: 'Cable cuántico', amountMinor: 3200, currency: 'EUR', categoryId: 'cat-tech', categoryName: 'Tecnología Cyberdeck', occurredAt: '2026-07-03T13:40:00Z' },
]

export const initialBudgets: Budget[] = [
  { id: 'budget-01', name: 'Ciclo mensual global', frequency: 'monthly', scope: 'global', limitMinor: 225000, spendMinor: 196189, eligibleSurplusMinor: 28811, excludedRewardMinor: 10900, currency: 'EUR', status: 'active', startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z' },
  { id: 'budget-02', name: 'Ocio Holográfico', frequency: 'weekly', scope: 'category', categoryId: 'cat-fun', categoryName: 'Ocio Holográfico', limitMinor: 12000, spendMinor: 5099, eligibleSurplusMinor: 6901, currency: 'EUR', status: 'active', startsAt: '2026-07-14T00:00:00Z', endsAt: '2026-07-21T00:00:00Z' },
  { id: 'budget-03', name: 'Raciones de la semana', frequency: 'weekly', scope: 'category', categoryId: 'cat-food', categoryName: 'Raciones Orbitales', limitMinor: 15000, spendMinor: 10340, eligibleSurplusMinor: 4660, currency: 'EUR', status: 'met', startsAt: '2026-07-07T00:00:00Z', endsAt: '2026-07-14T00:00:00Z', synthcoinsAwarded: 46, fluxAwarded: 25 },
  { id: 'budget-04', name: 'Hardware esencial', frequency: 'monthly', scope: 'category', categoryId: 'cat-tech', categoryName: 'Tecnología Cyberdeck', limitMinor: 13000, spendMinor: 18200, eligibleSurplusMinor: 0, currency: 'EUR', status: 'exceeded', startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z' },
  { id: 'budget-05', name: 'Combustible agosto', frequency: 'monthly', scope: 'category', categoryId: 'cat-fuel', categoryName: 'Combustible de Neón', limitMinor: 18000, spendMinor: 0, eligibleSurplusMinor: 0, currency: 'EUR', status: 'scheduled', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' },
]

export const progress: ProgressSummary = {
  level: 24,
  baseFlux: 3420,
  activePower: 1280,
  familyBonusPower: 234,
  totalFlux: 4934,
  currentLevelFlux: 4650,
  nextLevelFlux: 5050,
  synthcoins: 2380,
  weeklyStreak: 7,
  monthlyStreak: 3,
}

export const cashflow: CashflowPoint[] = [
  { label: '2026-01', incomeMinor: 274000, expenseMinor: 121000 },
  { label: '2026-02', incomeMinor: 286000, expenseMinor: 98000 },
  { label: '2026-03', incomeMinor: 286000, expenseMinor: 154000 },
  { label: '2026-04', incomeMinor: 305000, expenseMinor: 112000 },
  { label: '2026-05', incomeMinor: 286000, expenseMinor: 138000 },
  { label: '2026-06', incomeMinor: 331000, expenseMinor: 176000 },
  { label: '2026-07', incomeMinor: 348500, expenseMinor: 196189 },
]

const moduleBase: CyberModule[] = [
  { instanceId: 'mod-cpu', slot: 'cpu', slotLabel: 'Neural Chip', name: 'Pulse Vector X2', family: 'synthwave', rarity: 'rare', power: 180, shield: 4, energy: 72, state: 'equipped', priceCoins: 480, description: 'Procesador neural optimizado para predicción de ciclos.' },
  { instanceId: 'mod-gpu', slot: 'gpu', slotLabel: 'Holographic Core', name: 'Mirage Raster 88', family: 'vaporwave', rarity: 'epic', power: 240, shield: 3, energy: 100, state: 'equipped', priceCoins: 760, description: 'Proyecta telemetría financiera en espectro completo.' },
  { instanceId: 'mod-ram', slot: 'ram', slotLabel: 'Memory Module', name: 'Neon Cache 64', family: 'synthwave', rarity: 'rare', power: 145, shield: 5, energy: 44, state: 'equipped', priceCoins: 390, description: 'Memoria de baja latencia con matriz luminosa.' },
  { instanceId: 'mod-display', slot: 'display', slotLabel: 'Neon Display', name: 'Sunset CRT', family: 'retrowave', rarity: 'common', power: 90, shield: 6, energy: 100, state: 'equipped', priceCoins: 210, description: 'Panel fósforo cálido calibrado para el horizonte.' },
  { instanceId: 'mod-expansion', slot: 'expansion', slotLabel: 'Expansion Board', name: 'Void Backplane', family: 'hifi_tech', rarity: 'legendary', power: 280, shield: 7, energy: 100, state: 'equipped', priceCoins: 1260, description: 'Bus modular de precisión para subsistemas críticos.' },
  { instanceId: 'mod-jammer', slot: 'jammer', slotLabel: 'Frequency Jammer', name: 'Sin módulo', family: 'synthwave', rarity: 'common', power: 0, shield: 0, energy: 0, state: 'empty', priceCoins: 0, description: 'Slot disponible para una futura adquisición.' },
  { instanceId: 'mod-network', slot: 'network', slotLabel: 'Quantum NIC', name: 'Ghostlink Q7', family: 'vaporwave', rarity: 'epic', power: 175, shield: 4, energy: 18, state: 'equipped', priceCoins: 680, description: 'Interfaz cuántica con integridad crítica.' },
  { instanceId: 'mod-cooling', slot: 'cooling', slotLabel: 'Cryo Cooler', name: 'Arctic Bloom', family: 'vaporwave', rarity: 'rare', power: 105, shield: 8, energy: 100, state: 'equipped', priceCoins: 510, description: 'Criogenia silenciosa de alto blindaje.' },
  { instanceId: 'mod-projector', slot: 'projector', slotLabel: 'Hologram Projector', name: 'Prism Wraith', family: 'retrowave', rarity: 'rare', power: 65, shield: 2, energy: 0, state: 'destroyed', priceCoins: 320, description: 'Módulo destruido. No aporta Power ni valor de entrega.' },
  { instanceId: 'mod-power', slot: 'power', slotLabel: 'Fusion Cell', name: 'Helios Cell', family: 'retrowave', rarity: 'epic', power: 220, shield: 6, energy: 88, state: 'equipped', priceCoins: 840, description: 'Fuente de fusión estable con reserva sunset.' },
]

export const modules = moduleBase.map((module) => ({ ...module, descriptionKey: `module.mock.${module.instanceId}.description` }))

const offerModules: CyberModule[] = [
  { instanceId: 'offer-1-module', slot: 'jammer', slotLabel: 'Frequency Jammer', name: 'Signal Reaper', family: 'synthwave', rarity: 'rare', power: 155, shield: 5, energy: 100, state: 'equipped', priceCoins: 420, description: 'Silencia el ruido financiero de banda ancha.' },
  { instanceId: 'offer-2-module', slot: 'projector', slotLabel: 'Hologram Projector', name: 'Violet Oracle', family: 'vaporwave', rarity: 'epic', power: 230, shield: 3, energy: 100, state: 'equipped', priceCoins: 790, description: 'Proyección predictiva con prisma lavanda.' },
  { instanceId: 'offer-3-module', slot: 'ram', slotLabel: 'Memory Module', name: 'Chrome Archive', family: 'hifi_tech', rarity: 'rare', power: 135, shield: 8, energy: 100, state: 'equipped', priceCoins: 540, description: 'Memoria blindada de precisión clínica.' },
  { instanceId: 'offer-4-module', slot: 'gpu', slotLabel: 'Holographic Core', name: 'Solar Flare GX', family: 'retrowave', rarity: 'legendary', power: 360, shield: 4, energy: 100, state: 'equipped', priceCoins: 1480, description: 'Núcleo gráfico de alta potencia inspirado en el ocaso.' },
  { instanceId: 'offer-5-module', slot: 'cooling', slotLabel: 'Cryo Cooler', name: 'Zero Wave', family: 'synthwave', rarity: 'common', power: 80, shield: 7, energy: 100, state: 'equipped', priceCoins: 260, description: 'Refrigeración accesible para ciclos estables.' },
  { instanceId: 'offer-6-module', slot: 'network', slotLabel: 'Quantum NIC', name: 'Blue Shift', family: 'hifi_tech', rarity: 'mythic', power: 410, shield: 9, energy: 100, state: 'equipped', priceCoins: 2180, description: 'Enlace de espectro frío, extremadamente raro.' },
]

export const offers: StoreOffer[] = offerModules.map((module, index) => ({
  id: `offer-${index + 1}`,
  module: { ...module, descriptionKey: `module.mock.${module.instanceId}.description` },
  expiresAt: '2026-07-21T00:00:00Z',
  netCost: index === 0 ? module.priceCoins : Math.max(0, module.priceCoins - 195),
  tradeInValue: index === 0 ? 0 : 195,
  minLevel: [8, 12, 10, 20, 3, 24][index],
}))

export const gameHistory: GameEvent[] = [
  { id: 'game-1', type: 'reward', title: { key: 'game.history.budgetMet' }, detail: { key: 'game.history.mockReward', params: { name: 'Raciones de la semana', flux: 25 } }, amount: 46, occurredAt: '2026-07-14T00:05:00Z' },
  { id: 'game-2', type: 'damage', title: { key: 'game.history.excessImpact' }, detail: { key: 'game.history.mockDamage', params: { name: 'Ghostlink Q7', energy: 62 } }, occurredAt: '2026-07-12T00:06:00Z' },
  { id: 'game-3', type: 'purchase', title: { key: 'game.history.moduleEquipped' }, detail: { key: 'game.history.mockEquipped', params: { name: 'Void Backplane' } }, amount: -1060, occurredAt: '2026-07-08T21:30:00Z' },
  { id: 'game-4', type: 'level', title: { key: 'game.history.levelReached', params: { level: 24 } }, detail: { key: 'game.history.fluxSynced' }, occurredAt: '2026-07-08T21:30:10Z' },
  { id: 'game-5', type: 'repair', title: { key: 'game.history.repairCompleted' }, detail: { key: 'game.history.mockRestored', params: { name: 'Helios Cell' } }, amount: -84, occurredAt: '2026-07-03T16:20:00Z' },
]

export const profile: UserProfile = {
  id: 'user-mike',
  displayName: 'Mike Fieldins',
  email: 'mike@budgetrunner.local',
  primaryCurrency: 'EUR',
  locale: 'es-ES',
  timezone: 'Europe/Madrid',
  weekStartsOn: 1,
  googleConnected: true,
  progress,
  levelHistory: [
    { level: 24, flux: 4650, reachedAt: '2026-07-08T21:30:10Z', reason: { key: 'levelReason.moduleEquipped', params: { name: 'Void Backplane' } } },
    { level: 23, flux: 4320, reachedAt: '2026-06-28T00:05:00Z', reason: { key: 'levelReason.monthlyCycle' } },
    { level: 22, flux: 3990, reachedAt: '2026-06-02T18:10:00Z', reason: { key: 'levelReason.familyBonus', params: { family: 'Synthwave' } } },
  ],
  preferences: {
    reducedMotion: false,
    ambientEffects: true,
    audioReactive: false,
    scanlines: true,
    compactMode: false,
  },
}
