// Capa de reglas de contenido para el proxy defensivo.
// Inspecciona el payload ya interpretado de los paquetes serverbound del estado
// play. Es complementaria al observador de tasa de ids.mjs: aquella mira cuántos
// paquetes llegan, esta mira qué traen. Mantiene estado por sesión para medir el
// desplazamiento entre paquetes de posición.

export const DEFAULT_LIMITS = {
  maxPacketBytes: 32_768,
  maxTextChars: 256,
  maxBookPages: 100,
  maxBookChars: 102_400,
  maxPayloadBytes: 32_768,
  maxMoveBlocks: 10,
};

const TEXT_PACKETS = new Map([
  ['chat_message', data => [data.message]],
  ['chat_command', data => [data.command]],
  ['chat_command_signed', data => [data.command]],
  ['name_item', data => [data.name]],
  ['update_sign', data => [data.text1, data.text2, data.text3, data.text4]],
]);

const MOVE_PACKETS = new Set(['position', 'position_look', 'vehicle_move']);

function textLength(values) {
  let total = 0;
  for (const value of values) {
    if (typeof value === 'string') total += value.length;
  }
  return total;
}

export function createContentRules(limits = {}) {
  const active = { ...DEFAULT_LIMITS, ...limits };
  for (const [name, limit] of Object.entries(active)) {
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new RangeError(`El límite ${name} debe ser un número positivo.`);
    }
  }

  let lastPosition;

  function inspectSize(metadata, buffer) {
    if (!buffer || buffer.length <= active.maxPacketBytes) return undefined;
    return { rule: 'packet_size', packet: metadata.name, sizeBytes: buffer.length, limit: active.maxPacketBytes };
  }

  function inspectText(metadata, data) {
    const extract = TEXT_PACKETS.get(metadata.name);
    if (!extract) return undefined;
    const chars = textLength(extract(data));
    if (chars <= active.maxTextChars) return undefined;
    return { rule: 'text_length', packet: metadata.name, chars, limit: active.maxTextChars };
  }

  function inspectBook(metadata, data) {
    if (metadata.name !== 'edit_book') return undefined;
    const pages = Array.isArray(data.pages) ? data.pages : [];
    if (pages.length > active.maxBookPages) {
      return { rule: 'book_pages', packet: metadata.name, pages: pages.length, limit: active.maxBookPages };
    }
    const chars = textLength(pages) + textLength([data.title]);
    if (chars > active.maxBookChars) {
      return { rule: 'book_length', packet: metadata.name, chars, limit: active.maxBookChars };
    }
    return undefined;
  }

  function inspectPayload(metadata, data) {
    if (metadata.name !== 'custom_payload') return undefined;
    const sizeBytes = Buffer.isBuffer(data.data) ? data.data.length : 0;
    if (sizeBytes <= active.maxPayloadBytes) return undefined;
    return {
      rule: 'payload_size',
      packet: metadata.name,
      channel: typeof data.channel === 'string' ? data.channel : undefined,
      sizeBytes,
      limit: active.maxPayloadBytes,
    };
  }

  function inspectMovement(metadata, data) {
    if (!MOVE_PACKETS.has(metadata.name)) return undefined;
    const { x, y, z } = data;
    if (![x, y, z].every(Number.isFinite)) {
      return { rule: 'movement_invalid', packet: metadata.name };
    }

    const previous = lastPosition;
    lastPosition = { x, y, z };
    if (!previous) return undefined;

    const blocks = Math.hypot(x - previous.x, y - previous.y, z - previous.z);
    if (blocks <= active.maxMoveBlocks) return undefined;
    return { rule: 'movement_distance', packet: metadata.name, blocks: Number(blocks.toFixed(3)), limit: active.maxMoveBlocks };
  }

  return {
    limits: active,

    inspect(metadata, data, buffer) {
      if (metadata.state !== 'play') return [];
      return [
        inspectSize(metadata, buffer),
        inspectText(metadata, data),
        inspectBook(metadata, data),
        inspectPayload(metadata, data),
        inspectMovement(metadata, data),
      ].filter(Boolean);
    },

    // El servidor puede teletransportar o reaparecer al jugador. Sin reiniciar la
    // referencia, el siguiente paquete de posición parecería un salto imposible.
    noteServerMovement(metadata, data) {
      if (metadata.state !== 'play') return;
      if (metadata.name === 'respawn' || metadata.name === 'login') {
        lastPosition = undefined;
        return;
      }
      if (metadata.name !== 'position') return;
      const { x, y, z } = data;
      lastPosition = [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
    },
  };
}
