# Cómo contribuir a Budget Runner

[English version](CONTRIBUTING.md)

Este fichero es la referencia canónica para el flujo de trabajo del repositorio y la promoción entre ramas. El comportamiento y los requisitos del producto pertenecen a `PRD.md`; los detalles de despliegue pertenecen a `DEPLOYMENT_FREE_TIER.md`.

## Función de cada rama

### `dev`: rama principal de desarrollo

- Desarrolla las nuevas funcionalidades y los fixes en `dev`.
- Cuando un cambio necesite aislamiento, crea a partir de `dev` una rama temática de corta duración, por ejemplo `feature/...` o `fix/...`.
- Fusiona el trabajo terminado de nuevo en `dev` después de realizar las verificaciones apropiadas.

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

## Lista de comprobación

Antes de promocionar un cambio:

- Confirma que la funcionalidad o el fix estén completos y formen una unidad coherente.
- Ejecuta las pruebas, el linting y las compilaciones apropiadas para el área afectada.
- Actualiza la documentación técnica y de usuario cuando cambien el comportamiento o las operaciones.
- Comprueba que no se incluyan credenciales, ficheros de entorno local, metadatos de despliegue generados ni trabajo no relacionado.
- Al actualizar `prod`, confirma que su configuración de despliegue híbrido sigue funcionando y que la release se prepara desde `main`.

La publicación en un repositorio remoto y el despliegue son acciones distintas y explícitas. Un commit o merge local no autoriza ninguna de ellas.
