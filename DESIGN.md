# ADN del Diseño - Ultrawave (Synthwave Finance Tracker)
Estética retrofuturista, vaporwave y retrowave aplicada a la aplicación de gestión de gastos **"Vibe to Live"**.

---

## 1. Concepto y Estética General
La identidad visual de **Vibe to Live** es una fusión equilibrada de tres corrientes principales:
* **Synthwave Core**: Base retrofuturista inspirada en los años 80, cuadrículas tridimensionales y luces de neón.
* **Vaporwave**: Elementos nostálgicos y surrealistas, incluyendo pixel-art, glitches cromáticos, esculturas clásicas y tonalidades pastel/neón.
* **Retrowave**: Tonalidades púrpura profundo y una atmósfera arcade cinemática que evoca la cultura pop ochentera.

---

## 2. Paleta de Colores (Color Tokens)

### 2.1 Colores Principales del Tema
| Token | Valor Hex | Uso Principal |
| :--- | :--- | :--- |
| **Primary (Neon Magenta)** | `#FF007F` | Botones de acción principal, acentos clave de atención y estados activos. |
| **Secondary (Electric Cyan)** | `#00FFFF` | Acentos secundarios, estados hover, enlaces interactivos y elementos activos secundarios. |
| **Accent Purple (Electric Purple)** | `#8B00FF` | Picos en gráficos de barra, sombras neón de insignias y elementos decorativos secundarios. |
| **Accent Sunset (Yellow Sunset)** | `#FFD43F` | Mensajes de advertencia/alerta y medidores de XP de gamificación. |
| **Background Deep** | `#0B0C10` | Color de fondo principal y global de la aplicación. |
| **Background Alt (Space Black)** | `#0C0914` | Fondo de paneles laterales, barras de navegación y tarjetas profundas. |
| **Text Base (White Glow)** | `#F4F4F9` | Texto de lectura principal con un sutil resplandor claro. |
| **Text Muted (Purple Cyber)** | `#757B96` | Subtextos, etiquetas inactivas y estados deshabilitados. |

### 2.2 Tokens Adicionales (Material Design / Detallados)
```css
:root {
  --background: #1f0e13;
  --on-background: #fbdae1;
  
  --surface: #1f0e13;
  --surface-dim: #1f0e13;
  --surface-bright: #493338;
  --surface-container-lowest: #19090e;
  --surface-container-low: #28161b;
  --surface-container: #2d1a1f;
  --surface-container-high: #382529;
  --surface-container-highest: #442f34;
  --on-surface: #fbdae1;
  --on-surface-variant: #e5bcc5;
  --inverse-surface: #fbdae1;
  --inverse-on-surface: #3f2b30;
  
  --primary: #ffb1c4;
  --on-primary: #65002e;
  --primary-container: #ff4a8d;
  --on-primary-container: #590028;
  --inverse-primary: #ba005b;
  
  --secondary: #ffffff;
  --on-secondary: #003737;
  --secondary-container: #00fbfb;
  --on-secondary-container: #007070;
  
  --tertiary: #63e063;
  --on-tertiary: #003908;
  --tertiary-container: #21a732;
  --on-tertiary-container: #003206;
  
  --error: #ffb4ab;
  --on-error: #690005;
  --error-container: #93000a;
  --on-error-container: #ffdad6;
  
  --outline: #ac878f;
  --outline-variant: #5c3f46;
  
  /* Colores de acento extendidos */
  --accent-purple: #8B00FF;
  --accent-sunset: #FFD43F;
  --bg-deep: #0B0C10;
  --bg-alt: #0C0914;
  --text-glow: #F4F4F9;
  --text-muted: #757B96;
}
```

> [!NOTE]
> Regla de contraste: Se garantiza la luminosidad mínima WCAG AA para textos legibles (`#F4F4F9`) sobre cualquiera de los fondos oscuros del tema.

---

## 3. Tipografía y Jerarquía

* **Display & Headings (Títulos)**: `'Neon Tubes'`, `'Orbitron'`, `'Impact'`, sans-serif. Estilo neón vintage y futurista.
* **Body (Cuerpo de Texto)**: `'Arimo'`, `'MS Sans Serif'`, sans-serif. El uso de MS Sans Serif proporciona un toque nostálgico pixel-retro en interfaces de datos.
* **Monospace UI (Código/Tablas/Gastos)**: `'Courier Prime'`, `'Courier New'`, monospace. Ideal para campos de entrada y tablas numéricas.

### Escala Tipográfica de Referencia:
* **Headline XL (H1 principal)**: `Space Grotesk`, `64px`, Grosor `700` (Bold), `line-height: 1.1`, `letter-spacing: -0.02em`
* **Headline LG**: `Space Grotesk`, `40px`, Grosor `700` (Bold), `line-height: 1.2` (En móviles: `32px`)
* **Headline MD**: `Space Grotesk`, `24px`, Grosor `600` (Semi-Bold), `line-height: 1.3`
* **Body LG**: `Arimo`, `18px`, Grosor `400` (Regular), `line-height: 1.6`
* **Body MD**: `Arimo`, `16px`, Grosor `400` (Regular), `line-height: 1.6`
* **Body SM**: `Arimo`, `14px`, Grosor `400` (Regular), `line-height: 1.4`
* **Label MD**: `Courier Prime`, `14px`, Grosor `400`, `line-height: 1.2`, `letter-spacing: 0.05em`
* **Label SM**: `Courier Prime`, `12px`, Grosor `400`, `line-height: 1.2`, `letter-spacing: 0.05em`

