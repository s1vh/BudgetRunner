# Budget Runner — Especificación API REST

## 1. Convenciones

Base: `/api/v1`  
Formato: JSON UTF-8  
Autenticación: `Authorization: Bearer <access_token>`  
Importes: unidades menores enteras y código ISO 4217.  
Fechas: ISO 8601 UTC.  
Paginación: `page`, `pageSize`, máximo 100.  
Mutaciones económicas: cabecera `Idempotency-Key` obligatoria.

Respuesta correcta:

```json
{ "data": {}, "meta": {} }
```

Error:

```json
{
  "error": {
    "code": "INSUFFICIENT_SYNTHCOINS",
    "message": "No tienes SynthCoins suficientes.",
    "details": {},
    "requestId": "uuid"
  }
}
```

## 2. Auth

### `POST /auth/register`

Body: `email`, `password`, `displayName`, `currency`, `timezone`.

### `POST /auth/login`

Body: `email`, `password`.  
Devuelve access token y establece refresh token seguro.

### `POST /auth/refresh`

Rota refresh token.

### `POST /auth/logout`

Revoca sesión actual.

### `POST /auth/password/forgot`

Body: `email`. Respuesta neutra para evitar enumeración.

### `POST /auth/password/reset`

Body: `token`, `newPassword`.

### `GET /auth/google`

Inicia OAuth.

### `GET /auth/google/callback`

Valida `state`, vincula/crea cuenta y redirige.

## 3. Usuario

### `GET /me`
### `PATCH /me`

Campos editables: `displayName`, `primaryCurrency`, `locale`, `timezone`, `weekStartsOn`, preferencias visuales.

### `GET /me/progress`

Devuelve nivel, Flux base, Power activo, bonus, Flux total, progreso, SynthCoins y rachas.

### `GET /me/level-history`
### `DELETE /me`

Eliminación con reautenticación.

## 4. Categorías

### `GET /categories`
### `POST /categories`
### `PATCH /categories/:id`
### `DELETE /categories/:id`

No permitir eliminar una categoría referenciada; archivar o reasignar.

## 5. Transacciones financieras

### `GET /transactions`

Filtros: `from`, `to`, `type`, `categoryId`, `status`, `minAmount`, `maxAmount`, `query`.

### `POST /transactions`

```json
{
  "type": "expense",
  "concept": "Raciones Orbitales",
  "amountMinor": 2450,
  "currency": "EUR",
  "categoryId": "uuid",
  "occurredAt": "2026-07-15T10:00:00Z",
  "notes": ""
}
```

### `GET /transactions/:id`
### `PATCH /transactions/:id`
### `DELETE /transactions/:id`

Si está bloqueada por recompensa, devolver `409 REWARDED_TRANSACTION_LOCKED`.

## 6. Dashboard y estadísticas

### `GET /dashboard?period=month`

Devuelve:

- balance;
- presupuesto restante;
- distribución por categoría;
- flujo mensual;
- transacciones recientes;
- resumen de nivel;
- alertas.

### `GET /statistics/summary`
### `GET /statistics/categories`
### `GET /statistics/cashflow`

## 7. Presupuestos

### `GET /budgets`
### `POST /budgets`

```json
{
  "name": "Ocio Holográfico",
  "frequency": "weekly",
  "scope": "category",
  "categoryId": "uuid",
  "limitMinor": 10000,
  "currency": "EUR",
  "startsOn": "2026-07-20"
}
```

### `GET /budgets/:id`
### `PATCH /budgets/:id`
### `POST /budgets/:id/pause`
### `POST /budgets/:id/resume`
### `DELETE /budgets/:id`

Archiva; no elimina históricos.

### `GET /budgets/:id/periods`
### `GET /budget-periods/:periodId`

Incluye transacciones computadas, excedente, importe elegible, recompensas, penalización y trazabilidad.

### `POST /internal/budget-periods/:periodId/evaluate`

