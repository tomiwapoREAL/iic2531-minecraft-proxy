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

## Evaluación de ataques

Esta sección reúne dos mitades complementarias. La validación de detección
comprueba que las reglas disparan y que el modo enforce desconecta. El impacto
sobre el servidor vanilla mide la consecuencia real del ataque y cuánto la
contiene el proxy. La primera se corrió en un entorno controlado; la segunda
requiere el servidor vanilla 26.1 y queda pendiente de ejecutar.

### Validación de detección

**Entorno** Las corridas se hicieron con `src/attacker.mjs` contra el proxy en
`127.0.0.1:25565`, con un backend de prueba en JavaScript (`minecraft-protocol`
`createServer`) en lugar del servidor vanilla. Este montaje valida la lógica de
las reglas, que es independiente del backend: el proxy inspecciona el payload ya
interpretado de los paquetes serverbound antes de reenviarlos. No mide impacto
sobre un servidor real; eso corresponde a la sección siguiente.

Límites de la corrida: regla de tasa `arm_animation=60` por segundo; tamaño de
paquete y de `custom_payload` 32.768 bytes; libro 102.400 caracteres;
desplazamiento 10 bloques entre paquetes de posición.

| Ataque | Carga enviada | Alertas en observe | Resultado en enforce |
| --- | --- | --- | --- |
| Inundación de paquetes | 400 `arm_animation` | `packet_rate` ×1 | alerta y desconexión |
| Movimiento imposible | 11 `position`, saltos de 1.000 bloques | `movement_distance` ×10 | alerta y desconexión |
| Carga sobredimensionada | `custom_payload` de 200 KB y libro de 300.000 caracteres | `packet_size` ×2, `payload_size` ×1, `book_length` ×1 | alerta y desconexión |
| Inundación de login | 20 conexiones en ráfaga | sin alerta | sin alerta |

En observe el proxy registra cada infracción y sigue reenviando: el movimiento
imposible produjo una alerta por cada salto y la carga sobredimensionada disparó
las tres reglas de tamaño. En enforce la primera alerta registra una acción
`disconnect` y corta la sesión sin reenviar el paquete infractor, por lo que se
observa una sola alerta por ataque.

**Limitación conocida** La inundación de login no genera ninguna alerta. El
conjunto actual de reglas no incluye una tasa de conexiones nuevas, y el propio
proxy es el recurso que absorbe esa carga. Queda como trabajo futuro una regla
de tasa por dirección de origen o por ventana de conexiones.

### Impacto sobre el servidor vanilla

Objetivo: mostrar que un ataque degrada el servidor vanilla 26.1 y si el proxy
lo contiene. Metricas medibles en vanilla sin plugins: CPU% pico y RAM del
proceso Java (muestreo por segundo), avisos `Can't keep up` y desconexion del
jugador en la consola, y las alertas del proxy desde su JSONL con
`scripts/analizar-registro.mjs`. El vanilla no expone TPS, por lo que no se usa.

Los cuatro ataques puntuales (inundacion de paquetes, movimiento imposible,
carga sobredimensionada, inundacion de login) no mueven de forma apreciable la
carga del servidor: un solo cliente no satura el hilo principal. Su valor es la
deteccion, ya registrada en la seccion de validacion. El unico ataque con
impacto material sobre el servidor es el estres con bots concurrentes, de modo
que la tabla de impacto se centra en el.

| Ataque | Condicion | CPU% pico | RAM max | `Can't keep up` / caida | Alertas proxy | Disconnect |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| server_stress (100 bots, 45 s) | sin proxy | 47% | ~2.024 MB | jugador desconectado | — | — |
| server_stress (100 bots, 45 s) | observe | | | | | — |
| server_stress (100 bots, 45 s) | enforce | | | | | |
| Ataques puntuales | cualquiera | ~reposo | plano | no | ver validacion | ver validacion |

La fila sin proxy proviene del muestreo documentado mas abajo. Faltan observe y
enforce: se completan corriendo el mismo ataque con el proxy en cada modo, con
el muestreo de CPU/RAM en paralelo y leyendo las alertas del JSONL. Hipotesis:
en enforce el proxy no detiene el ataque, porque cada bot se mantiene bajo los
umbrales por conexion; la corrida lo confirma o lo refuta.

### Estres con bots concurrentes

**Fecha** 23 de noviembre de 2026. **Entorno** Cliente atacante `server_stress`
directo al servidor vanilla 26.1 en `127.0.0.1:25566` (sin proxy), en la maquina
anfitriona, con un jugador legitimo conectado en paralelo.

**Salida del atacante** (medido, `src/attacker.mjs`):

| Metrica | Valor |
| --- | ---: |
| Bots lanzados | 100 |
| Bots que entraron (`joined`) | 100 |
| Bots vivos al final (`vivosAlFinal`) | 98 |
| Paquetes enviados | 149.292 |
| Duracion | 45,0 s |
| Tasa agregada | ~3.300 paquetes/s |

Los 100 bots entraron, lo que indica que el servidor anfitrion no aplicaba el
limite de 20 jugadores de la copia de laboratorio. La perdida de solo 2 bots
muestra que el ataque se sostuvo durante los 45 s.

**Efecto observado** (observacion directa del equipo, no de un registro
verificado en este documento): lag severo en el servidor durante el ataque y
desconexion del jugador legitimo mientras los bots operaban. Corresponde a una
negacion de servicio a un usuario real.

**Consumo del proceso Java** (medido en la maquina anfitriona, muestreo por
segundo del proceso `java`):

| Fase | CPU% del total | RAM |
| --- | ---: | ---: |
| Reposo (antes) | ~1% | ~2.022 MB |
| Durante el ataque | 30-47% sostenido, pico 47% | ~2.024 MB |
| Reposo (despues) | ~1% | ~2.024 MB |

La CPU subio de ~1% a un rango sostenido de 30-47% durante ~42 s (18:17:06 a
18:17:48) y volvio a ~1% al terminar, enmarcada por reposo antes y despues: la
carga coincide con la ventana del ataque. La RAM se mantuvo plana (+2 MB), por
lo que el ataque esta ligado al procesamiento (CPU), no al consumo de memoria.

El pico de 47% no satura el total de la CPU, pero el servidor de Minecraft
procesa los ticks en un solo hilo; un nucleo saturado no se refleja como 100%
del total, de modo que el porcentaje agregado subestima la saturacion real del
hilo principal, que es lo que produce el lag y la desconexion del jugador.

**Evidencia aun pendiente** (opcional, refuerza el mecanismo): el `latest.log`
del servidor anfitrion durante la ventana del ataque, para registrar la
desconexion del jugador con su marca de tiempo junto a estas mediciones.

**Limitacion del proxy frente a este ataque.** Cada bot se mantiene por debajo
de los umbrales por conexion (su tasa individual no supera los limites de
`arm_animation` ni de movimiento), por lo que las reglas actuales no lo
detienen. Es el mismo vacio de la inundacion de login: el rate-limiting por
conexion no cubre un ataque distribuido entre muchas sesiones. Una defensa
efectiva requeriria una regla agregada (conexiones nuevas o paquetes por ventana
sumando todas las sesiones).
