# Declaración de uso de inteligencia artificial

Usamos Claude (Anthropic) como asistente durante el desarrollo de este proyecto. Dejamos constancia de su uso de forma trazable.

## En qué se usó

- Apoyo en la escritura y depuración de los clientes de ataque (`src/attacker.mjs`, `src/packet-storm.mjs`, `src/flood.mjs`) y en correcciones puntuales del proxy, entre ellas el ajuste de `BackendClient` por el bug de mutación de buffer en `set_equipment`.
- Análisis de los registros y muestreos de las corridas, y redacción de `resultados.md` y de secciones del informe a partir de las cifras que medimos nosotros.
- Preparación de material de presentación (diapositivas y guion).

## Cómo lo controlamos

El diseño de los experimentos, la ejecución de las corridas y la medición de CPU, memoria y alertas los hicimos nosotros; la IA no ejecutó el servidor ni generó datos. Revisamos y verificamos el código y las cifras antes de incorporarlos, y la autoría humana de cada paso queda registrada en `historia.md` y `tropiezos.md`. La interpretación de los resultados y las conclusiones son nuestras.

Integrantes: Gael Sánchez Lizana, Joaquín Chiyan Zhou Chen, Tomás Fluxá Armstrong.
