import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_KEY_FIELDS, HANDOFF_FORMAT, buildBusinessKey, buildHandoffPacket } from '../protocol.mjs';

test('builds a stable normalized business key', () => {
  const fields = {
    primaryKeyword: '  AI  写作 ',
    relatedKeyword: '长 文',
    type: '搜索',
    timeRange: '近 30 天',
    region: '全国',
  };
  assert.equal(buildBusinessKey(fields), 'ai 写作\u001f长 文\u001f搜索\u001f近 30 天\u001f全国');
  assert.equal(BUSINESS_KEY_FIELDS.length, 5);
  assert.equal(buildBusinessKey({ primaryKeyword: '只有主词' }), null);
});

test('builds a versioned handoff packet with a batch identity', () => {
  const packet = buildHandoffPacket([{ id: '1' }], { batchId: 'batch-test', exportedAt: '2026-08-31T00:00:00.000Z' });
  assert.equal(packet.format, HANDOFF_FORMAT);
  assert.equal(packet.schemaVersion, 2);
  assert.equal(packet.batchId, 'batch-test');
  assert.equal(packet.recordCount, 1);
  assert.throws(() => buildHandoffPacket([]), /没有可交接/);
});
