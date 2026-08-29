import { useEffect, useRef } from 'react'

type Color = [number, number, number]
type Point = [number, number, number]
type DeviceSection = 'frame' | 'cpu' | 'gpu' | 'ram' | 'display' | 'expansion' | 'jammer' | 'network' | 'cooling' | 'projector' | 'power'

const CYAN: Color = [0, 1, 1]
const MAGENTA: Color = [1, 0, 0.5]
const PURPLE: Color = [0.65, 0.61, 1]
const ICE: Color = [0.9, 0.97, 1]

function hexColor(value?: string): Color {
  const hex = value?.replace('#', '')
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return CYAN
  return [Number.parseInt(hex.slice(0, 2), 16) / 255, Number.parseInt(hex.slice(2, 4), 16) / 255, Number.parseInt(hex.slice(4, 6), 16) / 255]
}

function buildDeviceGeometry() {
  const sections = new Map<DeviceSection, number[]>()
  const vertices = (section: DeviceSection) => {
    const current = sections.get(section) ?? []
    sections.set(section, current)
    return current
  }
  const line = (section: DeviceSection, a: Point, b: Point, color: Color = CYAN) => {
    vertices(section).push(...a, ...color, ...b, ...color)
  }
  const rectangle = (section: DeviceSection, x1: number, y1: number, x2: number, y2: number, z: number, color: Color = CYAN) => {
    line(section, [x1, y1, z], [x2, y1, z], color)
    line(section, [x2, y1, z], [x2, y2, z], color)
    line(section, [x2, y2, z], [x1, y2, z], color)
    line(section, [x1, y2, z], [x1, y1, z], color)
  }
  const box = (section: DeviceSection, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: Color = CYAN) => {
    rectangle(section, x1, y1, x2, y2, z1, color)
    rectangle(section, x1, y1, x2, y2, z2, color)
    ;[[x1, y1], [x2, y1], [x2, y2], [x1, y2]].forEach(([x, y]) => line(section, [x, y, z1], [x, y, z2], color))
  }
  const ring = (section: DeviceSection, centerX: number, centerY: number, z: number, radius: number, color: Color, steps = 20) => {
    let previous: Point | null = null
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2
      const point: Point = [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, z]
      if (previous) line(section, previous, point, color)
      previous = point
    }
  }

  // Permanent chassis and lower data bus preserve the cyberdeck silhouette.
  box('frame', -2.35, -1.48, -0.36, 2.35, 1.48, 0.34, CYAN)
  rectangle('frame', -2.16, -1.29, 2.16, 1.29, 0.37, MAGENTA)
  rectangle('frame', -2.02, -1.16, 2.02, 1.16, 0.39, PURPLE)
  for (let x = -1.72; x <= 1.72; x += 0.28) line('frame', [x, -1.16, 0.4], [x + 0.13, -1.02, 0.4], CYAN)
  line('frame', [-2.26, 0, 0.1], [-2.56, 0, 0.1], MAGENTA)
  line('frame', [2.26, 0, 0.1], [2.56, 0, 0.1], MAGENTA)

  // DISPLAY: raised phosphor panel, telemetry grid and signal trace.
  box('display', -1.6, 0.16, 0.38, 1.38, 1.08, 0.48, CYAN)
  rectangle('display', -1.48, 0.28, 1.26, 0.96, 0.49, PURPLE)
  for (let x = -1.18; x <= 0.98; x += 0.43) line('display', [x, 0.29, 0.5], [x, 0.95, 0.5], PURPLE)
  for (let y = 0.42; y <= 0.84; y += 0.14) line('display', [-1.47, y, 0.5], [1.25, y, 0.5], PURPLE)
  line('display', [-1.38, 0.48, 0.51], [-0.78, 0.72, 0.51], MAGENTA)
  line('display', [-0.78, 0.72, 0.51], [-0.28, 0.5, 0.51], MAGENTA)
  line('display', [-0.28, 0.5, 0.51], [0.38, 0.82, 0.51], MAGENTA)
  line('display', [0.38, 0.82, 0.51], [1.12, 0.58, 0.51], MAGENTA)

  // CPU: socketed neural processor with visible pin traces.
  box('cpu', -1.72, -0.9, 0.4, -0.82, -0.22, 0.55, ICE)
  rectangle('cpu', -1.56, -0.76, -0.98, -0.36, 0.56, CYAN)
  for (let y = -0.72; y <= -0.4; y += 0.16) {
    line('cpu', [-1.72, y, 0.5], [-1.88, y, 0.45], CYAN)
    line('cpu', [-0.82, y, 0.5], [-0.66, y, 0.45], CYAN)
  }

  // GPU: broad raster co-processor with paired internal buses.
  box('gpu', -0.62, -1.02, 0.4, 0.62, -0.48, 0.53, MAGENTA)
  for (let x = -0.46; x <= 0.46; x += 0.23) line('gpu', [x, -0.94, 0.54], [x, -0.56, 0.54], MAGENTA)
  line('gpu', [-0.54, -0.75, 0.55], [0.54, -0.75, 0.55], PURPLE)

  // RAM: three removable memory banks resembling compact control keys.
  for (let bank = 0; bank < 3; bank += 1) {
    const x = 0.82 + bank * 0.39
    box('ram', x, -0.98, 0.4, x + 0.29, -0.36, 0.54, bank === 1 ? MAGENTA : CYAN)
    line('ram', [x + 0.07, -0.88, 0.55], [x + 0.22, -0.88, 0.55], ICE)
  }

  // PROJECTOR: concentric holographic emitter and aiming reticle.
  ring('projector', 1.7, 0.68, 0.49, 0.23, MAGENTA)
  ring('projector', 1.7, 0.68, 0.5, 0.13, CYAN)
  line('projector', [1.45, 0.68, 0.5], [1.95, 0.68, 0.5], PURPLE)
  line('projector', [1.7, 0.43, 0.5], [1.7, 0.93, 0.5], PURPLE)

  // EXPANSION: five hot-swappable ports on the starboard edge.
  for (let connector = 0; connector < 5; connector += 1) {
    const y = -1.02 + connector * 0.5
    box('expansion', 2.32, y, -0.22, 2.68, y + 0.24, 0.22, connector % 2 ? MAGENTA : CYAN)
  }

  // NETWORK: shielded ports and a small packet activity ladder.
  for (let connector = 0; connector < 3; connector += 1) {
    const y = -0.76 + connector * 0.58
    box('network', -2.68, y, -0.2, -2.32, y + 0.3, 0.2, connector === 1 ? PURPLE : CYAN)
  }
  for (let step = 0; step < 4; step += 1) line('network', [-2.18 + step * 0.12, 1.12, 0.42], [-2.12 + step * 0.12, 1.22, 0.42], MAGENTA)

  // COOLING: rear radiator block and exposed fins.
  box('cooling', -0.92, 1.42, -0.18, 0.92, 1.72, 0.24, PURPLE)
  for (let x = -0.8; x <= 0.8; x += 0.2) line('cooling', [x, 1.44, 0.26], [x, 1.7, 0.26], ICE)

  // JAMMER: segmented directional antenna and signal arcs.
  line('jammer', [1.58, 1.42, 0], [1.84, 2.06, 0], MAGENTA)
  line('jammer', [1.84, 2.06, 0], [2.08, 2.38, 0], MAGENTA)
  line('jammer', [2.08, 2.38, 0], [2.12, 2.72, 0], CYAN)
  line('jammer', [1.98, 2.46, 0], [2.26, 2.46, 0], PURPLE)
  line('jammer', [1.94, 2.6, 0], [2.3, 2.6, 0], PURPLE)

  // POWER: wrist battery, dual rear cells and charging rails.
  box('power', -0.78, 1.72, -0.36, 0.78, 3.18, -0.06, PURPLE)
  box('power', -0.78, -3.18, -0.36, 0.78, -1.48, -0.06, PURPLE)
  for (let y = 1.92; y <= 3.02; y += 0.25) line('power', [-0.7, y, -0.04], [0.7, y, -0.04], PURPLE)
  for (let y = -3; y <= -1.7; y += 0.25) line('power', [-0.7, y, -0.04], [0.7, y, -0.04], PURPLE)
  box('power', -0.52, -1.42, -0.28, 0.52, -1.18, 0.18, MAGENTA)

  return [...sections.entries()].map(([id, values]) => ({ id, vertices: new Float32Array(values) }))
}

