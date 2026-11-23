# Metodología

## Entorno de laboratorio

Todas las pruebas se hicieron en una sola máquina con Windows. El proxy y el backend escuchan solo en `127.0.0.1`.

| Componente | Versión |
| --- | --- |
| Sistema operativo | Windows x64, compilación 26200 |
| Node.js y npm | 24.16.0 y 11.13.0 |
| Java del servidor | Microsoft OpenJDK 25.0.5.1+2-LTS |
| Servidor | Minecraft Java vanilla 26.1, SHA-1 `3872a7f07a1a595e651aef8b058dfc2bb3772f46` |
| Biblioteca de protocolo | `minecraft-protocol` 1.67.0 (protocolo 775) |

El script [`scripts/prepare-server.ps1`](../scripts/prepare-server.ps1) descarga el servidor desde el manifiesto oficial de Mojang y verifica el SHA-1 de los metadatos y del JAR. También descarga OpenJDK 25 desde Microsoft, verifica su SHA-256 y lo instala en una carpeta local, sin tocar el `PATH`. Así cualquier integrante obtiene exactamente los mismos binarios.

El backend se configura con `server-ip=127.0.0.1`, `server-port=25566`, `online-mode=false`, `enforce-secure-profile=false`, y sin *query* ni RCON. [`scripts/start-server.ps1`](../scripts/start-server.ps1) se niega a arrancar si la IP y el puerto no son exactamente esos, y si la versión de Java no es la 25. El servidor arranca con entre 512 MB y 2 GB de memoria.

## Experimento 1 · Línea base de tráfico normal

**Objetivo.** Conocer qué paquetes produce una partida normal y con qué frecuencia, antes de definir límites.

**Procedimiento.** Un integrante entró con el cliente oficial 26.1 y una cuenta autenticada a través del proxy en `127.0.0.1:25565`. El proxy estaba en modo *observe*, sin límites de tasa. Durante la sesión se quedó quieto, caminó, colocó y rompió bloques y abrió el inventario. Luego se analizaron los registros de esa sesión en el JSONL con consultas de PowerShell: se agruparon por tipo de paquete y, para `position`, por segundo UTC ([historia.md](../historia.md), pasos 5 a 9).

Más tarde se repitió el procedimiento en una partida más larga, con tres personas y conexiones externas por un túnel de Playit que apuntaba al proxy. De esa partida se contaron los paquetes y la duración de cada sesión de conexión, y cuántas sesiones coincidieron en el tiempo (pasos 10 y 11).

**Mediciones.**

- paquetes por tipo y su proporción;
- máximo de paquetes `position` en un segundo;
- número de sesiones, su duración y el solapamiento entre ellas.

**Nota sobre las ventanas.** Las consultas agrupan por segundo de reloj UTC, mientras que el IDS usa ventanas del reloj monotónico del proceso. Los cortes no coinciden, así que el máximo por segundo de la línea base es una referencia y no reproduce exactamente lo que vería la regla de tasa.

## Experimento 2 · Validación de la detección

**Objetivo.** Comprobar que cada regla se dispara frente al patrón que debe detectar y que el modo *enforce* desconecta al atacante.

**Procedimiento.** Se ejecutó cada ataque de [`src/attacker.mjs`](../src/attacker.mjs) contra el proxy en `127.0.0.1:25565`, configurado con `--online false` porque el atacante no tiene cuenta. Cada ataque se corrió una vez con el proxy en *observe* y otra en *enforce*. Como backend se usó un servidor de prueba escrito con `minecraft-protocol` en lugar del servidor vanilla. Este montaje valida la lógica de las reglas, que no depende del backend, pero **no mide el efecto sobre un servidor real**.

| Ataque | Carga enviada |
| --- | --- |
| Inundación de paquetes | 400 `arm_animation` seguidos |
| Movimiento imposible | 11 `position` con saltos de 1.000 bloques |
| Carga sobredimensionada | Un `custom_payload` de 200 KB y un libro de 300.000 caracteres |
| Inundación de login | 20 conexiones en ráfaga |

**Límites usados.** Tasa de `arm_animation` de 60 por segundo; el resto con los valores por defecto de la tabla de reglas (paquete y `custom_payload` de 32.768 bytes, libro de 102.400 caracteres y desplazamiento de 10 bloques).

**Mediciones.** Alertas por regla en *observe*, y si hubo alerta y desconexión en *enforce*, según el JSONL del proxy y el resumen que imprime el atacante.

## Experimento 3 · Impacto de los ataques sobre el servidor vanilla

**Estado: diseñado, todavía no ejecutado.**

**Objetivo.** Medir si los ataques degradan o tumban el servidor vanilla 26.1 cuando no hay proxy, y cuánto contiene ese efecto el proxy.

**Variable independiente.** Hay tres condiciones por ataque:

1. **Sin proxy:** el atacante se conecta directo al backend en `25566`.
2. **Observe:** a través del proxy, que solo registra.
3. **Enforce:** a través del proxy, que desconecta ante la primera alerta.

**Procedimiento.**

- [`scripts/experimentos.mjs`](../scripts/experimentos.mjs) ejecuta en orden la inundación de paquetes (2.000 `arm_animation`), la carga sobredimensionada, el movimiento imposible (20 saltos) y la inundación de login (200 conexiones).
- Para cada ataque, el script lee solo las líneas que se agregaron al JSONL durante su ventana y le atribuye esas alertas. Al final imprime una tabla en Markdown.
- El estrés del servidor se ejecuta aparte con `src/attacker.mjs --attack server_stress`: 40 bots durante 45 s, cada uno avanzando 8 bloques por envío en una dirección distinta, para forzar la generación de terreno nuevo.
- El proxy y el servidor se arrancan por separado, para poder seguir la consola del servidor durante cada corrida.

**Mediciones.**

| Métrica | Fuente |
| --- | --- |
| Rendimiento del servidor (TPS o milisegundos por *tick*) | **[PENDIENTE: definir; por ejemplo `/tick query` en la consola]** y los avisos `Can't keep up!` del `latest.log` |
| Memoria máxima del proceso Java | **[PENDIENTE: definir; por ejemplo `Get-Process java` muestreado]** |
| Caída del servidor | Consola y `latest.log` (watchdog o cierre) |
| Alertas y desconexiones | JSONL del proxy, con `scripts/experimentos.mjs` y [`scripts/analizar-registro.mjs`](../scripts/analizar-registro.mjs) |
| Latencia agregada por el proxy | **[PENDIENTE: definir el método]** |

**Repeticiones.** **[PENDIENTE: definir cuántas corridas por condición.]**

## Experimento 4 · Costo del registro

**Estado: propuesto, todavía no ejecutado.** **[PENDIENTE: decidir si se ejecuta o se declara fuera de alcance.]**

**Objetivo.** Cuantificar cuánto cuesta el proxy y, en particular, la escritura del JSONL.

**Condiciones.** Conexión directa al backend; proxy con `--no-record`; proxy con registro.

**Mediciones candidatas.** Uso de CPU del proceso del proxy, crecimiento del JSONL por minuto de juego y latencia percibida por el cliente.
