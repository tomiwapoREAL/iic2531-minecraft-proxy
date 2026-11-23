# Consideraciones éticas

**Ataques solo contra infraestructura propia.** El cliente atacante y el estrés del servidor se ejecutaron contra un proxy y un servidor nuestros, en `127.0.0.1`. Ningún ataque se dirigió a servidores de terceros ni a la infraestructura de Mojang. El atacante usa autenticación *offline*, así que no necesita ni usa cuentas reales.

**Partida con otras personas.** La línea base incluye una partida con amigos que se conectaron desde fuera de la red local, a través de un túnel de Playit hacia el proxy. Durante esa partida:

- el cliente atacante y el modo *enforce* todavía no existían, así que no hubo ataques y el proxy no podía desconectar a nadie: solo registraba metadatos;
- el túnel se cerró al terminar;
- **[CONFIRMAR: que los participantes sabían que la partida pasaba por un proxy que registraba metadatos del tráfico, y que estuvieron de acuerdo.]**

**Minimización de datos.** El IDS registra solo el tipo de paquete, su tamaño, la hora, la dirección y un ID de sesión aleatorio. No guarda el contenido del chat ni de los libros, ni coordenadas, nombres de usuario o direcciones IP. Las reglas de contenido leen el paquete en memoria para evaluarlo, pero las alertas solo guardan cifras: largos, tamaños, distancias y el nombre del canal en el caso de `custom_payload`. Los registros y los mundos quedan en `.local/`, que está excluido del repositorio.

Esta seudonimización es débil. El ID de sesión no está vinculado al nombre del jugador, pero las marcas de tiempo del JSONL se pueden cruzar con el log del servidor, que sí registra nombres y horas de conexión. Nosotros mismos lo hicimos para diagnosticar las desconexiones. Cualquier publicación de los registros debería tenerlo en cuenta.

**Credenciales.** En modo *online* la autenticación la hacen el cliente y los servicios de Mojang. El proxy recibe la identidad verificada del jugador, pero nunca ve su contraseña.

**Licencia.** La EULA de Minecraft se aceptó explícitamente antes de arrancar el servidor local. El JAR del servidor no se redistribuye: el script de preparación lo descarga de la fuente oficial.

**Publicación del cliente atacante.** El atacante implementa patrones de abuso conocidos y públicos, sin explotar ninguna vulnerabilidad nueva del servidor. Aun así, apunta por defecto a `127.0.0.1:25565`, y su ayuda indica dirigirlo al proxy del laboratorio.

**[CONFIRMAR: las bitácoras (`historia.md` y `tropiezos.md`) incluyen rutas locales con nombres de usuario de Windows. Decidir si se dejan así en la entrega.]**
