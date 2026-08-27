# Budget Runner — Product Requirements Document

**Subtítulo:** Personal Finance & Cyberdeck  
**Versión:** 1.0  
**Estado:** Especificación para MVP  
**Propietario:** Mike Fieldins  
**Licencia:** MIT  
**Idioma inicial:** Español (es-ES)

> **Guía para colaboradores y agentes:** este PRD define el producto, pero no el proceso operativo. Antes de modificar el repositorio, consulta [`CONTRIBUTING_Es.md`](CONTRIBUTING_Es.md) o [`CONTRIBUTING.md`](CONTRIBUTING.md) para conocer el flujo `dev → main → prod`, las reglas de publicación y despliegue, y la gestión de contribuciones. Revisa también [`BACKLOG.md`](BACKLOG.md): registra trabajo futuro identificado, pero ninguna entrada autoriza su implementación sin priorización y alcance confirmados.

## 1. Resumen ejecutivo

Budget Runner es una aplicación web responsive de finanzas personales que combina un gestor de gastos y presupuestos con una capa de gamificación persistente. El usuario registra ingresos y gastos, crea presupuestos semanales y mensuales, consulta estadísticas y obtiene recompensas por mantenerse dentro de sus límites.

El excedente positivo de un presupuesto cumplido se transforma en **SynthCoins** a razón de 1:1 respecto a la moneda configurada. Los SynthCoins permiten comprar y reparar módulos de un cyberdeck virtual. Los módulos aportan **Power**, pueden recibir daño por incumplir presupuestos y se organizan en cuatro familias estéticas: Retrowave, Synthwave, Vaporwave y Hi‑Fi Tech. Los puntos de progreso del usuario se denominan **Flux**.

El producto debe respetar el mockup generado en Stitch UI y el sistema visual Ultrawave: modo nocturno único, composición synthwave con matices vaporwave y retrowave, alto contraste, rejillas de perspectiva, scanlines, brillos de neón moderados y componentes legibles. El backend se construye con Node.js, Express y PostgreSQL; el frontend con React y Tailwind CSS. En `prod`, Firebase Authentication gestiona email/contraseña, Google y recuperación; la API valida Firebase ID tokens y conserva en PostgreSQL el UUID interno y el estado de producto. Las rutas JWT y Google OAuth propias se mantienen únicamente para desarrollo y regresión. Las pruebas end-to-end se realizan con automatización de navegador. El despliegue híbrido utiliza Firebase Hosting, Vercel y Neon.

## 2. Visión del producto

Ayudar al público generalista a mejorar sus hábitos financieros mediante una experiencia clara, útil y motivadora, en la que el ahorro se convierte en progreso visible y personalización tecnológica.

### 2.1 Propuesta de valor

- Gestión financiera práctica: gastos, ingresos, categorías, presupuestos y estadísticas.
- Motivación no punitiva: incumplir un presupuesto limita temporalmente la progresión, pero no elimina SynthCoins ya obtenidos.
- Metajuego estratégico: compra, reparación, sinergias y riesgo de daño del cyberdeck.
- Identidad visual distintiva sin sacrificar legibilidad ni rendimiento.
- Propiedad aislada de los datos financieros y de progresión para cada usuario.

## 3. Objetivos del MVP

1. Permitir registro, inicio de sesión, recuperación de contraseña y acceso con Google.
2. Permitir registrar, editar, eliminar y consultar transacciones financieras.
3. Permitir crear presupuestos globales o por categoría con periodicidad semanal o mensual.
4. Evaluar automáticamente cada periodo una sola vez y otorgar recompensas sin doble contabilización.
5. Implementar niveles, Flux, SynthCoins, cyberdeck, tienda rotatoria, compra, sustitución, reparación, daño y destrucción.
6. Mantener historial auditable de operaciones financieras y de gamificación.
7. Completar las pantallas ausentes en el mockup manteniendo el lenguaje visual Ultrawave.
8. Funcionar correctamente en escritorio y smartphone.
9. Publicar el código bajo licencia MIT a nombre de Mike Fieldins.

## 4. Fuera de alcance del MVP

- Conexión bancaria automática u Open Banking.
- Aplicación móvil nativa.
- Inventario de módulos no equipados.
- Mercado entre usuarios, stock global o economía afectada por demanda.
- Audio real o visualizaciones dependientes de audio.
- Generación procedural de módulos.
- Monedas virtuales compradas con dinero real.
- Funciones sociales más allá de las expansiones futuras indicadas.
- Herramientas administrativas completas; el catálogo se gestionará inicialmente mediante seed/migraciones.

