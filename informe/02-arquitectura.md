# Diseño del proxy y del IDS

## Visión general

![Arquitectura del proxy defensivo. Los paquetes del cliente al servidor se interpretan sobre una copia, pasan por las reglas de contenido, se reenvían intactos y después pasan por el observador de tasa. Todas las alertas llegan a `record()`, que las escribe en el JSONL y, en modo enforce, corta la sesión. El tráfico del servidor al cliente se reenvía sin reglas, pero sus teletransportes reinician la referencia de movimiento. En rojo, el acceso directo al backend que el IDS no ve.](figuras/arquitectura.png)

Al conectarse, el jugador se autentica con Mojang a través del proxy, y el proxy entra al backend en su nombre. Ya en el juego, cada paquete que envía el cliente sigue los cuatro pasos numerados de la figura; el tráfico que vuelve del servidor se reenvía sin reglas. La flecha roja marca el supuesto que el laboratorio no garantiza: el backend también acepta conexiones que no pasan por el proxy.

El proxy está escrito en Node.js 24 sobre `minecraft-protocol` 1.67.0, la primera que soporta el protocolo 775 de la 26.1. Tiene tres módulos:

| Módulo | Responsabilidad |
| --- | --- |
| [`src/proxy.mjs`](../src/proxy.mjs) | Acepta jugadores, abre una conexión al backend por cada uno, reenvía el tráfico y concentra el registro y el modo *enforce* |
| [`src/ids.mjs`](../src/ids.mjs) | Observador de tasa: cuenta paquetes por tipo y sesión en ventanas de un segundo |
| [`src/rules.mjs`](../src/rules.mjs) | Reglas de contenido sobre el paquete ya interpretado |

## Autenticación y conexión con el backend

El proxy escucha en `127.0.0.1:25565` en modo *online*: verifica la cuenta del jugador con los servicios de sesión de Mojang y cifra la conexión con el cliente. Al terminar el login, abre una conexión nueva al backend en `127.0.0.1:25566` y repite el login en nombre del jugador. El backend corre en `online-mode=false`, así que acepta el nombre sin verificarlo; para que el mundo reconozca siempre al mismo jugador, el proxy le asigna el **UUID *offline* derivado del nombre** (el que calcula el vanilla en ese modo). Como control, compara el UUID que devuelve el backend con el esperado y corta la sesión si no coinciden, o si el backend pide cifrado (indicaría que quedó en *online* por error).

Para los experimentos con el cliente atacante, que no tiene cuenta, el proxy se arranca con `--online false`: no autentica y acepta cualquier nombre.

## Reenvío de paquetes

El proxy **reenvía los bytes originales de cada paquete** (`writeRaw`) en vez de interpretarlos y volver a serializarlos, en ambos sentidos y en los estados `configuration` y `play`. La biblioteca igual interpreta cada paquete para entregárselo a las reglas, pero lo que llega al otro extremo es exactamente lo recibido. Las razones son dos: **fidelidad** (volver a serializar depende de que la biblioteca conozca cada campo de la versión; cualquier diferencia produce un paquete distinto) y **mínima intervención** (un control de seguridad no debería cambiar el sistema que protege mientras no haya infracción).

La decisión fue insuficiente por sí sola. En la partida con tres jugadores, dos clientes se desconectaron con `DecoderException` al leer un `set_equipment` con 18 bytes de más ([tropiezos.md](../tropiezos.md), tropiezo 2): el lector de equipamiento de la biblioteca **modifica el búfer que interpreta**, de modo que el proxy reenviaba bytes alterados aunque nunca pidiera serializar. La corrección (commit `27a84db`) hace que la biblioteca interprete una copia y el proxy reenvíe el búfer original intacto; hay una prueba de regresión en [`src/proxy.test.mjs`](../src/proxy.test.mjs). La lección: inspeccionar un protocolo sin alterarlo exige verificar también el código de terceros que lo interpreta.

Dos detalles más del puente: el proxy desactiva la lógica propia de configuración y chat de la biblioteca, para que el backend vanilla envíe los registros reales y procese el chat; y mientras el backend no alcanza el estado del jugador, acumula sus paquetes en un búfer de hasta 256 KB, cortando la sesión si se supera.

## Observador de tasa

[`observePlayerPackets`](../src/ids.mjs) se engancha al entrar al estado `play`. Por cada paquete *serverbound* en `play` emite un registro `packet` con la hora, un ID de sesión aleatorio, la dirección, el tipo y el tamaño del búfer. **Nunca registra el contenido.**

La regla `packet_rate` es opcional: recibe un mapa de tipos a límites (`--rate "arm_animation=60"`) y cuenta los paquetes de cada tipo en **ventanas fijas de un segundo** del reloj monotónico del proceso. Al superar el límite emite **una sola alerta** por ventana, para no inundar el registro. Los contadores son por sesión. Sin límites, el observador solo registra, y así se obtuvo la línea base.

## Reglas de contenido

[`createContentRules`](../src/rules.mjs) crea reglas por sesión que inspeccionan el paquete ya interpretado antes del reenvío:

