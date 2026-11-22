# Proxy defensivo para Minecraft Java

Proyecto final de Seguridad Computacional IIC2531, Pontificia Universidad Católica de Chile. Integrantes — Gael Sánchez Lizana, Joaquín Chiyan Zhou Chen y Tomás Fluxá Armstrong.

El proyecto evalúa qué tráfico de juego puede observar un proxy, cuántas alertas aparecen en partidas normales y qué impacto tiene el registro. El primer hito es una partida vanilla 26.1 que produce un registro JSONL a través del proxy. [Enunciado](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/FinalProject.md) · [Pauta](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/EntregaFinal.md)

## Preparar el entorno en Windows

Desde PowerShell, en la raíz del repositorio, comprueba `java -version`, `node --version` y `npm.cmd --version`. Usa [Node.js](https://nodejs.org/en/download) 24 o posterior. La dependencia `minecraft-protocol` está fijada en `1.67.0`, que incorporó soporte para 26.1. [Historial de versiones](https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/docs/HISTORY.md)

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\prepare-server.ps1
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

1. Ejecuta `powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\start-server.ps1`. El primer arranque genera `.local/server/eula.txt` y se detiene hasta que aceptes la licencia. Lee la EULA y, si estás de acuerdo, abre ese archivo y cambia `eula=false` por `eula=true`. [EULA de Minecraft](https://www.minecraft.net/en-us/eula)
2. Ejecuta de nuevo el mismo comando y espera `Done` en la consola. Mantén esa consola abierta. Usa `stop` para apagar el servidor y guardar el mundo.
3. En Minecraft Launcher, abre **Instalaciones** y crea una instalación de Java Edition con la versión **release 26.1**. Iníciala y entra desde **Multijugador → Conexión directa** con `127.0.0.1:25566`. Entra al mundo, quédate quieto, camina y abre el inventario.

## Prueba a través del proxy

1. Desactiva cualquier túnel que apunte al backend y detén el servidor. En `.local/server/server.properties`, configura `server-ip=127.0.0.1`, `server-port=25566`, `online-mode=false` y `enforce-secure-profile=false`. Vuelve a arrancar el servidor.
2. En una segunda terminal, desde la raíz del proyecto, ejecuta `node .\src\proxy.mjs`. En Minecraft Java **26.1**, conecta a `127.0.0.1:25565` con una cuenta autenticada en el Launcher.
3. Entra al mundo, quédate quieto, camina y abre y cierra el inventario. Revisa `.local/proxy/packets.jsonl`. Para medir el reenvío sin escribir registros, repite la sesión con `node .\src\proxy.mjs --no-record`.

### Autenticación, aislamiento y registro

El proxy autentica la cuenta del jugador con los servicios de sesión de Minecraft. El backend offline acepta el nombre que le entrega el proxy y usa el UUID derivado de ese nombre. Ese UUID identifica el perfil que usa el mundo en la demo offline. El backend escucha en loopback y otros procesos locales pueden alcanzar el puerto. La exclusividad de acceso del proxy requiere una frontera adicional.

El backend proporciona los datos de `configuration` y el proxy los reenvía en ambos sentidos, igual que los de `play`. El observador registra la hora, un ID aleatorio de sesión, el tipo de paquete y el tamaño del búfer que entregó el intérprete. El archivo se abre en modo de anexado al arrancar. Para activar reglas, define `MINECRAFT_IDS_LIMITS` como un objeto JSON que asigne nombres de paquetes a límites enteros positivos. La regla usa ventanas fijas de un segundo por tipo de paquete y sesión. La ejecución por defecto registra una línea base con el mapa de límites vacío.

Una prueba automatizada conectó un cliente de protocolo 26.1 al backend vanilla a través del proxy en modo de prueba local. El cliente recibió los registros de configuración, el mundo y el inventario. El IDS observó el movimiento y los paquetes de mantenimiento de conexión. Las dos pruebas unitarias verifican también la alerta con eventos en memoria. La prueba con un cliente autenticado produjo registros JSONL de una partida real. La evaluación sigue con las alertas desactivadas y las mediciones comparativas de rendimiento están pendientes. [Resultados del laboratorio](resultados.md)

El JAR, el JDK, los mundos, los archivos locales del servidor y los registros quedan bajo `.local/`. Trabaja en una rama y abre un pull request hacia `main` para compartir los cambios con el equipo.

## Bitácoras del equipo

Escribe tu usuario de GitHub en cada entrada para que el equipo pueda identificar quién hizo la prueba o reportó el problema.

- **Historia del desarrollo.** Numera cada paso y anota la fecha, qué hiciste, por qué y qué resultado obtuviste. Incluye los comandos tal como los ejecutaste cuando ayuden a repetir el paso. [Consultar historia.md](historia.md)
- **Tropiezos.** Numera cada incidente y anota la fecha y hora, qué falló y qué archivos estuvieron involucrados y de qué manera. Incluye la evidencia y actualiza el estado de esa entrada cuando encuentres la causa, apliques una solución o identifiques qué falta comprobar. [Consultar tropiezos.md](tropiezos.md)
