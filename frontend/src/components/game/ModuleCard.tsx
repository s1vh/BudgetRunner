import { Battery, Cpu, Shield, Sparkles, Zap } from 'lucide-react'
import { Badge, Progress, SynthCard } from '@/components/ui/primitives'
import type { CyberModule, ModuleRarity } from '@/types/domain'
import { familyColors } from './CyberdeckDiagram'

const rarityTone: Record<ModuleRarity, 'muted' | 'cyan' | 'purple' | 'warning' | 'magenta'> = { common: 'muted', rare: 'cyan', epic: 'purple', legendary: 'warning', mythic: 'magenta' }

export function ModuleCard({ module, onClick, footer }: { module: CyberModule; onClick?: () => void; footer?: React.ReactNode }) {
  const critical = module.energy <= 25 && module.energy > 0
  const damaged = module.energy < 50 && module.energy > 0
  return (
    <SynthCard className="flex h-full flex-col p-4" interactive={Boolean(onClick)} tone={module.state === 'destroyed' || critical ? 'danger' : 'default'} onClick={onClick} style={{ '--module-color': familyColors[module.family] } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3"><div className="icon-chip" style={{ color: familyColors[module.family], borderColor: `${familyColors[module.family]}55` }}><Cpu className="size-5" /></div><Badge tone={rarityTone[module.rarity]}>{module.rarity}</Badge></div>
      <div className="mt-4"><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{module.slotLabel}</p><h3 className="mt-1 font-display text-sm font-bold" style={{ color: familyColors[module.family] }}>{module.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">{module.description}</p></div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-white/7 bg-white/[0.025] p-2 text-center font-mono text-[10px]"><span><Zap className="mx-auto mb-1 size-3 text-neon-cyan" /><strong>{module.power}</strong></span><span><Shield className="mx-auto mb-1 size-3 text-tertiary" /><strong>{module.shield}</strong></span><span><Battery className="mx-auto mb-1 size-3 text-sunset" /><strong>{module.energy}%</strong></span></div>
      <div className="mt-4"><Progress value={module.energy} tone={module.state === 'destroyed' || critical ? 'magenta' : damaged ? 'warning' : 'cyan'} />{module.state === 'destroyed' ? <p className="mt-2 flex items-center gap-1 text-[10px] text-neon-magenta"><Sparkles className="size-3" />Módulo destruido</p> : critical ? <p className="mt-2 text-[10px] text-neon-magenta">Fallo crítico inminente</p> : damaged ? <p className="mt-2 text-[10px] text-sunset">Integridad comprometida</p> : null}</div>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </SynthCard>
  )
}
