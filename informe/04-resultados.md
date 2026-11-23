# Resultados

> **Notas para quien escribe**
>
> - Presenta los resultados en el mismo orden que los experimentos de [03-metodologia.md](03-metodologia.md). Por cada tabla o figura, agrega una o dos frases que digan qué muestra y qué significa.
> - Toda cifra debe venir de [resultados.md](../resultados.md) o de una corrida nueva documentada allí. No pegues tablas sin interpretarlas.
> - Datos ya disponibles:
>   - **Línea base individual:** 4.222 paquetes serverbound de 15 tipos. `tick_end` representa el 81,2 %. El máximo fue de 20 `position` por segundo.
>   - **Partida con tres jugadores:** 72.338 paquetes en 10 sesiones entre las 22:09 y las 22:32 (hora de Santiago). Hubo como máximo dos sesiones simultáneas. La sesión más larga duró 21 minutos y 45 segundos con 51.641 paquetes.
>   - **Detección:** flood, movimiento imposible y carga sobredimensionada generaron alerta, y en enforce además desconexión. La inundación de login no generó ninguna alerta.
> - Responde explícitamente la pregunta del proyecto: **¿cuántas alertas aparecen en partidas normales?** Es la tasa de falsos positivos. Para medirla hay que reproducir el JSONL de la línea base con los límites activos, o correr una partida nueva en modo observe con los límites de la evaluación.
> - Figuras sugeridas para [figuras/](figuras/):
>   - distribución de tipos de paquete;
>   - paquetes `position` por segundo a lo largo de la sesión, con el umbral de la regla;
>   - TPS del servidor en el tiempo para cada condición del experimento 3.

## Tráfico observable en partidas normales

**[PENDIENTE]**

## Alertas en partidas normales

**[PENDIENTE: tasa de falsos positivos con los límites de la evaluación]**

## Detección de ataques

**[PENDIENTE]**

## Impacto sobre el servidor vanilla

**[PENDIENTE: tabla de resultados.md completada]**

## Costo del registro

**[PENDIENTE]**
