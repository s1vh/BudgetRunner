# Despliegue híbrido en planes gratuitos

Arquitectura en uso desde la rama `prod`:

- **Firebase Hosting (Spark):** frontend estático.
- **Firebase Authentication:** email/contraseña, Google y recuperación de contraseña.
- **Vercel Hobby:** API Express como una única Function, con cierre diario y rotación semanal programados.
- **Neon Free:** PostgreSQL persistente mediante conexión pooled.

Ambos cron jobs son compatibles con Hobby porque cada expresión se ejecuta como máximo una vez al día. Cada lectura de `GET /budgets` ejecuta además un cierre perezoso e idempotente. Del mismo modo, `GET /game/store` garantiza de forma perezosa la rotación canónica de la semana. Así, una visita de los jueces no depende de la precisión horaria del scheduler.

## Estado operativo verificado

Última revisión: **27 de agosto de 2026**.

- Frontend live: `https://budget-runner-cyberdeck.web.app`.
- API live: `https://budget-runner.vercel.app/api/v1`.
- Firebase: proyecto `budget-runner-cyberdeck`.
- Neon: rama `production` (`br-rough-truth-a2pys24x`), base `budget_runner`.
- Esquema PostgreSQL: `public`; el registro de cada despliegue debe enumerar las migraciones verificadas.
- Rama de despliegue: `prod`; solo se actualiza desde `main`.

### Publicación habilitada

La pausa de publicación de la hackathon finalizó el **27 de agosto de 2026**. Se puede volver a sincronizar el repositorio y desplegar, manteniendo el flujo `dev` → `main` → `prod` y publicando únicamente desde `prod`.

### Preflight de base de datos

La configuración **Production** de Vercel contiene `DATABASE_URL` como variable Sensitive. Estos valores son de solo escritura: funcionan dentro del deployment, pero Vercel no permite volver a leerlos desde el dashboard, `env pull` o `env run`. La ausencia de un valor legible localmente no significa que la variable falte.

Antes de crear un deployment:

1. confirma con `vercel env ls production` que existe `DATABASE_URL` para Production;
2. si hay cualquier duda sobre su origen, sobrescríbela como Sensitive con una URL **pooled** obtenida de la rama `production` y la base `budget_runner`;
3. conserva `DB_POOL_MAX=4`;
4. despliega y valida health, readiness y los smoke tests.

Antes de aplicar `007_weekly_store_rotation.sql`, comprueba con la URL **direct** de Neon que no existan duplicados heredados para una misma ventana semanal:

```sql
SELECT user_id, starts_at, count(*)
FROM store_rotations
WHERE source_period_id IS NULL
GROUP BY user_id, starts_at
HAVING count(*) > 1;
```

Si devuelve alguna fila, detén la migración y resuelve los duplicados de forma explícita. No borres ni consolides rotaciones automáticamente durante el despliegue.

### Límites gratuitos relevantes

Los planes pueden cambiar; comprueba sus páginas oficiales antes de cada release:

