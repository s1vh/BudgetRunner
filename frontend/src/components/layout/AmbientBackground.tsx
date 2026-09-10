import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/primitives'

function PointerAtmosphere({ enabled }: { enabled: boolean }) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    layer.dataset.pointerActive = 'false'
    if (!enabled) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const target = { ...current }
    let animationFrame: number | null = null
    let initialized = false

    const applyPosition = () => {
      layer.style.setProperty('--ambient-pointer-x', `${current.x}px`)
      layer.style.setProperty('--ambient-pointer-y', `${current.y}px`)
    }

    const animate = () => {
      current.x += (target.x - current.x) * 0.1
      current.y += (target.y - current.y) * 0.1
      applyPosition()

      if (Math.abs(target.x - current.x) > 0.2 || Math.abs(target.y - current.y) > 0.2) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        animationFrame = null
      }
    }

    const hide = () => { layer.dataset.pointerActive = 'false' }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || motionQuery.matches) return
      target.x = event.clientX
      target.y = event.clientY

      if (!initialized) {
        current.x = target.x
        current.y = target.y
        applyPosition()
        initialized = true
      }

      layer.dataset.pointerActive = 'true'
      if (animationFrame === null) animationFrame = requestAnimationFrame(animate)
    }
    const respectMotionPreference = () => {
      if (motionQuery.matches) hide()
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', hide)
    document.documentElement.addEventListener('pointerleave', hide)
    motionQuery.addEventListener('change', respectMotionPreference)

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', hide)
      document.documentElement.removeEventListener('pointerleave', hide)
      motionQuery.removeEventListener('change', respectMotionPreference)
    }
  }, [enabled])

  return (
    <div ref={layerRef} className="pointer-atmosphere" data-pointer-active="false">
      <div className="pointer-atmosphere__glare" />
    </div>
  )
}

export function AmbientBackground({ ambientEffects = true, scanlines = true, reducedMotion = false }: { ambientEffects?: boolean; scanlines?: boolean; reducedMotion?: boolean }) {
  return (
    <div className={cn(!ambientEffects && 'ambient-off', !scanlines && 'scanlines-off')} aria-hidden="true">
      <div className="app-background"><div className="nebula" /><div className="outrun-sun" /></div>
      <PointerAtmosphere enabled={ambientEffects && !reducedMotion} />
      <div className="scanlines" />
    </div>
  )
}
