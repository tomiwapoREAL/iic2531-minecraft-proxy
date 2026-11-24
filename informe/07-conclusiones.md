# Conclusiones y aprendizajes

## Respuesta a la pregunta del proyecto

**Qué tráfico puede observar el proxy.** Interpreta y registra los paquetes *serverbound* del estado *play* que la biblioteca decodifica, guardando sus metadatos (tipo, tamaño, sesión, dirección) sin el contenido. En la línea base, una sesión individual produjo 4.222 paquetes de 15 tipos dominados por `tick_end` (81,2 %), y una partida de tres jugadores, 72.338 paquetes en 10 sesiones. El tráfico de acción del jugador es una fracción pequeña, por lo que una regla de tasa útil debe ser específica por tipo de paquete.

**Cuántas alertas aparecen en partidas normales.** No se obtuvo una medición limpia: el registro de la partida real es anterior a las reglas y el JSONL no guarda coordenadas para re-evaluarlas. Por construcción el juego normal queda bajo los límites (máximo de 20 `position`/s frente a un límite de 40), pero el *rubber-band* del servidor sobre un jugador legítimo podría disparar `movement_distance`; cuantificarlo queda pendiente.

**Qué impacto tiene el registro.** La medición aislada quedó fuera de alcance. Como indicio, en el estrés con 100 bots el volumen de paquetes que alcanzó el mismo envío cayó ~14 % al pasar por el proxy en *observe*: una sobrecarga apreciable pero no prohibitiva.

**Si el proxy contiene los ataques.** Sí, en *enforce*, para los patrones que cruzan una regla por conexión: tres de los cuatro ataques puntuales se detectaron y desconectaron (la inundación de login no, por falta de una regla de tasa de conexiones). Frente al estrés de 100 bots —que sin proxy satura el servidor y expulsa a un jugador real— el proxy en *enforce* desconectó 98 de 100 sesiones, redujo los paquetes un 76 % y acortó la ventana de impacto a ~11 s.

## Aprendizajes

**Inspeccionar sin alterar el tráfico es más difícil de lo que parece.** El bug de `set_equipment`, en que el lector de la biblioteca mutaba el búfer y corrompía el reenvío crudo, expulsaba a los jugadores. Un proxy defensivo debe ser transparente antes de ser útil, y garantizarlo obligó a parsear sobre una copia para preservar los bytes originales.

**Un control de seguridad que se puede saltar no protege nada.** El backend acepta conexiones directas al `25566` en `online-mode=false`; en la primera prueba el cliente llegó por error a ese puerto y el IDS no registró nada. Sin aislar el backend, el proxy es evitable.

**Las reglas por conexión cubren a un atacante activo, pero no a las conexiones mudas.** El estrés distribuido se detuvo porque cada bot, al actuar, cruzaba una regla; la inundación de login, que no llega a *play*, pasó sin alertas. Defender contra un flood de conexiones exige una regla agregada, distinta del rate-limiting por sesión.

**Calibrar los límites con datos reales antes de activar enforce.** Los umbrales de tasa y de movimiento se fijaron desde la línea base; sin esa referencia, *enforce* habría cortado o dejado pasar de forma arbitraria.

**Usar una biblioteca de terceros para el protocolo tiene un costo.** Acelera el desarrollo, pero ata la detección y la fidelidad del reenvío a sus errores y a su manejo de paquetes malformados.
