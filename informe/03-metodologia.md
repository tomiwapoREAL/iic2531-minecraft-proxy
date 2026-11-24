# Metodología

## Entorno de laboratorio

Todas las pruebas se hicieron en una sola máquina con Windows; el proxy y el backend escuchan solo en `127.0.0.1`.

| Componente | Versión |
| --- | --- |
| Sistema operativo | Windows x64, compilación 26200 |
| Node.js y npm | 24.16.0 y 11.13.0 |
| Java del servidor | Microsoft OpenJDK 25.0.5.1+2-LTS |
| Servidor | Minecraft Java vanilla 26.1, SHA-1 `3872a7f07a1a595e651aef8b058dfc2bb3772f46` |
| Biblioteca de protocolo | `minecraft-protocol` 1.67.0 (protocolo 775) |

[`scripts/prepare-server.ps1`](../scripts/prepare-server.ps1) descarga el servidor desde el manifiesto oficial de Mojang y OpenJDK 25 desde Microsoft, verifica sus hashes (SHA-1 del JAR, SHA-256 del JDK) y los instala localmente sin tocar el `PATH`, de modo que todo el equipo obtiene los mismos binarios. El backend se configura con `server-ip=127.0.0.1`, `server-port=25566`, `online-mode=false`, `enforce-secure-profile=false`, sin *query* ni RCON; [`scripts/start-server.ps1`](../scripts/start-server.ps1) se niega a arrancar si la IP, el puerto o la versión de Java no son esos. El servidor arranca con entre 512 MB y 2 GB de memoria.

## Experimento 1 · Línea base de tráfico normal

**Objetivo.** Conocer qué paquetes produce una partida normal y con qué frecuencia, antes de definir límites.

**Procedimiento.** Un integrante entró con el cliente oficial 26.1 y cuenta autenticada a través del proxy (`127.0.0.1:25565`), en *observe* y sin límites; durante la sesión se quedó quieto, caminó, colocó y rompió bloques y abrió el inventario. Los registros se analizaron con consultas de PowerShell, agrupando por tipo de paquete y, para `position`, por segundo UTC ([historia.md](../historia.md), pasos 5-9). Más tarde se repitió en una partida más larga, con tres personas y conexiones externas por un túnel de Playit hacia el proxy, contando paquetes, duración y solapamiento de las sesiones (pasos 10-11).

**Mediciones.** Paquetes por tipo y proporción; máximo de `position` en un segundo; número, duración y solapamiento de las sesiones.

**Nota.** Las consultas agrupan por segundo UTC, mientras que el IDS usa ventanas del reloj monotónico del proceso; los cortes no coinciden, así que el máximo por segundo de la línea base es una referencia, no lo que vería exactamente la regla de tasa.

## Experimento 2 · Validación de la detección

**Objetivo.** Comprobar que cada regla se dispara frente a su patrón y que *enforce* desconecta al atacante.

**Procedimiento.** Cada ataque de [`src/attacker.mjs`](../src/attacker.mjs) se corrió contra el proxy (`--online false`, porque el atacante no tiene cuenta), una vez en *observe* y otra en *enforce*. Como backend se usó un servidor de prueba escrito con `minecraft-protocol`: este montaje valida la lógica de las reglas, que no depende del backend, pero **no mide el efecto sobre un servidor real**.

| Ataque | Carga enviada |
| --- | --- |
| Inundación de paquetes | 400 `arm_animation` seguidos |
| Movimiento imposible | 11 `position` con saltos de 1.000 bloques |
| Carga sobredimensionada | Un `custom_payload` de 200 KB y un libro de 300.000 caracteres |
| Inundación de login | 20 conexiones en ráfaga |

**Límites.** Tasa de `arm_animation` de 60/s; el resto con los valores por defecto (paquete y `custom_payload` 32.768 bytes, libro 102.400 caracteres, desplazamiento 10 bloques). **Mediciones.** Alertas por regla en *observe*, y si hubo alerta y desconexión en *enforce*, según el JSONL del proxy y el resumen del atacante.

## Experimento 3 · Impacto de los ataques sobre el servidor vanilla

**Estado: ejecutado** (una corrida por condición; resultados en [Resultados](04-resultados.md#impacto-sobre-el-servidor-vanilla)).

**Objetivo.** Medir si los ataques degradan o tumban el vanilla 26.1 sin proxy, y cuánto contiene ese efecto el proxy.

**Condiciones (por ataque).** (1) **Sin proxy**: el atacante va directo al backend (`25566`). (2) **Observe**: a través del proxy, que solo registra. (3) **Enforce**: a través del proxy, que desconecta ante la primera alerta.

**Procedimiento.** [`scripts/experimentos.mjs`](../scripts/experimentos.mjs) ejecuta en orden la inundación de paquetes (2.000 `arm_animation`), la carga sobredimensionada, el movimiento imposible (20 saltos) y la inundación de login (200 conexiones), atribuyendo a cada uno las líneas que agregó al JSONL en su ventana. El estrés se corre aparte con `src/attacker.mjs --attack server_stress` (100 bots, 45 s, cada uno avanzando 8 bloques por envío en una dirección distinta, para forzar terreno nuevo). Proxy y servidor se arrancan por separado, para seguir la consola del servidor.

**Mediciones.** Como el vanilla no expone TPS, se usan el CPU% pico del proceso Java y su RAM (`WorkingSet64`, muestreo por segundo; CPU calculado por diferencia de segundos de CPU, para no depender de contadores localizados), los avisos `Can't keep up` del `latest.log`, la caída (consola/watchdog) y las alertas y desconexiones del JSONL ([`scripts/analizar-registro.mjs`](../scripts/analizar-registro.mjs)). La latencia por paquete no se instrumentó (fuera de alcance). **Repeticiones.** Una por condición; no permite estimar la varianza, lo que se anota en [Limitaciones](05-limitaciones.md).

## Experimento 4 · Costo del registro

**Estado: fuera de alcance.** No se ejecutó como experimento controlado; en [Resultados](04-resultados.md#costo-del-registro) se da un indicio indirecto a partir del volumen de paquetes con y sin proxy, pero separar el costo de reenviar del de escribir el JSONL queda pendiente. Las condiciones candidatas serían conexión directa, proxy con `--no-record` y proxy con registro, midiendo CPU del proxy, crecimiento del JSONL por minuto y latencia percibida.
