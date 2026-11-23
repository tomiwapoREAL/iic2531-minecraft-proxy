# Figuras

Guarda aquí las imágenes del informe (PNG o SVG). Si una figura se genera con un script, indica cuál en esta lista.

| Archivo | Sección | Origen |
| --- | --- | --- |
| `arquitectura.svg` / `arquitectura.png` | 02 Arquitectura | SVG hecho a mano. El PNG se genera desde el SVG (ver abajo) |

Para regenerar el PNG después de editar el SVG, desde PowerShell:

```powershell
$dir = (Resolve-Path informe\figuras).Path; & 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1280,680 "--user-data-dir=$env:TEMP\edge-svg-render" "--screenshot=$dir\arquitectura.png" ("file:///" + ($dir -replace '\','/') + "/arquitectura.svg")
```
