# Historia del desarrollo

Cada entrada identifica con su usuario de GitHub a quien realizó el paso.

## Paso 1 · Preparé el servidor vanilla para la prueba

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Acepté la EULA de Minecraft y dejé el servidor vanilla con autenticación de cuentas para probar el acceso desde fuera de mi red.

**Por qué** La EULA era necesaria para arrancar el servidor. La autenticación permitía que Minecraft verificara las cuentas durante la prueba pública.

**Resultado** La configuración quedó con `eula=true`, `online-mode=true` y el servidor en `127.0.0.1:25566`.

## Paso 2 · Probé opciones para compartir el servidor

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Creé un túnel con Microsoft Dev Tunnels. Después configuré un túnel de Minecraft Java en Playit y compartí una captura de su panel.

**Por qué** Quería que un amigo de otra red pudiera entrar pegando una dirección en Minecraft. Con Playit, el programa se ejecuta en mi PC y mi amigo entra desde el juego.

**Resultado** En la captura inicial, el destino de Playit era `127.0.0.1:25565`. Para la prueba del servidor vanilla, el puerto local que correspondía era `25566`.

## Paso 3 · Arranqué el servidor desde PowerShell

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Ejecuté:

```powershell
Set-Location -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft'
& .\scripts\start-server.ps1
```

**Por qué** Necesitaba arrancar el servidor antes de probar el túnel con mi amigo.

**Resultado** Windows PowerShell 5.1 devolvió `PSSecurityException` porque la ejecución de scripts estaba deshabilitada. Para el siguiente intento recibí el comando con `-ExecutionPolicy RemoteSigned` acotado a una sesión. Después confirmé que el servidor y el enlace estaban funcionando.

## Paso 4 · Comprobé el acceso externo y cerré la prueba

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Un amigo entró desde fuera de mi red usando el enlace. Al terminar, cerré Playit y el servidor.

**Por qué** Quería comprobar que una persona en otra red podía entrar al vanilla. El cierre del túnel permitió continuar con la prueba local del proxy y el backend en modo offline.

**Resultado** Confirmé que mi amigo pudo entrar. Luego confirmé que había cerrado ambos procesos.

## Paso 5 · Jugué una partida y revisé el registro

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Entré al mundo, caminé, coloqué bloques, abrí el inventario y me desconecté antes de cerrar el proxy y el servidor. Luego ejecuté:

```powershell
Get-Content -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' -Tail 3
```

**Por qué** La partida debía generar paquetes del cliente durante el estado `play`. Revisé las últimas tres líneas para comprobar si el IDS había escrito sus metadatos.

**Resultado** PowerShell mostró una salida vacía. El incidente quedó registrado como tropiezo 1 en `tropiezos.md`.

## Paso 6 · Comprobé los puertos durante la prueba

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Revisé el puerto del proxy y el tamaño del registro. Después consulté las conexiones de ambos puertos.

```powershell
netstat -ano -p TCP | Select-String ':25565\s'
Get-Item -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' |
  Select-Object Length, LastWriteTime
netstat -ano -p TCP | Select-String ':2556[56]\s'
```

**Por qué** Tanto el servidor directo como el proxy permiten entrar al mismo mundo. Necesitaba identificar qué puerto estaba usando la conexión activa.

**Resultado** El JSONL medía 0 bytes. El proxy figuraba en `LISTENING` en `25565` y la conexión `ESTABLISHED` iba directamente al backend en `25566`.

## Paso 7 · Repetí la prueba por el proxy

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Repetí la conexión usando `127.0.0.1:25565` y volví a pedir las últimas tres líneas del JSONL con `Get-Content -Tail 3`.

**Por qué** Usar el puerto del proxy permite que el IDS observe los paquetes que envío durante el juego.

**Resultado** Aparecieron tres registros `tick_end` de la misma sesión, todos `serverbound` y de 1 byte. La última marca de tiempo correspondió a las 21:45:26.534 en Santiago. El registro en disco quedó verificado.

## Paso 8 · Conté los paquetes de la sesión

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Convertí cada línea del JSONL en un objeto de PowerShell, filtré por el ID de la sesión y agrupé los registros por nombre de paquete.

```powershell
Get-Content -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.type -eq 'packet' -and $_.sessionId -eq '5e05bd30-6a48-42b1-b941-78a9b188de80' } |
  Group-Object packet |
  Sort-Object Count -Descending |
  Select-Object Count, Name
```

**Por qué** Quería saber qué tipos de mensajes podía observar el IDS en una partida real y dejar una línea base antes de definir alertas.

**Resultado** La sesión produjo 4.222 registros de 15 tipos. Los más frecuentes fueron `tick_end` (3.430), `position` (240) y `look` (192). La tabla completa está en [resultados.md](resultados.md).

## Paso 9 · Medí los segundos más activos para `position`

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Filtré los paquetes `position` de la sesión, los agrupé por segundo UTC y mostré los cinco segundos con más paquetes.

```powershell
Get-Content -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.type -eq 'packet' -and $_.sessionId -eq '5e05bd30-6a48-42b1-b941-78a9b188de80' -and $_.packet -eq 'position' } |
  Group-Object { ([DateTimeOffset]$_.timestamp).UtcDateTime.ToString('yyyy-MM-dd HH:mm:ss') } |
  Sort-Object Count -Descending |
  Select-Object -First 5 Count, Name
```

**Por qué** La regla del IDS cuenta paquetes en ventanas de un segundo. Quería medir cuánto tráfico de posición puede producir una partida normal antes de elegir un límite.

**Resultado** Cada uno de los cinco segundos más activos tuvo 20 paquetes `position`. Guardé la tabla en [resultados.md](resultados.md) como referencia para la calibración.

