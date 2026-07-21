# Budget Runner — Plan de pruebas para Browser Agent

## 1. Objetivo

Validar de extremo a extremo la funcionalidad, reglas económicas, seguridad básica, responsive y fidelidad visual. Los escenarios críticos deben ejecutarse con datos aislados y reiniciables.

## 2. Entornos

- Local: frontend + API + PostgreSQL.
- Staging: configuración equivalente a producción.
- Producción: smoke tests sin operaciones destructivas.
- Viewports mínimos:
  - 360 × 800.
  - 768 × 1024.
  - 1280 × 1024.
  - 1440 × 900.

## 3. Datos base

- Usuario A y Usuario B.
- Moneda EUR para A; USD para B.
- Categorías retrofuturistas.
- Catálogo con al menos una mejora por slot/familia y todas las rarezas.
- Balances controlados.
- Reloj inyectable o periodos cortos en entorno de test.

## 4. Auth y aislamiento

### T-001 Registro

Dado un email nuevo, al registrarse se crea usuario, categorías seed, progreso nivel 1 y saldo 0.

### T-002 Email duplicado

Debe fallar sin crear segunda cuenta.

### T-003 Login incorrecto

No crea sesión y muestra error neutro.

### T-004 Recuperación

El token funciona una vez, expira y permite nueva contraseña.

### T-005 Google OAuth

Crea o vincula la cuenta correcta y evita duplicado por email verificado.

### T-006 Aislamiento

Usuario A no puede leer ni modificar IDs de B; devuelve 404/403 sin filtrar datos.

## 5. Transacciones y dashboard

### T-010 CRUD

Crear, editar y borrar una transacción no recompensada.

### T-011 Validación monetaria

Rechazar cero, negativos, moneda inválida y decimales en unidades menores.

### T-012 Dashboard

Las tarjetas, donut, barras y transacciones reflejan datos de A.

### T-013 Bloqueo histórico

Una transacción usada en recompensa no se edita ni borra; se ofrece ajuste.

### T-014 Responsive

Dashboard sin overflow horizontal; CTA y navegación utilizables en 360 px.

## 6. Presupuestos

### T-020 Semanal cumplido

Límite 1.000, gasto 800: excedente 200, recompensa 200 SynthCoins y 25 Flux una vez.

### T-021 Mensual cumplido

Límite 2.000, gasto 1.500: 500 SynthCoins y 100 Flux una vez.

### T-022 Idempotencia

Repetir job/call no altera saldos ni duplica ledger.

### T-023 Excedido

Límite 1.000, gasto 1.100: sin recompensa, bloqueo activo y daño base 110.

### T-024 Límite exacto

Gasto = límite: presupuesto cumplido, cero SynthCoins y Flux de cumplimiento.

### T-025 Categoría

Solo suma gastos de la categoría seleccionada.

### T-026 Moneda

Una transacción USD no entra en presupuesto EUR.

### T-027 Programada

No entra antes de su fecha efectiva.

## 7. Solapamientos y doble recompensa

### T-030 Semana y mes

Cerrar semana antes que mes. El gasto recompensado semanalmente aparece en informe mensual pero no vuelve a generar SynthCoins.

### T-031 Empate

Semana precede a mes; categoría precede a global; presupuesto antiguo desempata.

### T-032 Parcial

Solo una parte de una transacción/importe ha sido atribuida; el saldo elegible restante puede usarse una vez.

### T-033 Concurrencia

Dos cierres solapados simultáneos no sobreasignan el mismo importe.

## 8. Tienda y compra

### T-040 Slot vacío

Oferta 300, saldo 500: debita 300, equipa Energy 100 y deja 200.

### T-041 Sustitución

Anterior precio original 200, nueva 500: valor entrega 100; debita 400.

### T-042 Sustitución y Power

El Power anterior desaparece; solo se suma el nuevo y se recalculan bonus/nivel.

### T-043 Destruido

No ofrece valor de entrega; nueva cuesta precio completo.

### T-044 Saldo insuficiente

No cambia saldo, oferta, módulo ni progreso.

