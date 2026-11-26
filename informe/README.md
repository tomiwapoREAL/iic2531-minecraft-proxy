# Informe final

Esta carpeta contiene el informe escrito del proyecto final de IIC2531. Hay un archivo por sección, y al final se juntan todos en un PDF (ver [Armar el PDF](#armar-el-pdf)).

Lo que falta está marcado en el texto. `**[PENDIENTE: …]**` indica un dato o una medición que todavía no existe. `**[CONFIRMAR: …]**` indica algo que alguien del equipo tiene que verificar. Para ver todo lo que queda:

```powershell
Select-String -Path informe\*.md -Pattern 'PENDIENTE|CONFIRMAR'
```

## Estado

| Archivo | Sección | Estado |
| --- | --- | --- |
| [00-resumen.md](00-resumen.md) | Resumen | Completo |
| [01-contexto.md](01-contexto.md) | Contexto y problema | Completo |
| [02-arquitectura.md](02-arquitectura.md) | Diseño del proxy e IDS | Completo, con figura, límites justificados y ejemplos de alerta |
| [03-metodologia.md](03-metodologia.md) | Metodología | Completo |
| [04-resultados.md](04-resultados.md) | Resultados | Completo. Los falsos positivos quedan sin medir de forma directa, y así se declara |
| [05-limitaciones.md](05-limitaciones.md) | Limitaciones y cambios de alcance | Completo, con la comparación contra la propuesta |
| [06-etica.md](06-etica.md) | Consideraciones éticas | Completo. Falta confirmar el consentimiento en la partida con amigos |
| [07-conclusiones.md](07-conclusiones.md) | Conclusiones y aprendizajes | Completo |
| [08-reproducibilidad.md](08-reproducibilidad.md) | Anexo: cómo reproducir | Completo. Falta el hash del commit final |

## Qué pide la pauta

[Pauta de la entrega final](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/EntregaFinal.md)

- El informe debe entenderse por sí solo y contar la misma historia que la presentación. Tiene que cubrir qué hicimos, por qué es relevante, cómo lo hicimos, qué resultados obtuvimos y qué aprendimos.
- Debe incluir contexto, metodología, resultados, limitaciones y conclusiones.
- La pauta no fija formato ni extensión, y aclara que el largo no se evalúa por sí mismo.
- Hay que explicar supuestos, alcance, lo que quedó fuera y cómo cambió el proyecto respecto de la propuesta.
- Un resultado negativo cuenta si la metodología fue rigurosa y discutimos las limitaciones con honestidad.
- Ponderaciones: trabajo, metodología y resultados (35 %), profundidad técnica y seguridad (25 %), claridad del problema y del alcance (15 %), informe y materiales (15 %), presentación (10 %).

## Convenciones

- **Rama.** El informe vive en `feat/informe`. Haz `git pull` antes de empezar y commits pequeños. Si dos personas tocan la misma sección a la vez, avísense.
- **Cifras con fuente.** Cada número debe poder rastrearse hasta [resultados.md](../resultados.md), un JSONL o un log. Si una cifra todavía no existe, escribe `**[PENDIENTE: …]**` en vez de inventarla.
- **Figuras.** Guarda las figuras en [figuras/](figuras/). Si las genera un script, deja el script en `scripts/` para poder regenerarlas.
- **Horas.** Indica la zona horaria. El JSONL registra en UTC y las bitácoras usan la hora de Santiago.
- **Títulos.** Cada archivo abre con un único título `#`. Usa `##` y `###` para las subsecciones.

## Armar el PDF

Hace falta [pandoc](https://pandoc.org/installing.html) y, para generar PDF, un motor LaTeX (por ejemplo MiKTeX o TeX Live). Desde la raíz del repo:

```powershell
pandoc (Get-ChildItem informe\0*.md | Sort-Object Name).FullName -o informe\informe.pdf --toc -V lang=es -V geometry:margin=2.5cm --resource-path=informe
```

Sin LaTeX se puede generar un `.docx` y exportarlo a PDF desde Word o Google Docs:

```powershell
pandoc (Get-ChildItem informe\0*.md | Sort-Object Name).FullName -o informe\informe.docx --toc --resource-path=informe
```

### Versión compacta (DOCX de 14 páginas para exportar desde Word)

`informe\referencia-compacta.docx` es una plantilla de pandoc (fuente 9 pt, márgenes ~1,2 cm, espaciado reducido y títulos más chicos). Produce un `.docx` denso que Word exporta a PDF en 14 páginas con su estilo normal:

```powershell
pandoc (Get-ChildItem informe\0*.md | Sort-Object Name).FullName -o informe\informe-compacto.docx --toc --resource-path=informe --reference-doc=informe\referencia-compacta.docx
```

Ábrelo en Word → **Guardar como → PDF**. Los artefactos generados (`*.pdf`, `*.docx`, `*.html`) están en `.gitignore`, salvo la plantilla `referencia-compacta.docx` y el PDF de entrega `informe-compacto.pdf`.

También existe `informe\estilo.css`, un estilo alternativo para armar el PDF vía pandoc → HTML → navegador (Chrome/Edge `--headless --print-to-pdf`), por si se prefiere ese camino en vez de Word.
