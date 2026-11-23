# Resultados

## Tráfico observable en partidas normales

### Sesión individual

La primera sesión capturada a través del proxy, el 21 de noviembre de 2026, registró **4.222 paquetes del cliente de 15 tipos distintos**.

| Tipo de paquete | Cantidad | Proporción |
| --- | ---: | ---: |
| `tick_end` | 3.430 | 81,2 % |
| `position` | 240 | 5,7 % |
| `look` | 192 | 4,5 % |
| `chunk_batch_received` | 132 | 3,1 % |
| `position_look` | 72 | 1,7 % |
| `player_input` | 68 | 1,6 % |
| `arm_animation` | 56 | 1,3 % |
| `keep_alive` | 11 | 0,3 % |
| `block_dig` | 8 | 0,2 % |
| `held_item_slot` | 4 | 0,1 % |
| `block_place` | 4 | 0,1 % |
| `flying` | 2 | < 0,1 % |
| `close_window` | 1 | < 0,1 % |
| `player_loaded` | 1 | < 0,1 % |
| `teleport_confirm` | 1 | < 0,1 % |
| **Total** | **4.222** | **100 %** |

La mayor parte del tráfico es de mantenimiento. `tick_end` representa cuatro de cada cinco paquetes y el cliente lo envía de forma periódica, juegue o no. Los paquetes que reflejan acciones del jugador, como moverse, golpear o colocar bloques, son una fracción pequeña. Por eso una regla de tasa tiene que ser específica por tipo de paquete: un límite global estaría dominado por `tick_end`.

En esa sesión el **máximo fue de 20 paquetes `position` en un segundo**, y se alcanzó en cinco segundos distintos. Este valor sirve de referencia para la regla de tasa de movimiento.

### Partida con tres jugadores

El mismo 21 de noviembre, entre las 22:09 y las 22:32 (hora de Santiago), jugaron tres personas con conexiones externas por Playit hacia el proxy. En ese intervalo el proxy registró **72.338 paquetes en 10 sesiones de conexión**:

| Sesión | Primer paquete | Último paquete | Paquetes |
| --- | --- | --- | ---: |
| `269c0522` | 22:09:31.438 | 22:31:16.260 | 51.641 |
| `2319d935` | 22:23:41.698 | 22:29:18.505 | 15.524 |
| `04cf0211` | 22:29:31.489 | 22:31:15.790 | 4.423 |
| `b61bac02` | 22:31:24.087 | 22:31:24.226 | 8 |
| `5b319549` | 22:31:24.317 | 22:31:28.567 | 184 |
| `af66edb9` | 22:31:35.032 | 22:31:38.347 | 198 |
| `472d76cb` | 22:31:35.978 | 22:31:38.576 | 107 |
| `dd133361` | 22:31:47.444 | 22:31:47.477 | 5 |
| `0c857a0b` | 22:31:52.619 | 22:31:52.620 | 3 |
| `42a876d2` | 22:31:53.314 | 22:31:58.484 | 245 |

La sesión más larga duró 21 minutos y 45 segundos, con 51.641 paquetes. Eso equivale a unos 40 paquetes por segundo en promedio para un solo jugador. Durante la partida hubo como máximo **dos sesiones simultáneas**. **[PENDIENTE: explicar por qué se observaron como máximo dos sesiones simultáneas si jugaron tres personas. Puede que el tercer jugador entrara por otra ruta o que las sesiones no coincidieran en el tiempo.]**

Las siete sesiones cortas del final, de entre 3 y 245 paquetes, coinciden con el tramo en que se produjeron las desconexiones descritas a continuación.

### Transparencia del proxy

Al final de la partida, dos jugadores fueron desconectados varias veces. El log del cliente de uno de ellos mostró el mismo error a las 22:31:24, 22:31:38 y 22:31:52: un paquete `set_equipment` con 18 bytes de más. Las horas de esas desconexiones coinciden al segundo con el último paquete de varias sesiones del proxy. La causa era el bug de la biblioteca descrito en el [Diseño del proxy](02-arquitectura.md#reenvío-de-paquetes), que el proxy ya corrige.

Este episodio muestra que el proxy **no era transparente** antes de la corrección. Con el bug corregido, el registro de una partida real **[PENDIENTE: repetir una partida larga con varios jugadores y confirmar que no hay desconexiones]**.

## Alertas en partidas normales

**[PENDIENTE: medir la tasa de falsos positivos. Esto responde directamente a la pregunta del proyecto. Opciones: (a) aplicar al JSONL de la partida con tres jugadores las mismas reglas y límites de la evaluación; (b) jugar una partida normal con el proxy en observe y esos límites, y contar las alertas con `scripts/analizar-registro.mjs`.]**

## Detección de ataques

Resultados del [Experimento 2](03-metodologia.md#experimento-2--validación-de-la-detección), con el backend de prueba:

| Ataque | Carga enviada | Alertas en observe | Resultado en enforce |
| --- | --- | --- | --- |
| Inundación de paquetes | 400 `arm_animation` | `packet_rate` ×1 | Alerta y desconexión |
| Movimiento imposible | 11 `position`, saltos de 1.000 bloques | `movement_distance` ×10 | Alerta y desconexión |
| Carga sobredimensionada | `custom_payload` de 200 KB y libro de 300.000 caracteres | `packet_size` ×2, `payload_size` ×1, `book_length` ×1 | Alerta y desconexión |
| Inundación de login | 20 conexiones en ráfaga | Sin alerta | Sin alerta |

Tres de los cuatro patrones se detectaron. En *observe*, el proxy registró cada infracción y siguió reenviando:

- La inundación de paquetes produjo una sola alerta, porque la regla de tasa emite como máximo una por ventana.
- El movimiento imposible produjo una alerta por cada salto (10 saltos después de la posición inicial), porque la referencia se actualiza en cada paquete.
- La carga sobredimensionada disparó tres reglas distintas: los dos paquetes superaron el tamaño máximo, el `custom_payload` superó además el límite de carga y el libro superó el de longitud.

En *enforce*, la primera alerta de cada ataque cortó la sesión, por lo que solo se registra una alerta por ataque.

La **inundación de login no se detectó**. El proxy no tiene una regla de tasa de conexiones, y además es el proxy, no el backend, el que absorbe esas conexiones. Es un resultado negativo que se discute en [Limitaciones](05-limitaciones.md).

## Impacto sobre el servidor vanilla

**[PENDIENTE: ejecutar el Experimento 3 y completar la tabla.]**

| Ataque | Condición | TPS mínimo | RAM máx. | ¿Caída? | Latencia del proxy | Alertas |
| --- | --- | --- | --- | --- | --- | --- |
| Inundación de paquetes | Sin proxy | | | | — | — |
| Inundación de paquetes | Observe | | | | | |
| Inundación de paquetes | Enforce | | | | | |
| Movimiento imposible | Sin proxy | | | | — | — |
| Movimiento imposible | Observe | | | | | |
| Movimiento imposible | Enforce | | | | | |
| Carga sobredimensionada | Sin proxy | | | | — | — |
| Carga sobredimensionada | Observe | | | | | |
| Carga sobredimensionada | Enforce | | | | | |
| Inundación de login | Sin proxy | | | | — | — |
| Inundación de login | Observe | | | | | |
| Inundación de login | Enforce | | | | | |
| Estrés del servidor | Sin proxy | | | | — | — |
| Estrés del servidor | Observe | | | | | |
| Estrés del servidor | Enforce | | | | | |

## Costo del registro

**[PENDIENTE: Experimento 4, o declararlo fuera de alcance en Limitaciones.]**
