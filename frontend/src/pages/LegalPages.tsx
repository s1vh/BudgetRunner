import { ArrowLeft, FileKey2, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { Button, SynthCard } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'

export function LicensePage() {
  const { t } = useI18n()
  return <SynthCard className="w-full max-w-3xl p-6 sm:p-8"><FileKey2 className="size-7 text-neon-cyan" /><h1 className="mt-4 font-display text-2xl font-black">MIT License</h1><p className="mt-2 font-mono text-xs text-text-muted">Copyright © 2026 Mike Fieldins</p><div className="mt-6 space-y-4 text-sm leading-7 text-text-muted"><p>{t('legal.permission')}</p><p>{t('legal.warranty')}</p></div><Link to="/"><Button className="mt-7" variant="ghost" icon={ArrowLeft}>{t('legal.backDashboard')}</Button></Link></SynthCard>
}

export function PrivacyPage() {
  const { t } = useI18n()
  return <SynthCard className="w-full max-w-3xl p-6 sm:p-8"><ShieldCheck className="size-7 text-success" /><h1 className="mt-4 font-display text-2xl font-black">{t('privacy.title')}</h1><div className="mt-6 space-y-4 text-sm leading-7 text-text-muted"><p>{t('privacy.demo')}</p><p>{t('privacy.future')}</p><p>{t('privacy.deletion')}</p></div><Link to="/"><Button className="mt-7" variant="ghost" icon={ArrowLeft}>{t('legal.backDashboard')}</Button></Link></SynthCard>
}
