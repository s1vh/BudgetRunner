# Despliegue MVP en planes gratuitos

Arquitectura objetivo de la rama `prod`:

- **Firebase Hosting (Spark):** frontend estático.
- **Firebase Authentication:** email/contraseña, Google y recuperación de contraseña.
- **Vercel Hobby:** API Express como una única Function y cron diario.
- **Neon Free:** PostgreSQL persistente mediante conexión pooled.

El cron diario es compatible con Hobby. Cada lectura de `GET /budgets` ejecuta además un cierre perezoso e idempotente, por lo que una visita de los jueces no depende de la precisión horaria del scheduler.

## 1. Firebase

En el proyecto existente `budget-runner-cyberdeck`:

1. Activa **Authentication → Sign-in method → Email/Password**.
2. Activa **Google** y selecciona el email de soporte.
3. Añade a **Authorized domains** el dominio `web.app`, `firebaseapp.com`, `localhost` y cualquier dominio personalizado.
4. Registra una aplicación web y conserva su configuración pública.
5. El backend solo verifica tokens de identidad, por lo que no necesita una clave privada de Firebase Admin.
6. Para usar la pantalla de recuperación propia, configura la **Action URL** de la plantilla de restablecimiento como `https://budget-runner-cyberdeck.web.app/restablecer`.

Variables públicas necesarias para compilar el frontend:

```text
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=https://TU-API.vercel.app/api/v1
VITE_GOOGLE_OAUTH_ENABLED=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

Para un despliegue manual, guárdalas en `frontend/.env.production.local`; el archivo está ignorado por Git. Las variables del entorno de CI también prevalecen sobre `frontend/.env.production`. El archivo versionado permanece deliberadamente en modo mock para no romper la demo actual si alguien despliega antes de configurar los proveedores.

## 2. Neon

1. Crea un proyecto en una región europea y una base `budget_runner`.
2. Conserva las URLs **pooled** y **direct** por separado.
3. Usa temporalmente la URL direct para aplicar esquema y seed:

```powershell
$env:DATABASE_URL='postgresql://URL-DIRECT'
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

4. Configura en Vercel la URL pooled como `DATABASE_URL` y `DB_POOL_MAX=4`.

Todas las migraciones son aditivas. El motor usa importes enteros, transacciones `SERIALIZABLE`, bloqueos por usuario y claves idempotentes.

## 3. Vercel

Importa el repositorio con estos ajustes:

- plan personal **Hobby** y uso no comercial;
- Production Branch: `prod`;
- Root Directory: `backend`;
- Node.js: 22;
- región europea próxima a Neon.

Variables privadas:

```text
NODE_ENV=production
DATABASE_URL=postgresql://URL-POOLED
DB_POOL_MAX=4
FRONTEND_ORIGINS=https://budget-runner-cyberdeck.web.app,https://budget-runner-cyberdeck.firebaseapp.com
FIREBASE_AUTH_ENABLED=true
FIREBASE_PROJECT_ID=...
CRON_SECRET=secreto-aleatorio-de-32-o-mas-caracteres
```

Vercel detecta `backend/src/index.ts`. `backend/vercel.json` registra un cron diario contra `/api/v1/internal/jobs/close-due-periods`; Vercel enviará `CRON_SECRET` como Bearer token.

Comprobaciones tras desplegar:

```text
GET https://TU-API.vercel.app/api/v1/internal/health
GET https://TU-API.vercel.app/api/v1/internal/readiness
```

## 4. Firebase Hosting

Cuando la API y Firebase Auth estén operativos:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
firebase deploy --only hosting
```

Antes de desplegar, verifica que `frontend/dist` se ha compilado con la URL real de Vercel. La configuración pública de Firebase puede aparecer en el bundle; `CRON_SECRET` nunca debe estar en variables `VITE_*`.

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
- **API:** hacer Instant Rollback al deployment anterior de Vercel.
- **Base de datos:** no revertir las migraciones aditivas durante el incidente; la API anterior ignora las tablas/columnas nuevas. Restaurar datos solo desde backup si hubo corrupción comprobada.
- **Modo de demostración:** como contingencia, recompilar temporalmente con `VITE_DATA_SOURCE=mock` sin borrar datos de Neon.

No se debe borrar una cuenta, base, proyecto o deployment para hacer rollback.
