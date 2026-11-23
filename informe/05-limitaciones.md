# Limitaciones y cambios de alcance

> **Notas para quien escribe**
>
> - La pauta valora explícitamente la honestidad en esta sección. Por cada limitación, explica qué es, por qué ocurre, qué consecuencia tiene para los resultados y cómo se podría resolver.
> - Limitaciones ya identificadas en el repo:
>   - **Inundación de login sin detectar.** No hay una regla de tasa de conexiones y el propio proxy absorbe la carga ([resultados.md](../resultados.md)).
>   - **Detección validada contra un backend falso en JS** y no contra el vanilla. Prueba la lógica de las reglas, pero no su efecto sobre el servidor real.
>   - **Backend en `online-mode=false` y accesible por loopback.** Cualquier proceso local puede conectarse al 25566 sin pasar por el proxy. Esto ocurrió en la práctica: en el tropiezo 1 la conexión fue directa al backend y el IDS no vio nada.
>   - **Solo se inspecciona el tráfico serverbound.** Lo que el servidor envía al cliente se reenvía sin reglas.
>   - **Las ventanas de tasa son fijas.** Un ataque repartido entre dos ventanas puede quedar justo bajo el límite. Una ventana deslizante o un token bucket lo evitarían.
>   - **La regla de movimiento usa un umbral fijo de 10 bloques.** Falta comprobar si produce falsos positivos con élitros, perlas de ender o vehículos rápidos.
>   - **La dependencia de `minecraft-protocol` 1.67.0.** Su intérprete tuvo un bug con `set_equipment` que obligó a conservar los bytes originales.
> - **Cambios respecto de la propuesta:** compárala con lo que se hizo. Por ejemplo, el modo enforce y el cliente atacante se agregaron durante el desarrollo. **[Pedir la propuesta original al equipo.]**
> - Indica qué quedó fuera por falta de tiempo y qué por decisión de diseño.

## Limitaciones de la detección

**[PENDIENTE]**

## Limitaciones de la evaluación

**[PENDIENTE]**

## Supuestos

**[PENDIENTE]**

## Cambios respecto de la propuesta original

**[PENDIENTE]**

## Trabajo futuro

**[PENDIENTE]**
