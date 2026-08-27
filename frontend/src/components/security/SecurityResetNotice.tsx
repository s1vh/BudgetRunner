import { useEffect, useState } from 'react'
import { RadioTower, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { consumeSecurityResetNotice, hasSecurityResetNotice } from '@/security/securityReset'

export function SecurityResetNotice() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(hasSecurityResetNotice)

  useEffect(() => {
    if (visible) consumeSecurityResetNotice()
  }, [visible])

  if (!visible) return null
  return (
    <div className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-2xl rounded-xl border border-neon-magenta/45 bg-[#160d25]/95 p-4 text-text-glow shadow-[0_0_32px_rgba(255,0,127,0.22)] backdrop-blur" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-neon-magenta/35 bg-neon-magenta/10 text-neon-magenta"><RadioTower className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <strong className="font-display text-sm tracking-[0.08em] uppercase">{t('recovery.title')}</strong>
          <p className="mt-1 text-sm leading-5 text-text-muted">{t('recovery.description')}</p>
        </div>
        <button type="button" onClick={() => setVisible(false)} className="grid size-9 shrink-0 place-items-center rounded-lg text-text-muted transition hover:bg-white/5 hover:text-text-glow" aria-label={t('common.close')}><X className="size-4" /></button>
      </div>
    </div>
  )
}
