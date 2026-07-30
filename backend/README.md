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

- `src/routes/authRoutes.ts`: registro, login, Google OAuth/OIDC, refresh rotatorio, logout y perfil.
- `src/googleOAuth.ts`: PKCE, intercambio de código, validación de ID token y vinculación de identidad.
- `src/routes/transactionRoutes.ts`: categorías, listado/CRUD de operaciones y dashboard.
- `src/routes/gameRoutes.ts`: progreso, slots, tienda, compra, reparación, bonus e historial.
- `src/dashboard.ts`: agregaciones financieras server-side.
- `src/progress.ts`: Power, bonus de familia, Flux y nivel.
- `src/db.ts`: pool y transacciones `SERIALIZABLE` con retry y consultas ordenadas.

## Garantías implementadas

- UUID y tiempos UTC.
- Dinero en unidades menores enteras.
- `user_id` resuelto exclusivamente desde el token autenticado: Firebase ID token en `prod` o JWT en el modo local heredado; nunca desde el body.
- Consultas parametrizadas y referencias de categoría del mismo propietario.
- Una mejora equipada por usuario y slot.
- Saldo SynthCoin no negativo.
- Compra y reparación atómicas, auditadas e idempotentes.
- Refresh token rotatorio guardado como hash y cookie `HttpOnly`.
- Google OAuth con `state`, `nonce`, PKCE, email verificado y callback sin tokens en URL.
- Respuestas y errores con el formato de `API.md` y request ID.

## Autenticación por entorno

Con `FIREBASE_AUTH_ENABLED=true`, la API verifica Firebase ID tokens usando el proyecto indicado por `FIREBASE_PROJECT_ID`. La verificación normal no requiere desplegar una clave privada de Firebase Admin. La primera petición protegida vincula de forma idempotente el Firebase UID con el UUID interno de PostgreSQL.

Las rutas propias de registro, login, refresh, recuperación y Google OAuth/OIDC permanecen disponibles cuando `FIREBASE_AUTH_ENABLED=false` para desarrollo y regresión. No son el mecanismo utilizado por el frontend desplegado.

## Endpoints principales

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/bootstrap
GET /api/v1/auth/google
GET /api/v1/auth/google/callback
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET|PATCH /api/v1/me
GET|POST /api/v1/categories
PATCH|DELETE /api/v1/categories/:id
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
