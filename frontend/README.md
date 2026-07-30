# Budget Runner Frontend

SPA React + TypeScript + Tailwind que implementa el sistema visual Ultrawave y consume la API REST de Budget Runner.

## Arranque

Con PostgreSQL y la API activos:

```bash
npm install
npm run dev
```

Vite publica la aplicación en `http://127.0.0.1:5173` y redirige `/api` a la API local.

## Variables

```env
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=/api/v1
VITE_GOOGLE_OAUTH_ENABLED=false
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
```

- `api`: Firebase Authentication en el navegador; la API valida el ID token y persiste finanzas, perfil y gamificación en PostgreSQL.
- `mock`: repositorio en memoria útil para trabajo visual aislado.

En `prod`, `VITE_API_BASE_URL` apunta a `https://budget-runner.vercel.app/api/v1`, Google se habilita con `VITE_GOOGLE_OAUTH_ENABLED=true` y el resto de valores públicos procede de la aplicación web `budget-runner-cyberdeck` de Firebase. No incluyas secretos, URLs de PostgreSQL ni cuentas de servicio en variables `VITE_*`.

## Arquitectura

- `src/app/AuthContext.tsx`: sesión Firebase, registro, Google, recuperación y protección de rutas.
- `src/app/AppDataContext.tsx`: estado de dominio y revalidación tras mutaciones.
- `src/services/apiClient.ts`: cliente HTTP, errores normalizados y renovación automática.
- `src/services/httpBudgetRunnerRepository.ts`: adaptación del contrato REST a los tipos de UI.
- `src/components/forms`: formularios reutilizables.
- `src/components/charts`: gráficos SVG accesibles.
- `src/components/game`: cyberdeck WebGL/SVG y tarjetas de módulos.
- `src/pages`: rutas completas.

El servidor calcula balance, distribución, flujo mensual, costes, SynthCoins, Power, bonus y Flux. React solo renderiza los snapshots canónicos.

## Actualización dinámica

Después de registrar, editar o eliminar una operación, la aplicación revalida el snapshot y actualiza balance, donut, barras y lista reciente sin recargar la página. Comprar o reparar actualiza de la misma forma saldo, progreso, módulos, ofertas e historial.

## Verificación

```bash
npm run lint
npm run build
```