## 5. Personas y casos de uso

### 5.1 Usuario principal

Persona adulta no experta en finanzas que quiere registrar gastos, controlar límites y obtener motivación adicional mediante progreso y personalización.

### 5.2 Necesidades

- Entender rápidamente cuánto ha gastado y cuánto presupuesto queda.
- Registrar una transacción con pocos pasos.
- Separar presupuestos por categorías y periodos.
- Evitar recompensas duplicadas.
- Comprender por qué ha ganado o no SynthCoins.
- Evaluar el riesgo de comprar, conservar o reparar un módulo.
- Conocer la contribución del cyberdeck a su nivel.

## 6. Principios de producto

- **Claridad antes que espectáculo:** ningún efecto visual debe ocultar cantidades, estados o acciones.
- **Resultados deterministas:** una misma entrada y estado producen el mismo resultado.
- **Operaciones atómicas:** compras, reparaciones, cierres de periodo y daño se completan íntegramente o no se aplican.
- **Trazabilidad:** toda mutación de saldo, Flux, nivel o equipamiento genera un registro.
- **No doble recompensa:** un importe ya recompensado en un periodo no vuelve a generar SynthCoins en otro periodo solapado.
- **Progresión no pay-to-win:** no existen compras con dinero real.
- **Responsive real:** no se limita a reducir el escritorio; se reorganizan navegación, gráficos y acciones.

## 7. Arquitectura de información

### 7.1 Navegación principal

1. Dashboard
2. Gastos
3. Presupuestos
4. Gamificación
5. Perfil
6. Ajustes
7. Cerrar sesión

En escritorio se usa sidebar fijo. En smartphone se utiliza navegación inferior o drawer accesible, conservando acceso prioritario a Dashboard, Gastos, Presupuestos y Gamificación.

### 7.2 Dashboard

Debe mantenerse fiel al mockup:

- Saludo contextual y estado del sistema.
- Resumen de nivel y progreso hacia el siguiente nivel.
- Balance total.
- Presupuesto restante.
- Distribución de gastos mediante gráfico donut.
- Flujo mensual mediante gráfico de barras.
- Lista de transacciones recientes.
- CTA “Añadir gasto”.
- Estados vacíos, carga, error y datos precargados de demostración.

El cyberdeck no se muestra en el Dashboard; queda confinado a Gamificación. Las rachas y el desglose de nivel se muestran en Perfil.

### 7.3 Gastos

- Listado paginado y filtrable.
- Búsqueda por concepto.
- Filtros por fecha, tipo, categoría y rango de importe.
- Alta, edición y borrado con confirmación.
- Campos: tipo (gasto/ingreso), concepto, importe, moneda, categoría, fecha, notas opcionales.
- Resúmenes del periodo y exportación futura marcada como no MVP.
- Categorías editables por usuario.
- Ejemplos iniciales: Combustible de Neón, Raciones Orbitales, Mantenimiento del Hovercar, Suscripciones de la Red, Ocio Holográfico, Salud Biónica, Vivienda en la Megaciudad, Tecnología del Cyberdeck y Otros.

### 7.4 Presupuestos

- Crear, editar, pausar y archivar presupuestos.
- Periodicidad semanal o mensual.
- Alcance global o asociado a una categoría.
- Moneda configurable.
- Varios presupuestos activos simultáneamente.
- Visualizar límite, gasto computado, restante, porcentaje, inicio, fin y estado.
- Estados: programado, activo, cumplido, excedido, cerrado y cancelado.
- El cierre se ejecuta una sola vez por periodo y presupuesto.
- Mostrar la trazabilidad de gastos computados y cantidades excluidas por prevención de doble recompensa.

### 7.5 Gamificación

Subsecciones:

- Resumen: nivel, Flux, SynthCoins, Power base, Power del cyberdeck, bonus de familia y bloqueo vigente.
- Cyberdeck: diagrama vectorial técnico con 10 slots conectados.
- Tienda rotatoria: selección limitada de módulos disponible durante el periodo.
- Reparaciones: módulos dañados reparables.
- Registro: compras, reparaciones, daño, destrucciones, recompensas y cambios de nivel.
- Ayuda: explicación sintética de las reglas.

#### Slots fijos

1. CPU — Neural Chip
2. GPU — Holographic Core
3. RAM — Memory Module
4. Display — Neon Display
5. Expansion — Expansion Board
6. Jammer — Frequency Jammer
7. Network — Quantum NIC
8. Cooling — Cryo Cooler
9. Projector — Hologram Projector
10. Power — Fusion Cell

