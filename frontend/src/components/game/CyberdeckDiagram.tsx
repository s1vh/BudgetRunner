/* eslint-disable react-refresh/only-export-components -- family color tokens are colocated with the diagram */
import { useState } from 'react'
import type { CyberModule, ModuleFamily } from '@/types/domain'
import { WireframeDeviceCanvas } from './WireframeDeviceCanvas'
import { useI18n } from '@/i18n/I18nContext'

const familyColors: Record<ModuleFamily, string> = { retrowave: '#FFD43F', synthwave: '#00FFFF', vaporwave: '#A69DFF', hifi_tech: '#E7F7FF' }
const positions = [
  { x: 25, y: 35, side: 'left' }, { x: 25, y: 155, side: 'left' }, { x: 25, y: 275, side: 'left' }, { x: 25, y: 395, side: 'left' },
  { x: 665, y: 35, side: 'right' }, { x: 665, y: 155, side: 'right' }, { x: 665, y: 275, side: 'right' }, { x: 665, y: 395, side: 'right' },
  { x: 245, y: 520, side: 'bottom' }, { x: 445, y: 520, side: 'bottom' },
] as const

function connectorPath(position: (typeof positions)[number]) {
  const startX = position.side === 'left' ? position.x + 170 : position.side === 'right' ? position.x : position.x + 85
  const startY = position.side === 'bottom' ? position.y : position.y + 47
  const controlX = position.side === 'left' ? 250 : position.side === 'right' ? 610 : startX
  const controlY = position.side === 'bottom' ? 475 : 315
  return `M ${startX} ${startY} Q ${controlX} ${controlY} 430 315`
}

