# Limitaciones y cambios de alcance

## Limitaciones de la detección

**Inundación de login.** No hay regla de tasa de conexiones nuevas, así que una ráfaga de logins pasa sin alertas; además cada conexión se autentica y abre una conexión propia al backend, de modo que el proxy es el recurso que se consume primero. Lo cerraría una regla de tasa por dirección de origen, o un tope global de logins por ventana aplicado antes de abrir la conexión al backend.

**Ventanas de tasa fijas.** Los contadores se reinician cada segundo, así que un atacante puede enviar el máximo al final de una ventana y otra vez al principio de la siguiente —el doble del límite en menos de un segundo sin alerta—. Una ventana deslizante o un *token bucket* evitarían el borde.

**Enforce en la regla de tasa.** El observador de tasa se ejecuta después del reenvío, así que en *enforce* el paquete que supera el límite alcanza a llegar al backend antes del corte. El efecto es de un solo paquete por sesión, pero contradice la garantía de que en *enforce* ningún paquete infractor llega al backend; se resuelve evaluando la tasa en el mismo punto que las reglas de contenido.

**Solo tráfico serverbound.** Los paquetes del servidor al cliente se reenvían sin reglas: el proxy no protege a los clientes de un servidor malicioso o comprometido.

**Umbral de movimiento fijo.** `movement_distance` usa 10 bloques entre paquetes para cualquier desplazamiento. No se probó si produce falsos positivos con transporte rápido (élitros con cohetes, hielo, *Riptide*) ni con teletransportes del servidor que no lleguen como `position`; y a la inversa, un atacante puede avanzar mucho sin alertas si cada paquete queda bajo los 10 bloques. La regla detecta saltos, no velocidad sostenida.

**Dependencia del intérprete.** Las reglas trabajan sobre el paquete que interpreta `minecraft-protocol`: un error de la biblioteca afecta la detección y la fidelidad del reenvío, como con `set_equipment`. Tampoco se evaluó qué pasa con paquetes malformados que la biblioteca no logra interpretar.

## Limitaciones de la evaluación

**Backend de prueba en la validación.** El Experimento 2 se hizo contra un backend escrito con `minecraft-protocol`, no contra el vanilla: demuestra que las reglas se disparan, no que el servidor real se vea afectado ni que el proxy lo proteja. Esa es la pregunta del Experimento 3, cuyos resultados se reportan en [Resultados](04-resultados.md#impacto-sobre-el-servidor-vanilla).

**Una sola corrida por condición.** Cada ataque se ejecutó una vez por modo, y el estrés una vez en cada condición. Sin repeticiones no se puede estimar la varianza; las cifras de impacto son un caso observado, no un promedio.

**Línea base pequeña.** Viene de una sesión individual corta y una partida de ~23 minutos con tres jugadores, en el mismo mundo y con estilos parecidos. Otros tipos de juego (construcción a gran escala, combate, granjas) podrían dar perfiles de tráfico y tasas de falsos positivos distintas.

**Falsos positivos sin medir de forma directa.** No hay medición limpia de las alertas que producen los límites en juego normal: el registro de la partida real es anterior a las reglas y el JSONL no guarda coordenadas para re-evaluar `movement_distance` (ver [Resultados](04-resultados.md#alertas-en-partidas-normales)). Por construcción el tráfico normal queda bajo los límites, pero el *rubber-band* del servidor sobre un jugador legítimo podría disparar `movement_distance` —el mismo mecanismo que afectó a los bots de estrés—; cuantificarlo requiere una partida normal con las reglas activas.

## Supuestos

**El backend solo es accesible a través del proxy.** **No se cumple** en el laboratorio: el backend escucha en `127.0.0.1:25566` y, al correr en `online-mode=false`, cualquier proceso local puede entrar con el nombre que quiera, incluido el de un operador. Ocurrió en la práctica: en la primera prueba manual el cliente se conectó por error al `25566` y el IDS no registró nada ([tropiezos.md](../tropiezos.md), tropiezo 1). En producción el backend debería quedar tras un firewall, en un contenedor o red aislada, o con reenvío autenticado entre proxy y backend.

**La máquina del proxy es confiable.** Si se compromete, el atacante tiene el tráfico descifrado de todos los jugadores.

**El cliente atacante es representativo.** Los ataques son patrones simples y deliberadamente evidentes; un atacante que conozca las reglas puede mantenerse justo bajo los límites.

## Cambios respecto de la propuesta original

La propuesta entregada al curso planteaba un alcance más amplio que el ejecutado:

| Aspecto | Propuesta | Ejecutado |
| --- | --- | --- |
| Direcciones de amenaza | (A) cliente→servidor, (B) servidor→cliente, (C) cliente→servidor→otro cliente | Solo (A); (B) y (C) fuera de alcance |
| Motor de detección | Reglas + detección de anomalías por estadísticas de tráfico por jugador | Solo la capa de reglas (tasa y contenido) |
| Acciones | Registrar, descartar paquete, desconectar, banear temporalmente | Registrar (*observe*) y desconectar la sesión (*enforce*) |
| Generador de tráfico | Cliente atacante + bots de tráfico «normal» | Cliente atacante; línea base de sesiones humanas reales |
| Evaluación | Recall por clase, falsos positivos, latencia y throughput del proxy | Detección validada por ataque; falsos positivos sin medir; impacto como CPU/RAM del servidor |
| Estructura y ataques conocidos | Validar VarInts/NBT; revisar Log4Shell | Reenvío crudo sin validación estructural; Log4Shell no aplica a 26.1 |

Dentro del repositorio el alcance evolucionó en tres hitos: (1) solo observación —una partida vanilla 26.1 con registro JSONL, sin reglas—; (2) reglas de contenido y modo *enforce*, que convierten el IDS en IPS; (3) un cliente atacante con cuatro patrones y, más tarde, el estrés del servidor con múltiples bots.

## Trabajo futuro

- Regla de tasa de conexiones y tope de logins concurrentes.
- Ventanas deslizantes o *token bucket* en la regla de tasa, evaluada antes del reenvío.
- Reglas de velocidad sostenida, no solo de salto, con umbrales según el modo de desplazamiento.
- Aislar el backend para que el proxy sea el único camino.
- Calibrar los límites con una línea base más grande y variada.
- Inspección del tráfico *clientbound*.
