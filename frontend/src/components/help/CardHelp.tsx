import { CircleHelp } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useOptionalAppData } from '@/app/AppDataContext'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'

interface TooltipPosition {
  left: number
  top: number
  width: number
}

export function CardHelp({ messageKey }: { messageKey: TranslationKey }) {
  const { t } = useI18n()
  const appData = useOptionalAppData()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const lastPointerType = useRef('mouse')
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({ left: 16, top: 16, width: 320 })
  const enabled = appData?.profile?.preferences.helpHints ?? false

  const placeTooltip = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const gutter = 12
    const width = Math.min(340, window.innerWidth - 32)
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.right - width))
    const estimatedHeight = 150
    const top = rect.bottom + gutter + estimatedHeight <= window.innerHeight
      ? rect.bottom + gutter
      : Math.max(16, rect.top - estimatedHeight - gutter)
    setPosition({ left, top, width })
  }, [])

  useLayoutEffect(() => {
    if (open) placeTooltip()
  }, [open, placeTooltip])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onPointerDown = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onViewportChange = () => placeTooltip()
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, placeTooltip])

  if (!enabled) return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="card-help-trigger"
        aria-label={t('help.openLabel')}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation()
          if (lastPointerType.current === 'touch') setOpen((current) => !current)
          else setOpen(true)
        }}
        onPointerDown={(event) => { lastPointerType.current = event.pointerType; event.stopPropagation() }}
      >
        <CircleHelp className="size-5" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="card-help-tooltip"
          style={{ left: position.left, top: position.top, width: position.width }}
        >
          {t(messageKey)}
        </div>,
        document.body,
      )}
    </>
  )
}