export function CyberdeckDiagram({ modules, selectedId, onSelect }: { modules: CyberModule[]; selectedId?: string; onSelect: (module: CyberModule) => void }) {
  const { t, td } = useI18n()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const activeId = hoveredId ?? selectedId
  const activeModule = modules.find((module) => module.instanceId === activeId)
  const highlightedSlot = activeModule?.slot
  const highlightedColor = activeModule?.state === 'destroyed' ? '#FF6E84' : activeModule?.state === 'empty' ? '#663A52' : activeModule ? familyColors[activeModule.family] : undefined

  return (
    <div className="relative overflow-x-auto rounded-xl border border-outline-soft/50 bg-void/72 p-2 shadow-[inset_0_0_60px_rgba(139,0,255,.12)]">
      <div className="relative min-w-[820px] overflow-hidden rounded-lg">
        <WireframeDeviceCanvas highlightedSlot={highlightedSlot} highlightColor={highlightedColor} />
        <svg viewBox="0 0 860 630" className="relative z-10 min-w-[820px]" role="group" aria-label={t('game.diagramAria')}>
          <defs>
            <filter id="deck-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <pattern id="micro-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 18 0 L 0 0 0 18" fill="none" stroke="#663a52" strokeOpacity="0.2" strokeWidth="1" /></pattern>
            <linearGradient id="node-panel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#0C0914" stopOpacity="0.96" /><stop offset="1" stopColor="#220216" stopOpacity="0.9" /></linearGradient>
          </defs>
          <rect width="860" height="630" rx="18" fill="#050508" fillOpacity="0.23" />
          <rect width="860" height="630" rx="18" fill="url(#micro-grid)" />

          <g fill="none" strokeDasharray="5 7">
            {modules.map((module, index) => {
              const position = positions[index]
              if (!position) return null
              const color = module.state === 'destroyed' ? '#FF6E84' : module.state === 'empty' ? '#663A52' : familyColors[module.family]
              const active = activeId === module.instanceId
              return <path key={module.instanceId} d={connectorPath(position)} stroke={active ? color : '#8B00FF'} strokeOpacity={active ? 0.95 : 0.36} strokeWidth={active ? 3 : 1.5} filter={active ? 'url(#deck-glow)' : undefined} className="transition-all duration-200" />
            })}
          </g>
          <g opacity="0.7">
            <circle cx="430" cy="315" r="74" fill="#050508" fillOpacity="0.3" stroke="#00FFFF" strokeOpacity="0.35" strokeDasharray="3 10" />
            <circle cx="430" cy="315" r="55" fill="none" stroke="#FF007F" strokeOpacity="0.32" strokeDasharray="12 8" />
            <circle cx="430" cy="315" r="31" fill="#0B0C10" fillOpacity="0.62" stroke="#A69DFF" strokeWidth="1.5" filter="url(#deck-glow)" />
            <text x="430" y="312" textAnchor="middle" fill="#00FFFF" fontFamily="Orbitron" fontSize="8" letterSpacing="2">{t('game.wrist')}</text>
            <text x="430" y="326" textAnchor="middle" fill="#F4F4F9" fontFamily="Orbitron" fontSize="9" letterSpacing="1">{t('game.core')}</text>
          </g>

          {modules.map((module, index) => {
            const position = positions[index]
            if (!position) return null
            const { x, y, side } = position
            const color = module.state === 'destroyed' ? '#FF6E84' : module.state === 'empty' ? '#663A52' : familyColors[module.family]
            const active = activeId === module.instanceId
            const selected = selectedId === module.instanceId
            const selectable = module.state !== 'empty'
            const connectorX = side === 'left' ? x + 178 : side === 'right' ? x - 8 : x + 85
            const connectorY = side === 'bottom' ? y - 8 : y + 47
            const nodePath = `M ${x + 9} ${y} H ${x + 148} L ${x + 170} ${y + 22} V ${y + 85} L ${x + 161} ${y + 94} H ${x + 9} L ${x} ${y + 85} V ${y + 9} Z`
            return (
              <g
                key={module.instanceId}
                role={selectable ? 'button' : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-disabled={selectable ? undefined : true}
                aria-label={t('game.slotAria', { slot: td({ key: `slot.${module.slot}`, fallback: module.slotLabel }), name: module.name, energy: module.energy })}
                onClick={selectable ? () => onSelect(module) : undefined}
                onKeyDown={selectable ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(module) } } : undefined}
                onMouseEnter={() => setHoveredId(module.instanceId)}
                onMouseLeave={() => setHoveredId((current) => current === module.instanceId ? null : current)}
                onFocus={selectable ? () => setHoveredId(module.instanceId) : undefined}
                onBlur={selectable ? () => setHoveredId((current) => current === module.instanceId ? null : current) : undefined}
                className={`${selectable ? 'cursor-pointer' : 'cursor-default'} outline-none`}
              >
                <path d={nodePath} fill="url(#node-panel)" stroke={color} strokeWidth={active || selected ? 3 : 1.5} filter={active || selected ? 'url(#deck-glow)' : undefined} className="transition-all duration-200" />
                {active && <path d={nodePath} fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.45" strokeWidth="1" pointerEvents="none" />}
                <path d={`M ${x + 12} ${y + 8} H ${x + 132} M ${x + 12} ${y + 13} H ${x + 78}`} stroke={color} strokeOpacity={active ? 0.9 : 0.45} strokeWidth="1" />
                <path d={`M ${x + 146} ${y + 7} L ${x + 162} ${y + 23} M ${x + 151} ${y + 7} L ${x + 166} ${y + 22}`} stroke={color} strokeOpacity={active ? 1 : 0.8} />
                <path d={`M ${x + 10} ${y + 73} H ${x + 160}`} stroke="#451232" strokeWidth="7" strokeLinecap="square" />
                <path d={`M ${x + 10} ${y + 73} H ${x + 10 + 1.5 * module.energy}`} stroke={color} strokeWidth="7" strokeLinecap="square" />
                <path d={`M ${x + 10} ${y + 84} H ${x + 42} M ${x + 48} ${y + 84} H ${x + 60} M ${x + 66} ${y + 84} H ${x + 90}`} stroke={color} strokeOpacity={active ? 0.9 : 0.4} strokeWidth="2" />
                <circle cx={x + 154} cy={y + 84} r={active ? 4 : 3} fill={color} filter="url(#deck-glow)" />
                <circle cx={connectorX} cy={connectorY} r={active ? 6 : 4} fill="#050508" stroke={color} strokeWidth={active ? 3 : 2} filter={active ? 'url(#deck-glow)' : undefined} />
                <text x={x + 12} y={y + 27} fill="#9B91AD" fontFamily="Courier Prime" fontSize="8" letterSpacing="1.4">{module.slot.toUpperCase()} // {t('game.slotTag')} {String(index + 1).padStart(2, '0')}</text>
                <text x={x + 12} y={y + 48} fill={color} fontFamily="Orbitron" fontWeight="700" fontSize="10">{module.name.length > 20 ? `${module.name.slice(0, 18)}…` : module.name}</text>
                <text x={x + 12} y={y + 62} fill="#F4F4F9" fontFamily="Courier Prime" fontSize="8">PWR {module.power}  /  SHD {module.shield}  /  ENG {module.energy}</text>
                {module.state === 'destroyed' && <><path d={`M ${x + 5} ${y + 5} L ${x + 165} ${y + 89}`} stroke="#FF6E84" strokeWidth="2" strokeOpacity="0.72" /><text x={x + 85} y={y + 88} textAnchor="middle" fill="#FF6E84" fontFamily="Courier Prime" fontSize="7">{t('game.signalLost')}</text></>}
              </g>
            )
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded border border-neon-cyan/15 bg-void/70 px-3 py-1 font-mono text-[8px] tracking-[0.18em] text-neon-cyan/65 uppercase backdrop-blur">{t('game.passiveTelemetry')}</div>
      </div>
    </div>
  )
}

export { familyColors }
