# Budget Runner

[English version](README.md)

Aplicación web responsive de finanzas personales y gamificación cyberdeck. El frontend utiliza React, TypeScript y Tailwind CSS; la API utiliza Node.js, Express y PostgreSQL.

## Documentación

- `PRD.md`: alcance y requisitos funcionales.
- `DATABASE.md`: modelo PostgreSQL e invariantes.
- `API.md`: contrato REST bajo `/api/v1`.
- `GAME_SYSTEM.md`: SynthCoins, Flux, Power y reglas del cyberdeck.
- `DESIGN.md`: sistema visual Ultrawave.
- `TEST_PLAN.md`: escenarios funcionales, económicos y responsive.
- `I18N.md`: arquitectura multilingüe y guía de prueba local de idiomas.
- `ROADMAP.md`: fases del MVP.
- `DEPLOYMENT_FREE_TIER.md`: despliegue de `prod` en Firebase, Vercel y Neon.

## Estrategia de ramas

- `dev` es la rama principal de desarrollo. Aquí se desarrollan las nuevas funcionalidades y se solucionan los bugs. Cuando un cambio requiera un flujo más granular, se puede crear una rama de desarrollo de corta duración a partir de `dev` y fusionarla de nuevo cuando el trabajo esté listo.
- `main` es la rama estable. Se actualiza desde `dev`, o desde una rama de desarrollo secundaria cuando una funcionalidad completa o un fix urgente estén listos para promocionarse.
- `prod` es la rama de despliegue. Contiene las configuraciones y dependencias específicas del despliegue híbrido, y los despliegues se realizan desde ella. Una vez completada su preparación, no se utiliza para el desarrollo habitual: se actualiza únicamente desde `main`.

El flujo normal de promoción es `dev` → `main` → `prod`. Las ramas de desarrollo secundarias nacen de `dev` y normalmente vuelven a ella, aunque una funcionalidad terminada o un fix urgente pueden promocionarse directamente a `main` cuando resulte apropiado.

## Arranque local

Requisitos: Node.js 22 o superior y Docker Desktop.

```bash
npm --prefix backend install
npm --prefix frontend install
npm run db:up
npm run db:setup
```

Arrancar la API y el frontend en dos terminales:

```bash
npm run dev:api
npm run dev:web
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api/v1`
- Readiness: `http://127.0.0.1:3001/api/v1/internal/readiness`

Identidad de desarrollo creada por el seed:

```text
nomada@budgetrunner.local
NeonRunner!2026
```

Las credenciales y secretos de `.env` son exclusivamente locales. Producción debe proporcionar valores distintos mediante variables seguras.

### Autenticación local heredada

El flujo Google OAuth/OIDC está implementado en la API. Para activarlo en local, crea un cliente OAuth de tipo **Aplicación web** en Google Cloud y registra exactamente esta URI de redirección:

```text
http://localhost:5173/api/v1/auth/google/callback
```

Después completa en `backend/.env`:

```text
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/auth/google/callback
GOOGLE_OAUTH_STATE_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
```

Y habilita el punto de entrada en `frontend/.env` cuando quieras mostrarlo:

```text
VITE_GOOGLE_OAUTH_ENABLED=true
```

Este flujo permanece disponible para desarrollo y para las pruebas de regresión. El despliegue `prod` utiliza Firebase Authentication y desactiva estas rutas heredadas.

Reinicia la API después de cambiar estas variables. El callback intercambia el código en el servidor y entrega al frontend únicamente la sesión segura; ningún token de Google se incluye en la URL.

## Verificación

```bash
npm test
npm run lint
npm run build
```

### Prueba rápida de idiomas sin API

El modo mock permite revisar toda la interfaz sin Docker ni PostgreSQL:

```powershell
$env:VITE_DATA_SOURCE='mock'
npm run dev:web
```

