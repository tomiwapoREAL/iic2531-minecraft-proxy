# Metodología

> **Notas para quien escribe**
>
> - Esta sección pesa en el criterio más alto (35 %). La idea es que otra persona pueda repetir cada experimento.
> - **Entorno:** usa la tabla de verificación del [README.md](../README.md): Windows x64, Node 24.16.0, OpenJDK 25.0.5.1, el JAR 26.1 con SHA-1 verificado y `minecraft-protocol` 1.67.0. Explica que `prepare-server.ps1` verifica los hashes de todo lo que descarga.
> - **Experimento 1, línea base con juego real:**
>   - una sesión individual y la partida con tres jugadores del 21 de noviembre;
>   - el procedimiento está en [historia.md](../historia.md), pasos 5 a 11;
>   - los resultados están en [resultados.md](../resultados.md);
>   - explica cómo se contaron los paquetes (consultas de PowerShell sobre el JSONL) y la diferencia entre cortar por segundo UTC y las ventanas monotónicas del IDS.
> - **Experimento 2, validación de la detección:**
>   - [src/attacker.mjs](../src/attacker.mjs) con los ataques `packet_flood`, movimiento imposible, carga sobredimensionada, inundación de login y `server_stress`;
>   - límites usados en la corrida y modos observe y enforce;
>   - aclara que se corrió contra un backend de prueba en JS y no contra el vanilla.
> - **Experimento 3, impacto sobre el servidor vanilla:**
>   - tres condiciones por ataque: sin proxy, observe y enforce;
>   - métricas: TPS mínimo, RAM máxima, si se cae, latencia del proxy y alertas;
>   - herramientas: [scripts/experimentos.mjs](../scripts/experimentos.mjs), [scripts/analizar-registro.mjs](../scripts/analizar-registro.mjs) y el `latest.log` del servidor;
>   - **todavía no se ejecuta.**
> - **Experimento 4, costo del registro:** el README propone comparar la conexión directa, el proxy con `--no-record` y el proxy con registro. Define qué se mide (latencia, CPU o tamaño del JSONL por minuto) o di explícitamente que quedó fuera.
> - Por cada experimento, deja claras tres cosas: la variable independiente, qué se mide y cuántas repeticiones se hicieron.

## Entorno de laboratorio

**[PENDIENTE]**

## Experimento 1 · Línea base de tráfico normal

**[PENDIENTE]**

## Experimento 2 · Validación de la detección

**[PENDIENTE]**

## Experimento 3 · Impacto de los ataques sobre el servidor vanilla

**[PENDIENTE]**

## Experimento 4 · Costo del registro

**[PENDIENTE: decidir si se ejecuta o se declara fuera de alcance]**
