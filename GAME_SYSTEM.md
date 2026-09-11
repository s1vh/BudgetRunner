# Budget Runner — Sistema de gamificación y Cyberdeck

## 1. Terminología

- **SynthCoins:** créditos virtuales obtenidos por la parte elegible y trazable del excedente positivo de presupuestos cumplidos.
- **Flux:** puntuación total usada para calcular el nivel.
- **Power:** valor estático de un módulo equipado y no destruido.
- **Shield:** resistencia estática entre 0 y 10.
- **Energy:** salud dinámica entre 0 y 100.
- **Periodo:** intervalo semanal o mensual de un presupuesto.
- **Rotación:** conjunto semanal de ofertas asignado a un usuario para una ventana global de tienda.
- **Familia:** Retrowave, Synthwave, Vaporwave o Hi‑Fi Tech.

## 2. Modelo de progresión

```text
Flux total =
  Flux base acumulado
  + Power de módulos equipados no destruidos
  + bonus de familias
```

Los módulos dañados con Energy entre 1 y 99 aportan todo su Power. Los destruidos aportan cero.

### Umbrales iniciales

| Nivel | Flux mínimo |
|---:|---:|
| 1 | 0 |
| 2 | 100 |
| 3 | 250 |
| 4 | 450 |

A partir del nivel 4, el incremento requerido crece 50 respecto al incremento anterior. Los valores se materializan en una tabla para permitir balanceo.

El nivel puede bajar cuando baja el Power activo. El Flux base nunca se reduce por daño.

## 3. Bonus de familia

Contar únicamente módulos equipados, no destruidos y de la misma familia.

| Cantidad | Bonus sobre Power de la familia |
|---:|---:|
| 0–1 | 0 % |
| 2 | 5 % |
| 3 | 12 % |
| 4 | 20 % |
| 5 o más | 35 % |

Por familia:

```text
bonus_familia = trunc(suma_power_familia × porcentaje_bonus)
```

El total es la suma de bonus de todas las familias. Un módulo solo pertenece a una familia.

## 4. Cumplimiento de presupuestos

### 4.1 Gasto del periodo

Se incluyen gastos `posted`, en la moneda del presupuesto, dentro de `[inicio, fin)`, y según alcance global o categoría.

Los ingresos no reducen el gasto del presupuesto salvo que en el futuro se implemente una regla explícita de reembolso.

### 4.2 Resultado

```text
si gasto <= límite: cumplido
si gasto > límite: excedido
```

### 4.3 SynthCoins

```text
excedente = max(0, límite - gasto)
capacidad trazable = porción del gasto del periodo aún no atribuida a otra recompensa
excedente trazable = min(excedente, capacidad trazable)
excedente elegible = floor(excedente trazable / 100) × 100
SynthCoins = excedente elegible / 100
```

Conversión 1:1 sobre unidades monetarias completas del excedente elegible. Si la moneda usa céntimos, 12.345 unidades menores trazables generan 123 SynthCoins, 12.300 unidades menores elegibles y un resto excluido de 45. Esta regla conservadora exige que cada unidad menor premiada quede vinculada a gasto real: un periodo cumplido sin gasto concede el Flux de cumplimiento, pero no SynthCoins; si el gasto es inferior al excedente, la recompensa queda limitada por ese gasto trazable.

### 4.4 Prevención de doble recompensa

Un gasto puede aparecer en varios cálculos, pero su porción económica solo puede sustentar una recompensa.

Orden:

1. cierre anterior;
2. semanal antes que mensual si cierran a la vez;
3. categoría antes que global;
4. presupuesto más antiguo.

Ejemplo:

- Cuatro semanas ya han otorgado recompensa usando determinados gastos.
- El presupuesto mensual muestra todo el gasto para informar si se cumplió.
- Al calcular SynthCoins mensuales, la capacidad trazable excluye la porción ya atribuida a cierres semanales.
- Solo el mínimo entre el excedente mensual y la capacidad restante genera SynthCoins.

Cada unidad menor elegible se guarda como atribución en el ledger. La parte del excedente no premiada —por solapamiento, falta de gasto trazable o resto inferior a un SynthCoin— queda registrada como excluida y el cierre es idempotente. Todo gasto computado en un cierre cumplido queda bloqueado como historial recompensado, incluso cuando el excedente sea cero o no alcance un SynthCoin; cualquier corrección posterior usa un ajuste compensatorio enlazado. Los cierres con cero SynthCoins no crean movimientos de importe cero en el ledger de SynthCoins.

