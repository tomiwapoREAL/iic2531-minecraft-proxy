# Anexo · Cómo reproducir

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| `src/proxy.mjs` | Proxy, puente de sesiones y línea de comandos |
| `src/ids.mjs` | Observador de tasa |
| `src/rules.mjs` | Reglas de contenido |
| `src/attacker.mjs` | Cliente atacante |
| `src/*.test.mjs` | Pruebas unitarias (`npm test`) |
| `scripts/prepare-server.ps1` | Descarga verificada del servidor 26.1 y de OpenJDK 25 |
| `scripts/start-server.ps1` | Arranque del backend en `127.0.0.1:25566` |
| `scripts/experimentos.mjs` | Secuencia de ataques y conteo de alertas por ataque |
| `scripts/analizar-registro.mjs` | Resumen de un JSONL por sesión y en total |
| `config/server.properties.example` | Configuración del backend de laboratorio |
| `historia.md`, `tropiezos.md`, `resultados.md` | Bitácoras y datos del laboratorio |

## Preparación

Requisitos: Windows con PowerShell 5.1 o posterior y Node.js 24 o posterior. El script de preparación instala Java 25 en una carpeta local. Desde la raíz del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\prepare-server.ps1
npm.cmd ci
npm.cmd test
```

El primer arranque del servidor genera `.local/server/eula.txt`. Para continuar hay que aceptar la EULA cambiando `eula=false` por `eula=true`. Luego:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\start-server.ps1
```

## Comandos por experimento

Cada comando va en su propia terminal. El servidor tiene que estar arrancado.

**Experimento 1: línea base con un cliente oficial.**

```powershell
node .\src\proxy.mjs
```

Luego se entra con Minecraft Java 26.1 a `127.0.0.1:25565`, y se resume el registro:

```powershell
node .\scripts\analizar-registro.mjs .local\proxy\packets.jsonl
```

**Experimentos 2 y 3: ataques.** El atacante no tiene cuenta, así que el proxy se arranca con `--online false`:

```powershell
node .\src\proxy.mjs --online false --mode observe --rate "arm_animation=60"
```

```powershell
node .\scripts\experimentos.mjs --port 25565 --etiqueta observe
```

Para la condición *enforce* se repite con `--mode enforce` y `--etiqueta enforce`. Para la condición sin proxy, el script apunta directo al backend:

```powershell
node .\scripts\experimentos.mjs --port 25566 --sin-registro --etiqueta sin-proxy
```

Estrés del servidor, con 100 bots durante 45 segundos que avanzan 8 bloques por envío (la corrida reportada en [Resultados](04-resultados.md#impacto-sobre-el-servidor-vanilla)):

```powershell
node .\src\attacker.mjs --attack server_stress --bots 100 --duration 45 --step 8
```

Un ataque individual:

```powershell
node .\src\attacker.mjs --attack packet_flood --count 400
```

**Experimento 4: proxy sin registro.**

```powershell
node .\src\proxy.mjs --no-record
```

## Versión evaluada

Los resultados finales se obtuvieron con el commit `f333698` de `develop`; en esa versión el código del proxy, el atacante y los scripts son los que se describen en este anexo, y las 10 pruebas unitarias pasan.