Cada slot admite como máximo un módulo. No existe inventario. Un módulo reemplazado deja de estar disponible para el usuario.

### 7.6 Perfil

- Avatar y nombre visible.
- Nivel, Flux total y progreso.
- Racha semanal y mensual.
- Historial de niveles.
- Moneda principal y zona horaria.
- Gestión de cuenta y cambio de contraseña.
- Vinculación/estado de Google OAuth.

### 7.7 Ajustes

- Moneda principal y formato regional.
- Zona horaria.
- Inicio de semana.
- Preferencias de animación.
- Activar/desactivar efecto audio-reactive simulado.
- Preferencia `reduced motion`.
- Gestión de categorías.
- Privacidad y eliminación de cuenta.

## 8. Requisitos funcionales

### RF-01 — Registro y autenticación

- Registro con email y contraseña.
- Email único, normalizado y no sensible a mayúsculas.
- En `prod`, inicio de sesión mediante Firebase Authentication y autorización de la API con Firebase ID token.
- Recuperación de contraseña mediante el enlace de un solo uso de Firebase.
- Inicio de sesión con Google mediante Firebase Authentication.
- Revocación de sesiones Firebase; en modo heredado, refresh tokens rotatorios y revocables.
- Las contraseñas de producción no se almacenan en PostgreSQL. Las cuentas locales heredadas conservan únicamente hashes robustos.
- Rutas privadas protegidas por middleware.
- Vinculación idempotente entre Firebase UID y UUID interno, sin duplicar cuentas por email verificado.

### RF-02 — Aislamiento multiusuario

Todos los gastos, presupuestos, categorías, estadísticas, SynthCoins, Flux, niveles, equipamiento, daños, ofertas e historiales pertenecen a un único usuario. Ninguna consulta puede devolver datos de otro usuario.

### RF-03 — Moneda configurable

- Cada usuario elige una moneda principal ISO 4217.
- Los importes se almacenan en unidades menores enteras.
- El MVP no realiza conversión automática entre monedas.
- Una transacción y su presupuesto deben compartir moneda para computarse.
- Cambiar la moneda principal no convierte datos históricos.

### RF-04 — Transacciones

- CRUD completo.
- Importe mayor que cero.
- Fechas futuras permitidas solo si se marcan como programadas; las transacciones programadas no cuentan hasta su fecha efectiva.
- Cambiar o eliminar una transacción de un periodo ya cerrado no reabre automáticamente recompensas. Debe registrarse un ajuste administrativo interno o bloquearse la edición según política de consistencia del MVP. Para el MVP, se bloquea la edición/borrado de transacciones incluidas en cierres recompensados y se ofrece crear un ajuste compensatorio.

### RF-05 — Presupuestos concurrentes

- Un usuario puede tener presupuestos globales y por categoría simultáneos.
- Se permiten periodos semanales y mensuales.
- La interfaz advierte de solapamientos, pero no los prohíbe.
- Un gasto puede contribuir a la medición de varios presupuestos, pero su importe elegible para SynthCoins solo puede recompensarse una vez.
- La prioridad de atribución de recompensas es:
  1. cierre cronológicamente anterior;
  2. en empate, periodo más corto (semanal antes que mensual);
  3. en empate, presupuesto de categoría antes que global;
  4. en empate final, presupuesto creado primero.
- Un ledger de atribución conserva la porción del gasto ya utilizada para recompensas.
- Los gastos ya recompensados semanalmente pueden seguir aparecer en el cálculo informativo mensual, pero su porción no genera nuevos SynthCoins mensuales.

### RF-06 — Cierre de periodo

Al terminar un periodo:

1. Bloquear el presupuesto para evaluación.
2. Calcular gasto efectivo.
3. Determinar estado cumplido o excedido.
4. Calcular porción elegible no recompensada.
5. Si se cumple, otorgar Flux de cumplimiento y SynthCoins por excedente elegible.
6. Si se excede, crear penalización temporal y aplicar daño al cyberdeck.
7. Marcar el cierre como procesado con clave idempotente.
8. Crear el siguiente periodo si el presupuesto sigue activo.
9. Rotar las ofertas asociadas al nuevo periodo.
10. Actualizar nivel y estadísticas.
11. Emitir registros de auditoría.

### RF-07 — Recompensas

