# Contexto y problema

## Motivación

Un servidor de Minecraft Java mantiene el estado de un mundo compartido y lo actualiza a partir de lo que le envía cada cliente: movimientos, golpes, bloques, chat, libros y canales de datos propios. El cliente oficial genera ese tráfico de forma acotada, pero el protocolo está documentado y existen bibliotecas para escribir un cliente propio en pocas líneas. Un jugador con un cliente modificado puede enviar paquetes que el juego normal nunca produce: ráfagas de cientos de animaciones por segundo, posiciones que saltan mil bloques, libros de cientos de miles de caracteres o cargas binarias de cientos de kilobytes.

El vanilla trae algunas validaciones propias (como la corrección de movimientos demasiado rápidos), pero no ofrece un registro de lo que recibe ni una forma de expresar reglas propias sin modificar el servidor o instalar complementos. Las defensas habituales son *anticheat* que corren dentro del servidor, o proxies como Velocity o BungeeCord, que reparten jugadores pero no están pensados como sistemas de detección. Este proyecto estudia otra frontera: un **proxy de inspección** entre el cliente y el servidor vanilla —la idea de un IDS/IPS de red aplicada a un protocolo de juego—. El proxy no modifica el servidor, es transparente para un cliente vanilla y concentra en un punto la autenticación, el registro y las reglas.

## Ajustes de seguridad entre versiones

La seguridad del vanilla no es estática: a lo largo de las versiones, Mojang y el ecosistema han corregido fallas de disponibilidad y de dependencias que se manifiestan en el tráfico. Fijar la versión en 26.1 sitúa el trabajo en un punto concreto de esa evolución.

| Caso | Mecanismo | Versión afectada → corrección |
| --- | --- | --- |
| MC-308703 | Agotamiento de recursos **fuera del heap** al enviar *chunks* | Reportado en 26.1.2 (y con Fabric); corregido en 26.2 |
| Caídas de servidor | Vulnerabilidades críticas capaces de tumbar el servidor | Corregidas en 1.21.1 |
| Log4Shell (CVE-2021-44228) | RCE por la dependencia Log4j incluida en el servidor | Afecta 1.7–1.18; corregido en 1.18.1 |
| Paquetes malformados (2015) | Caída remota por consumo de memoria al procesar paquetes | Reportado en 1.6.2, aún en 1.8.3 |

El caso más cercano es **MC-308703**: una denegación de servicio por memoria **fuera del heap**, un mecanismo distinto del que probamos en [Resistencia del servidor a la caída](04-resultados.md#resistencia-del-servidor-a-la-caída), donde el impacto cayó en la CPU del hilo principal y la RAM quedó plana. Que la compilación exacta 26.1 esté afectada queda por confirmar. Se citan como contexto a partir de reportes públicos: [MC-308703](https://michaelbommarito.com/cves/) (M. Bommarito), las [caídas de 1.21.1](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-1) y [Log4Shell](https://www.minecraft.net/en-us/article/important-message--security-vulnerability-java-edition) (notas de Mojang) y los [paquetes malformados de 2015](https://blog.ammaraskar.com/minecraft-vulnerability-advisory/) (A. Askar).

## Pregunta y objetivos

> ¿Qué tráfico de juego puede observar un proxy, cuántas alertas aparecen en partidas normales y qué impacto tiene el registro?

Para responderla nos propusimos:

1. Construir un proxy para Minecraft Java 26.1 que reenvíe el tráfico sin alterarlo y registre metadatos de los paquetes del jugador en JSONL.
2. Caracterizar el tráfico de partidas reales para establecer una línea base.
3. Definir reglas de detección por tasa y por contenido, con un modo que solo registra (*observe*) y otro que además desconecta al infractor (*enforce*).
4. Construir un cliente atacante con patrones de abuso conocidos y validar contra él la detección.
5. Medir el efecto de esos ataques sobre el servidor vanilla con y sin el proxy, y el costo que agrega el registro.

## Por qué el proxy puede ver el contenido

El protocolo viaja sobre TCP y pasa por los estados *handshake*, *login*, *configuration* y *play*; cada paquete lleva un prefijo de largo, un identificador y un cuerpo cuyo formato depende del estado y de la versión del protocolo (775 para la 26.1). Puede activarse compresión y, en modo *online*, la conexión se cifra tras verificar la cuenta con Mojang. En nuestro diseño el cliente se autentica **contra el proxy**, que es el extremo del canal cifrado: descifra el tráfico y lo reenvía al backend por *loopback* sin cifrar, y por eso puede interpretar cada paquete. Es un intermediario deliberado, controlado por el operador del servidor, con el mismo papel que un terminador TLS con inspección en una red corporativa.

## Modelo de amenaza

**Atacante.** Un jugador que puede conectarse y controla por completo su cliente, por lo que puede enviar cualquier secuencia de paquetes válida para el protocolo. Lo representamos con [`src/attacker.mjs`](../src/attacker.mjs):

| Patrón | Qué busca |
| --- | --- |
| Inundación de paquetes | Saturar el procesamiento con ráfagas de un mismo tipo de paquete |
| Movimiento imposible | Teletransportarse o desplazarse más rápido de lo físicamente posible |
| Carga sobredimensionada | Forzar a procesar o guardar datos enormes (`custom_payload`, libros) |
| Inundación de login | Abrir muchas conexiones nuevas en poco tiempo |
| Estrés del servidor | Muchos bots que generan *chunks* nuevos y envían acciones sin pausa para saturar el hilo principal |

**Activos.** La disponibilidad del servidor (seguir procesando *ticks* a tiempo), la integridad del mundo compartido y la experiencia de los demás jugadores. **Confianza.** El servidor vanilla, la máquina que aloja proxy y backend, y los servicios de autenticación de Mojang.

## Alcance

**Dentro:** el tráfico *serverbound* en el estado `play`; reglas de tasa por tipo de paquete y reglas de contenido sobre el paquete ya interpretado; un vanilla 26.1 sin complementos en la misma máquina que el proxy.

**Fuera:** el tráfico *clientbound* (se reenvía sin reglas); ataques volumétricos de red contra la máquina; vulnerabilidades del servidor que no se manifiesten como anomalías en los paquetes; trampas que solo afectan lo que ve el cliente (como *x-ray*), porque no producen tráfico distinto.

Las limitaciones que resultan de estas decisiones se discuten en [Limitaciones y cambios de alcance](05-limitaciones.md).
