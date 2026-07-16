# Budget Runner

Aplicación web responsive de finanzas personales y gamificación cyberdeck. El frontend utiliza React, TypeScript y Tailwind CSS; la API utiliza Node.js, Express y PostgreSQL.

## Documentación

- `PRD.md`: alcance y requisitos funcionales.
- `DATABASE.md`: modelo PostgreSQL e invariantes.
- `API.md`: contrato REST bajo `/api/v1`.
- `GAME_SYSTEM.md`: SynthCoins, Flux, Power y reglas del cyberdeck.
- `DESIGN.md`: sistema visual Ultrawave.
- `TEST_PLAN.md`: escenarios funcionales, económicos y responsive.
- `ROADMAP.md`: fases del MVP.

## Arranque local

Requisitos: Node.js 22 o superior y Docker Desktop.

```bash
npm --prefix backend install
npm --prefix frontend install
npm run db:up
npm run db:setup
```

Arrancar la API y el frontend en dos terminales:

```bash
npm run dev:api
npm run dev:web
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api/v1`
- Readiness: `http://127.0.0.1:3001/api/v1/internal/readiness`

Identidad de desarrollo creada por el seed:

```text
nomada@budgetrunner.local
NeonRunner!2026
```

Las credenciales y secretos de `.env` son exclusivamente locales. Producción debe proporcionar valores distintos mediante variables seguras.

## Verificación

```bash
npm test
npm run lint
npm run build
```

La vertical persistente actual cubre identidad email/contraseña, perfil, categorías, transacciones, dashboard, cyberdeck, tienda, compras y reparaciones. Los presupuestos permanecen como datos de demostración hasta implementar scheduler, cierres y recompensas.

Budget Runner © 2026 Mike Fieldins · MIT License

