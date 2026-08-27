# Arquitectura del frontend

Este documento recoge decisiones estructurales del frontend que deben conservarse entre hilos de trabajo. Los requisitos de producto pertenecen a `PRD.md`, el sistema visual a `DESIGN.md`, el trabajo futuro a `BACKLOG.md` y el flujo Git a `CONTRIBUTING_Es.md` / `CONTRIBUTING.md`.

## Code splitting

### Objetivo

Reducir el JavaScript necesario para mostrar el acceso y evitar descargar áreas privadas que el usuario todavía no ha visitado. La referencia inicial de `dev`, tomada el 27 de agosto de 2026 con Vite 8.1.4, es un único chunk de **591,83 kB minificados / 198,36 kB gzip**.

El éxito se mide por los recursos realmente solicitados y ejecutados en cada recorrido, no solo por eliminar el aviso de tamaño de Vite.

### Resultado en `dev`

El build de producción del 27 de agosto de 2026 deja el HTML inicial enlazado a **480,66 kB minificados / 173,50 kB gzip** de JavaScript (entry y chunks compartidos), una reducción del **18,8 % / 12,5 %** frente a la referencia. El entry principal pasa a **245,09 kB / 77,59 kB gzip**, un **58,6 %** menos en tamaño minificado, y desaparece el aviso de chunks superiores a 500 kB.

Los bloques funcionales se emiten por separado y no aparecen en el HTML inicial:

- Estructura privada: 5,90 kB / 2,28 kB gzip.
- Finanzas: 39,37 kB / 10,03 kB gzip.
- Cuenta: 23,58 kB / 6,12 kB gzip.
- Cyberdeck: 11,33 kB / 3,51 kB gzip.
- Tienda: 4,36 kB / 1,68 kB gzip.

`npm --prefix frontend run verify:chunks` comprueba de forma automatizada que estos cinco artefactos existan y que ninguno quede referenciado prematuramente desde `dist/index.html`. Las cifras son una referencia reproducible, no un presupuesto inmutable: pueden variar al evolucionar las dependencias, pero cualquier regresión relevante debe justificarse y volver a medirse.

### Límites funcionales

1. **Núcleo público:** arranque, estilos globales, idioma, autenticación, shells públicos, acceso, registro, recuperación, páginas legales y estados globales de carga/error.
2. **Finanzas:** Dashboard, métricas, transacciones, presupuestos, tablas, formularios y gráficos compartidos.
3. **Cuenta:** Perfil, Ajustes y gestión de categorías.
4. **Cyberdeck:** resumen de Gamificación, progreso, diagrama, reparaciones e historial.
5. **Tienda:** ofertas rotatorias, tarjetas, confirmación y compra. Se carga bajo demanda al abrir la pestaña y se puede anticipar mediante hover, foco de teclado o el tour guiado.

Los módulos compartidos pueden acabar en chunks comunes generados por Vite. No se deben forzar `manualChunks` solo para ocultar una advertencia: primero se emplean límites de `import()` estables y después se ajusta la configuración únicamente si las mediciones lo justifican.

## Splitting de datos

### Problema de partida

Hasta `BR-BL-001`, entrar en cualquier ruta privada ejecutaba un único `getSnapshot()` que lanzaba nueve lecturas en paralelo: dashboard, transacciones, categorías, progreso, cyberdeck, tienda, historial, bonus de familias y perfil. Cada mutación volvía a descargar el snapshot completo, aunque la pantalla activa solo utilizara una parte.

### Límites y caché

La implementación incorporada desde `codex/feature/data-loading-splitting` añade TanStack Query 5.102.8 dentro del chunk privado y sustituye el snapshot global por consultas independientes. `AppDataProvider` conserva las acciones y el perfil compartido por el shell, mientras que cada página o pestaña solicita sus propios recursos:

| Área visible | Datos solicitados |
| --- | --- |
| Shell privado | Perfil (`/me`); al restaurar una sesión se reutiliza el perfil completo ya obtenido por autenticación y no se duplica la llamada. |
| Dashboard | Dashboard y categorías. |
| Gastos | Transacciones y categorías; utiliza el perfil ya compartido para la moneda. |
| Presupuestos | Presupuestos y categorías. Mientras no exista la vertical persistente, los presupuestos proceden del repositorio mock/local y no de una API ficticia. |
| Perfil | Perfil compartido. |
| Ajustes | Perfil compartido; categorías solo al montar su gestor. |
| Gamificación · Resumen | Resumen de progreso y bonus de familias. |
| Gamificación · Cyberdeck / Reparaciones | Slots y módulos del cyberdeck. |
| Gamificación · Tienda | Resumen de progreso e inventario rotatorio; código e inventario se precargan con hover o foco y se solicitan al seleccionar la pestaña o cuando el tour la necesita. |
| Gamificación · Registro | Historial del juego. |