export function WireframeDeviceCanvas({ active = true, highlightedSlot, highlightColor }: { active?: boolean; highlightedSlot?: string; highlightColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const highlightedSlotRef = useRef(highlightedSlot)
  const highlightColorRef = useRef<Color>(hexColor(highlightColor))
  const requestRenderRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    highlightedSlotRef.current = highlightedSlot
    highlightColorRef.current = hexColor(highlightColor)
    requestRenderRef.current?.()
  }, [highlightColor, highlightedSlot])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
    if (!gl) return

    const vertexSource = `
      attribute vec3 a_position;
      attribute vec3 a_color;
      uniform float u_angle;
      uniform float u_aspect;
      varying vec3 v_color;
      void main() {
        float cy = cos(u_angle);
        float sy = sin(u_angle);
        float cx = cos(-0.34);
        float sx = sin(-0.34);
        vec3 p = vec3(a_position.x * cy + a_position.z * sy, a_position.y, -a_position.x * sy + a_position.z * cy);
        p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
        float depth = 7.2 - p.z;
        gl_Position = vec4((p.x * 2.18 / depth) * u_aspect, p.y * 2.18 / depth, 0.0, 1.0);
        v_color = a_color;
      }
    `
    const fragmentSource = `
      precision mediump float;
      varying vec3 v_color;
      uniform vec3 u_highlight_color;
      uniform float u_emphasis;
      void main() {
        vec3 color = mix(v_color, u_highlight_color, u_emphasis * 0.72);
        gl_FragColor = vec4(color, mix(0.48, 0.96, u_emphasis));
      }
    `
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertexShader || !fragmentShader) return
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return

    const buffers = buildDeviceGeometry().flatMap((section) => {
      const buffer = gl.createBuffer()
      if (!buffer) return []
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, section.vertices, gl.STATIC_DRAW)
      return [{ ...section, buffer }]
    })
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const colorLocation = gl.getAttribLocation(program, 'a_color')
    const angleLocation = gl.getUniformLocation(program, 'u_angle')
    const aspectLocation = gl.getUniformLocation(program, 'u_aspect')
    const emphasisLocation = gl.getUniformLocation(program, 'u_emphasis')
    const highlightColorLocation = gl.getUniformLocation(program, 'u_highlight_color')
    gl.useProgram(program)
    gl.enableVertexAttribArray(positionLocation)
    gl.enableVertexAttribArray(colorLocation)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    let frame = 0
    let disposed = false
    const startedAt = performance.now()
    const render = (time: number) => {
      if (disposed) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio))
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(canvas.closest('.reduce-motion'))
      const angle = reduced ? 0.42 : 0.42 + (time - startedAt) * 0.00008
      const [red, green, blue] = highlightColorRef.current
      gl.uniform1f(angleLocation, angle)
      gl.uniform1f(aspectLocation, height / width)
      gl.uniform3f(highlightColorLocation, red, green, blue)
      for (const section of buffers) {
        const highlighted = section.id === highlightedSlotRef.current
        gl.bindBuffer(gl.ARRAY_BUFFER, section.buffer)
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0)
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12)
        gl.uniform1f(emphasisLocation, highlighted ? 1 : 0)
        gl.lineWidth(highlighted ? 2 : 1)
        gl.drawArrays(gl.LINES, 0, section.vertices.length / 6)
        if (highlighted) gl.drawArrays(gl.LINES, 0, section.vertices.length / 6)
      }
      if (!reduced) frame = requestAnimationFrame(render)
    }
    requestRenderRef.current = () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(canvas.closest('.reduce-motion'))
      if (reduced) { cancelAnimationFrame(frame); frame = requestAnimationFrame(render) }
    }
    frame = requestAnimationFrame(render)

    return () => {
      disposed = true
      requestRenderRef.current = null
      cancelAnimationFrame(frame)
      buffers.forEach(({ buffer }) => gl.deleteBuffer(buffer))
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
    }
  }, [active])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-70 [filter:drop-shadow(0_0_8px_rgba(0,255,255,.28))]" aria-hidden="true" />
}
