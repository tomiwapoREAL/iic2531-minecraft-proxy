import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import protocol from 'minecraft-protocol';
import { nameToMcOfflineUUID } from 'minecraft-protocol/src/datatypes/uuid.js';
import { observePlayerPackets } from './ids.mjs';
import { createContentRules } from './rules.mjs';

const version = '26.1';
const host = '127.0.0.1';
const backendPort = 25566;
const { LOGIN, CONFIGURATION, PLAY } = protocol.states;

export class BackendClient extends protocol.Client {
  constructor() {
    super(false, version, undefined, true);
  }

  setSerializer(state) {
    super.setSerializer(state);
    if (state !== PLAY) return;

    // El lector de equipamiento modifica el búfer. Conserva los bytes para writeRaw.
    const parsePacket = this.deserializer.parsePacketBuffer.bind(this.deserializer);
    this.deserializer.parsePacketBuffer = frame => {
      const parsed = parsePacket(Buffer.from(frame));
      parsed.fullBuffer = frame;
      return parsed;
    };
  }
}

export function createProxy({
  port = 25565,
  onlineMode = true,
  onRecord,
  limits = {},
  contentLimits = {},
  mode = 'observe',
} = {}) {
  if (mode !== 'observe' && mode !== 'enforce') {
    throw new RangeError("mode debe ser 'observe' o 'enforce'.");
  }

  const proxy = protocol.createServer({
    host, port, version,
    motd: 'IIC2531 - proxy defensivo',
    'online-mode': onlineMode,
    keepAlive: false,
    hideErrors: true,
    beforeLogin(player) {
      // La sesión ya se autenticó. Vanilla offline usa el UUID que deriva del nombre.
      player.uuid = nameToMcOfflineUUID(player.username);
    },
  });

  proxy.on('login', player => bridgeSession(proxy, player, { onRecord, rateLimits: limits, contentLimits, mode }));
  return proxy;
}

