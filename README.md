# Proxy defensivo para Minecraft Java

Proyecto final de Seguridad Computacional IIC2531, Pontificia Universidad Católica de Chile. Integrantes — Gael Sánchez Lizana, Joaquín Chiyan Zhou Chen y Tomás Fluxá Armstrong.

El proyecto evalúa qué tráfico de juego puede observar un proxy, cuántas alertas aparecen en partidas normales y qué impacto tiene el registro. El primer hito es una partida vanilla 26.1 que produce un registro JSONL a través del proxy. [Enunciado](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/FinalProject.md) · [Pauta](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/EntregaFinal.md)

## Preparar el entorno en Windows

Desde PowerShell, en la raíz del repositorio, comprueba `java -version`, `node --version` y `npm.cmd --version`. Usa [Node.js](https://nodejs.org/en/download) 24 o posterior. La dependencia `minecraft-protocol` está fijada en `1.67.0`, que incorporó soporte para 26.1. [Historial de versiones](https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/docs/HISTORY.md)

```powershell
& .\scripts\prepare-server.ps1
npm.cmd ci
npm.cmd test
```

El script obtiene el servidor vanilla **26.1** desde el manifiesto oficial de Mojang y verifica el SHA-1 de los metadatos y del JAR. Instala Microsoft OpenJDK 25 en `.local/` y comprueba el SHA-256 del ZIP publicado por Microsoft. Usa Java local al arrancar y mantiene intacto el `PATH`. [Publicación de Minecraft 26.1](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-1) · [Descargas de OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download-major-urls)

### Verificación del entorno

| Componente | Resultado del 21 de noviembre de 2026 |
| --- | --- |
| Windows | x64, compilación 26200 |
| Node.js y npm | `24.16.0` y `11.13.0` |
| Java para el servidor | Microsoft OpenJDK `25.0.5.1+2-LTS` |
| JAR vanilla `26.1` | SHA-1 `3872a7f07a1a595e651aef8b058dfc2bb3772f46`, coincide con el manifiesto oficial |
| `minecraft-protocol` `1.67.0` | Protocolo `775` para `26.1`. Se crearon los serializadores para ambos sentidos en `login`, `configuration` y `play`. |
| Observador IDS | Dos pruebas unitarias aprobadas con eventos en memoria |

## Prueba directa

1. Ejecuta `& .\scripts\start-server.ps1`. El primer arranque genera `.local/server/eula.txt` y se detiene hasta que aceptes la licencia. Lee la EULA y, si estás de acuerdo, abre ese archivo y cambia `eula=false` por `eula=true`. [EULA de Minecraft](https://www.minecraft.net/en-us/eula)
2. Ejecuta de nuevo `& .\scripts\start-server.ps1` y espera `Done` en la consola. Mantén esa consola abierta. Usa `stop` para apagar el servidor y guardar el mundo.
3. En Minecraft Launcher, abre **Instalaciones** y crea una instalación de Java Edition con la versión **release 26.1**. Iníciala y entra desde **Multijugador → Conexión directa** con `127.0.0.1:25566`. Entra al mundo, quédate quieto, camina y abre el inventario.

## Alcance de la prueba

El backend de laboratorio usa `online-mode=false` y `enforce-secure-profile=false`. En la prueba directa el backend acepta el nombre que envía el cliente sin verificarlo con los servicios de sesión de Minecraft. La arquitectura prevista delega esa autenticación al proxy en `127.0.0.1:25565`. El bind de `127.0.0.1:25566` limita conexiones a la máquina local. Los demás procesos de la misma máquina también pueden llegar al puerto, por lo que el aislamiento exclusivo del proxy requiere una frontera adicional.

El observador suministrado se prueba con eventos en memoria. Registra solo metadatos de paquetes del jugador que la biblioteca ya interpretó en el estado `play`. Su regla de tasa usa ventanas fijas de un segundo por tipo de paquete y sesión. El mapa vacío permite capturar la línea base sin activar reglas. La integración y la medición con el cliente vanilla se verifican después de la prueba directa.

El JAR, el JDK, los mundos, los archivos locales del servidor y los registros quedan bajo `.local/`. Trabaja en una rama y abre un pull request hacia `main` para compartir los cambios con el equipo.
