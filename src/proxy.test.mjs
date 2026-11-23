import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import protocol from 'minecraft-protocol';
import { BackendClient } from './proxy.mjs';

test('conserva el paquete original al leer más de una ranura de equipamiento', async () => {
  const { PLAY } = protocol.states;
  const backend = new BackendClient();
  backend.state = PLAY;

  const serializer = protocol.createSerializer({ isServer: true, state: PLAY, version: backend.version });
  const equipments = [
    { slot: 2, item: { itemCount: 0 } },
    { slot: 5, item: { itemCount: 0 } },
  ];
  const frame = serializer.createPacketBuffer({
    name: 'entity_equipment',
    params: { entityId: 42, equipments },
  });
  const original = Buffer.from(frame);
  const packet = once(backend, 'packet');
  backend.deserializer.write(frame);

  const [data, metadata, , raw] = await packet;
  assert.equal(metadata.name, 'entity_equipment');
  assert.deepEqual(data.equipments.map(({ slot }) => slot), [2, 5]);
  assert.deepEqual(raw, original);
});
