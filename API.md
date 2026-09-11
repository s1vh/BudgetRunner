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

Body: `email`, `password`, `displayName`, `currency`, `timezone`, `locale`. `timezone` debe ser un identificador IANA presente en PostgreSQL; los valores no válidos reciben `422 INVALID_TIMEZONE`.

`locale` admite `es-ES`, `en-US`, `fr-FR`, `de-DE`, `ru-RU`, `zh-CN`, `ja-JP` y `ko-KR`; si falta, se usa `en-US`.

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

La implementación actual permite actualizar `locale` y/o las preferencias visuales. `locale` usa la misma lista cerrada del registro. El objeto completo `preferences` incluye `reducedMotion`, `ambientEffects`, `audioReactive`, `scanlines`, `compactMode`, `helpHints` y `customCursor`. `helpHints` controla la visibilidad de los iconos de ayuda; `customCursor` activa el puntero triangular de neón en dispositivos de escritorio con puntero preciso. Ambas propiedades valen `true` por defecto.

### `POST /me/guided-tour/complete`

Marca el tour guiado como visto al terminarlo o abandonarlo. La operación es idempotente: llamadas posteriores conservan la fecha de la primera finalización y responden:

```json
{
  "data": { "guidedTourCompleted": true },
  "meta": {}
}
```

`GET /me` expone el booleano `guidedTourCompleted`; la interfaz inicia automáticamente el tour cuando es `false`.

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

### `POST /transactions/:id/adjustments`

Requiere `Idempotency-Key`, una razón y la fecha efectiva. Conserva la transacción recompensada original y crea otra enlazada, del tipo opuesto y por el mismo importe, para corregir el balance sin reabrir cierres históricos. Los ingresos compensatorios no reducen el gasto presupuestario en el MVP.

## 6. Dashboard y estadísticas

### `GET /dashboard?period=month`

Devuelve:

- balance de operaciones `posted` en la moneda principal;
- suma del restante de cada presupuesto activo y fecha del próximo cierre (`budgetNextCloseAt`);
- distribución por categoría del periodo solicitado y en la moneda principal;
- flujo mensual real de los siete ciclos más recientes;
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

La creación calcula el primer intervalo en la zona horaria del usuario y persiste snapshots de límite, moneda, alcance, categoría y frecuencia en cada periodo.

### `GET /budgets/:id`
### `PATCH /budgets/:id`

`PATCH` admite `name`, `frequency`, `scope`, `categoryId`, `limitMinor` y `currency`. El nombre cambia inmediatamente; los parámetros económicos y de calendario se aplican al siguiente periodo y nunca reescriben el snapshot de un periodo ya comprometido.

### `POST /budgets/:id/pause`
### `POST /budgets/:id/resume`
### `DELETE /budgets/:id`

Pausar o archivar evita generar renovaciones nuevas, pero no cancela un periodo abierto ya comprometido, que se evaluará normalmente. Reanudar antes de su cierre continúa el mismo periodo; después del cierre programa el siguiente inicio válido. `DELETE` archiva y no elimina históricos.
Un presupuesto por categoría no puede reanudarse si esa categoría fue archivada; la API devuelve `409 BUDGET_CATEGORY_ARCHIVED`.

### `GET /budgets/:id/periods`
### `GET /budget-periods/:periodId`

Incluye snapshots de límite, moneda y zona horaria, transacciones computadas, excedente, importe elegible, recompensas, penalización y trazabilidad. El detalle de una transacción computada queda congelado al cierre y sobrevive a la edición o borrado posterior de una operación perteneciente a un periodo excedido.

### `GET|POST /internal/jobs/close-due-periods`
### `POST /internal/budget-periods/:periodId/evaluate`

Rutas protegidas mediante `Authorization: Bearer <CRON_SECRET>`. Los cierres son idempotentes y no se exponen al cliente normal.
La evaluación individual solo admite periodos vencidos y procesa primero cualquier cierre pendiente del mismo usuario que tenga prioridad canónica; el body no permite forzar un periodo futuro. Un cierre atrasado que exceda el límite crea una penalización con al menos un ciclo completo de duración desde el momento de evaluación.

El job por lotes aísla los fallos por periodo: sigue procesando otras cuentas, devuelve `207` si hubo errores parciales y registra el `job_run` como fallido con `PARTIAL_FAILURE`. Un total agregado que exceda `BIGINT` conserva el periodo abierto y se informa como `BUDGET_PERIOD_TOTAL_OUT_OF_RANGE`; nunca se satura ni se persiste un importe monetario incorrecto.

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

Recupera o crea de forma idempotente la rotación del usuario para la ventana semanal vigente —domingo 02:00 UTC a domingo 02:00 UTC— y devuelve sus seis ofertas, expiración, precio, nivel mínimo y coste neto estimado para el slot actual.

### `GET|POST /internal/jobs/rotate-store`

Ruta protegida mediante `CRON_SECRET` para precalentar las rotaciones de la nueva ventana semanal. `GET /game/store` actúa como fallback perezoso; el job no cambia la ventana ni permite rerolls.

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

- `GET|POST /internal/jobs/close-due-periods`
- `GET|POST /internal/jobs/rotate-store`
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
- `422` regla de negocio incumplida o transmisión rechazada antes de alcanzar una ruta.
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
- Mantener el texto SQL de rutas y servicios estático y enviar cualquier valor no confiable exclusivamente mediante parámetros `$n`.
- Inspeccionar centralmente los textos de `body` y los campos de búsqueda antes de ejecutar lógica de dominio. Ante una transmisión rechazada, responder con un código y mensaje neutros, sin SQL, payload ni detalles del detector.
- No aplicar la inspección de texto a credenciales opacas de proveedores OAuth; deben validarse mediante su contrato específico y nunca interpolarse en SQL.

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