- Conversión: 1 unidad de moneda ahorrada = 1 SynthCoin.
- Internamente se usan unidades menores; la conversión se redondea hacia abajo a SynthCoins enteros.
- `excedente = max(0, límite - gasto efectivo)`.
- `excedente elegible` excluye las porciones ya recompensadas en periodos solapados.
- Los SynthCoins se acreditan una sola vez por cierre.
- El cumplimiento otorga Flux base configurable por tipo de periodo; valores iniciales recomendados:
  - semanal: 25 Flux;
  - mensual: 100 Flux.
- El PRD permite ajustar estos valores por configuración sin migración.

### RF-08 — Penalización por exceder presupuesto

- No se restan SynthCoins ya obtenidos.
- No se otorgan SynthCoins ni Flux de cumplimiento para ese cierre.
- Se impide comprar módulos hasta que termine el periodo penalizado.
- Reparar módulos continúa permitido.
- El balance de SynthCoins se muestra en rojo con glitch moderado mientras exista cualquier bloqueo activo.
- Si hay varios presupuestos incumplidos, la compra permanece bloqueada hasta la fecha de fin más tardía de las penalizaciones activas.
- Se aplica daño una vez por cada cierre excedido, protegido por idempotencia.

### RF-09 — Catálogo común de módulos

- Catálogo global compartido por todos los usuarios.
- Los módulos no se generan proceduralmente.
- Cada definición tiene: nombre, slot, familia, rareza, precio, Power, Shield, recurso visual y estado activo.
- Rarezas: Common, Rare, Epic, Legendary y Mythic.
- La rareza y los atributos influyen en el precio y nivel mínimo, pero la demanda no afecta al stock ni al precio.
- Relación de diseño: Shield alto tiende a Power menor; Power y Shield simultáneamente altos implican mayor rareza y coste.

### RF-10 — Ofertas rotatorias

- Al comenzar cada periodo relevante se genera una selección pseudoaleatoria a partir del catálogo.
- La selección depende del nivel del usuario y no de su build actual.
- No es obligatorio ofrecer módulos para todos los slots.
- Puede no existir oferta para un slot vacío.
- Las ofertas se conservan hasta el fin del periodo y después expiran.
- La semilla de selección se persiste para reproducibilidad y auditoría.
- No existe stock ni reserva global.
- La cantidad inicial recomendada es 6 ofertas totales por rotación, configurable.
- El rango de rareza/precio aumenta con el nivel, sin excluir por completo opciones asequibles.

### RF-11 — Compra y sustitución

Precondiciones:

- Oferta activa y no expirada.
- Compras no bloqueadas.
- Módulo compatible con el slot.
- Nivel mínimo cumplido.
- El usuario posee SynthCoins suficientes para el coste neto.
- La operación no ha sido procesada previamente.

Cálculo:

- Si el slot está vacío: `coste_neto = precio_nuevo`.
- Si hay módulo equipado y no destruido:
  - `valor_entrega = floor(precio_original_módulo_actual × 0,5)`.
  - `coste_neto = max(0, precio_nuevo - valor_entrega)`.
- Un módulo destruido no aporta valor de entrega.
- Si el coste neto es cero, no se acreditan SynthCoins adicionales.

Aplicación atómica:

1. Debitar coste neto.
2. Desequipar y retirar la instancia anterior.
3. Crear/equipar la nueva instancia con Energy 100.
4. Recalcular Power, bonus de familia, Flux derivado y nivel.
5. Registrar ledger y evento.

El Power de la mejora sustituida nunca debe permanecer sumado.

### RF-12 — Daño

Para un presupuesto excedido:

- `porcentaje_exceso = ((gasto - límite) / límite) × 100`.
- `daño_base = trunc((1 + porcentaje_exceso / 100) × 100)`.
- Simplificación equivalente: `daño_base = trunc(100 × gasto / límite)`.
- Para cada módulo equipado y no destruido:
  - `daño_aplicado = max(0, trunc(daño_base - Shield × 10))`.
  - `Energy_nueva = Energy_actual - daño_aplicado`.
- Shield bloquea hasta 100 puntos cuando vale 10.
- Si Energy queda en 0 o menos, se fija en 0 y el módulo queda destruido.
- Un módulo destruido deja de aportar Power y bonus.
- Tras cada destrucción se recalculan totales y nivel.
- Un mismo evento de cierre no puede dañar dos veces.

Ejemplo: límite 1.000, gasto 2.000 → exceso 100 % → daño base 200. Un módulo Shield 7 recibe 130 puntos y queda destruido desde Energy 100.

