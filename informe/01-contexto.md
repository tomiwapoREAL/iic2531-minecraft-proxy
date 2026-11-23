# Contexto y problema

> **Notas para quien escribe**
>
> - Explica el problema con conceptos del curso:
>   - un servidor de Minecraft Java procesa todo lo que envía cada cliente;
>   - el servidor vanilla aplica pocas validaciones propias;
>   - un cliente modificado puede enviar paquetes que el juego normal nunca genera.
> - Deja explícita la pregunta del proyecto, tomada del README: **qué tráfico de juego puede observar un proxy, cuántas alertas aparecen en partidas normales y qué impacto tiene el registro**.
> - Explica por qué el proxy es una frontera razonable: no modifica el servidor, es transparente para el cliente vanilla y sirve como punto único de control. Plantéalo como un IDS/IPS de red aplicado a un protocolo de juego.
> - Define el **modelo de amenaza**:
>   - el atacante es un jugador con un cliente propio que ya pasó la autenticación;
>   - lo que puede hacer: flood, movimiento imposible, cargas sobredimensionadas, inundación de login y estrés del servidor;
>   - qué no cubrimos (ver [05-limitaciones.md](05-limitaciones.md)).
> - Puedes incluir el trabajo relacionado como contexto, por ejemplo plugins anticheat del lado del servidor o proxies como Velocity y BungeeCord. Si lo haces, explica en qué se distingue nuestro enfoque.
> - Fuentes: [README.md](../README.md) y el [enunciado](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/FinalProject.md).

## Motivación

**[PENDIENTE]**

## Pregunta y objetivos

**[PENDIENTE]**

## Modelo de amenaza

**[PENDIENTE]**

## Alcance

**[PENDIENTE]**
