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

La sesión más larga duró 21 minutos y 45 segundos, con 51.641 paquetes. Eso equivale a unos 40 paquetes por segundo en promedio para un solo jugador. Durante la partida hubo como máximo **dos sesiones simultáneas** registradas por el proxy, pese a que jugaron tres personas. El dato se explica porque el solapamiento se calcula entre el primer y el último paquete de cada sesión, y las conexiones por Playit se cortaron y reconectaron varias veces (cada reconexión recibe un ID nuevo); no todas las ventanas coincidieron en el tiempo. **[CONFIRMAR: el equipo puede precisar si el tercer jugador entró por otra ruta o si fue solo cuestión de temporización.]**

Las siete sesiones cortas del final, de entre 3 y 245 paquetes, coinciden con el tramo en que se produjeron las desconexiones descritas a continuación.

### Transparencia del proxy

Al final de la partida, dos jugadores fueron desconectados varias veces. El log del cliente de uno de ellos mostró el mismo error a las 22:31:24, 22:31:38 y 22:31:52: un paquete `set_equipment` con 18 bytes de más. Las horas de esas desconexiones coinciden al segundo con el último paquete de varias sesiones del proxy. La causa era el bug de la biblioteca descrito en el [Diseño del proxy](02-arquitectura.md#reenvío-de-paquetes), que el proxy ya corrige.

Este episodio muestra que el proxy **no era transparente** antes de la corrección. Con el bug corregido, los jugadores volvieron a conectarse y a jugar a través del proxy sin el error de `set_equipment` que antes los expulsaba, lo que confirma la corrección en la práctica. Una partida larga con varios jugadores sostenida en el tiempo sería la comprobación más fuerte y queda como verificación adicional.

## Alertas en partidas normales

No se dispone todavía de una medición limpia de falsos positivos con las reglas
activas. El registro de la partida real del 21 de noviembre se tomó con el proxy
en observación, antes de incorporar las reglas, y el JSONL guarda solo metadatos
(tipo y tamaño de paquete), no las coordenadas, por lo que no se puede re-evaluar
`movement_distance` sobre esa captura. Una medición directa requiere una partida
normal con el proxy en *observe* y los límites de la evaluación, contando las
alertas con `scripts/analizar-registro.mjs`.

Dos consideraciones acotan la expectativa. Por construcción, el tráfico normal
queda bajo los límites de contenido: el chat no supera los 256 caracteres, los
paquetes no se acercan a los 32.768 bytes y el movimiento entre paquetes es de
una fracción de bloque, muy por debajo de los 10. Y la línea base dio un máximo de
20 paquetes `position` por segundo, bajo el límite de tasa de 40. El riesgo real
de falso positivo está en `movement_distance` cuando el servidor corrige
bruscamente la posición de un jugador legítimo (rubber-band), el mismo mecanismo
por el que los bots de estrés la dispararon pese a avanzar menos de 10 bloques por
envío; cuantificarlo queda pendiente.

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

El servidor vanilla aplica validaciones propias y, salvo el estrés con bots, los
ataques puntuales de un solo cliente no alteran de forma apreciable su carga: un
atacante no satura el hilo principal. La carga sobredimensionada, de hecho, la
rechaza el propio servidor (cierra la conexión por tamaño de paquete) además de
dispararse las reglas del proxy. Por eso la medición de impacto se centra en el
estrés con bots concurrentes, el único ataque con efecto material sobre el
servidor.

El vanilla no expone TPS, así que se usan el CPU% pico y la RAM del proceso Java
(muestreo por segundo), los avisos `Can't keep up` de la consola y las alertas
del proxy. El ataque: `server_stress` con **100 bots durante 45 s**.

| Condición | CPU% pico | RAM máx. | Efecto en el servicio | Alertas | Disconnect |
| --- | ---: | ---: | --- | ---: | ---: |
| Sin proxy | 47 % | ~2.024 MB (plano) | jugador legítimo desconectado | — | — |
| Observe | 29 % | ~2.670 MB (+700) | sin caída, 100 bots vivos | ~27-28 mov/bot | 0 |
| Enforce | 24 % | ~2.048 MB (plano) | ataque cortado a los 18,7 s, 0 bots vivos | 308 (`packet_rate` 224, `movement_distance` 84) | 98 |

**Sin proxy.** Los 100 bots se sostuvieron los 45 s (149.292 paquetes, ~3.300/s).
La CPU del servidor subió de ~1 % en reposo a un rango sostenido de 30-47 %
durante ~42 s, y un jugador legítimo conectado en paralelo fue desconectado
mientras los bots operaban: negación de servicio a un usuario real. La RAM se
mantuvo plana, por lo que el ataque está ligado al procesamiento, no a la
memoria. El pico de 47 % no satura el total de la CPU, pero el servidor procesa
los *ticks* en un solo hilo; un núcleo saturado no se refleja como 100 % del
total, de modo que el porcentaje agregado subestima la saturación real del hilo
principal, que es lo que produce el lag.

**Observe.** El proxy registra pero no actúa: el ataque también se sostiene
(128.904 paquetes, 100 bots vivos) y cada bot genera ~27-28 alertas de movimiento
en los 45 s. La RAM subió unos 700 MB, consistente con la generación de chunks
por la exploración de los bots.

**Enforce.** El proxy desconectó **98 de las 100 sesiones** y el ataque colapsó a
los 18,7 s con 35.880 paquetes, una reducción del ~76 % frente a sin proxy. La
carga del servidor duró solo ~11 s (CPU pico 24 %, RAM plana) antes de volver al
reposo: el proxy no solo reduce los paquetes, también acorta la ventana de
impacto. Cada bot cruzó tanto el límite de tasa de posición (`packet_rate`) como
el de desplazamiento (`movement_distance`), y la primera alerta cortó su sesión.

Resultado principal: un ataque distribuido de muchos bots degrada el servicio y
expulsa a jugadores reales, y el proxy en *enforce* lo contiene desconectando casi
todas las sesiones. El detalle y las cifras intermedias están en
[resultados.md](../resultados.md).

## Costo del registro

El Experimento 4, una medición aislada del costo del registro (conexión directa
frente a proxy con `--no-record` y proxy con registro), queda **fuera del alcance**
de este trabajo y se anota en [Limitaciones](05-limitaciones.md).

Como indicio indirecto, en el estrés con 100 bots el atacante colocó 149.292
paquetes en 45 s sin proxy y 128.904 a través del proxy en *observe* (que registra
cada paquete), una caída de ~14 % en el volumen que alcanza el mismo envío: el
proxy introduce una sobrecarga apreciable pero no prohibitiva. No es una medición
controlada del costo del registro, porque mezcla el costo de reenviar con el de
escribir el JSONL; separarlos es lo que haría el Experimento 4.
