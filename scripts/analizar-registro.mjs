// Analiza un registro JSONL del proxy y resume la detección.
// Uso: node scripts/analizar-registro.mjs .local/proxy/packets.jsonl
//
// Reporta, por sesión y en total: paquetes observados, alertas por regla y
// acciones de desconexión. Sirve para armar la tabla de resultados comparando
// tráfico normal (sin alertas) contra sesiones de ataque.

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const path = process.argv[2];
if (!path) {
  process.stderr.write('uso: node scripts/analizar-registro.mjs <archivo.jsonl>\n');
  process.exit(1);
}

const sessions = new Map();
const totals = { packets: 0, alerts: 0, actions: 0, byRule: {}, byPacket: {} };

function session(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { packets: 0, alerts: 0, actions: 0, byRule: {}, firstTs: null, lastTs: null });
  }
  return sessions.get(id);
}

const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  const text = line.trim();
  if (!text) continue;
  let event;
  try { event = JSON.parse(text); } catch { continue; }

  const s = session(event.sessionId ?? 'sin-sesion');
  if (event.timestamp) {
    s.firstTs ??= event.timestamp;
    s.lastTs = event.timestamp;
  }

  if (event.type === 'packet') {
    s.packets++; totals.packets++;
    if (event.packet) totals.byPacket[event.packet] = (totals.byPacket[event.packet] ?? 0) + 1;
  } else if (event.type === 'alert') {
    s.alerts++; totals.alerts++;
    s.byRule[event.rule] = (s.byRule[event.rule] ?? 0) + 1;
    totals.byRule[event.rule] = (totals.byRule[event.rule] ?? 0) + 1;
  } else if (event.type === 'action') {
    s.actions++; totals.actions++;
  }
}

const top = Object.entries(totals.byPacket).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('=== Totales ===');
console.log(`paquetes: ${totals.packets}`);
console.log(`alertas: ${totals.alerts} ${JSON.stringify(totals.byRule)}`);
console.log(`acciones disconnect: ${totals.actions}`);
console.log('tipos de paquete mas frecuentes:');
for (const [name, count] of top) {
  console.log(`  ${name}: ${count} (${((count / totals.packets) * 100).toFixed(1)}%)`);
}

console.log('\n=== Por sesion ===');
const ordered = [...sessions.entries()].sort((a, b) => (a[1].firstTs ?? '').localeCompare(b[1].firstTs ?? ''));
for (const [id, s] of ordered) {
  const rules = s.alerts ? ` reglas=${JSON.stringify(s.byRule)}` : '';
  console.log(`${id.slice(0, 8)} paquetes=${s.packets} alertas=${s.alerts}${rules} disconnect=${s.actions}`);
}
