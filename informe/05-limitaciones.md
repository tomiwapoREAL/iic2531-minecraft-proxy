# Limitaciones y cambios de alcance

## Limitaciones de la detección

**Inundación de login.** No hay una regla de tasa de conexiones nuevas, así que una ráfaga de logins pasa sin alertas. Además, cada conexión pasa la autenticación y abre una conexión propia al backend, por lo que el propio proxy es el recurso que se consume primero. Una regla de tasa por dirección de origen, o un tope global de logins por ventana aplicado antes de abrir la conexión al backend, cerraría este hueco.

**Ventanas de tasa fijas.** Los contadores se reinician al empezar cada segundo. Un atacante que conoce el límite puede enviar el máximo permitido al final de una ventana y otra vez al principio de la siguiente: llega al doble del límite en menos de un segundo sin generar ninguna alerta. Una ventana deslizante o un *token bucket* evitarían este borde.

**Enforce en la regla de tasa.** Las reglas de contenido se evalúan antes del reenvío, pero el observador de tasa se ejecuta después. Por eso en *enforce* el paquete que supera el límite de tasa alcanza a llegar al backend antes del corte. El efecto es de un solo paquete por sesión, pero contradice la garantía de que en *enforce* ningún paquete infractor llega al backend. Se resuelve evaluando la tasa en el mismo punto que las reglas de contenido.

**Solo tráfico serverbound.** Los paquetes que el servidor envía al cliente se reenvían sin aplicarles reglas. El proxy no protege a los clientes de un servidor malicioso o comprometido.

**Umbral de movimiento fijo.** La regla `movement_distance` usa 10 bloques entre paquetes consecutivos, para cualquier forma de desplazamiento. No se probó si produce falsos positivos con medios de transporte rápidos, como élitros con cohetes, vehículos sobre hielo o tridentes con *Riptide*, ni con teletransportes del servidor que no lleguen como un paquete `position`. A la inversa, un atacante puede avanzar muchos bloques por segundo sin alertas si cada paquete queda bajo los 10 bloques. La regla detecta saltos, no velocidad sostenida.

**Dependencia del intérprete.** Las reglas de contenido trabajan sobre el paquete que interpreta `minecraft-protocol`. Un error de la biblioteca afecta tanto la detección como la fidelidad del reenvío, como ocurrió con `set_equipment`. Tampoco se evaluó qué pasa con paquetes malformados que la biblioteca no logra interpretar.

## Limitaciones de la evaluación

**Backend de prueba en la validación.** El Experimento 2 se hizo contra un backend escrito con `minecraft-protocol` y no contra el servidor vanilla. Demuestra que las reglas se disparan, pero no que el servidor real se vea afectado por los ataques ni que el proxy lo proteja. Esa es la pregunta del Experimento 3, que está pendiente.

**Una sola corrida por condición.** Cada ataque se ejecutó una vez por modo, y el estrés del servidor una vez en cada una de las tres condiciones. Con una sola corrida no se puede estimar la varianza entre ejecuciones ni descartar efectos de una medición puntual; las cifras de impacto deben leerse como un caso observado, no como un promedio.

**Línea base pequeña.** La línea base viene de una sesión individual corta y una partida de unos 23 minutos con tres jugadores, todos en el mismo mundo y con estilos de juego parecidos. Otros tipos de juego, como construcción a gran escala, combate o granjas automáticas, pueden producir perfiles de tráfico distintos y otra tasa de falsos positivos.

**Falsos positivos sin medir de forma directa.** No existe una medición limpia de cuántas alertas producen los límites de la evaluación en una partida normal: el registro de la partida real es anterior a las reglas y el JSONL no guarda coordenadas para re-evaluar `movement_distance` sobre él (ver [Resultados](04-resultados.md#alertas-en-partidas-normales)). Por construcción el tráfico normal queda bajo los límites de contenido y de tasa, pero el rubber-band del servidor sobre un jugador legítimo podría disparar `movement_distance`, el mismo mecanismo que afectó a los bots de estrés; cuantificar ese caso requiere una partida normal con las reglas activas.

## Supuestos

**El backend solo es accesible a través del proxy.** Esto **no se cumple** en el laboratorio. El backend escucha en `127.0.0.1:25566`, así que cualquier proceso de la misma máquina puede conectarse directamente. Como corre en `online-mode=false`, quien llegue a ese puerto puede entrar con el nombre que quiera, incluido el de un operador. Esto ocurrió en la práctica: en la primera prueba manual, el cliente se conectó por error al `25566` y el IDS no registró nada ([tropiezos.md](../tropiezos.md), tropiezo 1). En un despliegue real, el backend debería quedar detrás de un firewall, en un contenedor o una red aislada, o con un mecanismo de reenvío autenticado entre proxy y backend.

**La máquina del proxy es confiable.** Si se compromete, el atacante tiene el tráfico descifrado de todos los jugadores.

**El cliente atacante es representativo.** Los ataques son patrones simples y deliberadamente evidentes. Un atacante que conozca las reglas puede mantenerse justo bajo los límites.

## Cambios respecto de la propuesta original

**[CONFIRMAR: contrastar con la propuesta entregada al curso (Propuesta_Proyecto_Final_Seguridad.pdf); el equipo tiene ese documento.]** Dentro del propio repositorio el alcance evolucionó así:

1. El primer hito fue solo de observación: una partida vanilla 26.1 que produjera un registro JSONL a través del proxy, sin reglas activas.
2. Después se agregaron las reglas de contenido y el modo *enforce*, que convierten el IDS en un IPS.
3. Para evaluar las reglas se agregó un cliente atacante con cuatro patrones, y más tarde el estrés del servidor con múltiples bots.

## Trabajo futuro

- Regla de tasa de conexiones y tope de logins concurrentes.
- Ventanas deslizantes o *token bucket* en la regla de tasa, evaluada antes del reenvío.
- Reglas de velocidad sostenida, no solo de salto, con umbrales según el modo de desplazamiento.
- Aislar el backend para que el proxy sea efectivamente el único camino.
- Calibrar los límites con una línea base más grande y variada.
- Inspección del tráfico *clientbound*.
