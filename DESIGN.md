# Ultrawave — ADN de diseño

> Fuente de verdad visual de **Vibe to Live**, la experiencia de control de gastos del proyecto Stitch **Synthwave Finance Tracker**. Contexto contrastado con el tema del proyecto, el design system `Ultrawave` v3 y la pantalla aprobada `Vibe to Live - Dashboard with Background Grid and Palms`.

## 1. Norte visual

Ultrawave convierte la gestión financiera en una consola nocturna, cinematográfica y gamificada. El lenguaje combina:

- **Synthwave** como estructura: negro espacial, magenta y cian de alta energía, rejillas y luz de neón.
- **Retrowave** como atmósfera: horizonte outrun, sol segmentado, palmeras en silueta y sensación arcade de los ochenta.
- **Vaporwave** como textura: glitches cromáticos, scanlines CRT, ruido digital, píxel art y estatuas clásicas tratadas en duotono.
- **Fintech** como disciplina: datos densos, números inequívocos, jerarquía estable y estados comprensibles sin depender del glow.

La interfaz debe sentirse como un sistema operativo financiero encontrado en una recreativa del futuro: expresiva en el ambiente, estricta en la información.

### Principios

1. **Los datos mandan.** El espectáculo visual enmarca la información; nunca la oculta.
2. **La luz crea profundidad.** La elevación se expresa con brillo, transparencia y capas tonales, no con sombras físicas pesadas.
3. **Dos neones por escena.** Magenta y cian son la firma principal. Violeta o amarillo aparecen como apoyo puntual, no como un tercer foco dominante.
4. **Geometría afilada.** Rejilla precisa, bordes visibles y radios contenidos. Evitar el aspecto blando de una app SaaS genérica.
5. **Movimiento con intención.** Pulsos, glitch y shader comunican vida del sistema; no decoran cada elemento.

## 2. Jerarquía de color

El sistema tiene dos niveles complementarios. La pantalla aprobada prevalece cuando exista conflicto:

- **Colores de firma:** magenta y cian saturados para marca, acciones, cifras clave y visualización de datos.
- **Colores semánticos y tonales:** rosa, violeta y malva del design system v3 para superficies, estados secundarios y profundidad.

### 2.1 Colores de firma

| Token | Valor | Uso |
| --- | --- | --- |
| `--neon-magenta` | `#FF007F` | Acción de riesgo, gasto, alertas visuales, series alternas y glitch izquierdo. |
| `--neon-cyan` | `#00FFFF` | Acción principal, balance positivo, estado activo, foco y glitch derecho. |
| `--electric-purple` | `#8B00FF` | Halo ambiental, insignias y profundidad de navegación. |
| `--sunset-yellow` | `#FFD43F` | Sol outrun, hitos, advertencias y progreso excepcional. |
| `--bg-deep` | `#0B0C10` | Fondo global estable. |
| `--bg-alt` | `#0C0914` | Sidebar y regiones profundas. |
| `--input-black` | `#050508` | Entradas, terminales y superficies de máxima profundidad. |
| `--text-glow` | `#F4F4F9` | Texto principal de alto contraste. |
| `--text-muted` | `#757B96` | Metadatos, ayudas y estados inactivos. |

### 2.2 Paleta tonal del design system v3

```css
:root {
  color-scheme: dark;

  --background: #220216;
  --on-background: #ffdceb;

  --surface-lowest: #000000;
  --surface-low: #2a041c;
  --surface: #220216;
  --surface-container: #330824;
  --surface-high: #3b0d2b;
  --surface-highest: #451232;
  --surface-bright: #4e1739;

  --on-surface: #ffdceb;
  --on-surface-variant: #d39bb7;
  --outline: #986780;
  --outline-variant: #663a52;

  --primary: #ff89ab;
  --primary-container: #ff709d;
  --primary-dim: #ff6b9b;

  --secondary: #f785c6;
  --secondary-container: #7e205c;
  --secondary-dim: #e778b8;

  --tertiary: #a69dff;
  --tertiary-container: #988dfa;
  --tertiary-fixed: #afa6ff;
  --tertiary-dim: #9b90fd;

  --error: #ff6e84;
  --error-container: #a70138;
}
```

### 2.3 Reglas de aplicación

- Fondo de página: `--bg-deep`. Los tonos vino del design system se usan en transparencias y capas, no como sustituto opaco del negro espacial.
- Acción primaria y estado `focus`: cian. Acción destructiva o gasto: magenta.
- Violeta: XP, gamificación, tercera serie de datos y estados secundarios.
- Amarillo: máximo un foco por vista; reservarlo para horizonte, aviso o logro.
- No colorear grandes párrafos con neón. El texto de lectura usa `--text-glow` o `--on-surface`.
- El glow refuerza un color sólido; nunca es el único indicador de estado.

