const systemCategoryKeys: Record<string, string> = {
  fuel: 'systemCategory.fuel',
  utensils: 'systemCategory.food',
  wrench: 'systemCategory.maintenance',
  radio: 'systemCategory.subscriptions',
  gamepad: 'systemCategory.leisure',
  'heart-pulse': 'systemCategory.health',
  building: 'systemCategory.housing',
  cpu: 'systemCategory.technology',
  shapes: 'systemCategory.other',
}

export function systemCategoryKey(icon: string, isSystemSeed: boolean) {
  return isSystemSeed ? systemCategoryKeys[icon] : undefined
}
