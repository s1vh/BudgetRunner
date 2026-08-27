# Budget Runner — Backlog

Este fichero registra trabajo futuro ya identificado, pero **no autoriza su implementación**. La prioridad y el alcance de cada entrada deben confirmarse antes de comenzar. La operativa completa se define en `CONTRIBUTING_Es.md` y `CONTRIBUTING.md`.

## Pendiente

### BR-BL-001 — Dividir la carga de datos por áreas funcionales

**Estado:** en curso

**Prioridad:** alta

**Rama de trabajo:** `codex/feature/data-loading-splitting`

**Dependencia:** estabilizar primero el code splitting de JavaScript.

Actualmente `AppDataProvider` obtiene al entrar en la zona privada un snapshot completo: dashboard, transacciones, categorías, presupuestos, perfil, progreso, cyberdeck, tienda, historial y bonus. Separar las peticiones y el estado para que cada área solicite solo lo necesario cuando se visite.

El trabajo deberá estudiar como mínimo:

- estados independientes de carga, error, refresco e invalidación;
- carga diferida de Perfil/Ajustes, Cyberdeck y tienda;
- coherencia después de crear gastos, cerrar presupuestos, comprar o reparar módulos;
- comportamiento equivalente entre repositorios HTTP y mock;
- impacto sobre el tour guiado y la navegación directa;
- medición de peticiones, payload y tiempo hasta contenido útil antes y después;
- pruebas con latencia representativa de Firebase, Vercel y Neon, prestando especial atención a la carga diferida de la tienda;
- feedback progresivo de espera: evitar parpadeos en cargas rápidas y mostrar un mensaje accesible si la espera supera un umbral medido y documentado.

### BR-BL-002 — Corregir el título transparente en Chrome/Chromium

**Estado:** pendiente

**Prioridad:** por determinar

Investigar y corregir los defectos de visualización en navegadores basados en Chrome/Chromium del título transparente situado en la parte superior izquierda. La implementación actual referencia `frontend/public/media/BudgetRunner_logo.svg`; al abordar el trabajo se deberá confirmar si el defecto procede del recurso, de su exportación original o del renderizado/CSS, y validar la solución también en Firefox y Safari cuando sea posible.

### BR-BL-003 — Revamp visual de Gamificación

**Estado:** pendiente

**Prioridad:** por determinar

Aplicar pequeños cambios de visualización a la sección de Gamificación. No se considera un rework funcional ni arquitectónico. El alcance concreto se definirá en su hilo de trabajo antes de modificar componentes, diseño o comportamiento.

### BR-BL-004 — Remediar avisos de seguridad en dependencias npm del backend

**Estado:** pendiente

**Prioridad:** alta

**Detectado:** 27 de agosto de 2026 con `npm --prefix backend audit` sobre el lockfile vigente.

El informe completo registra **0 avisos críticos, 2 altos y 10 moderados**: 12 nodos de paquetes afectados, no 12 vulnerabilidades independientes. Al excluir dependencias de desarrollo mediante `--omit=dev` permanecen **1 alto y 8 moderados** en 9 nodos de la cadena de producción.

#### Criticidad alta

- **Producción — `fast-xml-parser@5.10.0`:** las declaraciones `DOCTYPE` repetidas pueden reiniciar los límites de expansión de entidades y provocar consumo de recursos. Entra por `firebase-functions@7.2.5 > firebase-admin@13.10.0 > @google-cloud/storage@7.21.0`. Afecta a versiones `>=5.9.3 <5.10.1`; npm identifica una corrección disponible. Referencia: [GHSA-8r6m-32jq-jx6q](https://github.com/advisories/GHSA-8r6m-32jq-jx6q).
- **Desarrollo — `nanoid@3.3.16`:** un generador personalizado con tamaño cero puede entrar en un bucle infinito. Entra por `vitest@4.1.10 > vite@8.1.4 > postcss@8.5.19`. Afecta a versiones `<3.3.18`; npm identifica una corrección disponible. Referencia: [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).

#### Criticidad moderada

- **Producción — `uuid@9.0.1`:** falta una comprobación de límites del buffer en UUID v3/v5/v6 cuando se proporciona `buf`. Entra por las dependencias de Google Cloud; afecta a versiones `<11.1.1`. Referencia: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- **Desarrollo — `postcss@8.5.19`:** un `sourceMappingURL` controlado por un atacante puede leer ficheros `.map` cuando no se define `from`. Afecta a versiones `<=8.5.22`. Referencia: [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
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

### BR-BL-006 — Añadir una capa de hardening contra SQL injection

**Estado:** pendiente

**Prioridad:** alta

Reforzar de forma sistemática la protección frente a SQL injection sobre la base ya existente de consultas parametrizadas con `pg` y validación mediante Zod. El objetivo es convertir esas buenas prácticas en invariantes verificables y reducir el riesgo de regresión al incorporar filtros, ordenación, búsquedas, tareas internas o nuevas verticales.

El hardening deberá estudiar como mínimo:

- inventario y revisión de consultas, migraciones y cualquier SQL construido dinámicamente;
- prohibición de interpolar valores y allowlists explícitas para identificadores, orden y fragmentos que no admitan parámetros;
- validación y límites de longitud, paginación, filtros y operadores antes de llegar a PostgreSQL;
- usuario de base con privilegios mínimos, timeouts de consulta y límites defensivos apropiados;
- errores externos neutros y logs internos suficientes sin exponer SQL sensible, credenciales ni datos personales;
- comprobaciones estáticas o reglas de lint que detecten patrones inseguros;
- pruebas automatizadas con payloads de inyección en autenticación, filtros, búsquedas, IDs y mutaciones, incluyendo verificación de aislamiento entre usuarios.

## Historial resuelto

Las entradas completadas no se eliminan. Se mueven a esta sección, se marcan como resueltas y se amplían con:

- fecha de resolución;
- resumen del resultado y de cualquier decisión relevante;
- ramas, pull requests o commits pertinentes;
- verificaciones realizadas;
- documentación o deuda residual asociada.