### T-045 Oferta expirada

No permite compra.

### T-046 Nivel insuficiente

No permite compra.

### T-047 Compra bloqueada

No permite compra durante penalización y muestra balance rojo/glitch.

### T-048 Coste cero

Permite sustitución sin abonar saldo ni dejarlo negativo.

### T-049 Doble click

Misma clave idempotente produce una compra; distintas claves concurrentes solo una confirma.

## 9. Bonus y nivel

### T-050 Dos de familia

Aplica 5 % truncado.

### T-051 Tres, cuatro y cinco

Aplica 12 %, 20 % y 35 %.

### T-052 Familias separadas

Calcula cada bonus por separado.

### T-053 Nivel

Umbrales 0/100/250/450 correctos.

### T-054 Descenso

Destrucción reduce Flux total y puede bajar nivel; se registra historial.

### T-055 Dañado no destruido

Energy > 0 conserva Power completo.

## 10. Daño

### T-060 Ejemplo 100 %

Límite 1.000, gasto 2.000 → daño 200.

### T-061 Shield

Daño 110 y Shield 5 → daño aplicado 60.

### T-062 Mitigación total

Daño menor o igual a Shield×10 → daño aplicado 0.

### T-063 Truncado

Validar números no enteros y truncado.

### T-064 Destrucción

Energy llega a 0, módulo destruido, Power 0, slot disponible para compra.

### T-065 Daño múltiple

Cada cierre aplica daño una vez; dos cierres distintos se aplican en orden.

## 11. Internacionalización

### T-070 Autodetección

Detecta los ocho locales admitidos desde las preferencias del sistema. Un locale no compatible usa `en-US`.

### T-071 Persistencia

El cambio desde Ajustes → Región y moneda es inmediato, se refleja en el resumen Contexto regional del Perfil, se guarda en la cuenta y se mantiene tras cerrar sesión y volver a entrar.

### T-072 Cobertura

Acceso, registro, navegación, dashboard, transacciones, presupuestos, gamificación, perfil, ajustes, privacidad, licencia, 404, modales, errores, gráficas y SVG no muestran textos de interfaz en otro idioma.

### T-073 Contenido protegido

Budget Runner, Flux, SynthCoins, Power, los nombres de las mejoras y todo nombre/concepto/nota creado por el usuario permanecen literales al cambiar de idioma.

### T-074 Categorías

Las categorías iniciales se traducen. Una categoría creada o renombrada por el usuario conserva literalmente su nombre en todos los locales.

### T-075 Formatos y tipografía

Fechas, meses, cifras y moneda usan el locale activo; cirílico, chino simplificado, japonés y coreano se renderizan sin glifos ausentes ni desbordes críticos en los viewports mínimos.

### T-066 Reintento

Reprocesar el mismo cierre no daña de nuevo.

## 11. Reparación

### T-070 Precio 100, Energy 72

Coste 28, Energy vuelve a 100.

### T-071 Precio 500, Energy 72

Coste 140.

### T-072 Redondeo

Precio 333, Energy 99: `ceil(3,33)` = 4.

### T-073 Bloqueo activo

Reparación permitida.

### T-074 Sin saldo

No modifica módulo ni saldo.

### T-075 Destruido

No reparable.

### T-076 Sano

Energy 100 no reparable.

## 12. Rotaciones

### T-080 Reproducibilidad

Misma seed y snapshot generan mismas ofertas.

### T-081 Nivel

La distribución se ajusta a banda de nivel.

### T-082 Sin build bias

Cambiar módulos equipados no cambia una rotación ya creada.

### T-083 Slots no garantizados

Puede existir slot vacío sin oferta.

### T-084 Expiración

Nueva rotación invalida ofertas antiguas.

## 13. UX visual

### T-090 Fidelidad

Dashboard conserva jerarquía, tarjetas, sidebar, gráficos y estética del mockup.

### T-091 Cyberdeck

Diez slots visibles, conexiones lineales y panel de detalle.

### T-092 Estados Energy

