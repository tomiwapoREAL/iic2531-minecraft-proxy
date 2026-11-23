# Diseño del proxy y del IDS

> **Notas para quien escribe**
>
> - Esta sección pesa en el criterio de profundidad técnica (25 %). Explica las decisiones de diseño y su porqué, no solo qué hace cada archivo.
> - Incluye un diagrama: cliente → proxy `127.0.0.1:25565` → backend vanilla `127.0.0.1:25566`, con el IDS y el registro JSONL colgando del proxy. Guárdalo en [figuras/](figuras/).
> - Fuentes en el código:
>   - [src/proxy.mjs](../src/proxy.mjs):
>     - autenticación con Mojang en el proxy y backend en offline con el UUID derivado del nombre;
>     - reenvío de frames crudos con `writeRaw` en `configuration` y `play`, en ambos sentidos;
>     - búfer de configuración de hasta 256 KB;
>     - punto único de registro `record()`;
>     - modo enforce: desconecta y no reenvía el paquete infractor;
>     - flags de línea de comandos.
>   - [src/ids.mjs](../src/ids.mjs): regla de tasa por tipo de paquete y sesión, en ventanas fijas de 1 s con reloj monotónico. Emite una sola alerta por ventana y registra solo metadatos, nunca el contenido.
>   - [src/rules.mjs](../src/rules.mjs):
>     - reglas de contenido: `packet_size`, `text_length`, `book_pages`, `book_length`, `payload_size`, `movement_distance` y `movement_invalid`;
>     - el reinicio de la referencia de movimiento con `noteServerMovement`, para no confundir un teletransporte legítimo con un salto imposible.
> - Explica por qué reenviamos bytes crudos en vez de volver a serializar: se pierde menos fidelidad y se modifica menos el tráfico. Conecta esto con el bug de equipamiento ([tropiezos.md](../tropiezos.md), tropiezo 2, y el commit `27a84db`). El intérprete de la biblioteca modificaba el búfer y el cliente recibía 18 bytes de más. Es un buen ejemplo de que inspeccionar no debe alterar el tráfico.
> - Incluye una tabla con todas las reglas: nombre, paquetes que mira, límite por defecto y justificación del límite (por ejemplo, el máximo de 20 `position` por segundo observado en la línea base).

## Visión general

**[PENDIENTE: diagrama + párrafo]**

## Autenticación y conexión con el backend

**[PENDIENTE]**

## Reenvío de paquetes

**[PENDIENTE]**

## Observador de tasa

**[PENDIENTE]**

## Reglas de contenido

| Regla | Paquetes | Límite por defecto | Justificación |
| --- | --- | --- | --- |
| `packet_rate` | Configurable con `--rate` | Sin límite (línea base) | **[PENDIENTE]** |
| `packet_size` | Todos en `play` | 32.768 bytes | **[PENDIENTE]** |
| `text_length` | `chat_message`, `chat_command`, `chat_command_signed`, `name_item`, `update_sign` | 256 caracteres | **[PENDIENTE]** |
| `book_pages` | `edit_book` | 100 páginas | **[PENDIENTE]** |
| `book_length` | `edit_book` | 102.400 caracteres | **[PENDIENTE]** |
| `payload_size` | `custom_payload` | 32.768 bytes | **[PENDIENTE]** |
| `movement_distance` | `position`, `position_look`, `vehicle_move` | 10 bloques entre paquetes | **[PENDIENTE]** |
| `movement_invalid` | `position`, `position_look`, `vehicle_move` | Coordenadas no finitas | **[PENDIENTE]** |

## Modos observe y enforce

**[PENDIENTE]**

## Registro JSONL

**[PENDIENTE: formato de un registro `packet`, `alert` y `action`, con un ejemplo de cada uno]**
