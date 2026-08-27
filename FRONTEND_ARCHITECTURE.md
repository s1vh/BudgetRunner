# Arquitectura del frontend

Este documento recoge decisiones estructurales del frontend que deben conservarse entre hilos de trabajo. Los requisitos de producto pertenecen a `PRD.md`, el sistema visual a `DESIGN.md`, el trabajo futuro a `BACKLOG.md` y el flujo Git a `CONTRIBUTING_Es.md` / `CONTRIBUTING.md`.

## Code splitting

### Objetivo

Reducir el JavaScript necesario para mostrar el acceso y evitar descargar áreas privadas que el usuario todavía no ha visitado. La referencia inicial de `dev`, tomada el 27 de agosto de 2026 con Vite 8.1.4, es un único chunk de **591,83 kB minificados / 198,36 kB gzip**.

El éxito se mide por los recursos realmente solicitados y ejecutados en cada recorrido, no solo por eliminar el aviso de tamaño de Vite.

### Límites funcionales

1. **Núcleo público:** arranque, estilos globales, idioma, autenticación, shells públicos, acceso, registro, recuperación, páginas legales y estados globales de carga/error.
2. **Finanzas:** Dashboard, métricas, transacciones, presupuestos, tablas, formularios y gráficos compartidos.
3. **Cuenta:** Perfil, Ajustes y gestión de categorías.
4. **Cyberdeck:** resumen de Gamificación, progreso, diagrama, reparaciones e historial.
5. **Tienda:** ofertas rotatorias, tarjetas, confirmación y compra. Se carga bajo demanda al abrir la pestaña y se puede anticipar mediante hover, foco de teclado o el tour guiado.

Los módulos compartidos pueden acabar en chunks comunes generados por Vite. No se deben forzar `manualChunks` solo para ocultar una advertencia: primero se emplean límites de `import()` estables y después se ajusta la configuración únicamente si las mediciones lo justifican.

### Carga de datos

El code splitting descrito aquí afecta solo al JavaScript. `AppDataProvider` mantiene por ahora la carga completa de datos al entrar en la zona privada. Dividir las peticiones y el estado está registrado como `BR-BL-001` en `BACKLOG.md` y queda fuera de este cambio.

### Experiencia de carga

- El acceso inicial usa un estado de pantalla completa coherente con “SINCRONIZANDO IDENTIDAD…”.
- Dentro de la zona privada se conservan navegación, fondo y dimensiones mientras el contenido diferido muestra un skeleton Ultrawave.
- Los fallos al descargar un chunk muestran un mensaje accesible, integrado en la estética synthwave, con una acción de reintento/recarga.
- Los estados comunican actividad mediante texto y estructura, no solo color o animación.
- Se respeta `prefers-reduced-motion` y se evitan flashes, pantallas blancas y saltos de layout.

### Reglas de implementación

- Mantener las rutas y URLs públicas existentes.
- Colocar `Suspense` en el límite más pequeño que preserve el shell útil.
- Proteger las importaciones dinámicas con un límite de error apropiado.
- Evitar descargar Cyberdeck al mostrar el login y Tienda antes de necesitarla.
- Asegurar que el tour pueda esperar a un panel diferido antes de buscar su objetivo.
- No cambiar contratos de API ni el modelo de datos como parte de este trabajo.

### Verificación mínima

- TypeScript, lint y build de producción.
- Comparativa de nombres, tamaños y gzip de los chunks.
- Login, restauración de sesión, logout y navegación directa/recarga.
- Dashboard, transacciones, presupuestos, Perfil y Ajustes.
- Todas las pestañas de Gamificación, compra y reparación.
- Tour guiado, ocho idiomas, 360 px, teclado y movimiento reducido.
- Prueba de recuperación ante un chunk que no pueda descargarse.