- [Firebase Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing): 10 GB de almacenamiento y 10 GB/mes de transferencia sin coste. En Spark, alcanzar la cuota puede impedir nuevos deploys o deshabilitar temporalmente el sitio.
- [Firebase Authentication](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans): email/contraseña y proveedores sociales están entre las opciones sin coste usadas por Budget Runner; no se utiliza autenticación telefónica.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby): válido únicamente para uso personal y no comercial. Los [cron jobs de Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing) pueden ejecutarse una vez al día y tienen precisión horaria, no al minuto.
- [Neon Free](https://neon.com/pricing): 100 CU-horas mensuales y 0,5 GB de almacenamiento por proyecto en la revisión indicada, con scale-to-zero.

## 1. Firebase

En el proyecto existente `budget-runner-cyberdeck`:

1. Activa **Authentication → Sign-in method → Email/Password**.
2. Activa **Google** y selecciona el email de soporte.
3. Mantén en **Authorized domains** `budget-runner-cyberdeck.web.app`, `budget-runner-cyberdeck.firebaseapp.com` y cualquier dominio personalizado realmente utilizado.
4. Registra una aplicación web y conserva su configuración pública.
5. El backend desplegado solo verifica Firebase ID tokens, por lo que no necesita una clave privada de Firebase Admin.
6. Para usar la pantalla de recuperación propia, configura la **Action URL** de la plantilla de restablecimiento como `https://budget-runner-cyberdeck.web.app/restablecer`.

No autorices `localhost` en el proyecto de producción salvo durante una prueba local deliberada, y retíralo después. El reset manual del usuario demo sí necesita una cuenta de servicio local, pero se guarda exclusivamente en `.\.secrets\firebase-admin.json`; consulta `PROD_DEMO_RESET.md`.

Variables públicas necesarias para compilar el frontend:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=https://budget-runner.vercel.app/api/v1
VITE_GOOGLE_OAUTH_ENABLED=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=budget-runner-cyberdeck.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=budget-runner-cyberdeck
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

Para un despliegue manual, guárdalas en `frontend/.env.production.local`; el archivo está ignorado por Git. Las variables del entorno de CI también prevalecen sobre `frontend/.env.production`. El archivo versionado permanece deliberadamente en modo mock para no romper la demo actual si alguien despliega antes de configurar los proveedores.

## 2. Neon

1. Abre la rama `production` (`br-rough-truth-a2pys24x`) y selecciona la base `budget_runner`.
2. Conserva las URLs **pooled** y **direct** por separado. La URL pooled contiene `-pooler` en el host; la direct no.
3. Usa la URL pooled exclusivamente en `DATABASE_URL` de Vercel.
4. Usa temporalmente la URL direct para migraciones, seed y mantenimiento local. Neon recomienda conexiones directas para herramientas de migración:

```powershell
$env:DATABASE_URL='postgresql://URL-DIRECT'
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
Remove-Item Env:DATABASE_URL
```

No vuelvas a ejecutar el seed en producción por rutina. Hazlo únicamente cuando una release lo requiera y después de verificar el destino. El reset del usuario demo usa sus propios secretos, preflight y salvaguardas; no reutiliza `DATABASE_URL`.

Todas las migraciones son aditivas. El motor usa importes enteros, transacciones `SERIALIZABLE`, bloqueos por usuario y claves idempotentes.

## 3. Vercel

Importa el repositorio con estos ajustes:

- plan personal **Hobby** y uso no comercial;
- Production Branch: `prod`;
- Root Directory: `backend`;
- Node.js: 22;
- una región compatible próxima a Neon cuando el plan y el proyecto permitan configurarla.

Variables privadas:

```text
NODE_ENV=production
DATABASE_URL=postgresql://URL-POOLED
DB_POOL_MAX=4
FRONTEND_ORIGINS=https://budget-runner-cyberdeck.web.app,https://budget-runner-cyberdeck.firebaseapp.com
FIREBASE_AUTH_ENABLED=true
FIREBASE_PROJECT_ID=budget-runner-cyberdeck
CRON_SECRET=secreto-aleatorio-de-32-o-mas-caracteres
```

Vercel detecta `backend/src/index.ts`. `backend/vercel.json` registra dos tareas: cierre de periodos cada día (`0 2 * * *`) y rotación de tienda los domingos (`0 2 * * 0`), ambas en UTC. En Hobby pueden ejecutarse en cualquier momento entre las 02:00 y las 02:59. La ventana de tienda sigue comenzando exactamente el domingo a las 02:00 UTC y su fallback perezoso usa ese mismo límite. Vercel enviará `CRON_SECRET` como Bearer token y no reintentará automáticamente una invocación fallida.

Como `NODE_ENV=production` está disponible ya durante la instalación y Vercel poda `devDependencies` antes de compilar, TypeScript y los tipos que necesita `src/` se declaran intencionadamente como dependencias directas de build. `backend/vercel.json` fija `npm ci --omit=dev`: descarta cualquier árbol cacheado inconsistente y demuestra que el artefacto puede compilar con el conjunto production-only. Las herramientas exclusivas de pruebas permanecen en `devDependencies` y la Function se ejecuta con `NODE_ENV=production`.

La rama `prod` fija TypeScript `6.0.3`: es la versión verificada por el compilador Linux de Vercel para este backend. TypeScript `7.0.2` compila localmente en Windows, pero Vercel CLI 59.11.7 no resuelve allí la librería explícita `types: ["node"]`; no actualices ese pin sin repetir una build production-only en Linux/Vercel.

También se conserva `firebase-admin` en `13.10.0` y se excluye `firebase-functions`: la API usa Vercel, no Firebase Functions. La rama 14.x incorpora una ruta `jwks-rsa` → `jose` que el empaquetador CommonJS de Vercel intenta cargar con `require()` y provoca `ERR_REQUIRE_ESM` antes de atender incluso `/internal/health`.

Para mantener esa versión compatible sin reabrir avisos de seguridad, `uuid@11.1.1` se declara como dependencia directa y el override `"uuid": "$uuid"` alinea con ella las dependencias transitivas de Firebase Admin. El lockfile actual se resolvió con npm 11.6.0 y se verificó después mediante `npm ci --omit=dev` con npm 10, la versión usada por Vercel. La carga del módulo, las pruebas y `npm audit --omit=dev` deben repetirse después de cualquier cambio en este override o de regenerar el lockfile.

Desde la raíz del repositorio, comprueba que la variable esté asignada a Production:

```powershell
npx --package=vercel@latest -- vercel login
npx --package=vercel@latest -- vercel env ls production
```

Si `DATABASE_URL` no es Sensitive, `vercel env run -e production -- node scripts/compareProdDatabaseTargets.mjs` compara host y base sin imprimir credenciales. Si es Sensitive, Vercel no entrega el valor al proceso local y la comparación no es posible: valida el destino al establecer o rotar la variable y confirma después el deployment mediante readiness y smoke tests.

Comprobaciones tras desplegar:

```text
GET https://budget-runner.vercel.app/api/v1/internal/health
GET https://budget-runner.vercel.app/api/v1/internal/readiness
```

## 4. Firebase Hosting

Cuando la API y Firebase Auth estén operativos:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
firebase deploy --only hosting
```

Antes de desplegar, verifica que `frontend/dist` se ha compilado con `VITE_DATA_SOURCE=api` y la URL real de Vercel. La configuración pública de Firebase puede aparecer en el bundle; `CRON_SECRET`, la URL de Neon y las cuentas de servicio nunca deben estar en variables `VITE_*`.

## 5. Smoke test

1. Registrar una cuenta por email y cerrar/abrir sesión.
2. Solicitar recuperación de contraseña.
3. Entrar con Google y comprobar que no se duplica la cuenta por email verificado.
4. Crear una categoría, un gasto y presupuestos semanal y mensual solapados.
5. Abrir Presupuestos y verificar gasto, excedente elegible e historial.
6. Evaluar un periodo corto en staging o mediante la ruta interna autorizada.
7. Confirmar un único ledger de SynthCoins/Flux al reintentar el cierre.
8. Exceder un presupuesto y verificar daño, bloqueo de compras y reparación permitida.
9. Confirmar que tienda, dashboard e historial reflejan el nuevo estado.
10. Confirmar que la tienda contiene exactamente 6 ofertas distintas, adaptadas al nivel, y que expiran el domingo siguiente a las 02:00 UTC.

## 6. Rollback

- **Frontend:** restaurar la release anterior desde Firebase Hosting.
- **API:** hacer Instant Rollback al deployment anterior de Vercel. Después comprueba por separado el cierre diario y la rotación semanal; el deployment restaurado conserva su propia instantánea de configuración.
- **Base de datos:** no revertir las migraciones aditivas durante el incidente; la API anterior ignora las tablas/columnas nuevas. Restaurar datos solo desde backup si hubo corrupción comprobada.
- **Modo de demostración:** como contingencia, recompilar temporalmente con `VITE_DATA_SOURCE=mock` sin borrar datos de Neon.

No se debe borrar una cuenta, base, proyecto o deployment para hacer rollback.

## 7. Restauración del usuario demo

La rama `prod` incluye un script de mantenimiento local para restaurar la identidad Firebase, las credenciales de `testuser.nfo` y todos los datos de aplicación de `nomada@budgetrunner.local`. También recrea las cuentas borradas conservando el UUID interno y el UID Firebase canónicos. No forma parte de la API ni se ejecuta durante el build o el despliegue.

**Regla de cierre de release:** después de cada despliegue de `prod` y de comprobar health, readiness y frontend, se debe restaurar manualmente el usuario demo y verificarlo en modo de solo lectura. El perfil canónico queda en `en-US` y `USD`, y el fixture regenera sus transacciones y presupuestos en USD. Este paso solo puede dirigirse a `nomada@budgetrunner.local`; no se debe ejecutar un seed global ni modificar otras cuentas.

El procedimiento completo, las salvaguardas y las diferencias normalizadas respecto al mock original están documentados en `PROD_DEMO_RESET.md`. Ejecuta siempre primero el modo de solo lectura:

```powershell
# Preparación única e interactiva:
npm run prod:demo:setup
# Vista previa:
npm run prod:demo:reset
# Aplicar:
npm run prod:demo:reset -- confirm nomada@budgetrunner.local
# Verificación final de solo lectura:
npm run prod:demo:reset
```

El proyecto Firebase `budget-runner-cyberdeck` y los identificadores canónicos están fijados y validados por el script. La publicación no se considera terminada si la aplicación o la verificación final fallan. Las variables `PROD_DEMO_DATABASE_URL` y `GOOGLE_APPLICATION_CREDENTIALS` quedan disponibles únicamente como overrides opcionales de las rutas relativas.

## 8. Registro de despliegue — 11 de septiembre de 2026

**Alcance:** bundle autorizado de `dev` → `main` → `prod` para presupuestos persistentes, gráficas reales del Dashboard, rotación semanal de la tienda, orden final de pestañas del Cyberdeck, preferencias visuales ya validadas y cierre de `BR-BL-005`/`BR-BL-009`. No se ejecutó un seed global ni se modificaron cuentas distintas de la demo autorizada.

**Git e historial:** `main` recibió la implementación hasta `6b93ea2`; `prod` la integró mediante `d1e7de1`. La actualización de `prod` sustituyó con `--force-with-lease` la punta remota anterior `203d372` por la historia reescrita y el merge autorizado. El bundle verificado anterior a la reescritura se conserva en `.git/codex-backups/pre-copilot-cleanup-733a90c.bundle`. Las correcciones operativas posteriores son `88a7699`, `5355427`, `fbeb6fc`, `f45956e`, `60638f9`, `0419b19` y `e6f0405`; todas conservan la autoría humana y el trailer simbólico de Codex.

**Base de datos:** el preflight confirmó la base directa `budget_runner`, siete migraciones previas y cero ventanas semanales duplicadas. Se aplicaron, en orden y antes del backend, `005_custom_cursor_preference.sql`, `007_weekly_store_rotation.sql`, `008_budget_persistence.sql` y `009_budget_owner_integrity.sql`. El estado final registra 11 migraciones y mantiene cero duplicados por usuario/ventana semanal. Todas son aditivas y se conserva la compatibilidad temporal con el escritor anterior.

**Frontend:** Firebase Hosting compiló 1.889 módulos con `VITE_DATA_SOURCE=api` y publicó 24 archivos en `https://budget-runner-cyberdeck.web.app`. No se incluyeron secretos en variables `VITE_*`.

**Backend y diagnóstico de Vercel:** los primeros intentos desde `d1e7de1` hasta `f45956e` fallaron con `TS2688` porque el compilador de Vercel no resolvía la librería `node` durante su instalación production-only. `60638f9` fijó TypeScript 6.0.3 y dejó visible la incompatibilidad de tipos de Helmet; `0419b19` restauró su adaptador y produjo una build `Ready`, pero el runtime devolvía `ERR_REQUIRE_ESM` en la cadena Firebase Admin 14 → `jwks-rsa` → `jose`. `e6f0405` dejó el árbol compatible y auditable con Firebase Admin 13.10.0, sin Firebase Functions, y `uuid` 11.1.1. Su deployment de Vercel `7QA5gKmqdewTdwHERZTc9kjaJEKN` quedó `Ready` y sustituyó el alias de producción.

**Verificación de release:** la instalación production-only con npm 10, la compilación, la carga directa de `dist/app.js`, el chequeo de tipos y **80/80 tests** finalizaron correctamente. `npm audit` completo y `npm audit --omit=dev` devolvieron **0 vulnerabilidades**. En vivo, health y readiness respondieron 200, readiness confirmó PostgreSQL y el job semanal sin Bearer token respondió 401. Una lectura autenticada y no mutante de la tienda devolvió seis definiciones distintas con expiración única `2026-09-13T02:00:00Z`.

**Usuario demo:** el procedimiento preview/apply/preview se limita a `nomada@budgetrunner.local` y conserva su UUID interno y UID Firebase canónicos. El fixture confirmado contiene 8 categorías, 12 transacciones, 5 presupuestos, 5 periodos, 9 módulos, 2 rotaciones, 7 ofertas (6 activas), un evento de compra, reparación y daño, 3 registros de nivel y saldos finales de nivel 24 y 2.380 SynthCoins. Este cierre se repite después del último deployment de `prod` para retirar cualquier estado generado durante las pruebas.

**Rollback:** Firebase puede restaurar su release anterior y Vercel puede efectuar Instant Rollback al deployment `0419b19`, aunque este último solo sirve como artefacto de compilación y reproduce el fallo de runtime de Firebase Admin 14. Para recuperar servicio funcional debe usarse el deployment anterior `203d372`; las cuatro migraciones aditivas permanecen aplicadas en ambos casos y no deben revertirse durante el incidente.
