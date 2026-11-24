// Corre la secuencia de ataques contra un proxy que YA está en ejecución y
// atribuye a cada ataque las alertas que el proxy escribió en su JSONL durante
// la ventana del ataque (leyendo solo lo que se agregó al archivo).
//
// Uso típico (tres corridas, una por condición):
//   # 1) sin proxy: apunta al backend y no hay registro que leer
//   node scripts/experimentos.mjs --port 25566 --sin-registro --etiqueta sin-proxy
//   # 2) proxy en observe (arráncalo aparte con MINECRAFT_PROXY_MODE=observe)
//   node scripts/experimentos.mjs --port 25565 --etiqueta observe
//   # 3) proxy en enforce (arráncalo aparte con MINECRAFT_PROXY_MODE=enforce)
//   node scripts/experimentos.mjs --port 25565 --etiqueta enforce
//
// No arranca el proxy ni el server: eso se hace aparte para poder mirar la
// consola del server en vivo. Este script solo ejerce los ataques y ordena los
// números del lado del proxy.

import { createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { ATTACKS } from '../src/attacker.mjs';

const { values } = parseArgs({ options: {
  host: { type: 'string', default: '127.0.0.1' },
  port: { type: 'string', default: '25565' },
  version: { type: 'string', default: '26.1' },
  log: { type: 'string', default: '.local/proxy/packets.jsonl' },
  'sin-registro': { type: 'boolean', default: false },
  etiqueta: { type: 'string', default: 'corrida' },
  'flood-count': { type: 'string', default: '2000' },
  'login-count': { type: 'string', default: '200' },
  help: { type: 'boolean', default: false },
} });

if (values.help) {
  process.stdout.write('uso: node scripts/experimentos.mjs --port <p> [--etiqueta obs] [--sin-registro]\n');
  process.exit(0);
}

const host = values.host;
const port = Number(values.port);
const version = values.version;
const logPath = values.log;
const conRegistro = !values['sin-registro'];

// Plan de ataques en orden. count se adapta por ataque.
const plan = [
  { name: 'packet_flood', opts: { count: Number(values['flood-count']) } },
  { name: 'oversized_payload', opts: {} },
  { name: 'impossible_movement', opts: { count: 20 } },
  { name: 'login_flood', opts: { count: Number(values['login-count']) } },
];

function logSize() {
  try { return statSync(logPath).size; } catch { return 0; }
}

// Lee solo los bytes agregados al JSONL desde `offset` y cuenta alertas/acciones.
async function tallySince(offset) {
  const tally = { packets: 0, alerts: 0, actions: 0, byRule: {} };
  const end = logSize();
  if (!conRegistro || end <= offset) return tally;
  const rl = createInterface({ input: createReadStream(logPath, { start: offset, end: end - 1 }), crlfDelay: Infinity });
  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;
    let e;
    try { e = JSON.parse(text); } catch { continue; }
    if (e.type === 'packet') tally.packets++;
    else if (e.type === 'alert') { tally.alerts++; tally.byRule[e.rule] = (tally.byRule[e.rule] ?? 0) + 1; }
    else if (e.type === 'action') tally.actions++;
  }
  return tally;
}

const rows = [];

console.log(`\n### Corrida: ${values.etiqueta}  (puerto ${port}, ${conRegistro ? 'con' : 'sin'} registro)\n`);

for (const { name, opts } of plan) {
  const before = logSize();
  const t0 = Date.now();
  let summary;
  try {
    summary = await ATTACKS[name]({ host, port, version, ...opts });
  } catch (error) {
    summary = { attack: name, error: error.message };
  }
  // Deja que el proxy termine de volcar el registro de la ventana.
  await new Promise(r => setTimeout(r, 700));
  const tally = await tallySince(before);
  const elapsed = Date.now() - t0;

  const reglas = tally.alerts ? Object.entries(tally.byRule).map(([k, v]) => `${k}:${v}`).join(' ') : '—';
  const enviado = summary.sent ?? (summary.outcomes ? JSON.stringify(summary.outcomes) : '—');
  const corte = summary.disconnected ? 'sí' : (summary.error ? `error:${summary.error}` : 'no');

  rows.push({ name, enviado, corte, alertas: tally.alerts, reglas, acciones: tally.actions, ms: elapsed });
  console.log(`- ${name}: enviado=${enviado} desconectado=${corte} alertas=${tally.alerts} (${reglas}) disconnects=${tally.actions} t=${elapsed}ms`);

  await new Promise(r => setTimeout(r, 1200)); // respiro entre ataques
}

// Tabla lista para pegar en resultados.md
console.log('\n#### Tabla (markdown)\n');
console.log(`| Ataque | Enviado | Desconectado | Alertas | Reglas | Disconnects |`);
console.log(`| --- | --- | --- | ---: | --- | ---: |`);
for (const r of rows) {
  console.log(`| ${r.name} | ${r.enviado} | ${r.corte} | ${r.alertas} | ${r.reglas} | ${r.acciones} |`);
}
console.log('');
process.exit(0);
