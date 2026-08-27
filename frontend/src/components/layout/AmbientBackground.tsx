import { cn } from '@/components/ui/primitives'

export function AmbientBackground({ ambientEffects = true, scanlines = true }: { ambientEffects?: boolean; scanlines?: boolean }) {
  return (
    <div className={cn(!ambientEffects && 'ambient-off', !scanlines && 'scanlines-off')} aria-hidden="true">
      <div className="app-background"><div className="nebula" /><div className="outrun-sun" /></div>
      <div className="scanlines" />
    </div>
  )
}
