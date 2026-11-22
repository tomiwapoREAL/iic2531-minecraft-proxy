# Tropiezos del desarrollo

## Tropiezo 1 · Primera prueba manual del proxy con el registro vacío

**Usuario** `@tomiwapoREAL`

**Fecha y hora del registro** 21 de noviembre de 2026 a las 21:38 CLST (Santiago)

**Estado** Resuelto. La repetición por el puerto del proxy produjo registros JSONL de una sesión real.

### Qué se probó

El objetivo era entrar con Minecraft Java 26.1 a través del proxy y comprobar que el IDS guardara los paquetes de una partida. Tomás entró al mundo, caminó, colocó bloques, abrió el inventario y se desconectó. Luego cerró el proxy y el servidor.

### Qué falló

Al revisar el archivo `.local/proxy/packets.jsonl` después de la partida, PowerShell mostró una salida vacía. Se esperaba encontrar una línea JSON por cada paquete que el IDS observara durante el juego. La prueba automatizada anterior había generado 64 registros en memoria con las alertas desactivadas. La captura manual era la comprobación pendiente de escritura en disco.

En la primera partida quedó por confirmar qué puerto usó el cliente y si el proxy abrió el archivo de registro esperado. Una conexión directa al backend en `127.0.0.1:25566` permite jugar y queda fuera del registro del IDS.

### Archivos involucrados

- `src/proxy.mjs` escucha en `25565`, reenvía al backend en `25566` y conecta el observador al evento `playerJoin`. Su función `onRecord` escribe cada registro como una línea JSON.
- `src/ids.mjs` observa los paquetes del jugador en el estado `play` y entrega los metadatos de cada paquete a `onRecord`.
- `.local/proxy/packets.jsonl` es el archivo de destino que salió vacío en la comprobación posterior a la partida.
- `.local/server/server.properties` configura el backend vanilla en `127.0.0.1:25566`. Ese puerto permite una conexión directa que pasa fuera del proxy.
- `src/ids.test.mjs` verifica en memoria el registro y las alertas del observador. La escritura del archivo corresponde a `src/proxy.mjs`.

### Comprobación planteada

En una partida corta, conectarse por `127.0.0.1:25565`, verificar que la consola muestre la ruta de registro y confirmar una conexión TCP establecida en ese puerto mientras el jugador está en el mundo. Si el tamaño del JSONL sigue en cero durante esa conexión, revisar cuándo se instala el observador y si el proxy informa un error al escribir.

### Comprobación de seguimiento

La primera salida de Windows mostró `127.0.0.1:25565` en estado `LISTENING` con PID `44852`. `packets.jsonl` seguía con `Length = 0` y tenía como última modificación el 21 de noviembre de 2026 a las 21:16:59.

La segunda salida mostró una conexión `ESTABLISHED` entre `127.0.0.1:56574` (PID `38012`) y el backend `127.0.0.1:25566` (PID `9932`). El puerto del proxy `25565` solo figuraba en `LISTENING`. La conexión observada llegó directamente al backend y por esa ruta el IDS no recibe paquetes.

### Resolución

Tras repetir la conexión por `127.0.0.1:25565`, PowerShell mostró tres registros `tick_end` en `.local/proxy/packets.jsonl`. Los tres pertenecían a la misma sesión, tenían dirección `serverbound` y registraban un tamaño de 1 byte. La última marca de tiempo fue `2026-11-22T00:45:26.534Z`, que corresponde al 21 de noviembre de 2026 a las 21:45:26.534 en Santiago. La prueba confirmó que el proxy recibió paquetes del cliente durante el juego y que el IDS escribió sus metadatos en disco.

## Tropiezo 2 · Desconexiones al final de la partida con amigos

**Usuario** `@tomiwapoREAL`

**Fecha y hora del incidente** 21 de noviembre de 2026, alrededor de las 22:31 (Santiago)

**Estado** El cliente rechazó un paquete de equipamiento. El origen de los bytes sobrantes sigue en diagnóstico.

### Qué pasó

Durante la partida de tres jugadores por Playit hacia el proxy, Tomás percibió algo de lag. Según su impresión, sus amigos jugaron con normalidad durante ese tramo. Al final se desconectaron él y un amigo. Tomás recordó un mensaje que mencionaba paquetes y equipamiento.

### Qué muestran los registros

El log del servidor registró cierres repetidos de dos jugadores entre las 22:29:18 y las 22:31:58. A las 22:31:38 registró la desconexión de ambos. Los cierres de las 22:31:15, 22:31:16 y 22:31:38 coinciden al segundo con el último paquete de sesiones de la captura del proxy. Las líneas compartidas dan el motivo genérico `Disconnected`. La causa del cierre y su relación con el lag siguen en diagnóstico.

### Archivos involucrados

- `.local/server/logs/latest.log` registró las horas de las desconexiones y el motivo `Disconnected`.
- `.local/proxy/packets.jsonl` contiene los últimos paquetes observados de las sesiones. Sus marcas de tiempo permiten cruzar los cierres con el registro del servidor.
- `src/proxy.mjs` reenvía los paquetes entre Minecraft y el servidor vanilla. El flujo pendiente de revisar es el reenvío del servidor al cliente.
- El `latest.log` del perfil `Security Craft` de Modrinth registró las tres excepciones en `C:\Users\tomif\AppData\Roaming\ModrinthApp\profiles\Security Craft\logs`.

### Evidencia del cliente

El `latest.log` del perfil de Modrinth contiene el mismo error en las líneas 198, 202 y 205. Ocurrió a las 22:31:24, 22:31:38 y 22:31:52 del 21 de noviembre. Esos tres segundos coinciden con desconexiones de Tomás en el registro del servidor.

> `DecoderException: java.io.IOException: Packet play/clientbound/minecraft:set_equipment (ClientboundSetEquipmentPacket) was larger than I expected, found 18 bytes extra whilst reading packet clientbound/minecraft:set_equipment`

`clientbound` indica que el paquete viajaba del servidor al cliente. El motivo inmediato quedó identificado en el cliente de Tomás. Queda por determinar por qué sobraban esos 18 bytes y si el amigo recibió la misma excepción.
