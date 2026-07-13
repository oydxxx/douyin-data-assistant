---
name: douyin-import-feishu
description: Import the latest data handoff from the 抖音数据助手 browser extension into an existing Feishu Bitable using the local feishu-cli. Use when a user says "导入飞书" or "写入飞书" after collecting data in 抖音数据助手; locate the local handoff automatically and do not ask the user to export or attach a file.
---

# 抖音数据导入飞书

把浏览器扩展自动交接的原始接口数据整理为已有飞书多维表格中的记录。扩展本身不拥有飞书凭证，也不直接发送数据。

## 工作流程

1. 自动寻找最新交接文件：优先读取 `~/Downloads/douyin-data-assistant/agent-handoff.json`；若用户修改了默认下载位置，用文件内容中的 `"format":"douyin-data-assistant/v1"` 搜索最近文件。不要要求用户导出或上传。
2. 确认交接文件的 `format` 为 `douyin-data-assistant/v1` 且 `records` 是数组。导入前报告记录数量；无效文件不要写入飞书。
3. 只有用户明确说“导入飞书”“写入飞书”或等价指令时，才新增记录。用户仅要求分析、预览或整理时，不要产生外部写入。
4. 先检查 `feishu-cli` 是否可用且已完成授权。不可用时，说明缺少的本机前置条件；不要退回到浏览器扩展直连飞书、不要索要或保存 App Secret。
5. 使用用户在当前对话已指定的 Base 和数据表；不要新建表。目标不明确时，先列出现有数据表，请用户只选择一次。
6. 读取目标表字段和采集 JSON 的实际结构，用 Agent 判断可映射的数据。保留源关键词、关联词、指标、时间范围等可用字段；不要把整段原始 JSON 机械写进不相符的业务表。
7. 按当前 `feishu-cli` 的批量格式生成 `{"fields":["字段ID"],"rows":[["值"]]}`，每批最多 500 行，并调用 `feishu-cli bitable record batch-create`。写入完成后报告表格链接、写入数和失败批次。

## CLI 模板

使用 `feishu-cli-bitable` Skill 的当前命令格式。下面仅为顺序模板；从真实命令输出中读取 token、table ID、字段 ID 与顺序，不要猜测。

```bash
feishu-cli bitable field list --base-token BASE_TOKEN --table-id TABLE_ID
feishu-cli bitable record batch-create --base-token BASE_TOKEN --table-id TABLE_ID --config '{"fields":["fld_word","fld_score"],"rows":[["关联词",123]]}'
```

将单次写入拆分为不超过 500 条。必须按字段 ID 对应的顺序组织每一行，避免写错列。

## 数据边界

不要上传或保留用户数据到第三方服务。临时生成的批量文件在任务结束后可删除；飞书表格保留为用户的交付结果。
