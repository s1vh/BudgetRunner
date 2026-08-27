import { useState } from 'react'
import { Coins, LockKeyhole, PackageOpen } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { ModuleCard } from '@/components/game/ModuleCard'
import { Badge, Button, Modal, SynthCard } from '@/components/ui/primitives'
import { useI18n } from '@/i18n/I18nContext'
import type { StoreOffer } from '@/types/domain'
import { formatDate } from '@/utils/format'
import { useStoreOffersQuery } from '@/app/dataQueries'
import { DataQueryState } from '@/components/routing/DataQueryState'
import type { ProgressSummary } from '@/types/domain'

export function GameStorePanel({ progress, onNotice }: { progress: ProgressSummary; onNotice: (message: string) => void }) {
  const { t } = useI18n()
  const { purchaseModule } = useAppData()
  const offersQuery = useStoreOffersQuery()
  const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  if (offersQuery.isPending || offersQuery.isError || !offersQuery.data) return <DataQueryState mode="panel" pending={offersQuery.isPending} error={offersQuery.isError} retry={() => void offersQuery.refetch()} labelKey="loading.store"><span /></DataQueryState>
  const currentOffers = offersQuery.data
  const offerCount = currentOffers.length

  return (
    <>
      <section data-tour="game-store">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">{offerCount > 0 ? t(offerCount === 1 ? 'game.rotation.one' : 'game.rotation.other', { count: offerCount, date: formatDate(currentOffers[0]!.expiresAt) }) : t('game.rotationEmpty')}</p>
          <Badge tone={offerCount > 0 ? 'success' : 'purple'}><PackageOpen className="size-3" />{offerCount > 0 ? t('game.purchasesAvailable') : t('game.noOffers')}</Badge>
        </div>
        {offerCount > 0
          ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{currentOffers.map((offer) => <ModuleCard key={offer.id} module={offer.module} helpKey="help.game.storeModule" footer={<div className="flex items-center justify-between gap-3"><div><span className="block font-mono text-[9px] text-text-muted">{t('game.netCost')}</span><strong className="font-display text-lg text-sunset">{offer.netCost} SC</strong></div><Button className="px-3 text-[10px]" variant={offer.minLevel > progress.level ? 'ghost' : 'cyan'} disabled={offer.minLevel > progress.level} onClick={(event) => { event.stopPropagation(); setSelectedOffer(offer) }}>{offer.minLevel > progress.level ? t('common.level', { level: offer.minLevel }) : t('game.buy')}</Button></div>} />)}</div>
          : <SynthCard className="p-8 pr-14 text-center" helpKey="help.game.storeEmpty"><PackageOpen className="mx-auto mb-3 size-8 text-tertiary" /><h3 className="font-display text-sm uppercase">{t('game.rotationComplete')}</h3><p className="mt-2 text-sm text-text-muted">{t('game.rotationCompleteDesc')}</p></SynthCard>}
      </section>

      <Modal open={Boolean(selectedOffer)} onClose={() => setSelectedOffer(null)} title={t('game.acquire', { name: selectedOffer?.module.name ?? '' })} description={t('game.acquireDesc')}>
        {selectedOffer && <div className="grid gap-5"><div className="grid grid-cols-3 gap-3 font-mono text-center text-xs"><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">{t('game.price')}</span><strong className="mt-2 block text-lg">{selectedOffer.module.priceCoins}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">{t('game.tradeIn')}</span><strong className="mt-2 block text-lg text-tertiary">−{selectedOffer.tradeInValue}</strong></div><div className="rounded-lg border border-sunset/20 p-3"><span className="text-text-muted">{t('game.net')}</span><strong className="mt-2 block text-lg text-sunset">{selectedOffer.netCost}</strong></div></div><div className="flex items-center gap-2 rounded-lg border border-neon-magenta/20 bg-neon-magenta/5 p-3 text-xs text-text-muted"><LockKeyhole className="size-4 shrink-0 text-neon-magenta" />{t('game.serverRecalculation')}</div><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setSelectedOffer(null)}>{t('common.cancel')}</Button><Button icon={Coins} loading={actionBusy === selectedOffer.id} onClick={async () => { setActionBusy(selectedOffer.id); try { await purchaseModule(selectedOffer.id); onNotice(t('game.purchaseConfirmed', { name: selectedOffer.module.name })); setSelectedOffer(null) } catch (caught) { onNotice(caught instanceof Error ? caught.message : t('game.purchaseFailed')) } finally { setActionBusy(null) } }}>{t('game.confirmPurchase')}</Button></div></div>}
      </Modal>
    </>
  )
}