### RF-13 — Reparación

- Solo módulos con `0 < Energy < 100`.
- Los módulos destruidos no se pueden reparar.
- Permitida incluso con compras bloqueadas.
- `porcentaje_daño = (100 - Energy) / 100`.
- `coste_reparación = ceil(precio_original × porcentaje_daño)`.
- Se comprueba saldo suficiente.
- Se debita el coste y Energy vuelve a 100 en una operación atómica.
- Power no cambia durante el daño parcial ni tras la reparación.
- Advertencias visuales:
  - Energy < 50: advertencia.
  - Energy ≤ 25: crítica.
  - Energy = 0: destruido.

### RF-14 — Power, Flux y nivel

- `Power_activo = suma Power de módulos equipados no destruidos`.
- Los módulos dañados con Energy > 0 aportan el 100 % de Power.
- Los bonus de familia se calculan sobre el Power activo de los módulos de esa familia.
- Tabla de bonus:
  - 2 módulos: +5 %.
  - 3 módulos: +12 %.
  - 4 módulos: +20 %.
  - 5 o más módulos: +35 %.
- El bonus se trunca a entero por familia.
- `Flux_total = Flux_base_acumulado + Power_activo + bonus_familias`.
- Umbrales iniciales:
  - Nivel 1: 0.
  - Nivel 2: 100.
  - Nivel 3: 250.
  - Nivel 4: 450.
- A partir de nivel 4: el siguiente umbral aumenta en 50 Flux adicionales respecto al incremento anterior. Los umbrales se almacenan en tabla configurable.
- El nivel puede bajar si se destruyen o sustituyen módulos y baja el Power.
- Nunca se elimina el Flux base histórico; solo varía el componente derivado del cyberdeck.

### RF-15 — Historial

Conservar:

- transacciones financieras;
- presupuestos y periodos;
- evaluaciones y atribuciones de recompensa;
- movimientos de SynthCoins;
- cambios de Flux/nivel;
- ofertas;
- compras y sustituciones;
- reparaciones;
- daños y destrucciones;
- sesiones y eventos de seguridad relevantes.

### RF-16 — Footer y licencia

En todas las páginas públicas y autenticadas:

`Budget Runner © [año] Mike Fieldins · MIT License`

“Mike Fieldins” enlaza a `https://www.linkedin.com/in/mikefieldins/` en pestaña nueva con atributos seguros. Debe existir un enlace al texto de la licencia MIT.

## 9. Requisitos visuales y UX

- Aplicar el `DESIGN.md` Ultrawave del proyecto como fuente de verdad.
- Modo nocturno único.
- Tipografías: Space Grotesk/Orbitron para títulos, Arimo para cuerpo y Courier Prime para datos técnicos.
- Rejilla de perspectiva y palmeras digitales como decoración de baja opacidad.
- Scanlines globales sutiles.
- Neon glow solo en interacción o información prioritaria.
- Máximo dos acentos neón intensos simultáneos por vista.
- Glitch reservado para títulos grandes, errores críticos y balance bloqueado.
- Audio-reactive simulado sin sonido, desactivable.
- Diagramas del cyberdeck en SVG/wireframe lineal. Se puede reutilizar la geometría por tipo y variar color por familia.
- Familias:
  - Retrowave: rosa cálido/naranja sunset.
  - Synthwave: magenta/cian.
  - Vaporwave: lavanda/rosa pastel.
  - Hi‑Fi Tech: blanco frío/azul eléctrico.
- En móvil, el cyberdeck se presenta por capas: diagrama desplazable y panel de detalle como bottom sheet.
- Los gráficos deben incluir valores textuales y tooltips; el color no puede ser la única señal.
- Estados de carga con skeletons discretos, no con flashes.

## 10. Pantallas necesarias

### Públicas

- Landing mínima / acceso.
- Registro.
- Inicio de sesión.
- Solicitar recuperación.
- Restablecer contraseña.
- Callback/resultado de Google OAuth.
- Licencia y privacidad.

### Privadas

- Dashboard.
- Gastos: listado y formulario.
- Presupuestos: listado, detalle, formulario e historial.
- Gamificación: resumen, cyberdeck, tienda, reparaciones y registro.
- Perfil.
- Ajustes.
- Página 404 y estado de error.

## 11. Requisitos no funcionales

### Seguridad

