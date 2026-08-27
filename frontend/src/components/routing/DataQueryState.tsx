import { useEffect, useState, type ReactNode } from 'react'
import { RadioTower, RefreshCw } from 'lucide-react'
import { Button, PageSkeleton, Skeleton, SynthCard } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'

type DataStateMode = 'page' | 'panel'

function LoadingShape({ mode }: { mode: DataStateMode }) {
  if (mode === 'page') return <PageSkeleton />
  return <div className="grid gap-4"><Skeleton className="h-10" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>
}

export function DataLoadingState({ mode = 'page', labelKey = 'loading.data' }: { mode?: DataStateMode; labelKey?: TranslationKey }) {
  const { t } = useI18n()
  const [showLabel, setShowLabel] = useState(false)
  const [showSlowMessage, setShowSlowMessage] = useState(false)

  useEffect(() => {
    const labelTimer = window.setTimeout(() => setShowLabel(true), 700)
    const slowTimer = window.setTimeout(() => setShowSlowMessage(true), 3_000)
    return () => {
      window.clearTimeout(labelTimer)
      window.clearTimeout(slowTimer)
    }
  }, [])

  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <LoadingShape mode={mode} />
      {showLabel && <div className="rounded-lg border border-neon-cyan/15 bg-neon-cyan/[0.035] px-4 py-3 font-mono text-[10px] tracking-[0.12em] text-neon-cyan uppercase"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-neon-cyan shadow-[0_0_9px_#00ffff]" aria-hidden="true" />{t(labelKey)}{showSlowMessage && <span className="mt-1 block normal-case tracking-normal text-text-muted">{t('loading.dataSlow')}</span>}</div>}
    </div>
  )
}

export function DataErrorState({ onRetry, mode = 'page' }: { onRetry: () => void; mode?: DataStateMode }) {
  const { t } = useI18n()
  return (
    <div className={mode === 'page' ? 'grid min-h-[55vh] place-items-center' : 'grid min-h-72 place-items-center'}>
      <SynthCard className="w-full max-w-xl p-6 text-center sm:p-8" tone="danger" role="alert">
        <RadioTower className="mx-auto size-10 text-neon-magenta" aria-hidden="true" />
        <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-neon-magenta uppercase">DATA LINK LOST</p>
        <h2 className="mt-2 font-display text-xl font-black text-text-glow sm:text-2xl">{t('error.data.title')}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-muted">{t('error.data.description')}</p>
        <Button className="mt-6" icon={RefreshCw} onClick={onRetry}>{t('common.retry')}</Button>
      </SynthCard>
    </div>
  )
}

export function DataQueryState({ pending, error, retry, mode = 'page', labelKey, children }: {
  pending: boolean
  error: boolean
  retry: () => void
  mode?: DataStateMode
  labelKey?: TranslationKey
  children: ReactNode
}) {
  if (pending) return <DataLoadingState mode={mode} labelKey={labelKey} />
  if (error) return <DataErrorState mode={mode} onRetry={retry} />
  return children
}
