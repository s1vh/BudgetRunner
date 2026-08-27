# Budget Runner — Backlog

Este fichero registra trabajo futuro ya identificado, pero **no autoriza su implementación**. La prioridad y el alcance de cada entrada deben confirmarse antes de comenzar. La operativa completa se define en `CONTRIBUTING_Es.md` y `CONTRIBUTING.md`.

## Pendiente

### BR-BL-001 — Dividir la carga de datos por áreas funcionales

**Estado:** pendiente  
**Prioridad:** por determinar  
**Dependencia:** estabilizar primero el code splitting de JavaScript.

Actualmente `AppDataProvider` obtiene al entrar en la zona privada un snapshot completo: dashboard, transacciones, categorías, presupuestos, perfil, progreso, cyberdeck, tienda, historial y bonus. Separar las peticiones y el estado para que cada área solicite solo lo necesario cuando se visite.

El trabajo deberá estudiar como mínimo:

- estados independientes de carga, error, refresco e invalidación;
- carga diferida de Perfil/Ajustes, Cyberdeck y tienda;
- coherencia después de crear gastos, cerrar presupuestos, comprar o reparar módulos;
- comportamiento equivalente entre repositorios HTTP y mock;
- impacto sobre el tour guiado y la navegación directa;
- medición de peticiones, payload y tiempo hasta contenido útil antes y después.

### BR-BL-002 — Corregir el título transparente en Chrome/Chromium

**Estado:** pendiente  
**Prioridad:** por determinar

Investigar y corregir los defectos de visualización en navegadores basados en Chrome/Chromium del título transparente situado en la parte superior izquierda. La implementación actual referencia `frontend/public/media/BudgetRunner_logo.svg`; al abordar el trabajo se deberá confirmar si el defecto procede del recurso, de su exportación original o del renderizado/CSS, y validar la solución también en Firefox y Safari cuando sea posible.

### BR-BL-003 — Revamp visual de Gamificación

**Estado:** pendiente  
**Prioridad:** por determinar

Aplicar pequeños cambios de visualización a la sección de Gamificación. No se considera un rework funcional ni arquitectónico. El alcance concreto se definirá en su hilo de trabajo antes de modificar componentes, diseño o comportamiento.

## Historial resuelto

Las entradas completadas no se eliminan. Se mueven a esta sección, se marcan como resueltas y se amplían con:

- fecha de resolución;
- resumen del resultado y de cualquier decisión relevante;
- ramas, pull requests o commits pertinentes;
- verificaciones realizadas;
- documentación o deuda residual asociada.
