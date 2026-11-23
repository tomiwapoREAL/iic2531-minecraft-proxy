# Consideraciones éticas

> **Notas para quien escribe**
>
> - La pauta evalúa que las pruebas ofensivas se hagan de forma responsable: sin interrumpir servicios ajenos, sin acceder a datos de terceros, sin recolectar credenciales reales y sin explotar más allá de una demostración controlada.
> - Puntos a cubrir con lo que realmente hicimos:
>   - **Ataques solo contra infraestructura propia.** El cliente atacante y `server_stress` apuntaron a `127.0.0.1`, contra un servidor y un proxy nuestros.
>   - **Partida con amigos por Playit.** Hubo terceros conectados ([historia.md](../historia.md), pasos 2, 4 y 10). Explica que los jugadores sabían que la partida pasaba por un proxy que registraba metadatos, que no se corrieron ataques durante esa sesión y que el túnel se cerró al terminar. **[Confirmar estos puntos con Tomás.]**
>   - **Minimización de datos.** El IDS registra el tipo de paquete, el tamaño, la hora y un ID de sesión aleatorio. No guarda el contenido del chat, las coordenadas ni los nombres. Las reglas de contenido inspeccionan el payload en memoria, pero las alertas solo guardan longitudes y cifras. Los JSONL quedan en `.local/` y no se versionan.
>   - **Credenciales.** La autenticación la hace Mojang. El proxy nunca ve contraseñas.
>   - **EULA de Minecraft.** Se aceptó para el servidor local.
> - Si algo no se cumplió del todo, dilo. Por ejemplo, si a alguien no se le avisó del registro, o si las bitácoras incluyen rutas con nombres de usuario.

**[PENDIENTE]**
