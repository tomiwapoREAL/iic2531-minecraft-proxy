import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentRules, DEFAULT_LIMITS } from './rules.mjs';

const play = name => ({ state: 'play', name });

test('ignora estados distintos de play', () => {
  const rules = createContentRules();
  const violations = rules.inspect({ state: 'login', name: 'login_start' }, {}, Buffer.alloc(DEFAULT_LIMITS.maxPacketBytes + 1));
  assert.deepEqual(violations, []);
});

test('detecta paquetes y cargas sobredimensionadas', () => {
  const rules = createContentRules({ maxPacketBytes: 8, maxPayloadBytes: 4 });

  assert.deepEqual(rules.inspect(play('custom_payload'), { channel: 'minecraft:brand', data: Buffer.alloc(4) }, Buffer.alloc(8)), []);

  const violations = rules.inspect(play('custom_payload'), { channel: 'minecraft:brand', data: Buffer.alloc(5) }, Buffer.alloc(9));
  assert.deepEqual(violations, [
    { rule: 'packet_size', packet: 'custom_payload', sizeBytes: 9, limit: 8 },
    { rule: 'payload_size', packet: 'custom_payload', channel: 'minecraft:brand', sizeBytes: 5, limit: 4 },
  ]);
});

test('acumula el texto de los paquetes conversacionales y de letreros', () => {
  const rules = createContentRules({ maxTextChars: 10 });

  assert.deepEqual(rules.inspect(play('chat_message'), { message: 'hola' }, Buffer.alloc(1)), []);
  assert.deepEqual(rules.inspect(play('chat_message'), { message: 'a'.repeat(11) }, Buffer.alloc(1)), [
    { rule: 'text_length', packet: 'chat_message', chars: 11, limit: 10 },
  ]);
  assert.deepEqual(
    rules.inspect(play('update_sign'), { text1: 'aaa', text2: 'bbb', text3: 'ccc', text4: 'ddd' }, Buffer.alloc(1)),
    [{ rule: 'text_length', packet: 'update_sign', chars: 12, limit: 10 }],
  );
});

test('limita páginas y longitud de los libros', () => {
  const rules = createContentRules({ maxBookPages: 2, maxBookChars: 10 });

  assert.deepEqual(rules.inspect(play('edit_book'), { hand: 0, pages: ['hola'], title: null }, Buffer.alloc(1)), []);
  assert.deepEqual(rules.inspect(play('edit_book'), { hand: 0, pages: ['a', 'b', 'c'], title: null }, Buffer.alloc(1)), [
    { rule: 'book_pages', packet: 'edit_book', pages: 3, limit: 2 },
  ]);
  assert.deepEqual(
    rules.inspect(play('edit_book'), { hand: 0, pages: ['a'.repeat(8)], title: 'titulo' }, Buffer.alloc(1)),
    [{ rule: 'book_length', packet: 'edit_book', chars: 14, limit: 10 }],
  );
});

test('mide el desplazamiento entre paquetes y reconoce el teletransporte del servidor', () => {
  const rules = createContentRules({ maxMoveBlocks: 5 });

  assert.deepEqual(rules.inspect(play('position'), { x: 0, y: 64, z: 0 }, Buffer.alloc(1)), []);
  assert.deepEqual(rules.inspect(play('position'), { x: 3, y: 64, z: 4 }, Buffer.alloc(1)), []);
  assert.deepEqual(rules.inspect(play('position'), { x: 103, y: 64, z: 4 }, Buffer.alloc(1)), [
    { rule: 'movement_distance', packet: 'position', blocks: 100, limit: 5 },
  ]);

  rules.noteServerMovement(play('position'), { teleportId: 1, x: 1_000, y: 70, z: 1_000 });
  assert.deepEqual(rules.inspect(play('position_look'), { x: 1_001, y: 70, z: 1_000 }, Buffer.alloc(1)), []);

  rules.noteServerMovement(play('respawn'), {});
  assert.deepEqual(rules.inspect(play('position'), { x: -2_000, y: 64, z: -2_000 }, Buffer.alloc(1)), []);
});

test('marca coordenadas no finitas', () => {
  const rules = createContentRules();
  assert.deepEqual(rules.inspect(play('position'), { x: Number.NaN, y: 64, z: 0 }, Buffer.alloc(1)), [
    { rule: 'movement_invalid', packet: 'position' },
  ]);
});

test('rechaza límites no positivos', () => {
  assert.throws(() => createContentRules({ maxMoveBlocks: 0 }), RangeError);
});
