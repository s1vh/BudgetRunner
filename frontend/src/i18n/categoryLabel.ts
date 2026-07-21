import type { LocalizedMessage } from '@/types/domain'

type CategoryLabelSource = { name: string; systemKey?: string }
type DescriptorTranslator = (message: LocalizedMessage | string) => string

export function categoryLabel(category: CategoryLabelSource, translateDescriptor: DescriptorTranslator) {
  return category.systemKey
    ? translateDescriptor({ key: category.systemKey, fallback: category.name })
    : category.name
}