Normal, <50, ≤25 y destruido diferenciables por texto e icono, no solo color.

### T-093 Reduced motion

Desactiva pulsos/glitch no esenciales.

### T-094 Contraste y foco

Texto legible y navegación completa con teclado.

### T-095 Footer

MIT, Mike Fieldins y enlace seguro a LinkedIn.

### T-096 Iconos de ayuda

Todas las tarjetas de Dashboard, Gastos y Gamificación muestran el icono cuando `helpHints` está activo, sin solapar títulos, indicadores, filtros, tablas o acciones. Desactivarlo en Ajustes oculta todos los iconos y la elección persiste tras volver a entrar.

### T-097 Interacción de ayuda

El tooltip se abre con hover y foco, permanece visible mientras corresponda y se cierra al salir, perder el foco, pulsar Escape o tocar fuera. Es usable con ratón, teclado y táctil, no queda recortado por la tarjeta y se adapta al viewport móvil.

### T-098 Primer login y persistencia

Todas las cuentas existentes tras la migración y todas las cuentas nuevas ven el tour una vez. Terminarlo o abandonarlo desde cualquier paso impide que vuelva a abrirse automáticamente; repetir la petición al backend no altera la fecha inicial.

### T-099 Recorrido no destructivo

El tour resalta las secciones relevantes de Dashboard, Gastos, Presupuestos, Gamificación, Perfil y Ajustes sin crear ni configurar datos. Cambia automáticamente entre Resumen, Cyberdeck, Tienda, Reparaciones e Historial. Atrás, siguiente, salir y Escape funcionan en todos los pasos; el foco queda contenido en el diálogo mientras está abierto.

### T-100 Repetición y localización

El tour puede reiniciarse desde Ajustes incluso después de completarlo. Tooltips, controles y pasos usan inmediatamente cualquiera de los ocho idiomas, caen a inglés ante un locale incompatible y conservan Budget Runner, Flux, SynthCoins, Power, Cyberdeck y los nombres de mejoras.

### T-101 Destino al cerrar

Finalizar el último paso cierra el tour, vuelve al Dashboard y sitúa la página al inicio. Salir, pulsar Escape o cerrar desde el fondo conserva la página y sección del paso actual. Ambos caminos marcan el tour como visto y permiten repetirlo desde Ajustes.

### T-102 Gamificación y arranque manual

Iniciar el tour desde Ajustes abre el Dashboard ya en el primer paso, sin añadir pasos al recorrido. Los pasos existentes de Flux y Cyberdeck explican en los ocho idiomas los umbrales de nivel, Flux base, Power, bonus, Shield × 10, Energy, destrucción, reparación, familia y rareza, manteniendo literales todos esos términos protegidos.

## 14. Seguridad básica

- JWT inválido/expirado.
- Refresh revocado.
- Rate limit de login y recuperación.
- Inyección SQL en filtros.
- XSS en concepto/notas.
- Manipulación de `userId` en body.
- Manipulación de precio/coste desde frontend.
- CORS no autorizado.
- Tokens ausentes en logs.

## 15. Pruebas de recuperación

- Fallo tras débito antes de equipar: rollback total.
- Fallo de ledger: rollback total.
- Job interrumpido en `processing`: reintento seguro.
- Deadlock simulado: retry limitado.
- API reiniciada durante cierre: sin duplicados.

## 16. Smoke test de producción

1. Cargar landing/login.
2. Crear usuario de prueba autorizado.
3. Registrar gasto.
4. Consultar dashboard.
5. Crear presupuesto.
6. Consultar gamificación.
7. Verificar health/readiness.
8. Verificar footer y licencia.
9. Eliminar usuario de prueba.

## 17. Criterio de salida

- 100 % de escenarios críticos T-001, T-006, T-020–T-024, T-030–T-033, T-040–T-049, T-060–T-076 aprobados.
- Sin defectos severidad crítica/alta.
- Sin saldos negativos, dobles recompensas ni Power fantasma.
- Sin acceso cruzado entre usuarios.
- Responsive aprobado en todos los viewports.
