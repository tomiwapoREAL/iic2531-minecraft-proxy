# Resultados del laboratorio

## Primera captura de juego por el proxy

**Fecha local** 21 de noviembre de 2026 (Santiago)

**Entorno** Minecraft Java 26.1 conectado al proxy en `127.0.0.1:25565`, con servidor vanilla 26.1 en `127.0.0.1:25566`.

**Fuente** Registros de tipo `packet` de una sesión en `.local/proxy/packets.jsonl`.

La captura contiene **4.222 paquetes del cliente de 15 tipos**. `tick_end` representa el 81,2 % del total. También se observaron paquetes de posición y orientación, interacción con bloques y cierre de inventario.

| Tipo de paquete | Cantidad |
| --- | ---: |
| `tick_end` | 3.430 |
| `position` | 240 |
| `look` | 192 |
| `chunk_batch_received` | 132 |
| `position_look` | 72 |
| `player_input` | 68 |
| `arm_animation` | 56 |
| `keep_alive` | 11 |
| `block_dig` | 8 |
| `held_item_slot` | 4 |
| `block_place` | 4 |
| `flying` | 2 |
| `close_window` | 1 |
| `player_loaded` | 1 |
| `teleport_confirm` | 1 |
| **Total** | **4.222** |

### Ejemplo de registro

El ID de sesión se sustituyó por un valor de ejemplo.

```json
{"type":"packet","timestamp":"2026-11-22T00:45:26.534Z","sessionId":"00000000-0000-4000-8000-000000000001","direction":"serverbound","packet":"tick_end","sizeBytes":1}
```

La hora del JSONL está en UTC. Esta línea se registró el 21 de noviembre a las 21:45:26.534 en Santiago. El tamaño corresponde al búfer del paquete entregado por `minecraft-protocol` al observador en el estado `play`.

El recuento confirma que el registro funcionó durante una partida real. Quedan pendientes las repeticiones con juego normal y la comparación entre conexión directa, proxy sin registro y proxy con registro.

### Tasa de paquetes de posición en juego normal

La consulta agrupó los paquetes `position` de la misma sesión por segundo UTC. El máximo observado fue **20 paquetes en un segundo**.

| Segundo UTC | Paquetes `position` |
| --- | ---: |
| 2026-11-22 00:59:42 | 20 |
| 2026-11-22 00:59:49 | 20 |
| 2026-11-22 00:58:02 | 20 |
| 2026-11-22 00:58:40 | 20 |
| 2026-11-22 00:59:13 | 20 |

La tabla usa cortes por segundo UTC. Las ventanas del IDS se basan en el reloj monotónico del proxy y sus cortes pueden caer en instantes distintos. El máximo observado de 20 paquetes `position` queda como referencia para comparar sesiones. La próxima captura se hará con el observador activo y las alertas desactivadas.

## Consulta de sesiones tras la partida con amigos

**Fecha y zona horaria** 21 de noviembre de 2026 (Santiago)

**Partida** Jugaron tres personas en total, incluido Tomás, aproximadamente entre las 22:09 y las 22:31. Durante la partida, Playit apuntaba al proxy en `127.0.0.1:25565`.

**Fuente** Las ocho sesiones más recientes por hora del último paquete en `.local/proxy/packets.jsonl`. Los IDs se muestran abreviados a sus primeros ocho caracteres.

| Sesión | Primer paquete | Último paquete | Paquetes |
| --- | --- | --- | ---: |
| `42a876d2` | 22:31:53 | 22:31:58 | 245 |
| `0c857a0b` | 22:31:52 | 22:31:52 | 3 |
| `dd133361` | 22:31:47 | 22:31:47 | 5 |
| `472d76cb` | 22:31:35 | 22:31:38 | 107 |
| `af66edb9` | 22:31:35 | 22:31:38 | 198 |
| `5b319549` | 22:31:24 | 22:31:28 | 184 |
| `b61bac02` | 22:31:24 | 22:31:24 | 8 |
| `269c0522` | 22:09:31 | 22:31:16 | 51.641 |

La sesión más larga abarcó 21 minutos y 45 segundos entre el primer y el último paquete. Dos sesiones registraron paquetes entre las 22:31:35 y las 22:31:38, lo que muestra actividad concurrente en el proxy. Un jugador que se reconecta recibe otro ID de sesión.

### Recuento del intervalo completo

La consulta abarcó desde las 22:09:00 hasta antes de las 22:32:00, hora de Santiago. En ese intervalo se registraron **72.338 paquetes en 10 sesiones de conexión**.

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

El mayor solapamiento observado fue de **dos sesiones**. La conexión `269c0522` coincidió con `2319d935` entre las 22:23:41.698 y las 22:29:18.505, y luego con `04cf0211` entre las 22:29:31.489 y las 22:31:15.790. Más tarde también se solaparon `af66edb9` y `472d76cb` entre las 22:31:35.978 y las 22:31:38.347. Estos intervalos se calculan entre el primer y el último paquete observado de cada conexión.
