import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { RadioTower, RefreshCw } from 'lucide-react'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { Button, PageSkeleton, Skeleton, SynthCard } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'

type BoundaryMode = 'screen' | 'content' | 'panel'

interface ChunkErrorBoundaryProps {
  children: ReactNode
  mode: BoundaryMode
}

interface ChunkErrorBoundaryState {
  failed: boolean
}

function ChunkErrorView({ mode }: { mode: BoundaryMode }) {
  const { t } = useI18n()
  const card = (
    <SynthCard className="w-full max-w-xl p-6 text-center sm:p-8" tone="danger" role="alert">
      <RadioTower className="mx-auto size-10 text-neon-magenta" aria-hidden="true" />
      <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-neon-magenta uppercase">SIGNAL LOST</p>
      <h2 className="mt-2 font-display text-xl font-black text-text-glow sm:text-2xl">{t('error.chunk.title')}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-muted">{t('error.chunk.description')}</p>
      <Button className="mt-6" icon={RefreshCw} onClick={() => window.location.reload()}>{t('common.retry')}</Button>
    </SynthCard>
  )

  if (mode === 'screen') {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <AmbientBackground />
        <main className="relative z-10 grid min-h-screen place-items-center p-4">{card}</main>
      </div>
    )
  }

  return <div className={mode === 'panel' ? 'grid min-h-72 place-items-center' : 'grid min-h-[55vh] place-items-center'}>{card}</div>
}

class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Deferred frontend module failed to render.', error, info)
  }

  render() {
    if (this.state.failed) return <ChunkErrorView mode={this.props.mode} />
    return this.props.children
  }
}

export function AsyncBoundary({ children, fallback, mode = 'content' }: { children: ReactNode; fallback: ReactNode; mode?: BoundaryMode }) {
  return <ChunkErrorBoundary mode={mode}><Suspense fallback={fallback}>{children}</Suspense></ChunkErrorBoundary>
}

export function FullPageLoader({ labelKey = 'loading.module' }: { labelKey?: TranslationKey }) {
  const { t } = useI18n()
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AmbientBackground />
      <main className="relative z-10 grid min-h-screen place-items-center px-4">
        <div role="status" aria-live="polite" className="w-full max-w-sm rounded-xl border border-neon-cyan/20 bg-space-black/72 p-6 text-center shadow-[0_0_35px_rgba(0,255,255,.08)] backdrop-blur-xl">
          <span className="mx-auto mb-4 block size-3 animate-pulse rounded-full bg-neon-cyan shadow-[0_0_16px_rgba(0,255,255,.8)]" aria-hidden="true" />
          <p className="font-mono text-xs font-bold tracking-[0.16em] text-neon-cyan uppercase">{t(labelKey)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true"><Skeleton className="h-1" /><Skeleton className="h-1" /><Skeleton className="h-1" /></div>
        </div>
      </main>
    </div>
  )
}

export function PageRouteLoader() {
  const { t } = useI18n()
  return <div role="status" aria-live="polite"><span className="sr-only">{t('loading.module')}</span><PageSkeleton /></div>
}

export function StorePanelLoader() {
  const { t } = useI18n()
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{t('loading.store')}</span>
      <Skeleton className="h-10" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  )
}
