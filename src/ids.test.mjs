import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import test from 'node:test';
import { observePlayerPackets } from './ids.mjs';

test('registra metadatos del estado play y limpia el observador al terminar', () => {
  const client = new EventEmitter();
  const records = [];
  observePlayerPackets(client, {
    onRecord: record => records.push(record),
    sessionId: 'test-session',
    now: () => new Date('2026-11-21T21:00:00.000Z'),
  });

  client.emit('packet', {}, { state: 'login', name: 'login_start' }, Buffer.alloc(5));
  client.emit('packet', { text: 'contenido privado' }, { state: 'play', name: 'example' }, Buffer.alloc(7));
  client.emit('end');
  client.emit('packet', {}, { state: 'play', name: 'example' }, Buffer.alloc(7));

  assert.deepEqual(records, [{
    type: 'packet',
    timestamp: '2026-11-21T21:00:00.000Z',
    sessionId: 'test-session',
    direction: 'serverbound',
    packet: 'example',
    sizeBytes: 7,
  }]);
  assert.equal(client.listenerCount('packet'), 0);
  assert.equal(client.listenerCount('end'), 0);
});

test('emite una alerta por tipo, sesión y ventana solo al superar el límite', () => {
  const first = new EventEmitter();
  const second = new EventEmitter();
  const records = [];
  let time = 999;

  for (const [sessionId, client] of [['first', first], ['second', second]]) {
    observePlayerPackets(client, {
      onRecord: record => records.push(record),
      limits: { example: 2, other: 1 },
      sessionId,
      monotonicMs: () => time,
    });
  }

  function emit(client, name = 'example') {
    client.emit('packet', {}, { state: 'play', name }, Buffer.alloc(1));
  }

  emit(first);
  emit(second);
  emit(first);
  assert.equal(records.filter(record => record.type === 'alert').length, 0);

  emit(first);
  emit(first);
  emit(first, 'other');
  emit(first, 'other');
  emit(second);
  time = 1_000;
  emit(first);
  emit(first);
  emit(first);

  const alerts = records.filter(record => record.type === 'alert');
  assert.deepEqual(alerts.map(({ sessionId, packet, count, limit }) => [sessionId, packet, count, limit]), [
    ['first', 'example', 3, 2],
    ['first', 'other', 2, 1],
    ['first', 'example', 3, 2],
  ]);
});