| Regla | Paquetes | Límite por defecto | Qué detecta |
| --- | --- | --- | --- |
| `packet_size` | Todos en `play` | 32.768 bytes | Paquetes anormalmente grandes |
| `text_length` | `chat_message`, `chat_command`, `chat_command_signed`, `name_item`, `update_sign` | 256 caracteres | Texto más largo que el de la interfaz |
| `book_pages` | `edit_book` | 100 páginas | Libros con más páginas que las del juego |
| `book_length` | `edit_book` | 102.400 caracteres | Libros con demasiado texto |
| `payload_size` | `custom_payload` | 32.768 bytes | Cargas binarias grandes en canales propios |
| `movement_distance` | `position`, `position_look`, `vehicle_move` | 10 bloques entre paquetes | Teletransporte o desplazamiento imposible |
| `movement_invalid` | `position`, `position_look`, `vehicle_move` | Coordenadas no finitas | `NaN` o infinitos en la posición |

Los límites se fijan desde la línea base y los máximos del propio juego, con holgura para no afectar el juego normal: **`book_pages` (100)** es el máximo de un libro vanilla; **`text_length` (256)** y **`book_length` (102.400)** acotan chat y libros muy por encima de su uso normal; **`packet_size` y `payload_size` (32.768 bytes)** dejan amplio margen sobre el tráfico normal (de pocos a cientos de bytes); **`movement_distance` (10 bloques)** es inalcanzable por movimiento físico entre dos paquetes consecutivos. La regla de tasa se calibra aparte: la línea base dio un máximo de 20 `position`/s, por lo que el límite de 40 de la evaluación deja el doble de margen.

La regla de movimiento necesita estado: recuerda la última posición y mide la distancia euclidiana a la siguiente. Un teletransporte legítimo del servidor (comando, reaparición, corrección) haría parecer el siguiente paquete un salto imposible, así que el proxy observa también los `position`, `respawn` y `login` del servidor (`noteServerMovement`) y reinicia la referencia con ellos.

## Modos observe y enforce

Todas las alertas pasan por una única función de registro (`record`), con dos modos:

- **observe** (por defecto): la alerta se escribe y el paquete se reenvía igual.
- **enforce**: además se escribe un registro `action` con `action: "disconnect"`, el proxy cierra la sesión con el jugador y el backend y deja de reenviar.

En las reglas de contenido la inspección ocurre **antes** del reenvío, así que en *enforce* el paquete infractor nunca llega al backend. En la regla de tasa no: el observador se registra después del manejador que reenvía, así que el paquete que supera el límite ya se reenvió al dispararse la alerta. En la práctica el backend recibe como máximo un paquete más que el límite antes del corte (ver [Limitaciones](05-limitaciones.md)).

## Registro JSONL

El registro se abre en modo anexado. Cada evento es una línea JSON con escritura sincrónica, y si una escritura falla, el registro se detiene sin tumbar el proxy. Hay tres tipos de evento:

```json
{"type":"packet","timestamp":"2026-11-22T00:45:26.534Z","sessionId":"00000000-0000-4000-8000-000000000001","direction":"serverbound","packet":"tick_end","sizeBytes":1}
{"type":"alert","timestamp":"…","sessionId":"…","direction":"serverbound","rule":"movement_distance","packet":"position","blocks":1000,"limit":10}
{"type":"action","timestamp":"…","sessionId":"…","action":"disconnect","rule":"movement_distance","packet":"position"}
```

El primer ejemplo es real (con el ID de sesión reemplazado); los otros dos muestran la forma de `alert` y `action`. En la corrida de estrés en *enforce*, estos dos tipos se produjeron 308 y 98 veces: cada bot generó alertas de `packet_rate` y `movement_distance`, y la primera cortó su sesión con un evento `action`. Las horas están en UTC; el ID de sesión es un UUID aleatorio por conexión, de modo que una reconexión recibe un ID nuevo.

## Configuración

| Opción | Variable de entorno | Valor por defecto |
| --- | --- | --- |
| `--online true\|false` | `MINECRAFT_PROXY_ONLINE` | `true` |
| `--mode observe\|enforce` | `MINECRAFT_PROXY_MODE` | `observe` |
| `--rate "tipo=límite,…"` | `MINECRAFT_IDS_LIMITS` (JSON) | Sin límites |
| — | `MINECRAFT_CONTENT_LIMITS` (JSON) | Los de la tabla de reglas |
| `--log <ruta>` | — | `.local/proxy/packets.jsonl` |
| `--no-record` | — | Registro activado |

La línea de comandos tiene precedencia sobre las variables de entorno; se agregó porque en Windows la sintaxis de variables cambia según la terminal y escapar JSON en CMD dificultaba configurar las corridas.

## Pruebas automatizadas

Hay 10 pruebas unitarias con `node:test` (`npm test`), y todas pasan:

| Archivo | Pruebas | Qué cubren |
| --- | ---: | --- |
| [`src/ids.test.mjs`](../src/ids.test.mjs) | 2 | Solo se registra `play` y nunca el contenido; el observador se desengancha al cerrar; las alertas son por tipo, sesión y ventana, sin repetirse |
| [`src/rules.test.mjs`](../src/rules.test.mjs) | 7 | Cada regla de contenido, el reinicio de la referencia ante un teletransporte del servidor, las coordenadas no finitas y la validación de los límites |
| [`src/proxy.test.mjs`](../src/proxy.test.mjs) | 1 | Regresión del bug de `set_equipment`: el búfer reenviado es idéntico al original |
