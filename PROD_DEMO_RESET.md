# Reset del usuario demo de producción

Este procedimiento restaura los datos de aplicación de `nomada@budgetrunner.local` en la base live. El script existe únicamente en la rama `prod`, se ejecuta manualmente desde una consola local y no forma parte del frontend, la API desplegada, los builds ni el cron.

## Qué restaura

El fixture parte del usuario original del modo mock y regenera:

- perfil, idioma, moneda, zona horaria, preferencias, ayuda contextual y estado del tour;
- 8 categorías y las 12 transacciones originales;
- 5 presupuestos con sus periodos y relaciones con transacciones;
- nivel 24, SynthCoins, rachas y progresión compatible con las reglas live;
- 9 módulos del cyberdeck, incluido un módulo destruido y varios dañados;
- una rotación activa con 6 ofertas;
- historial de recompensa, daño, compra, reparación y niveles;
- ledgers, eventos e identificadores idempotentes necesarios para que el estado sea auditable.

Las fechas se desplazan respecto al momento de ejecución conservando su orden relativo. Así, la oferta sigue activa durante cinco días, la transacción programada permanece futura y los presupuestos de muestra continúan siendo interactivos aunque el reset se ejecute meses después de la hackathon.

## Normalización respecto al mock

El mock contenía proyecciones precalculadas que no coincidían por completo con sus entidades:

- sus 12 transacciones suman 1.321,89 € en gastos, aunque una proyección mostraba 1.961,89 €;
- el Power de los módulos y los bonus no sumaban los totales de Flux mostrados;
- algunos gastos quedaban fuera de las fechas de los presupuestos a los que se atribuían.

El reset no inventa movimientos para cuadrar esas diferencias. Conserva las operaciones e importes originales, ajusta las fechas de los gastos de muestra dentro de sus periodos y calcula la progresión con los umbrales y bonus existentes en live. Mantiene el nivel 24 y una posición equivalente dentro de ese nivel para que todas las ofertas del mock puedan probarse.

Las definiciones `mock.*` del catálogo se guardan como inactivas. Pueden respaldar el cyberdeck y las ofertas del usuario demo, pero no entran en las rotaciones normales de otros usuarios.

## Qué no modifica

- No crea, elimina ni cambia la identidad de Firebase.
- No cambia el email, la contraseña ni los proveedores configurados en Firebase Authentication.
- No modifica datos de otros usuarios.
- No despliega código ni contacta con GitHub.
- No ejecuta migraciones ni altera los umbrales o reglas globales de progresión.

El UUID interno y el `firebase_uid` existentes se conservan. El usuario debe existir y estar vinculado a Firebase antes del reset. Las sesiones JWT heredadas se eliminan junto con el estado anterior; las sesiones de Firebase se siguen gestionando en Firebase.

## Salvaguardas

El script:

- solo acepta el email fijo `nomada@budgetrunner.local`;
- lee la conexión desde la variable dedicada `PROD_DEMO_DATABASE_URL`, nunca desde `DATABASE_URL`;
- ofrece un modo `--dry-run` completamente de solo lectura;
- exige una confirmación literal para aplicar cambios;
- adquiere un bloqueo de mantenimiento y ejecuta el reemplazo en una transacción `SERIALIZABLE`;
- revierte toda la operación si falla una inserción o una comprobación;
- verifica recuentos, UUID interno y vínculo Firebase antes del commit;
- usa definiciones de módulos aisladas del catálogo activo.

Aunque la operación es repetible, reemplaza deliberadamente todo el estado de aplicación actual del usuario demo. Cualquier edición realizada por un juez después del reset permanecerá hasta la siguiente ejecución.

## Requisitos

- Estar en la rama local `prod`.
- Node.js 22 y las dependencias del repositorio instaladas.
- Tener acceso autorizado a la URL **direct** de la base Neon live.
- Haber aplicado previamente las migraciones y el seed global.
- Comprobar que el usuario ha iniciado sesión al menos una vez y está vinculado a Firebase.

La URL pooled puede funcionar, pero para esta operación puntual se recomienda la URL direct.

## 1. Vista previa

Desde la raíz del repositorio, asigna temporalmente la URL direct:

```powershell
$env:PROD_DEMO_DATABASE_URL='postgresql://USUARIO:PASSWORD@HOST/BASE?sslmode=require'
npm run prod:demo:reset -- --dry-run
```

La salida muestra el host y la base sin imprimir la contraseña, valida la identidad Firebase y enumera el estado actual. No modifica datos.

Revisa con especial atención que el destino mostrado corresponda a la base live correcta.

## 2. Aplicar el reset

Utiliza la confirmación literal:

```powershell
npm run prod:demo:reset -- --confirm nomada@budgetrunner.local
```

La salida final debe indicar:

- 8 categorías;
- 12 transacciones;
- 5 presupuestos y 5 periodos;
- 9 módulos;
- 6 ofertas activas;
- nivel 24 y 2.380 SynthCoins;
- confirmación de que el reset terminó de forma atómica.

## 3. Limpiar la consola y comprobar live

Elimina la URL de la sesión de PowerShell:

```powershell
Remove-Item Env:PROD_DEMO_DATABASE_URL
```

Después:

1. Inicia sesión en live con `nomada@budgetrunner.local`.
2. Comprueba Dashboard, Gastos, Presupuestos, Gamificación, Perfil y Ajustes.
3. Verifica que la tienda presenta seis ofertas y que el cyberdeck muestra nueve módulos más el slot vacío.
4. Realiza cualquier prueba destructiva necesaria y vuelve a ejecutar el reset para dejar el usuario preparado.

## Errores seguros

- **El usuario no existe:** el script se detiene; no crea una identidad Firebase.
- **Falta `firebase_uid`:** inicia sesión una vez en live y repite primero el `--dry-run`.
- **Faltan niveles o bonus globales:** ejecuta el procedimiento normal de migración/seed antes del reset.
- **Conflicto o timeout:** la transacción se revierte completa; revisa la salida y vuelve a intentarlo cuando no haya otra operación activa sobre el usuario.
- **Falla la verificación final:** no se realiza el commit y se conserva el estado anterior.
