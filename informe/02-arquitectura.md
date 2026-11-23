# Diseño del proxy y del IDS

## Visión general

```
 Cliente Minecraft 26.1                Proxy (Node.js)                      Servidor vanilla 26.1
 ──────────────────────   TCP    ┌──────────────────────────────┐   TCP    ──────────────────────
  cuenta autenticada   ────────▶ │ 127.0.0.1:25565               │ ───────▶  127.0.0.1:25566
                       ◀──────── │  · autenticación (Mojang)     │ ◀───────  online-mode=false
                                 │  · reenvío de frames crudos   │
                                 │  · reglas de contenido        │
                                 │  · observador de tasa         │
                                 │  · modo observe / enforce     │
                                 └──────────────┬───────────────┘
                                                │ un registro por línea
                                                ▼
                                   .local/proxy/packets.jsonl
```

**[PENDIENTE: reemplazar por una figura en `figuras/` si se quiere una versión gráfica.]**

El proxy está escrito en Node.js 24 sobre la biblioteca `minecraft-protocol` 1.67.0, la primera que soporta el protocolo 775 de la versión 26.1. Tiene tres módulos:

| Módulo | Responsabilidad |
| --- | --- |
| [`src/proxy.mjs`](../src/proxy.mjs) | Acepta jugadores, abre una conexión al backend por cada uno, reenvía el tráfico y concentra el registro y el modo *enforce* |
| [`src/ids.mjs`](../src/ids.mjs) | Observador de tasa: cuenta paquetes por tipo y sesión en ventanas de un segundo |
| [`src/rules.mjs`](../src/rules.mjs) | Reglas de contenido sobre el paquete ya interpretado |

## Autenticación y conexión con el backend

El proxy escucha en `127.0.0.1:25565` en modo *online*: verifica la cuenta del jugador con los servicios de sesión de Mojang y establece el cifrado con el cliente. Cuando el jugador termina el login, el proxy abre una conexión nueva al backend en `127.0.0.1:25566` y repite el login en nombre del jugador.

El backend corre en `online-mode=false`, así que acepta el nombre que le entrega el proxy sin verificarlo. Para que el mundo reconozca siempre al mismo jugador, el proxy le asigna el **UUID *offline* derivado del nombre**, que es el mismo que calcula el servidor vanilla en ese modo. Como control adicional, el proxy compara el UUID que devuelve el backend con el que espera y corta la sesión si no coinciden. También corta si el backend pide cifrado, porque eso indicaría que quedó en modo *online* por error.

Para los experimentos con el cliente atacante, que no tiene cuenta, el proxy se arranca con `--online false`. En ese caso el proxy tampoco autentica, y cualquier nombre es aceptado.

## Reenvío de paquetes

El proxy **reenvía los bytes originales de cada paquete** (`writeRaw`) en vez de interpretarlos y volver a serializarlos. Lo hace en ambos sentidos y en los estados `configuration` y `play`. La biblioteca igual interpreta cada paquete para entregárselo a las reglas, pero lo que llega al otro extremo es exactamente lo que se recibió. Elegimos este diseño por dos razones:

1. **Fidelidad.** Volver a serializar depende de que la biblioteca conozca cada campo de cada paquete de la versión. Cualquier diferencia se convierte en un paquete distinto al original.
2. **Mínima intervención.** Un control de seguridad no debería cambiar el comportamiento del sistema que protege mientras no haya una infracción.

Esta decisión resultó insuficiente por sí sola. Durante una partida con tres jugadores, dos clientes se desconectaron con `DecoderException` al leer un paquete `set_equipment` que traía 18 bytes de más (ver [tropiezos.md](../tropiezos.md), tropiezo 2). La causa era que el lector de equipamiento de la biblioteca **modifica el búfer que interpreta**, de modo que el proxy reenviaba bytes alterados aunque nunca hubiera pedido serializar nada. La corrección (commit `27a84db`) hace que la biblioteca interprete una copia y que el proxy reenvíe el búfer original intacto. Hay una prueba de regresión en [`src/proxy.test.mjs`](../src/proxy.test.mjs). La lección es que inspeccionar un protocolo sin alterarlo exige verificar también el código de terceros que lo interpreta.

Hay dos detalles más del puente entre jugador y backend:

- La biblioteca trae su propia lógica de configuración y de chat para actuar como servidor. El proxy la desactiva, para que el backend vanilla sea quien envíe los registros de configuración reales y procese el chat.
- Mientras el backend todavía no llega al mismo estado que el jugador, el proxy acumula los paquetes del jugador en un búfer de hasta 256 KB. Si se supera ese tope, corta la sesión.

## Observador de tasa

[`observePlayerPackets`](../src/ids.mjs) se engancha a la sesión cuando el jugador entra al estado `play`. Por cada paquete *serverbound* en `play` emite un registro de tipo `packet` con la hora, un ID de sesión aleatorio, la dirección, el tipo y el tamaño del búfer. **Nunca registra el contenido.**

La regla `packet_rate` es opcional. Recibe un mapa de tipos de paquete a límites (`--rate "arm_animation=60"`) y cuenta los paquetes de cada tipo en **ventanas fijas de un segundo**, medidas con el reloj monotónico del proceso. Cuando un tipo supera su límite dentro de una ventana, emite **una sola alerta** para esa ventana, para no inundar el registro durante un ataque. Los contadores son independientes por sesión, porque cada sesión tiene su propio observador. Sin límites configurados, el observador solo registra, y así se obtuvo la línea base.

## Reglas de contenido