---

## 4. Retícula, Espaciados y Decoración de Fondo

* **Sistema de Espaciado Base**: Escalado múltiple de 8px (potencias de 2 para los contenedores grandes).
  * `xs`: `4px`
  * `sm`: `8px`
  * `md`: `16px`
  * `lg`: `24px`
  * `xl`: `32px`
  * `xxl`: `64px` (y `128px` para márgenes de sección superiores)
* **Perspective Grid (Cuadrícula en Perspectiva)**: Fondo SVG con efecto de cuadrícula infinita en perspectiva con una opacidad del `4%` aplicado en las áreas de Hero y paneles superiores del Dashboard.

---

## 5. Estilos de Superficie y Efectos Visuales (Shaders y CSS)

### 5.1 Resplandor de Neón (Neon Glow)
Efecto de sombra de caja que transiciona suavemente de cian a magenta en `0.25s`.
```css
.neon-glow {
  box-shadow: 0 0 15px currentColor;
  transition: box-shadow 0.25s ease;
}
.neon-glow:hover {
  box-shadow: 0 0 25px currentColor,
              0 0 45px currentColor;
}
```

### 5.2 CRT Scanlines (Efecto de Monitor Antiguo)
Pseudo-elemento transparente con patrón de líneas horizontales simulando pantallas analógicas.
```css
.crt-container::before {
  content: " ";
  display: block;
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: repeating-linear-gradient(
    rgba(18, 16, 16, 0) 50%,
    rgba(0, 0, 0, 0.25) 50%
  );
  background-size: 100% 4px;
  z-index: 99;
  pointer-events: none;
  opacity: 0.05;
}
```

### 5.3 Glitch en Títulos (H1 Glitch Effect)
Efecto de deformación y desplazamiento mediante animaciones intermitentes en la propiedad `clip-path` y desfases horizontales en capas duplicadas de texto.

### 5.4 Statue Hero Backdrop (Fondo de Escultura Clásica)
Imagen PNG en 3D de una escultura clásica (estilo clásico griego/romano Vaporwave) con un filtro duotono (cian/magenta) aplicado al `80%` de opacidad, posicionada en la sección de inicio detrás del título principal.

### 5.5 Reactividad al Audio (Audio-Reactive Scale)
Simulación de vibración al ritmo de la música mediante JavaScript agregando dinámicamente la clase `.beat`, la cual aplica una ligera deformación en el eje Y:
```css
.beat {
  transform: scaleY(1.05);
}
```

---

## 6. Guías para Componentes del UI

### 6.1 Botones
* **Estructura Base**: Bordes sólidos de `2px solid currentColor`, fondo transparente.
* **Variante Cian (.btn-neon)**: Usa el color de texto e interactividad `Secondary` (Cian Eléctrico) con resplandor cian.
* **Variante Magenta (.btn-danger)**: Usa el color de texto `Primary` (Neon Magenta) con resplandor magenta.
* **Comportamiento en Hover**: Relleno de fondo con el color de borde correspondiente y transición de sombra dual.

### 6.2 Tarjetas (Cards)
* **Fondo**: Translúcido `rgba(12, 9, 20, 0.8)` con efecto de difuminado por debajo (`backdrop-filter: blur(10px)`).
* **Borde**: Línea delgada con gradiente diagonal de `Accent Purple` a `Secondary (Cian)`.
* **Animación en Hover**: Elevación vertical (`translateY(-4px)`) acompañada de un aumento sutil de brillo en la sombra exterior.

### 6.3 Campos de Entrada (Inputs)
* **Fondo**: Totalmente oscuro (`#050508`).
* **Borde**: Borde fino en `Text Muted`. Al ganar el foco (`:focus`), cambia el color del borde a `Secondary` y se activa el efecto `neon-glow` cian.

### 6.4 Widgets de Gamificación (XP)
* **Barra de XP**: Altura de `8px`. Fondo en `Accent Purple` con baja opacidad; el progreso acumulado se representa con el color brillante `Yellow Sunset` de forma animada.
* **Insignias**: Diseñadas mediante SVG estilo retro-píxel 8-bits con sombra e iluminación del color `Accent Purple`.

---

## 7. Accesibilidad y Buenas Prácticas

> [!IMPORTANT]
> * **Legibilidad**: Mantener siempre un contraste mínimo de 4.5:1 en todos los textos explicativos y numéricos. El color de texto `text-glow` (#F4F4F9) debe contrastar sobre los fondos oscuros.
> * **Límite de Neón**: Evitar el uso excesivo de colores brillantes. No mostrar más de 2 colores neón vibrantes en la pantalla a la vez para no fatigar la vista del usuario.
> * **Reducción de Movimiento**: Respetar la propiedad `@media (prefers-reduced-motion: reduce)` desactivando animaciones de glitch agresivas y efectos de parpadeo rápidos.
> * **Navegación por Teclado**: Los elementos enfocados mediante teclado deben mostrar un borde claro y visible (`outline: 2px dashed var(--accent-purple)`).