## 3. Tipografía

La pantalla combina una base legible con una capa display de terminal arcade.

| Rol | Familia | Tratamiento |
| --- | --- | --- |
| Display y titulares de marca | `Orbitron`, `Space Grotesk`, sans-serif | Mayúsculas, geometría amplia, glow o glitch solo en títulos principales. |
| Titulares estructurales | `Space Grotesk`, sans-serif | Peso 600–700, sin efectos agresivos. |
| Cuerpo | `Arimo`, sans-serif | Lectura limpia, antialiasing activo. |
| Etiquetas y datos compactos | `Courier Prime`, monospace | Sensación de terminal; tracking positivo y cifras alineadas. |

`Orbitron` es la voz expresiva observada en el dashboard. `Space Grotesk` conserva la jerarquía del sistema y funciona como fallback de mayor legibilidad.

### Escala

| Token | Tamaño | Peso | Interlínea | Tracking |
| --- | ---: | ---: | ---: | ---: |
| `headline-xl` | `64px` | `700` | `1.1` | `-0.02em` |
| `headline-lg` | `40px` | `700` | `1.2` | normal |
| `headline-lg-mobile` | `32px` | `700` | `1.2` | normal |
| `headline-md` | `24px` | `600` | `1.3` | normal |
| `body-lg` | `18px` | `400` | `1.6` | normal |
| `body-md` | `16px` | `400` | `1.6` | normal |
| `body-sm` | `14px` | `400` | `1.4` | normal |
| `label-md` | `14px` | `400` | `1.2` | `0.05em` |
| `label-sm` | `12px` | `400` | `1.2` | `0.05em` |

### Jerarquía textual

- H1 de bienvenida: `headline-xl`, Orbitron, mayúsculas, cian y glitch magenta/cian.
- Valores financieros principales: `headline-lg`, un solo color de firma, cifras tabulares cuando estén disponibles.
- Títulos de tarjeta: `label-md`, mayúsculas, tono secundario; icono de 18–20 px.
- Metadatos: `label-sm` o `body-sm`, sin glow.
- No aplicar glitch a texto menor de `24px` ni a cantidades que el usuario deba leer con precisión.

## 4. Espaciado, rejilla y composición

### 4.1 Escala

La unidad base es `8px`, con pasos de `2px` y `4px` para bordes y ajustes ópticos.

```css
:root {
  --space-2xs: 2px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 64px;
  --grid-gutter: 16px;
  --grid-margin: 24px;
}
```

No introducir valores intermedios salvo corrección óptica documentada.

### 4.2 Dashboard desktop

- Sidebar fija: `256px`, altura completa, padding vertical `16px`, horizontal `8px`.
- Área principal: margen izquierdo `256px`, padding exterior `24px`; `32px` en viewport amplio.
- Ritmo vertical principal: `24px`.
- Rejilla de contenido: 3 columnas fluidas y gutter de `16px`.
- KPIs: mínimo `160px` de alto, padding `24px`.
- Zona analítica: dos columnas para el gráfico principal y una para actividad; mínimo `300px`.
- Gráfico mensual: ocupa las tres columnas; mínimo `240px`.
- Cabecera: título a la izquierda, progreso/XP a la derecha; separación mínima `16px`.

### 4.3 Responsive

- Por debajo de `md`, ocultar la sidebar fija y eliminar el margen izquierdo.
- Colapsar la rejilla a una columna. Las zonas de datos cambian orden, pero no jerarquía.
- El H1 pasa de `64px` a `32px`.
- Gráficos circulares y leyendas se apilan verticalmente.
- Mantener targets táctiles mínimos de `44 × 44px`.
- Reducir efectos ambientales antes que reducir legibilidad o espacio de datos.

## 5. Capas ambientales y shaders

El fondo se construye como una escena. Este orden debe conservarse:

| Capa | `z-index` | Contenido |
| --- | ---: | --- |
| Base | `-3` | Canvas WebGL de nebulosa animada. |
| Horizonte | `-2` | Sol outrun segmentado y desenfocado. |
| Siluetas | `-1` | Rejilla en perspectiva, palmeras o estatua; una familia decorativa dominante. |
| Aplicación | `10` | Dashboard y tarjetas. |
| Navegación | `40` | Sidebar fija con blur. |
| Textura CRT | `50` | Scanlines globales, sin eventos de puntero. |

### 5.1 Shader de nebulosa

El canvas usa WebGL con tres capas de ruido simplex 2D en movimiento lento:

