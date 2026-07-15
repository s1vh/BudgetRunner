/* eslint-disable react-refresh/only-export-components -- family color tokens are colocated with the diagram */
import type { CyberModule, ModuleFamily } from '@/types/domain'

const familyColors: Record<ModuleFamily, string> = { retrowave: '#FFD43F', synthwave: '#00FFFF', vaporwave: '#A69DFF', hifi_tech: '#E7F7FF' }
const positions = [
  { x: 55, y: 55 }, { x: 315, y: 35 }, { x: 635, y: 55 }, { x: 55, y: 210 }, { x: 635, y: 210 },
  { x: 55, y: 365 }, { x: 315, y: 385 }, { x: 635, y: 365 }, { x: 315, y: 180 }, { x: 445, y: 180 },
]

export function CyberdeckDiagram({ modules, selectedId, onSelect }: { modules: CyberModule[]; selectedId?: string; onSelect: (module: CyberModule) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-soft/50 bg-void/50 p-2">
      <svg viewBox="0 0 860 520" className="min-w-[760px]" role="group" aria-label="Cyberdeck con diez slots conectados">
        <defs>
          <filter id="deck-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <pattern id="micro-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 18 0 L 0 0 0 18" fill="none" stroke="#663a52" strokeOpacity="0.22" strokeWidth="1" /></pattern>
        </defs>
        <rect width="860" height="520" rx="18" fill="url(#micro-grid)" />
        <g stroke="#8B00FF" strokeOpacity="0.34" strokeWidth="2" fill="none">
          {positions.slice(0, 8).map((position, index) => <path key={index} d={`M ${position.x + 85} ${position.y + 46} C 300 ${position.y + 46}, 300 260, 430 260`} />)}
          <path d="M 400 226 L 445 226" /><circle cx="430" cy="260" r="54" stroke="#00FFFF" strokeOpacity="0.28" strokeDasharray="5 8" />
        </g>
        <g><circle cx="430" cy="260" r="34" fill="#0B0C10" stroke="#FF007F" strokeWidth="2" filter="url(#deck-glow)" /><circle cx="430" cy="260" r="18" fill="#FF007F" fillOpacity="0.12" stroke="#00FFFF" /><text x="430" y="264" textAnchor="middle" fill="#F4F4F9" fontFamily="Orbitron" fontSize="8">CORE</text></g>
        {modules.map((module, index) => {
          const position = positions[index]
          if (!position) return null
          const color = module.state === 'destroyed' ? '#FF6E84' : module.state === 'empty' ? '#663A52' : familyColors[module.family]
          const selected = selectedId === module.instanceId
          return (
            <g key={module.instanceId} role="button" tabIndex={0} aria-label={`${module.slotLabel}: ${module.name}, Energy ${module.energy}%`} onClick={() => onSelect(module)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(module) }} className="cursor-pointer outline-none">
              <rect x={position.x} y={position.y} width="170" height="92" rx="8" fill="#0C0914" fillOpacity="0.92" stroke={color} strokeWidth={selected ? 3 : 1.5} filter={selected ? 'url(#deck-glow)' : undefined} />
              <path d={`M ${position.x + 10} ${position.y + 70} H ${position.x + 160}`} stroke="#451232" strokeWidth="6" strokeLinecap="round" />
              <path d={`M ${position.x + 10} ${position.y + 70} H ${position.x + 10 + 1.5 * module.energy}`} stroke={color} strokeWidth="6" strokeLinecap="round" />
              <text x={position.x + 12} y={position.y + 20} fill="#9B91AD" fontFamily="Courier Prime" fontSize="8" letterSpacing="1">{module.slot.toUpperCase()}</text>
              <text x={position.x + 12} y={position.y + 42} fill={color} fontFamily="Orbitron" fontWeight="700" fontSize="10">{module.name.length > 20 ? `${module.name.slice(0, 18)}…` : module.name}</text>
              <text x={position.x + 12} y={position.y + 58} fill="#F4F4F9" fontFamily="Courier Prime" fontSize="8">PWR {module.power} · SHD {module.shield} · ENG {module.energy}</text>
              {module.state === 'destroyed' && <path d={`M ${position.x + 5} ${position.y + 5} L ${position.x + 165} ${position.y + 87}`} stroke="#FF6E84" strokeWidth="2" strokeOpacity="0.7" />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export { familyColors }
