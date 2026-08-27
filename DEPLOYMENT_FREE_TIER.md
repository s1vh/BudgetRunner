# Despliegue híbrido en planes gratuitos

Arquitectura en uso desde la rama `prod`:

- **Firebase Hosting (Spark):** frontend estático.
- **Firebase Authentication:** email/contraseña, Google y recuperación de contraseña.
- **Vercel Hobby:** API Express como una única Function y cron diario.
- **Neon Free:** PostgreSQL persistente mediante conexión pooled.

El cron diario es compatible con Hobby. Cada lectura de `GET /budgets` ejecuta además un cierre perezoso e idempotente, por lo que una visita de los jueces no depende de la precisión horaria del scheduler.

## Estado operativo verificado

Última revisión: **27 de agosto de 2026**.

- Frontend live: `https://budget-runner-cyberdeck.web.app`.
- API live: `https://budget-runner.vercel.app/api/v1`.
- Firebase: proyecto `budget-runner-cyberdeck`.
- Neon: rama `production` (`br-rough-truth-a2pys24x`), base `budget_runner`.
- Esquema PostgreSQL: `public`, con las 7 migraciones actuales aplicadas.
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

Vercel detecta `backend/src/index.ts`. `backend/vercel.json` registra a las `02:00 UTC` un cron diario contra `/api/v1/internal/jobs/close-due-periods`; en Hobby puede ejecutarse en cualquier momento de esa hora. Vercel enviará `CRON_SECRET` como Bearer token y no reintentará automáticamente una invocación fallida.

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

## 6. Rollback

- **Frontend:** restaurar la release anterior desde Firebase Hosting.
- **API:** hacer Instant Rollback al deployment anterior de Vercel. Después comprueba por separado el estado del cron y recuerda que el deployment restaurado conserva su propia instantánea de configuración.
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
