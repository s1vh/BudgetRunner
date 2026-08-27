/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share one context module */
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAppData } from '@/app/AppDataContext'
import { Button, Progress, SynthCard } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'

interface TourStep {
  route?: string
  target?: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
}

const tourSteps: readonly TourStep[] = [
  { route: '/', titleKey: 'tour.welcome.title', bodyKey: 'tour.welcome.body' },
  { route: '/', target: 'dashboard-header', titleKey: 'tour.dashboard.title', bodyKey: 'tour.dashboard.body' },
  { route: '/', target: 'dashboard-metrics', titleKey: 'tour.dashboard.metrics.title', bodyKey: 'tour.dashboard.metrics.body' },
  { route: '/', target: 'dashboard-distribution', titleKey: 'dashboard.distribution', bodyKey: 'help.dashboard.distribution' },
  { route: '/', target: 'dashboard-recent', titleKey: 'dashboard.transmissions', bodyKey: 'help.dashboard.recent' },
  { route: '/', target: 'dashboard-cashflow', titleKey: 'dashboard.monthlyFlow', bodyKey: 'help.dashboard.cashflow' },
  { route: '/transactions', target: 'transactions-header', titleKey: 'tour.transactions.title', bodyKey: 'tour.transactions.body' },
  { route: '/transactions', target: 'transactions-summary', titleKey: 'tour.transactions.summary.title', bodyKey: 'tour.transactions.summary.body' },
  { route: '/transactions', target: 'transactions-filters', titleKey: 'tour.transactions.filters.title', bodyKey: 'help.transactions.filters' },
  { route: '/transactions', target: 'transactions-list', titleKey: 'tour.transactions.list.title', bodyKey: 'help.transactions.list' },
  { route: '/budgets', target: 'budgets-header', titleKey: 'tour.budgets.title', bodyKey: 'tour.budgets.body' },
  { route: '/budgets', target: 'budgets-filters', titleKey: 'tour.budgets.filters.title', bodyKey: 'tour.budgets.filters.body' },
  { route: '/budgets', target: 'budgets-cards', titleKey: 'tour.budgets.cards.title', bodyKey: 'tour.budgets.cards.body' },
  { route: '/gamification', target: 'game-tabs', titleKey: 'tour.game.title', bodyKey: 'tour.game.body' },
  { route: '/gamification', target: 'game-summary', titleKey: 'tour.game.summary.title', bodyKey: 'tour.game.summary.body' },
  { route: '/gamification', target: 'game-flux', titleKey: 'profile.totalFlux', bodyKey: 'tour.game.flux.body' },
  { route: '/gamification', target: 'game-families', titleKey: 'game.familyBonus', bodyKey: 'help.game.family' },
  { route: '/gamification', target: 'game-deck', titleKey: 'game.tab.deck', bodyKey: 'tour.game.cyberdeck.body' },
  { route: '/gamification', target: 'game-store', titleKey: 'game.tab.store', bodyKey: 'help.game.storeModule' },
  { route: '/gamification', target: 'game-repairs', titleKey: 'game.tab.repairs', bodyKey: 'help.game.repairModule' },
  { route: '/gamification', target: 'game-history', titleKey: 'game.tab.history', bodyKey: 'help.game.history' },
  { route: '/profile', target: 'profile-identity', titleKey: 'tour.profile.identity.title', bodyKey: 'tour.profile.identity.body' },
  { route: '/profile', target: 'profile-progress', titleKey: 'tour.profile.progress.title', bodyKey: 'tour.profile.progress.body' },
  { route: '/profile', target: 'profile-history', titleKey: 'profile.levelHistory', bodyKey: 'tour.profile.history.body' },
  { route: '/profile', target: 'profile-regional', titleKey: 'profile.regionalContext', bodyKey: 'tour.profile.region.body' },
  { route: '/settings', target: 'settings-header', titleKey: 'tour.settings.title', bodyKey: 'tour.settings.body' },
  { route: '/settings', target: 'settings-region', titleKey: 'settings.region', bodyKey: 'tour.settings.region.body' },
  { route: '/settings', target: 'settings-experience', titleKey: 'settings.experience', bodyKey: 'tour.settings.experience.body' },
  { route: '/settings', target: 'settings-help', titleKey: 'settings.helpTitle', bodyKey: 'tour.settings.help.body' },
  { route: '/settings', target: 'settings-categories', titleKey: 'tour.settings.categories.title', bodyKey: 'tour.settings.categories.body' },
  { route: '/settings', target: 'settings-accessibility', titleKey: 'settings.accessibility', bodyKey: 'tour.settings.accessibility.body' },
  { route: '/settings', target: 'settings-privacy', titleKey: 'settings.privacy', bodyKey: 'tour.settings.privacy.body' },
]

interface HelpCenterValue {
  startTour: () => void
  tourOpen: boolean
  activeTourTarget: string | null
}

