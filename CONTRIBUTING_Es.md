# Cómo contribuir a Budget Runner

[English version](CONTRIBUTING.md)

Este fichero es la referencia canónica para el flujo de trabajo del repositorio, la promoción entre ramas y el mantenimiento del backlog. El comportamiento y los requisitos del producto pertenecen a `PRD.md`; el trabajo futuro identificado pertenece a `BACKLOG.md`; los detalles de despliegue pertenecen a `DEPLOYMENT_FREE_TIER.md` cuando ese fichero exista en la rama de despliegue.

## Función de cada rama

### `dev`: rama principal de desarrollo

- Desarrolla las nuevas funcionalidades y los fixes en `dev`.
- Cuando un cambio sea complejo, delicado o necesite aislamiento, crea a partir de `dev` una rama temática de corta duración, preferentemente `codex/feature/...` o `codex/fix/...` para trabajo realizado con Codex.
- Fusiona el trabajo terminado de nuevo en `dev` después de realizar las verificaciones apropiadas.
- El código integrado en `dev` se prueba localmente y necesita aceptación del mantenedor antes de promoverse a `main`. La documentación puede actualizarse y publicarse sin esperar esa validación funcional.

### `main`: rama estable

- Mantén `main` en un estado estable y publicable.
- Actualízala desde `dev` cuando una funcionalidad completa o un conjunto coherente de fixes estén listos.
- Cuando sea necesario, también se puede promocionar una funcionalidad terminada o un fix urgente desde una rama de desarrollo secundaria.
- Si un fix urgente llega a `main` sin pasar por `dev`, incorpora el mismo cambio a `dev` para evitar regresiones entre ramas.

### `prod`: rama de despliegue

- Conserva en `prod` las configuraciones y dependencias necesarias para el despliegue híbrido en Firebase, Vercel y Neon.
- Realiza los despliegues únicamente desde `prod`.
- Una vez completada su preparación, no utilices `prod` para el desarrollo habitual de funcionalidades o fixes.
- Actualiza `prod` únicamente desde `main`. Al resolver conflictos de promoción, conserva la configuración específica del despliegue salvo que el cambio estable entrante la sustituya de forma intencionada.
- No devuelvas cambios exclusivos del despliegue a `main` o `dev` salvo que se hayan revisado y convertido en cambios independientes del entorno.

## Flujo de promoción

```text
rama temática (opcional, creada desde dev)
                    │
                    ▼
                   dev ──────► main ──────► prod ──────► despliegue
```

El recorrido normal es `dev` → `main` → `prod`. Las ramas temáticas vuelven normalmente a `dev`; la promoción directa a `main` se reserva para una funcionalidad completa o un fix urgente que la justifique.

## Publicación y despliegue

- Se pueden publicar commits y ramas temáticas en remoto como parte del trabajo normal, después de revisar que no contienen secretos ni cambios ajenos a la tarea.
- Publicar una rama temática o `dev` no autoriza promoverla a `main`; la promoción requiere que el código esté completo, verificado y aceptado.
- `main` conserva exclusivamente trabajo estable. `prod` se actualiza únicamente desde `main` y nunca recibe desarrollo directo.
- Vercel tiene `prod` como Production Branch e ignora los builds Git de cualquier otra rama. Un push a `prod` puede iniciar un despliegue real y exige la aprobación de release correspondiente.
- Firebase se despliega únicamente desde `prod` mediante su procedimiento documentado; un push Git por sí solo no sustituye esa verificación.

## Gestión del backlog

- `BACKLOG.md` es la fuente informativa de trabajo futuro identificado. Una entrada no autoriza a implementarla ni cambia el alcance del hilo actual.
- Antes de comenzar una entrada, el mantenedor confirma prioridad, alcance y criterios de aceptación. Al iniciarla, se marca como **en curso** y se anota la rama de trabajo.
- Las entradas resueltas no se borran: se marcan como **resueltas**, se mueven al historial y se completan con fecha, resultado, decisiones, commits o pull requests, verificaciones y deuda residual pertinente.
- Los hallazgos nuevos que queden fuera del alcance actual se añaden al backlog en vez de incorporarse silenciosamente a la implementación.

## Lista de comprobación

Antes de promocionar un cambio:

- Confirma que la funcionalidad o el fix estén completos y formen una unidad coherente.
- Ejecuta las pruebas, el linting y las compilaciones apropiadas para el área afectada.
- Actualiza la documentación técnica y de usuario cuando cambien el comportamiento o las operaciones.
- Comprueba que no se incluyan credenciales, ficheros de entorno local, metadatos de despliegue generados ni trabajo no relacionado.
- Al actualizar `prod`, confirma que su configuración de despliegue híbrido sigue funcionando y que la release se prepara desde `main`.

La sincronización remota durante el desarrollo está permitida, pero la promoción y el despliegue siguen siendo decisiones separadas con sus propias comprobaciones.
