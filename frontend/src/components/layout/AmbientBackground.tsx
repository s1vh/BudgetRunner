import { useOptionalAppData } from '@/app/AppDataContext'
import { cn } from '@/components/ui/primitives'

export function AmbientBackground() {
  const preferences = useOptionalAppData()?.data?.profile.preferences
  return (
    <div className={cn(!preferences?.ambientEffects && 'ambient-off', !preferences?.scanlines && 'scanlines-off')} aria-hidden="true">
      <div className="app-background"><div className="nebula" /><div className="outrun-sun" /></div>
      <div className="scanlines" />
    </div>
  )
}
