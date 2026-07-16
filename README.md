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

### Google OAuth

El flujo Google OAuth/OIDC está implementado en la API. Para activarlo en local, crea un cliente OAuth de tipo **Aplicación web** en Google Cloud y registra exactamente esta URI de redirección:

```text
http://localhost:5173/api/v1/auth/google/callback
```

Después completa en `backend/.env`:

```text
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/auth/google/callback
GOOGLE_OAUTH_STATE_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
```

Y habilita el punto de entrada en `frontend/.env` cuando quieras mostrarlo:

```text
VITE_GOOGLE_OAUTH_ENABLED=true
```

Para el MVP esta bandera permanece en `false`: los botones están desactivados, pero la implementación OAuth continúa disponible por detrás.

Reinicia la API después de cambiar estas variables. El callback intercambia el código en el servidor y entrega al frontend únicamente la sesión segura; ningún token de Google se incluye en la URL.

## Verificación

```bash
npm test
npm run lint
npm run build
```

La vertical persistente actual cubre identidad email/contraseña y Google OAuth, perfil, categorías, transacciones, dashboard, cyberdeck, tienda, compras y reparaciones. Los presupuestos permanecen como datos de demostración hasta implementar scheduler, cierres y recompensas.

Budget Runner © 2026 Mike Fieldins · MIT License