function bridgeSession(proxy, player, { onRecord, rateLimits = {}, contentLimits = {}, mode = 'observe' } = {}) {
  const backend = new BackendClient();
  const sessionId = randomUUID();
  const rules = createContentRules(contentLimits);
  const pending = [];
  let pendingBytes = 0;
  let backendAccepted = false;
  let joined = false;
  let closed = false;
  const joinTimer = setTimeout(() => endSession('Tiempo de espera del backend agotado'), 30_000);

  // Punto único de registro. En modo enforce, una alerta desconecta al jugador y
  // el paquete infractor no se reenvía (quien lo emite ya llamó a endSession).
  function record(event) {
    onRecord?.(event);
    if (mode === 'enforce' && event.type === 'alert' && !closed) {
      onRecord?.({
        type: 'action',
        timestamp: new Date().toISOString(),
        sessionId,
        action: 'disconnect',
        rule: event.rule,
        packet: event.packet,
      });
      endSession(`Desconectado por la regla ${event.rule}`);
    }
  }

  function endSession(reason) {
    if (closed) return;
    closed = true;
    clearTimeout(joinTimer);
    pending.length = 0;
    if (!backend.ended) backend.socket.destroy();
    if (!player.ended) player.end(reason);
  }

  function beginConfiguration() {
    if (!backendAccepted || player.state !== CONFIGURATION || closed) return;
    backend.write('login_acknowledged', {});
    backend.state = CONFIGURATION;
    for (const packet of pending) backend.writeRaw(packet);
    pending.length = 0;
    pendingBytes = 0;
  }

  // minecraft-protocol 1.67.0 instala un configurador local durante el login.
  // El backend vanilla envía los registros y paquetes de configuración reales.
  player.removeAllListeners('login_acknowledged');
  player.once('login_acknowledged', () => {
    player.state = CONFIGURATION;
    beginConfiguration();
  });
  for (const name of ['chat_session_update', 'chat_message', 'message_acknowledgement']) {
    player.removeAllListeners(name);
  }

  player.on('packet', (data, metadata, buffer, frame) => {
    const { name, state } = metadata;
    if (closed || (state !== CONFIGURATION && state !== PLAY)) return;
    if (backend.state !== state) {
      pendingBytes += frame.length;
      if (pendingBytes > 256 * 1024) {
        endSession('Búfer de configuración lleno');
        return;
      }
      pending.push(frame);
      return;
    }

    // Reglas de contenido sobre el payload ya interpretado por la biblioteca.
    // No altera el reenvío crudo: inspecciona y, en enforce, corta antes de pasar.
    if (state === PLAY) {
      for (const violation of rules.inspect(metadata, data, buffer)) {
        record({ type: 'alert', timestamp: new Date().toISOString(), sessionId, direction: 'serverbound', ...violation });
      }
      if (closed) return;
    }

    backend.writeRaw(frame);
    if (state === CONFIGURATION && name === 'finish_configuration') {
      backend.state = PLAY;
      player.state = PLAY;
      if (!joined) {
        joined = true;
        clearTimeout(joinTimer);
        proxy.emit('playerJoin', player);
        // Observador de tasa de ids.mjs: comparte sessionId y el mismo canal de
        // registro, de modo que sus alertas también activan enforce.
        observePlayerPackets(player, { onRecord: record, limits: rateLimits, sessionId });
      }
    } else if (state === PLAY && name === 'configuration_acknowledged') {
      backend.state = CONFIGURATION;
      player.state = CONFIGURATION;
    }
  });

  backend.on('packet', (data, metadata, _buffer, frame) => {
    const { state } = metadata;
    if (!closed && state === player.state && (state === CONFIGURATION || state === PLAY)) {
      if (state === PLAY) rules.noteServerMovement(metadata, data);
      player.writeRaw(frame);
    }
  });
  backend.once('connect', () => {
    backend.write('set_protocol', {
      protocolVersion: proxy.mcversion.version,
      serverHost: host,
      serverPort: backendPort,
      nextState: 2,
    });
    backend.state = LOGIN;
    backend.write('login_start', { username: player.username, playerUUID: player.uuid });
  });
  backend.once('compress', ({ threshold }) => { backend.compressionThreshold = threshold; });
  backend.once('success', ({ uuid }) => {
    if (uuid !== player.uuid) {
      endSession('El UUID del backend no coincide con el del laboratorio');
      return;
    }
    backendAccepted = true;
    beginConfiguration();
  });
  backend.once('encryption_begin', () => endSession('El backend de laboratorio debe usar online-mode=false'));
  backend.once('disconnect', () => endSession('El backend rechazó el inicio de sesión'));
  backend.on('error', () => endSession('Error en la conexión con el backend'));
  backend.once('end', () => endSession('El backend cerró la conexión'));
  player.once('end', () => endSession('El jugador cerró la conexión'));
  backend.setSocket(createConnection({ host, port: backendPort }));
}

function runLocalProxy() {
  const limits = JSON.parse(process.env.MINECRAFT_IDS_LIMITS ?? '{}');
  if (!limits || typeof limits !== 'object' || Array.isArray(limits) ||
      Object.values(limits).some(limit => !Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error('MINECRAFT_IDS_LIMITS debe ser un objeto JSON con límites enteros positivos.');
  }

  const contentLimits = JSON.parse(process.env.MINECRAFT_CONTENT_LIMITS ?? '{}');
  const mode = process.env.MINECRAFT_PROXY_MODE === 'enforce' ? 'enforce' : 'observe';

  const logDirectory = new URL('../.local/proxy/', import.meta.url);
  const logPath = new URL('packets.jsonl', logDirectory);
  let log;
  if (!process.argv.includes('--no-record')) {
    mkdirSync(logDirectory, { recursive: true });
    log = openSync(logPath, 'a');
  }

  function closeLog() {
    if (log === undefined) return;
    closeSync(log);
    log = undefined;
  }

  const proxy = createProxy({
    limits,
    contentLimits,
    mode,
    onRecord: log === undefined ? undefined : record => {
      if (log === undefined) return;
      try {
        writeSync(log, `${JSON.stringify(record)}\n`);
      } catch (error) {
        console.error(`Se detuvo el registro IDS (${error.code}).`);
        closeLog();
      }
    },
  });
  proxy.once('listening', () => {
    console.log(`Proxy Minecraft ${version} en ${host}:25565 → ${host}:${backendPort} (modo ${mode})`);
    if (log !== undefined) console.log(`Registro IDS: ${fileURLToPath(logPath)}`);
  });
  proxy.on('error', error => {
    console.error(`Error del proxy: ${error.message}`);
    process.exitCode = 1;
    closeLog();
  });
  proxy.once('close', closeLog);
  process.once('SIGINT', () => proxy.close());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocalProxy();
}