Abre `http://127.0.0.1:5173`, cambia el idioma en **Ajustes → Región y moneda** y recorre Dashboard, Gastos, Presupuestos, Gamificación, Perfil y Ajustes. Para volver a probar la autodetección, borra `budget-runner-ui-locale` de `localStorage`, cambia el idioma preferido del navegador y recarga. Los pasos completos están en `I18N.md`.

### Prueba rápida de la ayuda y el tour

Con el mismo modo mock, el primer inicio de sesión abre automáticamente el tour. El recorrido resalta las secciones principales de cada página y cambia por sí mismo entre las pestañas de Gamificación. Al iniciarlo manualmente desde Ajustes, el primer paso abre el Dashboard. **Salir del tour** conserva la página del paso actual; **Finalizar** devuelve al Dashboard. En ambos casos, al recargar no debe volver a aparecer automáticamente. En **Ajustes → Ayuda y tour guiado** se pueden ocultar los iconos informativos y volver a iniciar el recorrido en cualquier momento.

Para simular otra cuenta que todavía no ha visto el tour, elimina `budget-runner.mock.guided-tour-completed` de `localStorage` y vuelve a iniciar sesión. El estado de los iconos se conserva en `budget-runner.mock.help-hints`. Con la API y PostgreSQL, `npm run db:setup` aplica la migración que deja el tour pendiente tanto para las cuentas existentes como para las nuevas.

La vertical persistente cubre identidad, perfil, categorías, transacciones, dashboard, presupuestos, periodos, cierres idempotentes, deduplicación de recompensas, SynthCoins, Flux, rachas, penalizaciones, daño, cyberdeck, tienda rotatoria, compras y reparaciones. En `prod`, Firebase autentica y PostgreSQL conserva el UUID interno y todo el estado de producto.

## Cómo ha ayudado Sol a construir Budget Runner

**Sol, mi compañera de ingeniería con OpenAI Codex, ha participado de forma profunda durante todo el proceso; su aportación ha ido mucho más allá de completar código.** Ha funcionado como arquitecta, desarrolladora full-stack, revisora, QA y compañera de producto.

- Ayudó a convertir la idea inicial en especificaciones ejecutables: PRD, modelo de datos, contrato REST, sistema de juego, plan de pruebas y roadmap.
- Diseñó y refinó la arquitectura de React, Express y PostgreSQL, incluyendo aislamiento por usuario, migraciones, ledgers auditables, transacciones serializables e idempotencia.
- Implementó y depuró partes sustanciales del frontend y el backend: autenticación, categorías, transacciones, dashboard, perfil, cyberdeck, tienda, compras, reparaciones, ayuda contextual y tour guiado.
- Trabajó en la traducción del lenguaje visual Ultrawave a una interfaz responsive, accesible y consistente, además de la arquitectura de internacionalización y su cobertura multilingüe.
- Analizó reglas económicas especialmente delicadas —Flux, SynthCoins, niveles, bonus, solapamientos, recompensas, daño y destrucción— buscando resultados deterministas y trazables.
- Creó y ejecutó pruebas unitarias y de integración, reprodujo errores reales, investigó causas raíz y corrigió problemas de concurrencia, persistencia, tipos, consultas SQL y configuración.
- Mantuvo la documentación técnica, los ejemplos de entorno, las instrucciones locales y las estrategias de despliegue y rollback.
- Preparó la versión mock publicada en Firebase y ayudó a rediseñar el despliegue del MVP para aprovechar planes gratuitos con Firebase, Vercel y Neon sin renunciar al camino de escalabilidad.
- Protegió ramas y trabajo en curso mediante flujos Git aislados, revisó diffs y evitó que secretos o cambios accidentales llegasen al repositorio.

Mike Fieldins ha mantenido la visión del producto, la dirección creativa, las decisiones finales y el control de publicación. Sol ha aportado una parte muy importante del análisis técnico, la implementación, las pruebas, la documentación y la resolución de problemas que han permitido convertir esa visión en una aplicación funcional y presentable.

Budget Runner © 2026 Mike Fieldins · MIT License