Las consultas mantienen datos frescos durante 30 segundos por defecto, dos minutos para categorías y cinco minutos para el perfil. No se refrescan solo por recuperar el foco de la ventana. El caché se destruye al desmontar la zona autenticada.

### Coherencia después de mutar

- Crear, editar o borrar una transacción aprovecha el dashboard recalculado que ya devuelve la API e invalida únicamente la lista de transacciones.
- Cambiar categorías invalida categorías, transacciones y dashboard; TanStack Query solo vuelve a solicitar en ese momento las consultas activas y deja el resto marcado como obsoleto.
- Crear un presupuesto invalida presupuestos y dashboard. La API real seguirá pendiente hasta `BR-BL-005`.
- Cambiar idioma, preferencias o completar el tour actualiza directamente el perfil en caché.
- Comprar o reparar recibe el estado completo del juego, reparte sus piezas entre las consultas correspondientes e invalida perfil y dashboard para recoger los saldos derivados.

Los repositorios HTTP y mock implementan el mismo contrato granular. No se deben reintroducir agregadores que consulten todos los recursos para simplificar una pantalla.

### Espera, error y medición

- Cada recurso muestra primero un skeleton estable. El texto de sincronización aparece solo a partir de **700 ms**, para no generar parpadeos, y a los **3 s** añade un aviso accesible de que el proveedor sigue respondiendo.
- Un error de datos queda contenido en la sección afectada y permite reintentar su consulta sin recargar toda la aplicación. Los errores de descarga de JavaScript siguen siendo responsabilidad de `AsyncBoundary`.
- `apiClient` conserva en `window.__BUDGET_RUNNER_API_METRICS__` las últimas 200 peticiones con método, ruta normalizada, estado y duración. Los UUID y query strings no se guardan. Las mismas operaciones quedan registradas como medidas `budget-runner:api:*` en la Performance API.
- Para una medición manual, vacía el array antes del recorrido y consulta después `console.table(window.__BUDGET_RUNNER_API_METRICS__)`. Combínalo con Network/Performance del navegador para payload, waterfalls y tiempo hasta contenido útil bajo la latencia real de Vercel y Neon.

La validación cubrió build, lint, 13 tests de integración, contrato de chunks y navegación por todas las áreas y pestañas. El mantenedor aprobó la experiencia local el 27 de agosto de 2026. La observación de métricas con los proveedores reales queda como seguimiento operativo del próximo despliegue autorizado, no como una condición pendiente de implementación.

### Experiencia de carga

- El acceso inicial usa un estado de pantalla completa coherente con “SINCRONIZANDO IDENTIDAD…”.
- Dentro de la zona privada se conservan navegación, fondo y dimensiones mientras el contenido diferido muestra un skeleton Ultrawave.
- Los fallos al descargar un chunk muestran un mensaje accesible, integrado en la estética synthwave, con una acción de reintento/recarga.
- Los estados comunican actividad mediante texto y estructura, no solo color o animación.
- Se respeta `prefers-reduced-motion` y se evitan flashes, pantallas blancas y saltos de layout.

### Reglas de implementación

- Mantener las rutas y URLs públicas existentes.
- Colocar `Suspense` en el límite más pequeño que preserve el shell útil.
- Proteger las importaciones dinámicas con un límite de error apropiado.
- Evitar descargar Cyberdeck al mostrar el login y Tienda antes de necesitarla.
- Asegurar que el tour pueda esperar a un panel diferido antes de buscar su objetivo.
- No cambiar contratos de API ni el modelo de datos como parte de este trabajo.

### Verificación mínima

- TypeScript, lint y build de producción.
- Comparativa de nombres, tamaños y gzip de los chunks.
- Login, restauración de sesión, logout y navegación directa/recarga.
- Dashboard, transacciones, presupuestos, Perfil y Ajustes.
- Todas las pestañas de Gamificación, compra y reparación.
- Tour guiado, ocho idiomas, 360 px, teclado y movimiento reducido.
- Prueba de recuperación ante un chunk que no pueda descargarse.
