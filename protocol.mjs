export const HANDOFF_FORMAT = "douyin-data-assistant/v2";
export const HANDOFF_SCHEMA_VERSION = 2;
export const MAX_RECORDS = 200;

export const BUSINESS_KEY_FIELDS = [
  "primaryKeyword",
  "relatedKeyword",
  "type",
  "timeRange",
  "region",
];

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildBusinessKey(fields = {}) {
  const values = BUSINESS_KEY_FIELDS.map((name) => normalizeText(fields[name]));
  if (!values[0] || !values[1]) return null;
  return values.join("\u001f");
}

export function buildHandoffPacket(records, { batchId, exportedAt } = {}) {
  if (!Array.isArray(records)) throw new TypeError("records 必须是数组");
  if (!records.length) throw new Error("没有可交接的数据");
  if (records.length > MAX_RECORDS) throw new RangeError(`单批最多交接 ${MAX_RECORDS} 条数据`);
  return {
    format: HANDOFF_FORMAT,
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    batchId: String(batchId || "").trim() || `batch-${Date.now()}`,
    exportedAt: exportedAt || new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}
