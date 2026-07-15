# Budget Runner Frontend

SPA de demostración construida con React, TypeScript, Vite y Tailwind CSS. Implementa el sistema visual Ultrawave y las pantallas definidas en la documentación raíz.

## Arranque

```bash
npm install
npm run dev
```

La aplicación se inicia con datos internos. Las altas y ediciones se conservan en memoria mientras la pestaña permanezca abierta.

## Variables

Copiar `.env.example` si se necesita una configuración local:

```env
VITE_DATA_SOURCE=mock
VITE_API_BASE_URL=/api/v1
```

- `mock`: utiliza `MockBudgetRunnerRepository`.
- `api`: activa el adapter HTTP preparado para la futura integración. Hasta que exista backend, responde con un error explicativo.

## Arquitectura

- `src/app`: providers y estado de aplicación.
- `src/components/ui`: primitivas Ultrawave.
- `src/components/forms`: formularios reutilizables.
- `src/components/charts`: gráficos SVG accesibles.
- `src/components/game`: cyberdeck y módulos.
- `src/data`: dataset de demostración.
- `src/pages`: rutas completas.
- `src/services`: contrato de repositorio, mock y adapter HTTP.
- `src/types`: modelos alineados con `API.md`.

La lógica económica —recompensas, daño, coste de compra, cierres e idempotencia— no se ejecuta en el navegador. Los valores mostrados son snapshots o estimaciones que la futura API deberá recalcular.

## Rutas

- `/`: dashboard.
- `/gastos`: transacciones, filtros y formulario modular.
- `/presupuestos`: presupuestos, gauges y detalle de periodos.
- `/gamificacion`: resumen, cyberdeck, tienda, reparaciones y registro.
- `/perfil`: Flux, rachas e historial.
- `/ajustes`: región, animación, accesibilidad y categorías.
- `/login`, `/registro`, `/recuperar`, `/restablecer`: identidad.
- `/licencia`, `/privacidad`: páginas legales.

## Verificación

```bash
npm run build
npm run lint
```
