import { ArrowLeft, RadioTower } from 'lucide-react'
import { Link } from 'react-router'
import { Button, SynthCard } from '@/components/ui/primitives'

export function NotFoundPage() {
  return <div className="grid min-h-[70vh] place-items-center"><SynthCard className="max-w-lg p-8 text-center" tone="danger"><RadioTower className="mx-auto size-12 text-neon-magenta" /><p className="mt-5 font-mono text-xs tracking-[0.2em] text-neon-magenta">ERROR 404</p><h1 className="mt-2 font-display text-2xl font-black">Frecuencia desconocida</h1><p className="mt-3 text-sm leading-6 text-text-muted">La ruta solicitada no existe en este sector de la red.</p><Link to="/"><Button className="mt-6" variant="ghost" icon={ArrowLeft}>Volver al dashboard</Button></Link></SynthCard></div>
}
