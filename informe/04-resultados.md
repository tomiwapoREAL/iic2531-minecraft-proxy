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
| `close_window`, `player_loaded`, `teleport_confirm` | 1 c/u | < 0,1 % |
| **Total** | **4.222** | **100 %** |

El tráfico es casi todo de mantenimiento: `tick_end` son cuatro de cada cinco paquetes y el cliente lo envía de forma periódica, juegue o no, mientras que las acciones del jugador (mover, golpear, colocar bloques) son una fracción pequeña. Por eso una regla de tasa debe ser específica por tipo de paquete: un límite global estaría dominado por `tick_end`. El **máximo fue de 20 paquetes `position` en un segundo** (en cinco segundos distintos), valor que sirve de referencia para la regla de tasa de movimiento.

### Partida con tres jugadores

El mismo 21 de noviembre, entre las 22:09 y las 22:32 (Santiago), jugaron tres personas con conexiones externas por Playit hacia el proxy. El proxy registró **72.338 paquetes en 10 sesiones de conexión**; la más larga duró 21 min 45 s con 51.641 paquetes (~40 paquetes/s para un solo jugador). El desglose por sesión está en [resultados.md](../resultados.md).

Hubo como máximo **dos sesiones simultáneas** registradas por el proxy, pese a que jugaron tres personas: el tercer jugador se conectó **directamente al backend**, sin pasar por el proxy, de modo que el observador nunca vio su tráfico. Es un caso concreto del supuesto que no se cumple en el laboratorio —el backend acepta conexiones directas— y que se discute en [Limitaciones](05-limitaciones.md#supuestos).

### Transparencia del proxy

Al final de la partida, dos jugadores fueron desconectados varias veces. El log del cliente de uno mostró el mismo error a las 22:31:24, 22:31:38 y 22:31:52: un paquete `set_equipment` con 18 bytes de más, cuyas horas coinciden al segundo con el último paquete de varias sesiones del proxy. La causa era el bug de la biblioteca descrito en el [Diseño del proxy](02-arquitectura.md#reenvío-de-paquetes): el proxy **no era transparente** antes de la corrección. Con el bug corregido, los jugadores volvieron a jugar a través del proxy sin ese error, lo que confirma la corrección en la práctica; una partida larga sostenida sería la comprobación más fuerte y queda como verificación adicional.

## Alertas en partidas normales

No se dispone de una medición limpia de falsos positivos con las reglas activas: el registro de la partida real es anterior a las reglas y el JSONL guarda solo metadatos (tipo y tamaño), no coordenadas, por lo que no se puede re-evaluar `movement_distance` sobre esa captura. Medirlo requiere una partida normal con el proxy en *observe* y los límites de la evaluación, contando alertas con `scripts/analizar-registro.mjs`.

Por construcción el tráfico normal queda bajo los límites: el chat no supera 256 caracteres, los paquetes no se acercan a 32.768 bytes, el movimiento entre paquetes es una fracción de bloque (muy por debajo de 10) y el máximo de 20 `position`/s está bajo el límite de 40. El riesgo real de falso positivo está en `movement_distance` cuando el servidor corrige bruscamente la posición de un jugador legítimo (*rubber-band*), el mismo mecanismo por el que los bots de estrés la dispararon pese a avanzar menos de 10 bloques por envío; cuantificarlo queda pendiente.

## Detección de ataques

Resultados del [Experimento 2](03-metodologia.md#experimento-2--validación-de-la-detección), con el backend de prueba:

| Ataque | Carga enviada | Alertas en observe | Resultado en enforce |
| --- | --- | --- | --- |
| Inundación de paquetes | 400 `arm_animation` | `packet_rate` ×1 | Alerta y desconexión |
| Movimiento imposible | 11 `position`, saltos de 1.000 bloques | `movement_distance` ×10 | Alerta y desconexión |
| Carga sobredimensionada | `custom_payload` de 200 KB y libro de 300.000 caracteres | `packet_size` ×2, `payload_size` ×1, `book_length` ×1 | Alerta y desconexión |
| Inundación de login | 20 conexiones en ráfaga | Sin alerta | Sin alerta |

Tres de los cuatro patrones se detectaron. En *observe* el proxy registró cada infracción y siguió reenviando: la inundación de paquetes dio una sola alerta (la regla de tasa emite como máximo una por ventana); el movimiento imposible, una por cada salto (10 tras la posición inicial, porque la referencia se actualiza en cada paquete); y la carga sobredimensionada disparó tres reglas (los dos paquetes superaron el tamaño máximo, el `custom_payload` el límite de carga y el libro el de longitud). En *enforce*, la primera alerta de cada ataque cortó la sesión, por lo que se registra una sola.

La **inundación de login no se detectó**: el proxy no tiene una regla de tasa de conexiones, y además es él —no el backend— quien absorbe esas conexiones. Es un resultado negativo que se discute en [Limitaciones](05-limitaciones.md).

## Impacto sobre el servidor vanilla

Salvo el estrés con bots, los ataques puntuales de un solo cliente no alteran de forma apreciable la carga del servidor: no saturan el hilo principal, y la carga sobredimensionada la rechaza el propio vanilla (cierra la conexión por tamaño de paquete). Por eso la medición de impacto se centra en el estrés con bots concurrentes, el único ataque con efecto material. Como el vanilla no expone TPS, se usan el CPU% pico y la RAM del proceso Java (muestreo por segundo), los avisos `Can't keep up` y las alertas del proxy. El ataque: `server_stress` con **100 bots durante 45 s**.

| Condición | CPU% pico | RAM máx. | Efecto en el servicio | Alertas | Disconnect |
| --- | ---: | ---: | --- | ---: | ---: |
| Sin proxy | 47 % | ~2.024 MB (plano) | jugador legítimo desconectado | — | — |
| Observe | 29 % | ~2.670 MB (+700) | sin caída, 100 bots vivos | ~27-28 mov/bot | 0 |
| Enforce | 24 % | ~2.048 MB (plano) | ataque cortado a los 18,7 s, 0 bots vivos | 308 (`packet_rate` 224, `movement_distance` 84) | 98 |

- **Sin proxy.** Los 100 bots se sostuvieron los 45 s (149.292 paquetes, ~3.300/s). La CPU subió de ~1 % en reposo a 30-47 % sostenido durante ~42 s y un jugador legítimo conectado en paralelo fue desconectado: negación de servicio a un usuario real. La RAM se mantuvo plana, así que el ataque está ligado al procesamiento, no a la memoria. El pico de 47 % no satura el total, pero el servidor procesa los *ticks* en un solo hilo; un núcleo saturado no se refleja como 100 % del total, de modo que el agregado subestima la saturación real del hilo principal, que es lo que produce el lag.
- **Observe.** El proxy registra pero no actúa: el ataque también se sostiene (128.904 paquetes, 100 bots vivos) y cada bot genera ~27-28 alertas de movimiento. La RAM subió ~700 MB, consistente con la generación de chunks por la exploración de los bots.
- **Enforce.** El proxy desconectó **98 de las 100 sesiones** y el ataque colapsó a los 18,7 s con 35.880 paquetes, una reducción del ~76 % frente a sin proxy. La carga duró solo ~11 s (CPU pico 24 %, RAM plana) antes de volver al reposo: el proxy reduce los paquetes y acorta la ventana de impacto. Cada bot cruzó tanto el límite de tasa de posición (`packet_rate`) como el de desplazamiento (`movement_distance`), y la primera alerta cortó su sesión.

Resultado principal: un ataque distribuido de muchos bots degrada el servicio y expulsa a jugadores reales, y el proxy en *enforce* lo contiene desconectando casi todas las sesiones. El detalle y las cifras intermedias están en [resultados.md](../resultados.md).

## Resistencia del servidor a la caída

Se intentó provocar un cierre del proceso **sin modificar el heap**, con tres vectores —`server_stress` (movimiento, genera chunks), `packet_storm` (inundación estática de `arm_animation`) y `flood` (movimiento con reconexión inmediata)—. Ninguno cerró el proceso. El patrón, en el `latest.log`, es común: el servidor emite `Can't keep up` con el peor caso en **313 ticks (15,6 s) de atraso**, pero el watchdog —que exige un solo *tick* de más de 60 s— nunca se dispara, porque el flood reparte el trabajo en muchos *ticks*. Hay además un efecto autolimitante: al atrasarse, el servidor expulsa a sus propios bots por `Timed out` o `Flying is not enabled` (el movimiento se rechazó 20.656 veces como `moved wrongly`), la carga baja y se recupera.

La conclusión es de resiliencia: el vanilla 26.1 con el heap por defecto **resiste el cierre** frente a floods de nivel de aplicación; el impacto máximo por esta vía es la degradación hasta volver el servicio injugable, que ya es una negación de servicio. Un cierre forzado requeriría un heap reducido o una operación costosa en un solo *tick* (NBT grande con permisos de creativo), fuera del alcance probado. El detalle está en [resultados.md](../resultados.md#resistencia-del-servidor-a-la-caída).

## Costo del registro

El Experimento 4 (medición aislada del costo del registro) queda **fuera del alcance** y se anota en [Limitaciones](05-limitaciones.md). Como indicio indirecto, en el estrés con 100 bots el atacante colocó 149.292 paquetes sin proxy y 128.904 a través del proxy en *observe*, una caída de ~14 % en el volumen que alcanza el mismo envío: sobrecarga apreciable pero no prohibitiva. No es una medición controlada, porque mezcla el costo de reenviar con el de escribir el JSONL; separarlos es lo que haría el Experimento 4.
