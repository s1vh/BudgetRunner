import { ArrowLeft, FileKey2, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { Button, SynthCard } from '@/components/ui/primitives'

export function LicensePage() {
  return <SynthCard className="w-full max-w-3xl p-6 sm:p-8"><FileKey2 className="size-7 text-neon-cyan" /><h1 className="mt-4 font-display text-2xl font-black">MIT License</h1><p className="mt-2 font-mono text-xs text-text-muted">Copyright © 2026 Mike Fieldins</p><div className="mt-6 space-y-4 text-sm leading-7 text-text-muted"><p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies.</p><p>The software is provided “as is”, without warranty of any kind, express or implied.</p></div><Link to="/"><Button className="mt-7" variant="ghost" icon={ArrowLeft}>Volver al dashboard</Button></Link></SynthCard>
}

export function PrivacyPage() {
  return <SynthCard className="w-full max-w-3xl p-6 sm:p-8"><ShieldCheck className="size-7 text-success" /><h1 className="mt-4 font-display text-2xl font-black">Privacidad</h1><div className="mt-6 space-y-4 text-sm leading-7 text-text-muted"><p>Este frontend utiliza datos internos de demostración. No transmite información financiera ni credenciales a un servidor.</p><p>La integración futura almacenará tiempos en UTC, aislará todos los recursos por usuario y evitará incluir tokens o datos financieros completos en logs.</p><p>La eliminación de cuenta requerirá reautenticación y confirmación explícita.</p></div><Link to="/"><Button className="mt-7" variant="ghost" icon={ArrowLeft}>Volver al dashboard</Button></Link></SynthCard>
}
