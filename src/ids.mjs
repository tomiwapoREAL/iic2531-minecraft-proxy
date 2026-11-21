import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export function observePlayerPackets(client, {
  onRecord,
  limits = {},
  sessionId = randomUUID(),
  monotonicMs = () => performance.now(),
  now = () => new Date(),
} = {}) {
  if (typeof onRecord !== 'function') {
    throw new TypeError('onRecord debe ser una función.');
  }

  const packetLimits = new Map(Object.entries(limits));
  for (const [name, limit] of packetLimits) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError(`El límite de ${name} debe ser un entero positivo.`);
    }
  }

  const packetCounts = new Map();
  let currentWindow;

  function onPacket(_data, metadata, buffer) {
    if (metadata.state !== 'play') return;

    const window = Math.floor(monotonicMs() / 1_000);
    if (window !== currentWindow) {
      packetCounts.clear();
      currentWindow = window;
    }

    const event = {
      timestamp: now().toISOString(),
      sessionId,
      direction: 'serverbound',
      packet: metadata.name,
    };

    onRecord({ type: 'packet', ...event, sizeBytes: buffer.length });

    const limit = packetLimits.get(metadata.name);
    if (limit === undefined) return;

    const previousCount = packetCounts.get(metadata.name) ?? 0;
    if (previousCount > limit) return;

    const count = previousCount + 1;
    packetCounts.set(metadata.name, count);
    if (previousCount === limit) {
      onRecord({ type: 'alert', ...event, rule: 'packet_rate', count, limit, windowMs: 1_000 });
    }
  }

  function detach() {
    client.off('packet', onPacket);
    client.off('end', detach);
    packetCounts.clear();
  }

  client.on('packet', onPacket);
  client.once('end', detach);
  return detach;
}
