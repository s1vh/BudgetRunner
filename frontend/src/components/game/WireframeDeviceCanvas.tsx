import { useEffect, useRef } from 'react'

type Color = [number, number, number]
type Point = [number, number, number]

const CYAN: Color = [0, 1, 1]
const MAGENTA: Color = [1, 0, 0.5]
const PURPLE: Color = [0.65, 0.61, 1]

function buildDeviceGeometry() {
  const vertices: number[] = []
  const line = (a: Point, b: Point, color: Color = CYAN) => {
    vertices.push(...a, ...color, ...b, ...color)
  }
  const rectangle = (x1: number, y1: number, x2: number, y2: number, z: number, color: Color = CYAN) => {
    line([x1, y1, z], [x2, y1, z], color)
    line([x2, y1, z], [x2, y2, z], color)
    line([x2, y2, z], [x1, y2, z], color)
    line([x1, y2, z], [x1, y1, z], color)
  }
  const box = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: Color = CYAN) => {
    rectangle(x1, y1, x2, y2, z1, color)
    rectangle(x1, y1, x2, y2, z2, color)
    ;[[x1, y1], [x2, y1], [x2, y2], [x1, y2]].forEach(([x, y]) => line([x, y, z1], [x, y, z2], color))
  }

  // Wrist strap, rear rails and portable chassis.
  box(-0.72, 1.35, -0.34, 0.72, 3.15, -0.08, PURPLE)
  box(-0.72, -3.15, -0.34, 0.72, -1.35, -0.08, PURPLE)
  for (let y = 1.65; y <= 2.95; y += 0.28) line([-0.68, y, -0.06], [0.68, y, -0.06], PURPLE)
  for (let y = -2.95; y <= -1.65; y += 0.28) line([-0.68, y, -0.06], [0.68, y, -0.06], PURPLE)
  box(-2.25, -1.42, -0.34, 2.25, 1.42, 0.34, CYAN)
  rectangle(-2.06, -1.24, 2.06, 1.24, 0.37, MAGENTA)

  // Display, scan grid and status telemetry.
  rectangle(-1.54, 0.18, 1.34, 1.05, 0.4, CYAN)
  rectangle(-1.43, 0.29, 1.23, 0.94, 0.405, PURPLE)
  for (let x = -1.15; x <= 0.95; x += 0.42) line([x, 0.3, 0.41], [x, 0.93, 0.41], PURPLE)
  for (let y = 0.42; y <= 0.84; y += 0.14) line([-1.42, y, 0.41], [1.22, y, 0.41], PURPLE)
  line([-1.35, 0.46, 0.42], [-0.72, 0.72, 0.42], MAGENTA)
  line([-0.72, 0.72, 0.42], [-0.22, 0.5, 0.42], MAGENTA)
  line([-0.22, 0.5, 0.42], [0.42, 0.82, 0.42], MAGENTA)
  line([0.42, 0.82, 0.42], [1.12, 0.58, 0.42], MAGENTA)

  // Compact keyboard matrix.
  const keyWidth = 0.43
  const keyHeight = 0.2
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = -1.42 + column * 0.48 + (row % 2) * 0.08
      const y = -0.25 - row * 0.27
      rectangle(x, y - keyHeight, x + keyWidth, y, 0.405, row === 2 ? MAGENTA : CYAN)
    }
  }

  // Rotary controls.
  for (const [centerX, centerY, radius] of [[-1.78, -0.45, 0.2], [1.67, 0.69, 0.16]] as Array<[number, number, number]>) {
    let previous: Point | null = null
    for (let step = 0; step <= 18; step += 1) {
      const angle = (step / 18) * Math.PI * 2
      const point: Point = [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 0.41]
      if (previous) line(previous, point, MAGENTA)
      previous = point
    }
    line([centerX - radius * 0.7, centerY, 0.42], [centerX + radius * 0.7, centerY, 0.42], MAGENTA)
  }

  // Expansion connectors on both sides.
  for (let connector = 0; connector < 5; connector += 1) {
    const y = -0.98 + connector * 0.48
    box(2.24, y, -0.2, 2.55, y + 0.22, 0.2, connector % 2 ? MAGENTA : CYAN)
    box(-2.55, y, -0.2, -2.24, y + 0.22, 0.2, connector % 2 ? PURPLE : CYAN)
  }

  // Antenna, top latches and lower data bus.
  line([1.72, 1.42, 0], [1.98, 2.06, 0], MAGENTA)
  line([1.98, 2.06, 0], [2.15, 2.34, 0], MAGENTA)
  line([2.15, 2.34, 0], [2.18, 2.64, 0], MAGENTA)
  box(-1.62, 1.4, -0.16, -0.92, 1.62, 0.18, PURPLE)
  box(0.62, 1.4, -0.16, 1.32, 1.62, 0.18, PURPLE)
  for (let x = -1.45; x <= 1.45; x += 0.25) line([x, -1.2, 0.39], [x + 0.12, -1.04, 0.39], CYAN)

  return new Float32Array(vertices)
}

export function WireframeDeviceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
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
        vec3 p = vec3(
          a_position.x * cy + a_position.z * sy,
          a_position.y,
          -a_position.x * sy + a_position.z * cy
        );
        p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
        float depth = 7.2 - p.z;
        gl_Position = vec4((p.x * 2.18 / depth) * u_aspect, p.y * 2.18 / depth, 0.0, 1.0);
        v_color = a_color;
      }
    `
    const fragmentSource = `
      precision mediump float;
      varying vec3 v_color;
      void main() { gl_FragColor = vec4(v_color, 0.68); }
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

    const geometry = buildDeviceGeometry()
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const colorLocation = gl.getAttribLocation(program, 'a_color')
    const angleLocation = gl.getUniformLocation(program, 'u_angle')
    const aspectLocation = gl.getUniformLocation(program, 'u_aspect')
    gl.useProgram(program)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(colorLocation)
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    let frame = 0
    const startedAt = performance.now()
    const render = (time: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio))
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(canvas.closest('.reduce-motion'))
      const angle = reduced ? 0.42 : 0.42 + (time - startedAt) * 0.00008
      gl.uniform1f(angleLocation, angle)
      gl.uniform1f(aspectLocation, height / width)
      gl.drawArrays(gl.LINES, 0, geometry.length / 6)
      if (!reduced) frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-55 [filter:drop-shadow(0_0_7px_rgba(0,255,255,.25))]" aria-hidden="true" />
}
