import { useState } from 'react'
import { Accessibility, BellRing, CircleHelp, Eye, Globe2, Palette, Play, Save, Settings, Shield, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { CategoryManager } from '@/components/settings/CategoryManager'
import { Button, Field, Input, PageSkeleton, Select, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { localeOptions, resolveLocale, type SupportedLocale } from '@/i18n/locales'
import { catalogs } from '@/i18n/messages'
import type { UserPreferences } from '@/types/domain'
import { useHelpCenter } from '@/components/help/HelpCenterContext'

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-outline-soft/45 py-4 last:border-0"><span><strong className="block text-sm">{label}</strong><small className="mt-1 block max-w-lg text-xs leading-5 text-text-muted">{description}</small></span><input className="peer sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="relative mt-1 h-6 w-11 shrink-0 rounded-full border border-outline-soft bg-panel-high transition peer-checked:border-neon-cyan/60 peer-checked:bg-neon-cyan/20 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-tertiary after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-text-muted after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-neon-cyan peer-checked:after:shadow-[0_0_8px_#00ffff]" aria-hidden="true" /></label>
}

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { startTour } = useHelpCenter()
  const { data, loading, updateLocale, updatePreferences } = useAppData()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [languageBusy, setLanguageBusy] = useState(false)
  const [languageNotice, setLanguageNotice] = useState<{ message: string; failed: boolean } | null>(null)
  if (loading || !data) return <PageSkeleton />
  const profile = data.profile
  const current = preferences ?? profile.preferences
  const change = (key: keyof UserPreferences, value: boolean) => { setPreferences({ ...current, [key]: value }); setSaved(false) }
  async function save() { setSaving(true); try { await updatePreferences(current); setPreferences(null); setSaved(true) } finally { setSaving(false) } }

  async function changeLanguage(next: SupportedLocale) {
    const previous = resolveLocale(profile.locale)
    setLanguageBusy(true)
    setLanguageNotice(null)
    setLocale(next)
    try {
      await updateLocale(next)
      setLanguageNotice({ message: catalogs[next]['profile.languageSaved'], failed: false })
    } catch {
      setLocale(previous)
      setLanguageNotice({ message: catalogs[previous]['profile.languageFailed'], failed: true })
    } finally {
      setLanguageBusy(false)
    }
  }

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} description={t('settings.description')} icon={Settings} tourId="settings-header" actions={<Button icon={Save} loading={saving} onClick={() => void save()}>{t('settings.saveChanges')}</Button>} />
      {saved && <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-sm text-success">{t('settings.saved')}</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        <SynthCard className="p-5 sm:p-6" data-tour="settings-region">
          <div className="mb-4 flex items-center gap-2"><Globe2 className="size-4 text-neon-cyan" /><h2 className="font-display text-sm font-bold uppercase">{t('settings.region')}</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('profile.language')} htmlFor="settings-language" hint={t('profile.languageHint')}>
              <Select id="settings-language" value={locale} disabled={languageBusy} onChange={(event) => void changeLanguage(event.target.value as SupportedLocale)}>
                {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <Field label={t('settings.primaryCurrency')} htmlFor="settings-currency"><Select id="settings-currency" defaultValue={profile.primaryCurrency}><option>EUR</option><option>USD</option><option>GBP</option></Select></Field>
            <Field label={t('profile.timezone')} htmlFor="settings-timezone"><Select id="settings-timezone" defaultValue={profile.timezone}><option>Europe/Madrid</option><option>UTC</option><option>America/New_York</option></Select></Field>
            <Field label={t('settings.weekStart')} htmlFor="settings-week"><Select id="settings-week" defaultValue={String(profile.weekStartsOn)}><option value="1">{t('profile.monday')}</option><option value="7">{t('profile.sunday')}</option></Select></Field>
          </div>
          {languageNotice && <p className={`mt-4 rounded-lg border p-3 text-xs ${languageNotice.failed ? 'border-neon-magenta/25 bg-neon-magenta/5 text-neon-magenta' : 'border-success/25 bg-success/5 text-success'}`} role={languageNotice.failed ? 'alert' : 'status'} aria-live="polite">{languageNotice.message}</p>}
          <p className="mt-4 rounded-lg border border-sunset/20 bg-sunset/5 p-3 text-xs leading-5 text-text-muted">{t('settings.currencyWarning')}</p>
        </SynthCard>
        <SynthCard className="p-5 sm:p-6" data-tour="settings-experience">
          <div className="flex items-center gap-2"><Palette className="size-4 text-neon-magenta" /><h2 className="font-display text-sm font-bold uppercase">{t('settings.experience')}</h2></div>
          <div className="mt-2">
            <Toggle checked={current.ambientEffects} onChange={(value) => change('ambientEffects', value)} label={t('settings.ambient')} description={t('settings.ambientDesc')} />
            <Toggle checked={current.scanlines} onChange={(value) => change('scanlines', value)} label={t('settings.scanlines')} description={t('settings.scanlinesDesc')} />
            <Toggle checked={current.audioReactive} onChange={(value) => change('audioReactive', value)} label={t('settings.audioReactive')} description={t('settings.audioReactiveDesc')} />
            <Toggle checked={current.reducedMotion} onChange={(value) => change('reducedMotion', value)} label={t('settings.reducedMotion')} description={t('settings.reducedMotionDesc')} />
            <Toggle checked={current.compactMode} onChange={(value) => change('compactMode', value)} label={t('settings.compact')} description={t('settings.compactDesc')} />
          </div>
        </SynthCard>
        <SynthCard className="p-5 sm:p-6" data-tour="settings-help">
          <div className="flex items-center gap-2"><CircleHelp className="size-4 text-neon-cyan" /><h2 className="font-display text-sm font-bold uppercase">{t('settings.helpTitle')}</h2></div>
          <p className="mt-2 text-xs leading-5 text-text-muted">{t('settings.helpDescription')}</p>
          <div className="mt-2">
            <Toggle checked={current.helpHints} onChange={(value) => change('helpHints', value)} label={t('settings.helpHints')} description={t('settings.helpHintsDesc')} />
          </div>
          <div className="mt-4 rounded-lg border border-neon-cyan/15 bg-neon-cyan/[0.035] p-4">
            <p className="mb-4 text-xs leading-5 text-text-muted">{t('settings.tourDescription')}</p>
            <Button icon={Play} variant="cyan" onClick={startTour}>{t('settings.startTour')}</Button>
          </div>
        </SynthCard>
        <div data-tour="settings-categories"><CategoryManager /></div>
        <div className="grid gap-4">
          <SynthCard className="p-5 sm:p-6" data-tour="settings-accessibility"><div className="mb-4 flex items-center gap-2"><Accessibility className="size-4 text-success" /><h2 className="font-display text-sm font-bold uppercase">{t('settings.accessibility')}</h2></div><ul className="grid gap-3 text-sm text-text-muted"><li className="flex gap-2"><Eye className="mt-0.5 size-4 shrink-0 text-neon-cyan" />{t('settings.contrast')}</li><li className="flex gap-2"><SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-tertiary" />{t('settings.keyboard')}</li><li className="flex gap-2"><BellRing className="mt-0.5 size-4 shrink-0 text-sunset" />{t('settings.stateText')}</li></ul></SynthCard>
          <SynthCard className="p-5 sm:p-6" tone="danger" data-tour="settings-privacy"><div className="mb-3 flex items-center gap-2"><Shield className="size-4 text-neon-magenta" /><h2 className="font-display text-sm font-bold uppercase">{t('settings.privacy')}</h2></div><p className="text-sm leading-6 text-text-muted">{t('settings.deleteDesc')}</p><div className="mt-4 flex gap-3"><Field label={t('auth.confirmation')} htmlFor="delete-account"><Input id="delete-account" placeholder={t('settings.deletePlaceholder')} /></Field><Button className="self-end" variant="magenta" icon={Trash2} disabled>{t('common.delete')}</Button></div></SynthCard>
        </div>
      </div>
    </div>
  )
}
