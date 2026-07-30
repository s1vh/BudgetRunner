# Budget Runner — Roadmap de implementación

## 0. Reglas de ejecución

- Leer `PRD.md`, `DATABASE.md`, `API.md`, `GAME_SYSTEM.md`, `TEST_PLAN.md` y el `DESIGN.md` Ultrawave antes de escribir código.
- Presentar checklist de cada fase antes de implementarla.
- Mantener frontend y backend modulares.
- No introducir lógica económica en el frontend.
- Crear migraciones y seeds reproducibles.
- Ejecutar las pruebas de automatización de navegador al final de cada fase funcional.
- No avanzar con tests críticos fallidos.

## Fase 1 — Bootstrap y arquitectura

Entregables:

- Monorepo o estructura clara `frontend/` y `backend/`.
- React + Tailwind.
- Node.js + Express.
- Configuración de PostgreSQL.
- Variables de entorno de ejemplo.
- ESLint/formatter.
- Manejo global de errores.
- Health/readiness.
- Docker local opcional para PostgreSQL.
- README de arranque.
- Licencia MIT a nombre de Mike Fieldins.

Salida: aplicación mínima ejecutable y conexión DB validada.

## Fase 2 — Design system y shell responsive

- Importar tokens del DESIGN.md.
- Sidebar escritorio y navegación móvil.
- Layout, scanlines, grid, palmeras y fondos.
- Componentes: Button, Card, Input, Modal, Toast, Table, Badge, Progress, Skeleton.
- Estados de foco y reduced motion.
- Footer con MIT y LinkedIn.
- Rutas públicas/privadas vacías.

Salida: shell visual fiel al mockup en 1280 px y 360 px.

## Fase 3 — Identidad y seguridad

- Registro email/contraseña con Firebase Authentication en `prod`.
- Firebase ID tokens para la API; login y refresh JWT conservados para desarrollo y regresión.
- Logout.
- Recuperación por email mediante Firebase en `prod`.
- Google mediante Firebase en `prod`; OAuth/OIDC propio como flujo heredado.
- Middleware de autorización.
- Rate limiting.
- Sesiones revocables.
- Perfil y ajustes básicos.

Salida: flujos completos probados mediante automatización de navegador.

## Fase 4 — Finanzas personales

- Categorías editables y seeds retrofuturistas.
- CRUD de transacciones.
- Filtros y paginación.
- Moneda configurable.
- Dashboard fiel al mockup:
  - balance;
  - presupuesto restante;
  - donut;
  - barras mensuales;
  - transacciones recientes;
  - CTA.
- Datos demo opcionales por usuario de desarrollo.

Salida: gestor financiero funcional sin presupuestos automáticos.

## Fase 5 — Presupuestos y scheduler

- CRUD de presupuestos.
- Generación de periodos semanal/mensual.
- Cálculo por alcance.
- Job de cierre.
- Idempotencia.
- Historial de periodos.
- Bloqueo de transacciones recompensadas.
- Ledger de atribución para solapamientos.

Salida: cierres deterministas sin doble recompensa.

## Fase 6 — Economía y niveles

- SynthCoin ledger.
- Flux ledger.
- Umbrales de nivel.
- Servicio central de recálculo.
- Rachas.
- Recompensas de presupuestos cumplidos.
- Perfil con nivel y rachas.

Salida: progresión auditable.

## Fase 7 — Catálogo, cyberdeck y tienda

- Seeds de catálogo común.
- Diez slots.
- Instancias de usuario.
- Generación reproducible de rotaciones.
- Tienda con ofertas limitadas.
- Compra y sustitución atómicas.
- Bonus de familia.
- Vista SVG/wireframe del cyberdeck.
- Detalle lateral/bottom sheet.

Salida: ciclo de compra funcional.

## Fase 8 — Penalizaciones, daño y reparación

- Bloqueo temporal de compra.
- Fórmula de daño.
- Eventos de daño por módulo.
- Destrucción y recálculo de nivel.
- Reparación proporcional al precio.
- Alertas 50 %, 25 % y destruido.
- Balance rojo/glitch durante bloqueo.
- Historial completo.

Salida: ciclo riesgo/recompensa completo.

## Fase 9 — Robustez y observabilidad

- Auditoría.
- Logs estructurados.
- Índices y análisis de consultas.
- Manejo de concurrencia.
- Reintentos de jobs.
- Backup y restauración documentados.
- Revisión de seguridad.
- Optimización responsive y rendimiento.

## Fase 10 — QA y despliegue

- Ejecutar todos los escenarios de TEST_PLAN.
- Corregir los errores detectados mediante automatización de navegador.
- Validar producción con variables seguras.
- Desplegar el frontend estático en Firebase Hosting desde `prod`.
- Desplegar la API Express y el cron diario en Vercel Hobby.
- Configurar PostgreSQL gestionado en Neon con conexión pooled para runtime y direct para migraciones.
- Validar Firebase Authentication y la vinculación entre Firebase UID y UUID interno.
- Smoke tests postdespliegue.
- Verificar licencia, footer y LinkedIn.

## Backlog por épicas

### E1 — Cuenta
Registro, login, Google OAuth, recuperación, sesiones, perfil.

### E2 — Finanzas
Categorías, gastos, ingresos, filtros, dashboard, estadísticas.

### E3 — Presupuestos
Configuración, periodos, cierres, solapamientos, recompensas.

### E4 — Progresión
SynthCoins, Flux, niveles, rachas, ledgers.

### E5 — Cyberdeck
Catálogo, slots, ofertas, compra, sustitución, bonus.

### E6 — Riesgo
Bloqueos, daño, destrucción, reparación y alertas.

### E7 — Experiencia
Responsive, Ultrawave, accesibilidad, rendimiento y estados.

### E8 — Plataforma
Seguridad, auditoría, jobs, despliegue y observabilidad.

## Definition of Done

Una historia está terminada cuando:

- cumple criterios del PRD;
- valida propiedad multiusuario;
- tiene manejo de errores;
- conserva idempotencia cuando aplica;
- usa transacción SQL en economía;
- dispone de estado loading/empty/error;
- funciona en 360 px y escritorio;
- la automatización de navegador completa el flujo;
- documentación y migraciones están actualizadas;
- no expone secretos ni datos de otro usuario.
