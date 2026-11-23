# Anexo · Cómo reproducir

> **Notas para quien escribe**
>
> - La pauta pide el código acompañado de instrucciones mínimas: estructura del repo, dependencias y cómo reproducir la demo y los resultados.
> - Resume el [README.md](../README.md) sin copiarlo entero:
>   - preparar el entorno;
>   - arrancar el servidor;
>   - arrancar el proxy con sus flags;
>   - correr los ataques y analizar el JSONL.
> - Incluye los comandos exactos usados en cada experimento de [03-metodologia.md](03-metodologia.md) y la versión del repo (hash del commit) con que se obtuvieron los resultados.

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| `src/proxy.mjs` | Proxy, puente de sesiones y CLI |
| `src/ids.mjs` | Observador de tasa |
| `src/rules.mjs` | Reglas de contenido |
| `src/attacker.mjs` | Cliente atacante |
| `src/*.test.mjs` | Pruebas unitarias (`npm test`) |
| `scripts/prepare-server.ps1` | Descarga verificada del servidor 26.1 y de OpenJDK 25 |
| `scripts/start-server.ps1` | Arranque del backend en `127.0.0.1:25566` |
| `scripts/experimentos.mjs` | Secuencia de ataques y conteo de alertas |
| `scripts/analizar-registro.mjs` | Resumen de un JSONL por sesión |
| `historia.md`, `tropiezos.md`, `resultados.md` | Bitácoras y datos del laboratorio |

## Preparación

**[PENDIENTE]**

## Comandos por experimento

**[PENDIENTE]**

## Versión evaluada

**[PENDIENTE: hash del commit]**