- HTTPS obligatorio en producción.
- Firebase ID token validado en cada petición protegida de `prod`; JWT corto y refresh rotatorio solo en el modo local heredado.
- Protecciones antiabuso de Firebase para autenticación y recuperación. Las rutas heredadas permanecen deshabilitadas en `prod` y deben tener rate limiting si se habilitan fuera de un entorno local aislado.
- Validación y sanitización en servidor.
- Consultas parametrizadas.
- Texto SQL estático en rutas y servicios, con comprobación automatizada contra composición en runtime.
- Detección de entradas con forma de consulta como defensa en profundidad, sin sustituir parametrización, validación semántica ni privilegios mínimos.
- Protección CSRF cuando corresponda al mecanismo de refresh.
- CORS restringido.
- Secrets fuera del repositorio.
- Logs sin contraseñas, tokens ni datos financieros completos.
- Eliminación de cuenta con confirmación y política documentada.

### Rendimiento

- Carga inicial objetivo < 3 s en conexión móvil media.
- Interacciones principales < 200 ms percibidos.
- Paginación de históricos.
- Índices en usuario, fecha, presupuesto, estado y claves idempotentes.
- SVG optimizados y efectos CSS limitados.

### Fiabilidad

- Jobs de cierre recuperables e idempotentes.
- Transacciones SQL para economía y equipamiento.
- Tiempos almacenados en UTC y mostrados según zona del usuario.
- Backup de PostgreSQL definido para producción.
- Ningún saldo puede quedar negativo.

### Accesibilidad mínima

- Contraste mínimo 4.5:1 para texto normal.
- Navegación por teclado.
- Foco visible.
- Etiquetas de formulario.
- `prefers-reduced-motion`.
- Mensajes de error textuales.

## 12. Métricas de éxito

- ≥ 80 % de usuarios nuevos completa su primer gasto.
- ≥ 60 % crea un presupuesto.
- ≥ 40 % completa un primer periodo.
- ≥ 30 % realiza una compra o reparación.
- Cero dobles recompensas en pruebas de idempotencia.
- Cero saldos negativos.
- 100 % de compras y reparaciones con ledger correspondiente.
- Flujo crítico usable en 360 px de ancho.
- Sin errores graves de la automatización de navegador en las rutas críticas.

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Doble recompensa por presupuestos solapados | Ledger de atribución por gasto y cierre idempotente |
| Condiciones de carrera en compras | Transacción SQL, bloqueo de fila y clave idempotente |
| Confusión entre Flux y Power | Mostrar fórmula y desglose separados |
| Saturación visual | Límites de efectos y jerarquía del DESIGN.md |
| Nivel inconsistente tras destrucción | Servicio único de recálculo invocado tras toda mutación |
| Daño repetido por job reintentado | Identificador único por cierre y módulo |
| Ofertas imposibles de auditar | Semilla persistida y snapshot de oferta |
| Cambio de zona horaria | Fijar zona al crear periodo; aplicar cambios al periodo siguiente |

## 14. Criterios de aceptación del MVP

El MVP se considera completo cuando:

1. Un usuario puede registrarse, recuperar contraseña e iniciar sesión con email o Google.
2. Puede gestionar categorías y transacciones.
3. Puede crear presupuestos semanales y mensuales simultáneos.
4. Los cierres otorgan SynthCoins una sola vez y evitan recompensas solapadas.
5. Los cierres excedidos bloquean compras, aplican daño y no eliminan saldo previo.
6. Puede comprar, sustituir y reparar módulos respetando todas las fórmulas.
7. Los módulos destruidos dejan de aportar Power y no se reparan.
8. Los bonus de familia y el nivel se recalculan correctamente.
9. Todos los movimientos relevantes quedan auditados.
10. La interfaz coincide visualmente con el mockup y DESIGN.md.
11. Los flujos principales funcionan en escritorio y smartphone.
12. La automatización de navegador completa el plan de pruebas crítico.
13. La app se despliega desde `prod` con el frontend en Firebase Hosting, la API en Vercel y PostgreSQL en Neon; muestra licencia MIT y enlace de autor.

## 15. Future Expansions

Preparar la arquitectura sin implementar en el MVP:

- Logros: catálogo, progreso y desbloqueo.
- Ranking: clasificaciones opt-in por nivel, Flux o rachas, con privacidad.
- Temporadas: periodos globales, recompensas cosméticas y rankings reiniciables.
- Desafíos diarios y eventos.
- Compartir cyberdeck.
- Skins cosméticas.
- Exportación avanzada.
- Open Banking.
- Clasificación automática de gastos.
- Recomendaciones y predicción financiera.
