# Budget Runner API

API Node.js + Express + TypeScript respaldada por PostgreSQL.

## Comandos

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
npm test
npm run lint
npm run build
```

`db:migrate` aplica una sola vez los SQL de `migrations/`. `db:seed` es reejecutable y prepara umbrales, bonus, catálogo, usuario demo, transacciones, módulos y rotación de tienda.

## Módulos

- `src/routes/authRoutes.ts`: registro, login, refresh rotatorio, logout y perfil.
- `src/routes/transactionRoutes.ts`: categorías, listado/CRUD de operaciones y dashboard.
- `src/routes/gameRoutes.ts`: progreso, slots, tienda, compra, reparación, bonus e historial.
- `src/dashboard.ts`: agregaciones financieras server-side.
- `src/progress.ts`: Power, bonus de familia, Flux y nivel.
- `src/db.ts`: pool y transacciones `SERIALIZABLE` con retry y consultas ordenadas.

## Garantías implementadas

- UUID y tiempos UTC.
- Dinero en unidades menores enteras.
- `user_id` obtenido exclusivamente del JWT.
- Consultas parametrizadas y referencias de categoría del mismo propietario.
- Una mejora equipada por usuario y slot.
- Saldo SynthCoin no negativo.
- Compra y reparación atómicas, auditadas e idempotentes.
- Refresh token rotatorio guardado como hash y cookie `HttpOnly`.
- Respuestas y errores con el formato de `API.md` y request ID.

## Endpoints principales

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET|PATCH /api/v1/me
GET /api/v1/categories
GET|POST /api/v1/transactions
PATCH|DELETE /api/v1/transactions/:id
GET /api/v1/dashboard
GET /api/v1/game/summary
GET /api/v1/game/cyberdeck
GET /api/v1/game/store
POST /api/v1/game/store/offers/:offerId/purchase
POST /api/v1/game/modules/:instanceId/repair
GET /api/v1/game/history
GET /api/v1/game/family-bonuses
```

Las mutaciones económicas requieren `Idempotency-Key` con formato UUID.