- Base púrpura profunda aproximada: `rgb(34, 2, 22)`.
- Púrpura iluminado aproximado: `rgb(78, 23, 57)`.
- Aporte magenta: intensidad máxima `0.20`.
- Aporte cian: intensidad máxima `0.10`.
- Velocidad temporal: `u_time × 0.2`.
- Scanline interna: `sin(uv.y × 800) × 0.04`.
- Viñeta: `1 - smoothstep(0.5, 1.5, length(p))`.

El shader debe ser atmosférico. Si el ruido reduce el contraste de una tarjeta, bajar su intensidad; no hacer la tarjeta más opaca por defecto.

### 5.2 Sol outrun

- Gradiente vertical `#FFD43F → #FF007F`.
- Ancho `60vw`, alto `30vw`, máximos `800 × 400px`.
- Semicírculo superior; bandas horizontales recortadas desde el 60% de su altura.
- Glow exterior de `50px` magenta y `100px` amarillo.
- Ubicado en el horizonte inferior, con blur ambiental. No debe competir con números ni botones.

### 5.3 Rejilla, palmeras y estatua

- **Perspective grid:** SVG o CSS a `4%` de opacidad, convergente hacia el horizonte. Úsala en hero o dashboard, no en ambos si comparten viewport.
- **Palmeras:** siluetas periféricas, sin detalle interior y fuera de la zona de lectura.
- **Estatua vaporwave:** PNG/3D clásico en duotono violeta–rosa o cian–magenta, `80%` de opacidad máxima, detrás del H1.
- Mostrar solo una de las dos familias figurativas —palmeras o estatua— por escena.

### 5.4 CRT scanlines

Patrón horizontal de `4px`: mitad transparente, mitad negro al `20%`, con opacidad global de referencia `0.30`. Debe ser imperceptible sobre texto pequeño. En pantallas de baja densidad o con contraste degradado, reducir la opacidad a `0.05–0.12`.

## 6. Superficies y profundidad

### Tarjeta synth

```css
.synth-card {
  position: relative;
  overflow: hidden;
  background: rgb(11 12 16 / 20%);
  border: 1px solid rgb(255 255 255 / 10%);
  backdrop-filter: blur(10px);
}

.synth-card::before {
  content: "";
  position: absolute;
  inset: 0;
  padding: 2px;
  border-radius: inherit;
  background: linear-gradient(135deg, #ff007f, #00ffff);
  pointer-events: none;
  /* Aplicar máscara para conservar solo el borde. */
}
```

- Radios de referencia: `8–12px` en tarjetas de dashboard. Los controles de marca pueden ser rectos.
- La translucidez es baja y el blur crea separación del shader.
- El borde degradado define el contenedor; no añadir otra sombra pesada.
- Hover opcional: `translateY(-4px)` y glow tenue. En dashboards densos, reservarlo para tarjetas clicables.

### Jerarquía de elevación

1. Fondo opaco/profundo.
2. Superficie translúcida con blur.
3. Borde tonal o degradado.
4. Glow tenue en reposo.
5. Glow intenso únicamente en foco, hover o actividad.

## 7. Componentes

### 7.1 Botones

- Borde `2px solid currentColor`, fondo transparente y altura mínima `44px`.
- Texto de etiqueta en Courier Prime u Orbitron, mayúsculas.
- **Primario (`btn-neon`):** cian; glow exterior e interior de `10px / 50%`.
- **Destructivo (`btn-danger`):** magenta; misma estructura, nunca solo un cambio de glow.
- Hover: relleno al `20%` y glow de `20px / 80%`.
- Active: escala máxima `0.95–0.98`; evitar rebotes.
- Focus visible independiente del hover: `2px` discontinuo violeta con offset suficiente.

### 7.2 Navegación

- Sidebar negro translúcido, blur medio y borde derecho tonal.
- Elemento activo: texto cian, borde izquierdo `4px`, relleno cian muy tenue.
- Inactivos: `on-surface-variant`; hover con superficie elevada y glow corto.
- Perfil: avatar circular con borde cian; nombre display y nivel en monoespaciada.

### 7.3 Inputs

- Fondo `#050508`.
- Borde `1px solid --outline` o `--text-muted`.
- Texto y cifras en Courier Prime.
- Focus: borde cian/violeta, outline visible y glow controlado.
- Error: color sólido y mensaje textual; no usar parpadeo.

### 7.4 Visualización financiera

- Mantener cifras y unidades visibles sin hover.
- Series principales: cian, magenta y violeta, en ese orden.
- Añadir leyenda, etiqueta o patrón; el color por sí solo no basta.
- Donut: trazo de `16px`, glow de `5px`; cifra total centrada.
- Barras: relleno al `20%`, borde al `30%`; hover al `40%` y tooltip textual.
- Positivo/activo: cian. Gasto/riesgo: magenta. Categoría auxiliar: violeta.

