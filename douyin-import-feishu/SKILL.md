---
name: douyin-import-feishu
description: Import the latest data handoff from the 抖音数据助手 browser extension into an existing Feishu Bitable using the user's local feishu-cli. Deduplicate by business key and update matching records instead of creating duplicates. Use when a user says "导入飞书", "写入飞书" or "清理重复数据" after collecting data in 抖音数据助手; locate the local handoff automatically and do not ask the user to export or attach a file.
---

# 抖音数据导入飞书

把浏览器扩展自动交接的原始接口数据整理为已有飞书多维表格中的记录。扩展本身不拥有飞书凭证，也不直接发送数据。

## 工作流程

1. 自动寻找最新交接文件：优先读取 `~/Downloads/douyin-data-assistant/agent-handoff.json`；若用户修改了默认下载位置，用文件内容中的 `"format":"douyin-data-assistant/v2"` 搜索最近文件。不要要求用户导出或上传。
2. 确认交接文件的 `format` 为 `douyin-data-assistant/v2`、`schemaVersion` 为 `2`、`batchId` 非空且 `recordCount` 与 `records.length` 一致。导入前报告批次 ID 和记录数量；无效文件不要写入飞书。
3. 只有用户明确说“导入飞书”“写入飞书”或等价指令时，才新增记录。用户仅要求分析、预览或整理时，不要产生外部写入。
4. 先检查 `feishu-cli` 是否可用且已完成授权。不可用时，说明缺少的本机前置条件；不要退回到浏览器扩展直连飞书、不要索要或保存 App Secret。
5. 使用用户在当前对话已指定的 Base 和数据表；不要新建表。目标不明确时，先列出现有数据表，请用户只选择一次。
6. 读取目标表字段和采集 JSON 的实际结构，用 Agent 判断可映射的数据。保留源关键词、关联词、指标、时间范围等可用字段；不要把整段原始 JSON 机械写进不相符的业务表。
7. 为每条可导入数据生成业务键：`主关键词 + 关联词 + 类型 + 时间范围 + 地域`。全部先标准化为去首尾空格、压缩内部空格并转小写的文本；缺少主关键词或关联词的数据不要写入，并报告跳过数。不要使用 `id` 或原始响应体哈希替代业务键。
8. 导入前分页读取目标表全部记录，用同一业务键建立索引。先合并本次交接文件中的重复项：保留指标字段更完整的一条；完整度相同则保留 `capturedAt` 更晚的一条。
9. 业务键已存在时，更新该记录的指标和采集时间，不新增。若表内同一业务键已有多条记录，只更新其中指标最完整的一条，并把其余记录计入“历史重复项”报告；普通导入绝不自动删除历史数据。
10. 仅对不存在的业务键按当前 `feishu-cli` 的批量格式生成 `{"fields":["字段ID"],"rows":[["值"]]}`，每批最多 500 行，并调用 `feishu-cli bitable record batch-create`。对已有记录使用 `feishu-cli bitable record upsert --record-id RECORD_ID` 更新。写入完成后报告新增数、更新数、跳过数、历史重复项数和失败批次。

## CLI 模板

使用 `feishu-cli-bitable` Skill 的当前命令格式。下面仅为顺序模板；从真实命令输出中读取 token、table ID、字段 ID 与顺序，不要猜测。

```bash
feishu-cli bitable field list --base-token BASE_TOKEN --table-id TABLE_ID
feishu-cli bitable record batch-create --base-token BASE_TOKEN --table-id TABLE_ID --config '{"fields":["fld_word","fld_score"],"rows":[["关联词",123]]}'
```

将单次新增拆分为不超过 500 条。必须按字段 ID 对应的顺序组织每一行，避免写错列。不同记录的更新使用带 `--record-id` 的 `record upsert`，不要把不同字段值错误地混入同一个批量更新请求。

## 清理历史重复项

仅当用户明确说“清理重复数据”“删除重复项”或等价指令时执行。

1. 先分页读取全表，并按业务键分组；先报告将删除多少条、每组保留哪一条以及保留规则。
2. 保留指标字段最完整的记录；若完整度相同，保留采集时间较晚的记录；仍相同则保留 record ID 最早的一条，保证结果可复现。
3. 用户已经给出明确清理指令后，可用 `feishu-cli bitable record batch-delete` 分批删除其余 record ID（每批最多 500 条）。删除完成后重新读取并报告剩余重复组数。
4. 不要把“导入飞书”理解为“清理历史重复项”。

## 数据边界

不要上传或保留用户数据到第三方服务。临时生成的批量文件在任务结束后可删除；飞书表格保留为用户的交付结果。
