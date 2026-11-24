---
title: "Proxy defensivo para Minecraft Java: observación y detección de abuso en el tráfico de juego"
subtitle: "Proyecto final · IIC2531 Seguridad Computacional · Pontificia Universidad Católica de Chile"
author:
  - Gael Sánchez Lizana
  - Joaquín Chiyan Zhou Chen
  - Tomás Fluxá Armstrong
date: "Noviembre de 2026"
---

# Resumen

Los servidores de Minecraft Java están expuestos a abuso en el tráfico de juego:
paquetes malformados, movimiento imposible, cargas sobredimensionadas e inundaciones
de conexiones o de paquetes. Este trabajo estudia qué puede hacer un proxy defensivo
situado entre el cliente y el servidor para observar y contener ese abuso. Se
construyó un proxy para la versión vanilla 26.1, basado en `minecraft-protocol`, que
reenvía el tráfico entre cliente y backend y sobre él aplica un sistema de detección
con dos familias de reglas —una de tasa por tipo de paquete y otra de contenido
(tamaño, texto, libros, carga y distancia de movimiento)— en dos modos: *observe*,
que solo registra, y *enforce*, que desconecta ante la primera alerta.

La evaluación combinó una línea base de partidas reales (una sesión individual y una
de tres jugadores, con 4.222 y 72.338 paquetes registrados), una validación de la
detección con un cliente atacante de cinco patrones, y una comparación de impacto
sobre el servidor vanilla entre las condiciones sin proxy, *observe* y *enforce*. El
resultado principal: un ataque distribuido de 100 bots satura el servidor —la CPU del
proceso sube de ~1 % a un pico de 47 % y un jugador legítimo es expulsado—, y el
proxy en *enforce* lo contiene, desconectando 98 de las 100 sesiones y reduciendo los
paquetes un 76 %. La limitación más importante es que las reglas operan por conexión:
una inundación de login, que no llega al estado de juego, pasa sin ser detectada.