### 4.5 Flux de cumplimiento

Valores iniciales configurables:

- semana cumplida: +25 Flux base;
- mes cumplido: +100 Flux base.

Solo una vez por periodo.

## 5. Penalización por incumplimiento

Cuando un periodo excede el límite:

- no concede SynthCoins;
- no concede Flux de cumplimiento;
- no elimina SynthCoins anteriores;
- bloquea compras hasta el final del periodo/penalización;
- permite reparaciones;
- aplica daño una vez;
- muestra el saldo en rojo con glitch moderado.

Con varias penalizaciones activas, el bloqueo termina al vencer la última. Si un periodo se procesa con retraso, la penalización conserva como mínimo una duración completa del periodo comprometido contada desde la evaluación; nunca nace ya vencida.

## 6. Fórmula de daño

```text
porcentaje_exceso = ((gasto - límite) / límite) × 100
daño_base = trunc((1 + porcentaje_exceso / 100) × 100)
```

Equivalente:

```text
daño_base = trunc(100 × gasto / límite)
```

Por módulo:

```text
mitigación = Shield × 10
daño_aplicado = max(0, trunc(daño_base - mitigación))
Energy_nueva = max(0, Energy_actual - daño_aplicado)
```

Ejemplos:

| Límite | Gasto | Daño base |
|---:|---:|---:|
| 1.000 | 1.100 | 110 |
| 1.000 | 1.500 | 150 |
| 1.000 | 2.000 | 200 |

Con daño 110:

- Shield 0 recibe 110.
- Shield 5 recibe 60.
- Shield 10 recibe 10.

### Destrucción

Si `Energy_nueva <= 0`:

- Energy se fija en 0.
- Estado pasa a destruido.
- Deja de aportar Power y bonus.
- El slot queda funcionalmente vacío para futuras compras.
- No puede repararse.
- No tiene valor de entrega.
- Se recalculan Flux y nivel inmediatamente.

## 7. Reparación

Permitida solo con `0 < Energy < 100`.

```text
porcentaje_daño = (100 - Energy) / 100
coste = ceil(precio_original × porcentaje_daño)
```

Ejemplo: Energy 72 y precio original 100 → 28 SynthCoins.  
Energy 72 y precio original 500 → 140 SynthCoins.

Reglas:

- comprobar saldo dentro de la transacción;
- debitar coste;
- restaurar Energy a 100;
- registrar ledger y evento;
- no cambia Power;
- permitida con compras bloqueadas;
- destruido no reparable.

Avisos:

- Energy < 50: “Integridad comprometida”.
- Energy ≤ 25: “Fallo crítico inminente”.
- Energy = 0: “Módulo destruido”.

## 8. Compra y sustitución

### 8.1 Coste

Slot vacío:

```text
coste_neto = precio_nuevo
```

Slot ocupado por módulo no destruido:

```text
valor_entrega = floor(precio_original_actual × 0,5)
coste_neto = max(0, precio_nuevo - valor_entrega)
```

Módulo destruido:

```text
valor_entrega = 0
coste_neto = precio_nuevo
```

### 8.2 Secuencia atómica

1. Validar autenticación y propiedad.
2. Bloquear fila de progreso.
3. Validar que no exista penalización activa.
4. Bloquear y validar oferta.
5. Validar nivel mínimo y compatibilidad de slot.
6. Leer módulo actual.
7. Calcular valor de entrega y coste neto.
8. Confirmar saldo.
9. Debitar SynthCoins.
10. Marcar módulo anterior como reemplazado, si existe.
11. Crear nueva instancia Energy 100 y equiparla.
12. Marcar oferta comprada.
13. Recalcular Power, bonus, Flux y nivel.
14. Registrar compra, ledger, auditoría y cambio de nivel.
15. Commit.

Ante cualquier error, rollback completo.

## 9. Catálogo

### Atributos

- SKU.
- Nombre.
- Slot.
- Familia.
- Rareza.
- Precio.
- Power.
- Shield.
- Nivel mínimo.
- Descripción.
- Clave visual.

### Filosofía de balance

