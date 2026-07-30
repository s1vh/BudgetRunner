# Reset del usuario demo de producción

Este procedimiento restaura por completo `nomada@budgetrunner.local` en el entorno live: identidad de Firebase Authentication, credenciales, perfil y datos de aplicación. El script existe únicamente en la rama `prod`, se ejecuta manualmente desde una consola local y no forma parte del frontend, la API, los builds, el cron ni el despliegue.

## Fuente de verdad

`testuser.nfo`, situado en la raíz de `prod`, contiene en este orden:

1. email o nombre de usuario de acceso;
2. contraseña.

El script lee el fichero en cada ejecución. No duplica esos valores en variables de entorno ni en el código. El nombre visible `Nómada` y el resto del perfil proceden del fixture original del mock.

## Qué restaura

En Firebase Authentication:

- recupera el email y la contraseña de `testuser.nfo`;
- restaura el nombre visible `Nómada`, elimina la foto, habilita la cuenta y marca el email como verificado;
- revoca las sesiones anteriores;
- si la cuenta fue borrada, la crea de nuevo con su UID Firebase canónico;
- si tras el borrado se creó accidentalmente otra cuenta con el email demo, retira esa identidad de reemplazo antes de recuperar la canónica.

En PostgreSQL:

- recrea el usuario con el mismo UUID interno aunque la fila haya sido borrada;
- restaura perfil, idioma, moneda, zona horaria, preferencias, ayuda contextual y estado del tour;
- regenera 8 categorías, 12 transacciones y 5 presupuestos con sus periodos;
- recupera nivel 24, SynthCoins, rachas y progresión compatible con las reglas live;
- restaura 9 módulos del cyberdeck, una rotación activa con 6 ofertas y el historial de juego;
- reconstruye ledgers, eventos e identificadores idempotentes necesarios para auditar el estado.

Las fechas se desplazan respecto al momento de ejecución conservando su orden relativo. La oferta queda activa durante cinco días, la transacción programada permanece futura y los presupuestos continúan siendo interactivos.

## Identidad canónica y cuentas borradas

El primer reset con esta versión guarda en `audit_events` un checkpoint de recuperación con:

- UUID interno de PostgreSQL;
- UID de Firebase;
- email de credenciales;
- versión del fixture.

La referencia `user_id` del evento puede quedar a `NULL` al borrar la fila de usuario, pero `entity_id` y los metadatos sobreviven. Por eso el siguiente reset puede reconstruir ambas cuentas con sus identificadores originales.

La implementación anterior ya dejó eventos `prod_demo.reset` que permiten recuperar el UUID interno durante la transición. Si se borraran a la vez la fila, todos sus eventos históricos y la cuenta Firebase antes de crear el nuevo checkpoint, el identificador no se puede deducir. Solo en esa primera recuperación se debe proporcionar el UUID histórico conocido:

```powershell
$env:PROD_DEMO_INTERNAL_UUID='00000000-0000-4000-8000-000000000000'
```

El script se detiene si falta ese valor o no es un UUID válido; nunca genera silenciosamente un UUID interno nuevo.

## Normalización respecto al mock

El mock contenía algunas proyecciones que no coincidían por completo con sus entidades: sus transacciones suman 1.321,89 € en gastos aunque una proyección mostraba 1.961,89 €, el Power y los bonus no cuadraban con ciertos totales de Flux, y algunos gastos quedaban fuera de las fechas de sus presupuestos.

El reset conserva las operaciones e importes originales, ajusta las fechas de muestra dentro de sus periodos y calcula la progresión con los umbrales y bonus live. Mantiene el nivel 24 y una posición equivalente dentro del nivel. Las definiciones `mock.*` quedan inactivas: respaldan el usuario demo, pero no participan en las rotaciones de otros usuarios.

## Qué no modifica

- No modifica datos de otros usuarios.
- No despliega código ni contacta con GitHub.
- No ejecuta migraciones ni cambia reglas globales de progresión.
- No se ejecuta automáticamente desde Firebase, Vercel o Neon.

El reset reemplaza deliberadamente todo el estado actual del usuario demo. Cualquier edición realizada después permanecerá hasta la siguiente ejecución.

## Salvaguardas

El script:

