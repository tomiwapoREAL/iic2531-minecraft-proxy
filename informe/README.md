# Informe final

Esta carpeta contiene el informe escrito del proyecto final de IIC2531. Hay un archivo por sección, para que cada integrante escriba la suya en su propia rama sin generar conflictos.

Cada sección empieza con un bloque de notas (`> **Notas para quien escribe**`) que indica qué debe cubrir y qué material del repo se puede reutilizar. **Borra ese bloque cuando la sección esté terminada.**

## Reparto y estado

| Archivo | Sección | Responsable | Estado |
| --- | --- | --- | --- |
| [00-resumen.md](00-resumen.md) | Resumen | _pendiente_ | Esqueleto |
| [01-contexto.md](01-contexto.md) | Contexto y problema | _pendiente_ | Esqueleto |
| [02-arquitectura.md](02-arquitectura.md) | Diseño del proxy e IDS | _pendiente_ | Esqueleto |
| [03-metodologia.md](03-metodologia.md) | Metodología | _pendiente_ | Esqueleto |
| [04-resultados.md](04-resultados.md) | Resultados | _pendiente_ | Esqueleto |
| [05-limitaciones.md](05-limitaciones.md) | Limitaciones y cambios de alcance | _pendiente_ | Esqueleto |
| [06-etica.md](06-etica.md) | Consideraciones éticas | _pendiente_ | Esqueleto |
| [07-conclusiones.md](07-conclusiones.md) | Conclusiones y aprendizajes | _pendiente_ | Esqueleto |
| [08-reproducibilidad.md](08-reproducibilidad.md) | Anexo: cómo reproducir | _pendiente_ | Esqueleto |

Estados sugeridos: `Esqueleto` → `Borrador` → `En revisión` → `Listo`.

## Qué pide la pauta

[Pauta de la entrega final](https://github.com/nachoparada/IIC2531/blob/main/2026-2/FinalProject/EntregaFinal.md)

- El informe debe entenderse por sí solo y contar la misma historia que la presentación. Tiene que cubrir qué hicimos, por qué es relevante, cómo lo hicimos, qué resultados obtuvimos y qué aprendimos.
- Debe incluir contexto, metodología, resultados, limitaciones y conclusiones.
- La pauta no fija formato ni extensión, y aclara que el largo no se evalúa por sí mismo.
- Hay que explicar supuestos, alcance, lo que quedó fuera y cómo cambió el proyecto respecto de la propuesta.
- Un resultado negativo cuenta si la metodología fue rigurosa y discutimos las limitaciones con honestidad.
- Ponderaciones: trabajo, metodología y resultados (35 %), profundidad técnica y seguridad (25 %), claridad del problema y del alcance (15 %), informe y materiales (15 %), presentación (10 %).

## Convenciones

- **Rama y PR.** Trabaja en una rama propia que salga de `feat/informe`, por ejemplo `informe/resultados`. Abre el PR hacia `feat/informe` y pide que lo revise alguien que no escribió esa sección.
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
