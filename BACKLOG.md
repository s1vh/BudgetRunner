# Budget Runner — Backlog

Este fichero registra trabajo futuro ya identificado, pero **no autoriza su implementación**. La prioridad y el alcance de cada entrada deben confirmarse antes de comenzar. La operativa completa se define en `CONTRIBUTING_Es.md` y `CONTRIBUTING.md`.

## Pendiente

### BR-BL-004 — Remediar avisos de seguridad en dependencias npm

**Estado:** pendiente

**Prioridad:** alta

**Detectado:** 27 de agosto de 2026 con `npm --prefix backend audit` sobre el lockfile vigente.

El informe completo del backend registra **0 avisos críticos, 2 altos y 10 moderados**: 12 nodos de paquetes afectados, no 12 vulnerabilidades independientes. Al excluir dependencias de desarrollo mediante `--omit=dev` permanecen **1 alto y 8 moderados** en 9 nodos de la cadena de producción.

La revisión del frontend tras incorporar TanStack Query registra **0 críticos, 3 altos y 1 moderado** en cuatro nodos. Con `npm --prefix frontend audit --omit=dev` permanece únicamente **1 alto** de producción: `react-router@7.18.1`. TanStack Query 5.102.8 no figura afectado.

#### Criticidad alta

- **Producción — `fast-xml-parser@5.10.0`:** las declaraciones `DOCTYPE` repetidas pueden reiniciar los límites de expansión de entidades y provocar consumo de recursos. Entra por `firebase-functions@7.2.5 > firebase-admin@13.10.0 > @google-cloud/storage@7.21.0`. Afecta a versiones `>=5.9.3 <5.10.1`; npm identifica una corrección disponible. Referencia: [GHSA-8r6m-32jq-jx6q](https://github.com/advisories/GHSA-8r6m-32jq-jx6q).
- **Desarrollo — `nanoid@3.3.16`:** un generador personalizado con tamaño cero puede entrar en un bucle infinito. Entra por `vitest@4.1.10 > vite@8.1.4 > postcss@8.5.19`. Afecta a versiones `<3.3.18`; npm identifica una corrección disponible. Referencia: [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- **Producción frontend — `react-router@7.18.1`:** en modo RSC, determinadas acciones pueden ejecutarse antes de que una protección CSRF responda con 400. Afecta a `>=7.12.0 <7.18.2`; npm identifica una corrección compatible disponible. Budget Runner no utiliza actualmente RSC, pero la dependencia directa debe actualizarse y verificarse. Referencia: [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).
- **Desarrollo frontend — `brace-expansion@5.0.0`:** dos avisos de denegación de servicio por expansión sin límites afectan al mismo nodo (`<5.0.9`). npm identifica una corrección disponible. Referencias: [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) y [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895).

#### Criticidad moderada

- **Producción — `uuid@9.0.1`:** falta una comprobación de límites del buffer en UUID v3/v5/v6 cuando se proporciona `buf`. Entra por las dependencias de Google Cloud; afecta a versiones `<11.1.1`. Referencia: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- **Desarrollo — `postcss@8.5.19`:** un `sourceMappingURL` controlado por un atacante puede leer ficheros `.map` cuando no se define `from`. Afecta a versiones `<=8.5.22`. Referencia: [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
- **Frontend — `postcss@8.5.19`:** el mismo aviso moderado aparece en la cadena de desarrollo del frontend y dispone de corrección.
- **Propagación de la cadena Firebase/Google Cloud:** npm eleva también como nodos moderados a `firebase-functions`, `firebase-admin`, `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `gaxios`, `retry-request` y `teeny-request`, porque dependen de los paquetes vulnerables anteriores.

La remediación no debe aplicar automáticamente `npm audit fix --force`: el informe completo propone `firebase-functions@4.9.0`, lo que supondría un downgrade mayor desde `7.2.5` y podría romper el despliegue híbrido. El trabajo deberá evaluar primero versiones corregidas compatibles, actualizaciones transitivas u `overrides` acotados.

Para resolver esta entrada se deberá:

- actualizar dependencias y lockfile sin introducir downgrades incompatibles;
- dejar `npm audit` sin avisos altos o críticos y justificar expresamente cualquier moderado residual;
- repetir `npm audit --omit=dev` para distinguir el riesgo de producción;
- superar lint, build y la batería completa de tests con PostgreSQL local;
- validar la compilación y el comportamiento de Firebase Functions antes de promover el cambio a `main` y `prod`;
- registrar al cerrar la entrada las versiones finales, avisos resueltos, verificaciones y posible riesgo aceptado.

### BR-BL-005 — Implementar la persistencia real de Presupuestos

**Estado:** pendiente

**Prioridad:** por determinar

Sustituir los presupuestos de demostración del frontend por la vertical persistente completa definida en `PRD.md`, `DATABASE.md`, `API.md` y `GAME_SYSTEM.md`. El trabajo abarcará la API, PostgreSQL, el scheduler de periodos, cierres, recompensas y penalizaciones, además de la experiencia de creación y seguimiento en el frontend.

La implementación deberá contemplar como mínimo:

- aislamiento por usuario y contratos CRUD completos;
- frecuencias, zonas horarias, pausas, reanudaciones, archivado y periodos derivados;
- cierres idempotentes, concurrencia, transacciones serializables y recuperación ante fallos;
- cálculo auditable de cumplimiento, Flux, SynthCoins, daño y cualquier ajuste compensatorio;
- migración desde los datos mock sin presentar presupuestos ficticios como persistidos;
- invalidación selectiva de Dashboard, Presupuestos y Gamificación;
- pruebas unitarias, de integración, scheduler, aislamiento y casos límite de calendario.

### BR-BL-007 — Auditar el robo y la reutilización de sesión mediante cookies

**Estado:** pendiente

**Prioridad:** alta

**Responsable de la prueba exploratoria:** mantenedor

Intentar comprometer una sesión propia de Budget Runner mediante cookies y mecanismos relacionados para identificar deuda en refresh tokens, rotación, revocación, atributos `HttpOnly`, `Secure` y `SameSite`, fijación o reutilización de sesión y exposición indirecta mediante XSS o CSRF. La prueba debe limitarse al entorno local o a cuentas de test expresamente autorizadas; nunca debe dirigirse contra usuarios reales ni infraestructura ajena.

Al abordar la entrada se documentarán el modelo de amenaza, los pasos reproducibles sin incluir secretos, la evidencia observada y las mitigaciones propuestas. Cualquier corrección se desarrollará en una rama auxiliar independiente creada desde `dev`.

## Historial resuelto

Las entradas completadas no se eliminan. Se mueven a esta sección, se marcan como resueltas y se amplían con:

- fecha de resolución;
- resumen del resultado y de cualquier decisión relevante;
- ramas, pull requests o commits pertinentes;
- verificaciones realizadas;
- documentación o deuda residual asociada.

### BR-BL-003 — Revamp visual de Gamificación

**Estado:** resuelta

**Fecha de resolución:** 29 de agosto de 2026

**Prioridad:** por determinar

**Rama de trabajo:** `codex/feature/cyberdeck-hud`, validada por el mantenedor antes de promoverse.

**Resultado:** la sección se presenta ahora como **Cyberdeck** en la navegación y en el encabezado de los ocho idiomas. Resumen integra en una única pestaña las métricas de progresión y el esquema técnico. `WRIST CORE` permanece sin traducir y cada módulo enlaza visualmente su tarjeta, su traza discontinua y una pieza específica del modelo wireframe.

La telemetría permite reparar módulos dañados desde el propio detalle, muestra el coste en SynthCoins y actualiza Energy y saldo inmediatamente. Los módulos íntegros y destruidos muestran la acción deshabilitada; los slots vacíos dejan de abrir el detalle. La pestaña Reparaciones continúa ofreciendo el listado especializado.

En orientación vertical, el esquema sustituye el lienzo ancho por tarjetas compactas en una o dos columnas y sitúa una miniatura WebGL debajo, sin core ni conexiones. En horizontal se conserva el layout widescreen original. Solo se anima el canvas visible para no duplicar trabajo gráfico.

**Commits principales:** `bd1a92f` (integración e interacciones del HUD) y `aca241c` (layout vertical responsive).

**Verificación:** build y lint del frontend, contrato automatizado de code splitting y recorridos Chromium en 320, 390, 600 y 1280 píxeles. Se comprobaron hover coordinado, ausencia de desbordamiento interno en vertical, paridad del modal, coste y aplicación de reparaciones, estados deshabilitados, slots vacíos no interactivos y ausencia de errores de WebGL.

**Deuda residual:** ninguna identificada. La visualización vertical conserva el resaltado por hover o foco, aunque la interacción primaria en dispositivos táctiles es la selección de la tarjeta.

### BR-BL-002 — Corregir el título transparente en Chrome/Chromium

**Estado:** resuelta

**Fecha de resolución:** 29 de agosto de 2026

**Prioridad:** por determinar

**Resultado:** se simplificó `frontend/public/media/BudgetRunner_logo.svg`, eliminando la estructura heredada de Illustrator basada en máscaras y capas redundantes. El recurso usa ahora un viewport normalizado y un único recorte explícito para producir las franjas transparentes que atraviesan las palabras Budget y Runner, sin fondo ni capas raster ocultas adicionales.

**Commit:** `c753255`.

**Verificación:** inspección del SVG y validación visual del mantenedor en navegadores Chrome/Chromium, sin reproducción posterior de los artefactos originales.

**Deuda residual:** no se ejecutó una comprobación automatizada en Safari desde Windows; el SVG conserva únicamente primitivas y atributos ampliamente compatibles.

### BR-BL-006 — Añadir una capa de hardening contra SQL injection

**Estado:** resuelta

**Fecha de resolución:** 27 de agosto de 2026

**Prioridad:** alta

**Rama de trabajo:** `codex/feature/sql-injection-hardening`, validada por el mantenedor antes de promoverse.

**Resultado:** todas las consultas ejecutadas por rutas y servicios usan texto SQL estático y parámetros de PostgreSQL. El único constructor dinámico de filtros fue sustituido por una consulta fija con parámetros anulables. La API inspecciona de forma centralizada los textos no confiables y el frontend aplica la misma detección a formularios, repositorios HTTP y mock; una transmisión rechazada cancela peticiones, purga las cachés accesibles, recarga la aplicación y muestra un aviso Ultrawave neutro sin describir la contramedida.

**Decisiones relevantes:** la detección heurística normaliza codificación porcentual, Unicode, caracteres invisibles, comentarios y varias formas de concatenación, pero se considera exclusivamente defensa en profundidad. La garantía primaria continúa siendo no interpretar los valores del usuario como SQL. Las consultas tienen además límites de tiempo de sentencia, bloqueo, cliente y transacción inactiva.

**Commit y revisión:** `97b664f`; pull request `#5` hacia `dev`.

**Verificación:** 39/39 pruebas, incluyendo autenticación, búsquedas, categorías, conceptos, notas, ofuscación y falsos positivos; comprobación de que los rechazos no alteran filas; invariante estática contra SQL construido en runtime; lint completo; build de producción y contrato de code splitting.

**Deuda residual:** ninguna detección textual puede reconocer todas las ofuscaciones posibles y no debe ampliarse como sustituto de la parametrización. La revisión ofensiva de sesiones y cookies continúa separadamente en `BR-BL-007`.

### BR-BL-001 — Dividir la carga de datos por áreas funcionales

**Estado:** resuelta

**Fecha de resolución:** 27 de agosto de 2026

**Prioridad:** alta

**Rama de trabajo:** `codex/feature/data-loading-splitting`, integrada en `dev` tras la validación del mantenedor.

**Resultado:** se eliminó el snapshot privado global de nueve lecturas y se sustituyó por TanStack Query 5.102.8 con consultas independientes para perfil, dashboard, transacciones, categorías, presupuestos y cada recurso de Gamificación. La restauración de sesión reutiliza el perfil ya obtenido, y los repositorios HTTP y mock comparten el mismo contrato granular.

**Decisiones relevantes:**

- caché y estados de carga/error independientes por ruta y pestaña;
- invalidaciones selectivas que aprovechan el dashboard recalculado de las mutaciones financieras;
- código e inventario de Tienda precargables mediante hover, foco, selección o tour;
- skeleton inmediato, texto accesible a partir de 700 ms y aviso de proveedor lento a los 3 s;
- errores reintentables dentro de la sección afectada sin recargar toda la app;
- telemetría limitada a las últimas 200 peticiones, con rutas normalizadas y sin UUID ni query strings.

**Commits principales:** `567e956` (implementación) y `24e81ef` (arquitectura y plan de pruebas).

**Verificación:** `npm test` con 13/13 tests, lint completo sin avisos, build de backend y frontend, contrato automatizado de chunks y recorrido local de Dashboard, Gastos, Presupuestos, Perfil, Ajustes y todas las pestañas de Gamificación. El mantenedor validó la experiencia local antes de autorizar la promoción.

**Documentación:** `FRONTEND_ARCHITECTURE.md` define recursos, caché, invalidaciones, umbrales y métricas; `TEST_PLAN.md` recoge los casos T-107 a T-111.

**Seguimiento operativo:** revisar `window.__BUDGET_RUNNER_API_METRICS__` después del próximo despliegue autorizado para observar Vercel y Neon y recalibrar los umbrales únicamente si las mediciones reales lo justifican. Esta observación no bloquea la resolución de la entrada.