[`createContentRules`](../src/rules.mjs) crea un conjunto de reglas por sesión que inspecciona el paquete ya interpretado antes de que el proxy lo reenvíe:

| Regla | Paquetes | Límite por defecto | Qué detecta |
| --- | --- | --- | --- |
| `packet_size` | Todos en `play` | 32.768 bytes | Paquetes anormalmente grandes, sin importar su tipo |
| `text_length` | `chat_message`, `chat_command`, `chat_command_signed`, `name_item`, `update_sign` | 256 caracteres en total | Texto más largo que lo que permite la interfaz del juego |
| `book_pages` | `edit_book` | 100 páginas | Libros con más páginas que las del juego |
| `book_length` | `edit_book` | 102.400 caracteres | Libros con demasiado texto en total |
| `payload_size` | `custom_payload` | 32.768 bytes | Cargas binarias grandes en canales de datos propios |
| `movement_distance` | `position`, `position_look`, `vehicle_move` | 10 bloques entre paquetes | Teletransporte o desplazamiento imposible |
| `movement_invalid` | `position`, `position_look`, `vehicle_move` | Coordenadas no finitas | `NaN` o infinitos en la posición |

**[PENDIENTE: justificar cada límite con la línea base o con los máximos del juego. Por ejemplo, en una partida normal el máximo observado fue de 20 paquetes `position` por segundo, y el juego limita los libros a 100 páginas.]**

La regla de movimiento necesita estado: recuerda la última posición que envió el jugador y mide la distancia euclidiana hasta la siguiente. Un teletransporte legítimo del servidor, ya sea por un comando, una reaparición o una corrección de posición, haría que el siguiente paquete del cliente pareciera un salto imposible. Para evitarlo, el proxy observa también los paquetes `position`, `respawn` y `login` que envía el servidor (`noteServerMovement`) y reinicia la referencia con ellos.

## Modos observe y enforce

Todas las alertas, tanto las de contenido como las de tasa, pasan por una única función de registro (`record`). La función tiene dos modos:

- **observe** (por defecto): la alerta se escribe en el registro y el paquete se reenvía igual.
- **enforce**: además de la alerta, se escribe un registro de tipo `action` con `action: "disconnect"`, el proxy cierra la sesión con el jugador y con el backend, y deja de reenviar.

En las reglas de contenido, la inspección ocurre **antes** del reenvío, por lo que en *enforce* el paquete infractor nunca llega al backend. En la regla de tasa no ocurre lo mismo: el observador de tasa se registra en la sesión después del manejador que reenvía, así que el paquete que supera el límite ya se reenvió cuando se dispara la alerta. En la práctica el backend recibe como máximo un paquete más que el límite antes del corte (ver [Limitaciones](05-limitaciones.md)).

## Registro JSONL

El registro se abre en modo anexado. Cada evento se escribe como una línea JSON con escritura sincrónica, y si una escritura falla, el registro se detiene sin tumbar el proxy. Hay tres tipos de evento:

```json
{"type":"packet","timestamp":"2026-11-22T00:45:26.534Z","sessionId":"00000000-0000-4000-8000-000000000001","direction":"serverbound","packet":"tick_end","sizeBytes":1}
{"type":"alert","timestamp":"…","sessionId":"…","direction":"serverbound","rule":"movement_distance","packet":"position","blocks":1000,"limit":10}
{"type":"action","timestamp":"…","sessionId":"…","action":"disconnect","rule":"movement_distance","packet":"position"}
```

El primer ejemplo es real, con el ID de sesión reemplazado por uno ficticio. Los otros dos muestran la forma de los campos. **[PENDIENTE: reemplazarlos por líneas reales de una corrida de ataque.]** Las horas están en UTC. El ID de sesión es un UUID aleatorio por conexión: si un jugador se reconecta, recibe un ID nuevo.

## Configuración

| Opción | Variable de entorno equivalente | Valor por defecto |
| --- | --- | --- |
| `--online true\|false` | `MINECRAFT_PROXY_ONLINE` | `true` |
| `--mode observe\|enforce` | `MINECRAFT_PROXY_MODE` | `observe` |
| `--rate "tipo=límite,…"` | `MINECRAFT_IDS_LIMITS` (JSON) | Sin límites |
| — | `MINECRAFT_CONTENT_LIMITS` (JSON) | Los de la tabla de reglas |
| `--log <ruta>` | — | `.local/proxy/packets.jsonl` |
| `--no-record` | — | Registro activado |

Las opciones de la línea de comandos tienen precedencia sobre las variables de entorno. Se agregaron porque en Windows la sintaxis para definir variables de entorno cambia según la terminal, y escapar JSON en CMD dificultaba configurar las corridas de ataque.

## Pruebas automatizadas

Hay 10 pruebas unitarias con `node:test` que se ejecutan con `npm test`, y todas pasan:

| Archivo | Pruebas | Qué cubren |
| --- | ---: | --- |
| [`src/ids.test.mjs`](../src/ids.test.mjs) | 2 | Solo se registra el estado `play` y nunca el contenido; el observador se desengancha al cerrar la sesión; las alertas son por tipo, sesión y ventana, y no se repiten |
| [`src/rules.test.mjs`](../src/rules.test.mjs) | 7 | Cada regla de contenido, el reinicio de la referencia ante un teletransporte del servidor, las coordenadas no finitas y la validación de los límites |
| [`src/proxy.test.mjs`](../src/proxy.test.mjs) | 1 | Regresión del bug de `set_equipment`: el búfer reenviado es idéntico al original |