## Paso 10 · Revisé las conexiones registradas tras jugar con amigos

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Jugué un rato con amigos. Después ejecuté esta consulta para ver las ocho sesiones más recientes del registro del proxy.

```powershell
Get-Content -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.type -eq 'packet' } |
  Group-Object sessionId |
  ForEach-Object {
    [pscustomobject]@{
      Inicio   = ([DateTimeOffset]$_.Group[0].timestamp).LocalDateTime
      Fin      = ([DateTimeOffset]$_.Group[-1].timestamp).LocalDateTime
      Paquetes = $_.Count
      Sesion   = $_.Name
    }
  } |
  Sort-Object Fin -Descending |
  Select-Object -First 8 |
  Format-Table -AutoSize
```

**Por qué** Quería comprobar qué conexiones habían pasado por el proxy y encontrar las que coincidieran con la hora de la partida.

**Resultado** Aparecieron ocho sesiones. Una tuvo 51.641 paquetes entre las 22:09:31 y las 22:31:16. Las otras siete fueron breves y tuvieron entre 3 y 245 paquetes cada una. Confirmé que jugamos tres personas, contándome, aproximadamente entre las 22:09 y las 22:31, y que Playit apuntaba al proxy en `127.0.0.1:25565`. La tabla quedó en [resultados.md](resultados.md). Para comprobar cuántas conexiones coincidieron en el tiempo queda pendiente consultar el intervalo completo.

## Paso 11 · Revisé el intervalo completo de la partida con amigos

**Usuario** `@tomiwapoREAL`
**Fecha** 21 de noviembre de 2026 (Santiago)

**Qué hice** Volví a consultar el JSONL, esta vez para ver todas las sesiones con paquetes entre las 22:09 y las 22:32.

```powershell
$desde = [DateTimeOffset]'2026-11-21T22:09:00-03:00'
$hasta = [DateTimeOffset]'2026-11-21T22:32:00-03:00'

Get-Content -LiteralPath 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\proxy\packets.jsonl' |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object {
    $hora = [DateTimeOffset]$_.timestamp
    $_.type -eq 'packet' -and $hora -ge $desde -and $hora -lt $hasta
  } |
  Group-Object sessionId |
  ForEach-Object {
    [pscustomobject]@{
      Inicio   = ([DateTimeOffset]$_.Group[0].timestamp).ToOffset($desde.Offset).ToString('HH:mm:ss.fff')
      Fin      = ([DateTimeOffset]$_.Group[-1].timestamp).ToOffset($desde.Offset).ToString('HH:mm:ss.fff')
      Paquetes = $_.Count
      Sesion   = $_.Name.Substring(0, 8)
    }
  } |
  Sort-Object Inicio |
  Format-Table -AutoSize
```

**Por qué** La consulta anterior seleccionaba las ocho sesiones más recientes. Consulté todo el intervalo para incluir también las conexiones que terminaron antes y poder comparar sus horarios.

**Resultado** La consulta devolvió 10 sesiones de conexión con 72.338 paquetes. Al cruzar sus marcas de tiempo, el mayor solapamiento observado fue de 2 sesiones. La tabla y los intervalos están en [resultados.md](resultados.md).

## Paso 12 · Revisé el log del servidor por las desconexiones

**Usuario** `@tomiwapoREAL`
**Fecha** 22 de noviembre de 2026 (Santiago)

**Qué hice** Busqué en el log del servidor los avisos y las desconexiones del tramo final de la partida del 21 de noviembre.

```powershell
$log = 'C:\Users\tomif\OneDrive\Documentos\Security Craft\.local\server\logs\latest.log'
$eventos = '/(WARN|ERROR|FATAL)\]:|lost connection|left the game|disconnect|packet|paquete|equipment|equipamiento'

Get-Content -LiteralPath $log | Where-Object {
  $_ -match '^\[22:(29|30|31|32):\d{2}\]' -and
  $_ -notmatch '\]:\s*(?:\[Not Secure\]\s*)?<' -and
  $_ -match $eventos
}
```

**Por qué** Al final de la partida, el juego nos desconectó a un amigo y a mí. Quería encontrar el mensaje de paquetes y equipamiento que había visto en Minecraft.

**Resultado** El servidor mostró varias desconexiones con el motivo `Disconnected`. A las 22:31:38 quedaron registrados dos cierres en el mismo segundo. La revisión sigue en el log del cliente. El incidente quedó anotado como tropiezo 2 en [tropiezos.md](tropiezos.md).

## Paso 13 · Encontré el error de equipamiento en el log del cliente

**Usuario** `@tomiwapoREAL`
**Fecha** 22 de noviembre de 2026 (Santiago)

**Qué hice** Busqué el error en el `latest.log` del perfil `Security Craft` de Modrinth.

```powershell
$carpetaLogs = 'C:\Users\tomif\AppData\Roaming\ModrinthApp\profiles\Security Craft\logs'
$logCliente = Join-Path $carpetaLogs 'latest.log'

Select-String -LiteralPath $logCliente `
  -Pattern 'equipment|equipamiento|DecoderException|EncoderException|failed to (decode|encode|handle)|error handling packet|network protocol error|internal exception' `
  -Context 1,5
```

**Por qué** El servidor solo había registrado `Disconnected`. Quería recuperar el mensaje que mostró Minecraft para identificar qué paquete estaba leyendo cuando se cerró la conexión.

**Resultado** Encontré el mismo `DecoderException` a las 22:31:24, 22:31:38 y 22:31:52 del 21 de noviembre. Mi cliente se desconectó al encontrar 18 bytes sobrantes mientras leía un paquete `minecraft:set_equipment`. La evidencia quedó en [tropiezos.md](tropiezos.md).