const HelpCenterContext = createContext<HelpCenterValue | null>(null)

function GuidedTour({ open, stepIndex, onStepChange, onExit, onFinish }: {
  open: boolean
  stepIndex: number
  onStepChange: (step: number) => void
  onExit: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const step = tourSteps[stepIndex] ?? tourSteps[0]
  const lastStep = stepIndex === tourSteps.length - 1

  useEffect(() => {
    if (!open) return
    if (step.route && location.pathname !== step.route) navigate(step.route)
  }, [location.pathname, navigate, open, step.route])

  useEffect(() => {
    if (!open) return
    const measure = () => {
      const target = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      setTargetRect(target?.getBoundingClientRect() ?? null)
    }
    const reveal = () => {
      const target = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      if (target) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      else if (step.route) window.scrollTo({ top: 0, behavior: 'auto' })
      measure()
    }
    const frame = window.requestAnimationFrame(reveal)
    const delayed = window.setTimeout(reveal, 180)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(delayed)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [location.pathname, open, step.route, step.target])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
      if (event.key === 'ArrowRight' && !lastStep) onStepChange(stepIndex + 1)
      if (event.key === 'ArrowLeft' && stepIndex > 0) onStepChange(stepIndex - 1)
      if (event.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], select, input, [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lastStep, onExit, onStepChange, open, stepIndex])

  if (!open) return null

  return (
    <div className="tour-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onExit() }}>
      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            left: Math.max(8, targetRect.left - 8),
            top: Math.max(8, targetRect.top - 8),
            width: Math.min(window.innerWidth - 16, targetRect.width + 16),
            height: Math.min(window.innerHeight - 16, targetRect.height + 16),
          }}
          aria-hidden="true"
        />
      )}
      <SynthCard
        ref={panelRef}
        tabIndex={-1}
        className="tour-panel p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.14em] text-neon-cyan uppercase">{t('tour.progress', { current: stepIndex + 1, total: tourSteps.length })}</span>
          <button type="button" className="tour-exit" onClick={onExit} aria-label={t('tour.exit')}><X className="size-4" />{t('tour.exit')}</button>
        </div>
        <div className="mt-3"><Progress value={stepIndex + 1} max={tourSteps.length} tone="cyan" /></div>
        <h2 id="tour-title" className="mt-5 font-display text-xl font-black text-text-glow sm:text-2xl">{t(step.titleKey)}</h2>
        <p id="tour-description" className="mt-3 text-sm leading-6 text-text-muted">{t(step.bodyKey)}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" icon={ArrowLeft} disabled={stepIndex === 0} onClick={() => onStepChange(stepIndex - 1)}>{t('tour.back')}</Button>
          {lastStep
            ? <Button icon={Check} onClick={onFinish}>{t('tour.finish')}</Button>
            : <Button icon={ArrowRight} onClick={() => onStepChange(stepIndex + 1)}>{t('tour.next')}</Button>}
        </div>
      </SynthCard>
    </div>
  )
}

export function HelpCenterProvider({ children }: { children: ReactNode }) {
  const { data, completeGuidedTour } = useAppData()
  const navigate = useNavigate()
  const [tourOpen, setTourOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const autoStartedUsers = useRef(new Set<string>())

  const startTour = useCallback(() => {
    setStepIndex(0)
    setTourOpen(true)
  }, [])

  useEffect(() => {
    const profile = data?.profile
    if (!profile || profile.guidedTourCompleted || autoStartedUsers.current.has(profile.id)) return
    autoStartedUsers.current.add(profile.id)
    startTour()
  }, [data?.profile, startTour])

  const markTourCompleted = useCallback(() => {
    if (!data?.profile.guidedTourCompleted) void completeGuidedTour().catch(() => undefined)
  }, [completeGuidedTour, data?.profile.guidedTourCompleted])

  const exitTour = useCallback(() => {
    setTourOpen(false)
    markTourCompleted()
  }, [markTourCompleted])

  const finishTour = useCallback(() => {
    setTourOpen(false)
    navigate('/')
    window.scrollTo({ top: 0, behavior: 'auto' })
    markTourCompleted()
  }, [markTourCompleted, navigate])

  const activeTourTarget = tourOpen ? tourSteps[stepIndex]?.target ?? null : null
  const value = useMemo<HelpCenterValue>(() => ({ startTour, tourOpen, activeTourTarget }), [activeTourTarget, startTour, tourOpen])

  return (
    <HelpCenterContext.Provider value={value}>
      {children}
      <GuidedTour open={tourOpen} stepIndex={stepIndex} onStepChange={setStepIndex} onExit={exitTour} onFinish={finishTour} />
    </HelpCenterContext.Provider>
  )
}

export function useHelpCenter() {
  const context = useContext(HelpCenterContext)
  if (!context) throw new Error('useHelpCenter must be used within HelpCenterProvider.')
  return context
}
