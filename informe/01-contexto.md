# Contexto y problema

## Motivación

Un servidor de Minecraft Java Edition mantiene el estado de un mundo compartido y lo actualiza a partir de lo que le envía cada cliente: movimientos, golpes, bloques colocados o rotos, mensajes de chat, libros escritos y canales de datos propios. El cliente oficial genera ese tráfico de forma acotada, pero la comunidad documentó el protocolo y existen bibliotecas que permiten escribir un cliente propio en pocas líneas. Un jugador con un cliente modificado puede enviar paquetes que el juego normal nunca produce: ráfagas de cientos de animaciones por segundo, posiciones que saltan mil bloques, libros de cientos de miles de caracteres o cargas binarias de cientos de kilobytes.

El servidor vanilla trae algunas validaciones propias, como la corrección de movimientos demasiado rápidos, pero no ofrece un registro de lo que recibe ni una forma de expresar reglas propias sin modificar el servidor o instalar complementos. Las soluciones habituales de la comunidad son complementos *anticheat* que se ejecutan dentro del servidor, o proxies como Velocity o BungeeCord, que reparten jugadores entre varios servidores pero no están pensados como sistemas de detección.

Este proyecto estudia otra frontera: un **proxy de inspección** situado entre el cliente y el servidor vanilla. Es la misma idea de un IDS/IPS de red, aplicada a un protocolo de juego. El proxy no modifica el servidor, es transparente para un cliente vanilla y concentra en un solo punto la autenticación, el registro y la aplicación de reglas.

## Pregunta y objetivos

La pregunta del proyecto es:

> ¿Qué tráfico de juego puede observar un proxy, cuántas alertas aparecen en partidas normales y qué impacto tiene el registro?

Para responderla nos propusimos:

1. Construir un proxy para Minecraft Java 26.1 que reenvíe el tráfico sin alterarlo y registre metadatos de los paquetes del jugador en formato JSONL.
2. Caracterizar el tráfico de partidas reales para establecer una línea base.
3. Definir reglas de detección por tasa y por contenido, con un modo que solo registra (*observe*) y otro que además desconecta al infractor (*enforce*).
4. Construir un cliente atacante que ejerza patrones de abuso conocidos y validar contra él la detección.
5. Medir el efecto de esos ataques sobre el servidor vanilla con y sin el proxy, y el costo que agrega el registro.

## Por qué el proxy puede ver el contenido

El protocolo de Minecraft Java viaja sobre TCP y pasa por varios estados: *handshake*, *login*, *configuration* y *play*. Cada paquete lleva un prefijo de largo, un identificador y un cuerpo cuyo formato depende del estado y de la versión del protocolo (775 para la 26.1). Por encima del protocolo puede activarse compresión, y en modo *online* la conexión se cifra después de que el servidor verifica la cuenta del jugador con los servicios de sesión de Mojang.

En nuestro diseño el cliente se autentica **contra el proxy**. El proxy es el extremo del canal cifrado, descifra el tráfico y lo reenvía al backend por *loopback* sin cifrar. Por eso puede interpretar cada paquete. En otras palabras, el proxy es un intermediario deliberado: lo controla el operador del servidor y cumple el mismo papel que un terminador TLS con inspección en una red corporativa.

## Modelo de amenaza

**Atacante.** Un jugador que puede conectarse al servidor y controla por completo su cliente, por lo que puede enviar cualquier secuencia de paquetes válida para el protocolo. En los experimentos lo representamos con [`src/attacker.mjs`](../src/attacker.mjs). Los comportamientos considerados son:

| Patrón | Qué busca |
| --- | --- |
| Inundación de paquetes | Saturar el procesamiento con ráfagas de un mismo tipo de paquete |
| Movimiento imposible | Teletransportarse o desplazarse más rápido de lo físicamente posible |
| Carga sobredimensionada | Forzar al servidor a procesar o guardar datos enormes (`custom_payload`, libros) |
| Inundación de login | Abrir muchas conexiones nuevas en poco tiempo |
| Estrés del servidor | Muchos bots que generan *chunks* nuevos y envían acciones sin pausa para saturar el hilo principal |

**Activos.** La disponibilidad del servidor (que siga procesando *ticks* a tiempo), la integridad del mundo compartido y la experiencia de los demás jugadores.

**Confianza.** Confiamos en el servidor vanilla, en la máquina que aloja el proxy y el backend, y en los servicios de autenticación de Mojang.

## Alcance

Dentro del alcance:

- el tráfico *serverbound* (del cliente al servidor) en el estado `play`;
- reglas de tasa por tipo de paquete y reglas de contenido sobre el paquete ya interpretado;
- un servidor vanilla 26.1 sin complementos, en la misma máquina que el proxy.

Fuera del alcance:

- el tráfico *clientbound*, que el proxy reenvía sin aplicarle reglas;
- ataques volumétricos de red contra la máquina;
- vulnerabilidades del propio servidor que no se manifiesten como anomalías en los paquetes;
- trampas que solo afectan lo que ve el cliente, como *x-ray*, porque no producen tráfico distinto.

Las limitaciones que resultan de estas decisiones se discuten en [Limitaciones y cambios de alcance](05-limitaciones.md).