Ruta protegida para scheduler/agent. Requiere idempotencia. No se expone al cliente normal.

## 8. Gamificación

### `GET /game/summary`

Devuelve estado de bloqueo, nivel, Flux, SynthCoins, Power, bonus y alertas.

### `GET /game/cyberdeck`

Devuelve los 10 slots y módulo equipado:

```json
{
  "slot": "cpu",
  "label": "Neural Chip",
  "module": {
    "instanceId": "uuid",
    "name": "Pulse Vector X2",
    "family": "synthwave",
    "rarity": "rare",
    "power": 80,
    "shield": 4,
    "energy": 72,
    "state": "equipped",
    "warnings": ["ENERGY_BELOW_75"]
  }
}
```

### `GET /game/store`

Ofertas de la rotación activa, expiración, precio, nivel mínimo y coste neto estimado para el slot actual.

### `POST /game/store/offers/:offerId/purchase`

Cabecera `Idempotency-Key`.

Respuesta:

```json
{
  "data": {
    "netCost": 320,
    "tradeInValue": 150,
    "balanceAfter": 680,
    "equippedModule": {},
    "progress": {}
  }
}
```

Errores:

- `PURCHASES_LOCKED`
- `OFFER_EXPIRED`
- `OFFER_ALREADY_PURCHASED`
- `LEVEL_TOO_LOW`
- `INSUFFICIENT_SYNTHCOINS`
- `SLOT_MISMATCH`
- `CONCURRENT_MODIFICATION`

### `POST /game/modules/:instanceId/repair`

Cabecera `Idempotency-Key`.

Errores:

- `MODULE_NOT_DAMAGED`
- `MODULE_DESTROYED`
- `INSUFFICIENT_SYNTHCOINS`

### `GET /game/history`

Filtros: `type`, `from`, `to`.

### `GET /game/family-bonuses`

Reglas y estado actual.

## 9. Catálogo público autenticado

### `GET /game/catalog/modules`

Solo lectura; admite filtros por slot, familia, rareza y nivel. Puede limitarse a elementos descubiertos en el MVP si se desea evitar revelar todo el catálogo.

## 10. Ledgers

### `GET /wallet/synthcoins`

Saldo y movimientos paginados.

### `GET /progress/flux`

Desglose de Flux base, Power, bonus, total y eventos.

## 11. Operaciones internas

Protegidas por credencial de servicio:

- `POST /internal/jobs/close-due-periods`
- `POST /internal/jobs/rotate-store`
- `POST /internal/progress/:userId/recalculate`
- `GET /internal/health`
- `GET /internal/readiness`

## 12. Códigos HTTP

- `200` consulta/mutación correcta.
- `201` recurso creado.
- `204` sin contenido.
- `400` validación.
- `401` no autenticado.
- `403` no autorizado o compra bloqueada.
- `404` recurso inexistente o ajeno.
- `409` conflicto/idempotencia/estado.
- `422` regla de negocio incumplida.
- `429` rate limit.
- `500` error no controlado.

## 13. Validaciones críticas

- Verificar siempre `user_id` desde token, nunca desde body.
- Comprobar moneda del presupuesto y transacción.
- No usar coma flotante para dinero.
- Recalcular costes en servidor; no confiar en estimaciones del frontend.
- Bloquear fila de progreso antes de debitar.
- Revalidar oferta y bloqueo dentro de la transacción.
- Recalcular nivel en el mismo commit de compra, daño o reparación cuando proceda.
- Responder igual ante email existente/no existente en recuperación.

## 14. Webhooks/eventos internos recomendados

Eventos de dominio internos, no necesariamente endpoints:

- `transaction.created`
- `budget.period.closed`
- `budget.reward.granted`
- `budget.exceeded`
- `cyberdeck.damaged`
- `module.destroyed`
- `module.purchased`
- `module.repaired`
- `level.changed`
- `store.rotated`

El consumidor debe ser idempotente.