- Shield alto suele implicar Power inferior.
- Power alto suele implicar Shield inferior.
- Power y Shield altos: rareza y precio muy elevados.
- No existe generación procedural.
- El catálogo es común a todos.
- No hay stock ni demanda.
- Los precios son estables hasta una revisión de balance versionada.

### Rarezas

- Common: accesible, atributos simples.
- Rare: especialización clara.
- Epic: valor notable y nivel medio.
- Legendary: combinación potente o defensiva.
- Mythic: combinación excepcional, muy cara y de nivel alto.

## 10. Rotación de tienda

- La tienda usa una ventana global fija desde cada domingo a las 02:00 UTC hasta el domingo siguiente a las 02:00 UTC. No depende de región, zona horaria ni ciclos presupuestarios.
- Se genera una rotación propia para cada usuario al consultar la tienda durante la ventana, o mediante el job semanal. La creación es idempotente y segura ante concurrencia.
- Cada rotación contiene exactamente 6 definiciones distintas. Una definición puede reaparecer en semanas posteriores porque el catálogo es finito.
- La semilla se genera con aleatoriedad criptográfica, se persiste y permite reproducir y auditar la selección una vez creada. Una restricción única por usuario y comienzo de ventana impide rerolls.
- El nivel se captura al crear la rotación y permanece fijado durante toda la semana; subir o bajar de nivel no regenera las ofertas vigentes.
- Usa el catálogo común y considera el nivel, la rareza permitida y la banda de precio. El catálogo debe conservar al menos 6 definiciones activas elegibles para nivel 1.
- Ignora el equipamiento actual.
- Ignora familias por completar, slots vacíos y módulos dañados o destruidos.
- No garantiza opciones para cada slot.
- No rellena slots vacíos deliberadamente.
- La escasez temporal forma parte de la estrategia.
- Las ofertas expiran exactamente al terminar la ventana semanal.
- El job programado es una optimización. `GET /game/store` crea o recupera perezosamente la rotación de la ventana actual, por lo que una ejecución tardía o fallida del scheduler no altera el calendario ni deja la tienda vacía.

Ponderación inicial sugerida según nivel, configurable:

| Nivel | Common | Rare | Epic | Legendary | Mythic |
|---:|---:|---:|---:|---:|---:|
| 1–3 | 75 % | 25 % | 0 % | 0 % | 0 % |
| 4–7 | 45 % | 40 % | 15 % | 0 % | 0 % |
| 8–12 | 25 % | 40 % | 27 % | 8 % | 0 % |
| 13–19 | 10 % | 30 % | 35 % | 22 % | 3 % |
| 20+ | 5 % | 20 % | 35 % | 30 % | 10 % |

## 11. Representación visual

- Vista técnica vectorial del cyberdeck.
- Diez módulos conectados por líneas luminosas.
- Selección abre panel lateral; en móvil, bottom sheet.
- Cada módulo muestra: nombre, familia, rareza, Power, Shield, Energy y estado.
- Indicadores:
  - barra de Energy;
  - icono Shield;
  - cifra Power;
  - halo/color de familia;
  - etiqueta de bonus.
- Se reutiliza geometría lineal por tipo; el color distingue familias.
- Estados:
  - vacío: outline tenue y “Sin módulo”.
  - disponible en tienda: pulso suave.
  - dañado: interferencia localizada.
  - crítico: borde de error y alerta.
  - destruido: líneas partidas, opacidad baja y glitch breve.
- No usar animación continua intensa.

## 12. Casos límite

- Reintento de compra con misma clave: devolver resultado original.
- Dos compras simultáneas: solo una puede confirmar.
- Oferta vence durante confirmación: validar en servidor dentro de transacción.
- Consulta o job simultáneos al cambiar la ventana semanal: devolver una sola rotación persistida para ese usuario y esa ventana.
- Cambio de nivel durante una ventana de tienda: mantener el snapshot y aplicar el nuevo nivel en la rotación siguiente.
- Penalización aparece durante compra: bloqueo serializable evita commit incorrecto.
- Dos daños simultáneos de periodos distintos: aplicar secuencialmente y recalcular tras cada uno.
- Reparación y daño concurrentes: bloquear módulo; orden real de commit determina resultado auditable.
- Cambio de nivel durante compra: validar nivel antes y recalcular después.
- Coste neto cero: permitir sustitución sin saldo negativo ni abono.
- Redondeos: dinero entero, Power/daño truncado donde se indica y reparación redondeada hacia arriba.