### 7.5 Gamificación

- Barra XP: `8px` de alto, pista tonal oscura y progreso `--tertiary-fixed`.
- Pulso: glow `5px → 15px → 5px` durante `2s`.
- Insignias: SVG o píxel art, halo individual y silueta reconocible sin glow.
- Gamificación acompaña objetivos financieros; nunca convierte una pérdida en feedback celebratorio.

## 8. Movimiento y estados

| Uso | Duración | Curva |
| --- | ---: | --- |
| Hover/focus estándar | `250–300ms` | `ease` o `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| Pulso XP/neón | `2s` | `ease-in-out`, infinito solo mientras esté activo |
| Glitch display | `2.5–3s` por capa | `linear alternate-reverse` |
| Efecto ambiental amplio | `600ms+` | suave, sin cambios bruscos de luminancia |

- El glitch duplica el H1: capa magenta a `+2px`, capa cian a `-2px`, con recortes asíncronos.
- La simulación audio-reactiva puede aplicar `scaleY(1.05)` a decoración, nunca a texto o cifras.
- No animar más de un elemento ambiental dominante por pantalla.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .glitch-text::before,
  .glitch-text::after,
  .scanlines,
  #shader-canvas {
    animation: none !important;
  }
}
```

### 8.1 Estados de carga diferida

- La carga de identidad o del núcleo público ocupa la pantalla completa sobre el fondo Ultrawave y utiliza un mensaje monoespaciado breve, como “SINCRONIZANDO IDENTIDAD…”.
- La carga de una ruta privada conserva el shell, la navegación y el fondo. El contenido usa skeletons con las dimensiones aproximadas de la vista final para evitar saltos de layout.
- La Tienda puede mostrar un skeleton dentro del panel de Gamificación; no debe reemplazar el encabezado ni las pestañas ya disponibles.
- Los errores de descarga de un chunk se presentan en una tarjeta synth con explicación y acción de reintento/recarga. Nunca se deja una pantalla vacía.
- Los indicadores incluyen texto accesible o `aria-live`; el movimiento es decorativo y respeta `prefers-reduced-motion`.

## 9. Accesibilidad

- Contraste mínimo `4.5:1` en texto normal y `3:1` en texto grande y componentes.
- Verificar contraste sobre el frame más luminoso del shader, no solo sobre el color base.
- Foco de teclado persistente: `outline: 2px dashed #a69dff`; no eliminarlo al activar glows.
- Estados con icono + texto + color cuando sean importantes.
- Scanlines, glitch y pulso deben apagarse con `prefers-reduced-motion`.
- Evitar flashes rápidos y grandes cambios de luminancia.
- Cifras monetarias con separación y signo consistentes; usar alineación tabular en tablas.
- El fondo decorativo lleva `pointer-events: none` y queda oculto de tecnologías asistivas.

## 10. Do / Don't

### Do

- Usar el negro espacial como lienzo dominante.
- Reservar cian y magenta para acciones, cifras y series que merecen atención.
- Mantener la rejilla de 8 px y el gutter de 16 px.
- Crear profundidad con transparencia, blur y halos medidos.
- Probar cada vista sin shader: la jerarquía debe seguir funcionando.

### Don't

- No mostrar más de dos neones dominantes simultáneamente.
- No aplicar glow a todos los bordes, iconos y textos.
- No superponer sol, estatua y palmeras como focos equivalentes.
- No usar glitch en párrafos, etiquetas pequeñas ni valores financieros.
- No suavizar toda la interfaz con radios grandes o sombras SaaS convencionales.
- No esconder datos esenciales detrás de hover, animación o color.

## 11. Checklist de implementación

- [ ] Fondo global `#0B0C10` y superficies suficientemente transparentes.
- [ ] Orden de capas ambiental respetado.
- [ ] Máximo dos colores neón dominantes por viewport.
- [ ] Sidebar de `256px`, margen principal y rejilla de 3 columnas en desktop.
- [ ] Escala de espaciado usada sin valores arbitrarios.
- [ ] Tipografía display reservada para marca y titulares.
- [ ] Gráficos comprensibles sin depender solo del color.
- [ ] Focus visible y contraste verificado sobre shader.
- [ ] `prefers-reduced-motion` implementado.
- [ ] Decoración sin eventos de puntero ni semántica accesible.
- [ ] Responsive conserva orden de lectura y targets de `44px`.

---

**Criterio de desempate:** ante diferencias entre tokens generados y la pantalla aprobada, conservar la estructura semántica del design system v3, pero mantener `#FF007F` y `#00FFFF` como colores de firma visibles. La experiencia renderizada es la referencia final.
