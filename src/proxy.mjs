import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import protocol from 'minecraft-protocol';
import { nameToMcOfflineUUID } from 'minecraft-protocol/src/datatypes/uuid.js';
import { observePlayerPackets } from './ids.mjs';

const version = '26.1';
const host = '127.0.0.1';
const backendPort = 25566;
const { LOGIN, CONFIGURATION, PLAY } = protocol.states;

export function createProxy({ port = 25565, onlineMode = true, onRecord, limits = {} } = {}) {
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

  proxy.on('login', player => bridgeSession(proxy, player));
  if (onRecord) {
    proxy.on('playerJoin', player => observePlayerPackets(player, { onRecord, limits }));
  }
  return proxy;
}

function bridgeSession(proxy, player) {
  const backend = new protocol.Client(false, version, undefined, true);
  const pending = [];
  let pendingBytes = 0;
  let backendAccepted = false;
  let joined = false;
  let closed = false;
  const joinTimer = setTimeout(() => endSession('Tiempo de espera del backend agotado'), 30_000);

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

  player.on('packet', (_data, metadata, _buffer, frame) => {
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

    backend.writeRaw(frame);
    if (state === CONFIGURATION && name === 'finish_configuration') {
      backend.state = PLAY;
      player.state = PLAY;
      if (!joined) {
        joined = true;
        clearTimeout(joinTimer);
        proxy.emit('playerJoin', player);
      }
    } else if (state === PLAY && name === 'configuration_acknowledged') {
      backend.state = CONFIGURATION;
      player.state = CONFIGURATION;
    }
  });

  backend.on('packet', (_data, { state }, _buffer, frame) => {
    if (!closed && state === player.state && (state === CONFIGURATION || state === PLAY)) {
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
    console.log(`Proxy Minecraft ${version} en ${host}:25565 → ${host}:${backendPort}`);
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