- solo acepta como confirmación el email leído de `testuser.nfo`;
- usa `PROD_DEMO_DATABASE_URL`, nunca la variable habitual `DATABASE_URL`;
- solo admite el proyecto Firebase `budget-runner-cyberdeck`;
- exige una cuenta de servicio cuyo `project_id` coincida;
- rechaza `FIREBASE_AUTH_EMULATOR_HOST` para evitar mezclar entornos;
- ofrece `--dry-run`, que consulta Firebase y PostgreSQL sin escribir;
- bloquea y reemplaza PostgreSQL dentro de una transacción `SERIALIZABLE`;
- verifica recuentos, UUID interno, UID Firebase y email antes del commit.

Firebase y PostgreSQL no comparten una transacción distribuida. Al aplicar, Firebase se restaura primero y PostgreSQL después de forma atómica. Si la segunda fase falla, PostgreSQL hace rollback y la salida indica que se vuelva a ejecutar el comando; el procedimiento es idempotente y completa el estado pendiente.

## Requisitos

- Estar en la rama local `prod`.
- Node.js 22 y dependencias instaladas.
- URL **direct** autorizada de la base Neon live.
- Migraciones y seed global aplicados.
- Un JSON de cuenta de servicio de Firebase con permisos para administrar usuarios de Authentication.
- `testuser.nfo` revisado y correcto.

Guarda el JSON de la cuenta de servicio fuera del repositorio y no lo añadas a Git. La URL pooled puede funcionar, pero para este mantenimiento se recomienda la URL direct.

## 1. Preparar una sesión local

Desde la raíz:

```powershell
$env:PROD_DEMO_DATABASE_URL='postgresql://USUARIO:PASSWORD@HOST/BASE?sslmode=require'
$env:PROD_DEMO_FIREBASE_PROJECT_ID='budget-runner-cyberdeck'
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\ruta-segura\firebase-admin.json'
```

## 2. Vista previa

```powershell
npm run prod:demo:reset -- --dry-run
```

La salida muestra el destino PostgreSQL sin contraseña, el proyecto Firebase, el origen del UUID canónico, si existen ambas cuentas y qué identidad de reemplazo se retiraría. También valida las reglas globales y muestra los recuentos actuales. No imprime la contraseña ni modifica datos.

Revisa especialmente que la base mostrada sea live, que el UUID/UID sean los esperados y que el origen de identidad sea `checkpoint` o `database`.

## 3. Aplicar

Usa el email exacto que figure en `testuser.nfo`:

```powershell
npm run prod:demo:reset -- --confirm nomada@budgetrunner.local
```

La salida final debe confirmar el UUID interno, el UID Firebase, 8 categorías, 12 transacciones, 5 presupuestos, 9 módulos, 6 ofertas activas, nivel 24 y 2.380 SynthCoins.

## 4. Limpiar y comprobar

```powershell
Remove-Item Env:PROD_DEMO_DATABASE_URL
Remove-Item Env:PROD_DEMO_FIREBASE_PROJECT_ID
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
Remove-Item Env:PROD_DEMO_INTERNAL_UUID -ErrorAction SilentlyContinue
```

Después:

1. Inicia sesión live con las credenciales actuales de `testuser.nfo`.
2. Comprueba Dashboard, Gastos, Presupuestos, Gamificación, Perfil y Ajustes.
3. Verifica seis ofertas y nueve módulos más el slot vacío.
4. Si realizas pruebas destructivas, vuelve a ejecutar el reset para dejar preparado el usuario.

## Errores seguros

- **Credenciales inválidas:** corrige `testuser.nfo`; no se conecta a ningún servicio.
- **Cuenta Firebase ausente:** se recrea con el UID guardado.
- **Fila PostgreSQL ausente:** se recrea con el UUID guardado.
- **No existe checkpoint ni historial:** proporciona `PROD_DEMO_INTERNAL_UUID`; el script no improvisa otro.
- **Proyecto o cuenta de servicio incorrectos:** se detiene antes de cambiar Firebase.
- **Faltan niveles o bonus:** aplica migraciones/seed y repite.
- **Fallo tras restaurar Firebase:** PostgreSQL revierte; vuelve a ejecutar el mismo comando.
- **Falla la verificación final:** PostgreSQL no hace commit.
