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
```

- `api`: autenticación JWT, finanzas y gamificación persistidas en PostgreSQL.
- `mock`: repositorio en memoria útil para trabajo visual aislado.

## Arquitectura

- `src/app/AuthContext.tsx`: sesión, restauración mediante refresh y protección de rutas.
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

