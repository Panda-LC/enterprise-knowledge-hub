# 语雀导出对接文档

## 概述
- 目标：从语雀知识库导出目录与文档正文（含附件/图片），为知识中心导入做好数据与格式准备
- 支持：企业子域与主域 API、单篇导出与整库导出、资源下载与链接重写

## 前置条件
- 语雀令牌：在语雀“个人设置 → 开放平台/Token”生成可访问目标空间的个人访问令牌
- 域名：
  - 企业子域（推荐）：`https://<your_org>.yuque.com`（示例：`https://jdpiaozone.yuque.com`）
  - 主域：`https://www.yuque.com`（若子域不可用再尝试）
- 标识：
  - `group_login`：团队 Login（示例：`nbklz3`）
  - `book_slug`：知识库路径（示例：`dn5ehb`）
  - 单篇文档标识：文档 ID 或路径（可从 TOC 的 `url` 字段获取，如 `tmawm6eavb3dthx4`）

## 鉴权与请求头
- 推荐同时携带：
  - `X-Auth-Token: <TOKEN>`
  - `User-Agent: <your-app>`（避免 403）
  - `Accept: application/json`

## 核心接口
- 获取目录（TOC）
  - `GET /api/v2/repos/{group_login}/{book_slug}/toc`
  - 返回字段：`uuid`、`type(DOC|URL|TITLE)`、`title`、`slug`、`doc_id`、层级与顺序（`prev_uuid/sibling_uuid/child_uuid/parent_uuid`）
- 获取文档列表
  - `GET /api/v2/repos/{group_login}/{book_slug}/docs`
  - 分页参数：`page`、`page_size`
- 获取文档详情
  - `GET /api/v2/repos/{group_login}/{book_slug}/docs/{id_or_slug}`
  - 正文字段：`format`（`markdown` 或 lake/HTML）、`body`（Markdown）、`body_html`（HTML）
- 文档历史版本（可选）
  - `GET /api/v2/doc_versions`、`GET /api/v2/doc_versions/{id}`

## 请求示例（curl）
```bash
# 获取当前用户（验证令牌）
curl -H "X-Auth-Token:<TOKEN>" -H "User-Agent:EKH-Export/1.0" \
  https://jdpiaozone.yuque.com/api/v2/user

# 获取目录（TOC）
curl -H "X-Auth-Token:<TOKEN>" -H "User-Agent:EKH-Export/1.0" \
  https://jdpiaozone.yuque.com/api/v2/repos/nbklz3/dn5ehb/toc

# 获取文档列表（第 1 页，每页 50）
curl -H "X-Auth-Token:<TOKEN>" -H "User-Agent:EKH-Export/1.0" \
  "https://jdpiaozone.yuque.com/api/v2/repos/nbklz3/dn5ehb/docs?page=1&page_size=50"

# 获取文档详情（按 TOC 的 url 路径）
curl -H "X-Auth-Token:<TOKEN>" -H "User-Agent:EKH-Export/1.0" \
  https://jdpiaozone.yuque.com/api/v2/repos/nbklz3/dn5ehb/docs/tmawm6eavb3dthx4
```

## Node 脚本集成
- 文件：`scripts/export-yuque.js`
- 关键实现：
  - 请求封装与头部：`scripts/export-yuque.js:31-38`
  - 单篇导出分支：`scripts/export-yuque.js:118-151`
  - 资源下载与链接重写：`scripts/export-yuque.js:132-151`、`scripts/export-yuque.js:77-94`、`scripts/export-yuque.js:56-75`
- 参数：
  - `--token` 或环境变量 `YUQUE_TOKEN`
  - `--group` 团队 Login（或 `YUQUE_GROUP_LOGIN`）
  - `--book` 知识库 Slug（或 `YUQUE_BOOK_SLUG`）
  - `--base` 基地址（或 `YUQUE_BASE`），默认 `https://www.yuque.com`
  - `--out` 输出目录，默认 `./export`
  - `--pageSize`、`--delayMs`（全量模式限流）
  - `--assets` 下载图片/附件并重写正文链接
  - `--doc` 单篇文档 ID 或路径（启用单篇导出）

### 单篇导出示例
```bash
YUQUE_TOKEN=<TOKEN> node scripts/export-yuque.js \
  --group nbklz3 --book dn5ehb \
  --base https://jdpiaozone.yuque.com \
  --doc tmawm6eavb3dthx4 \
  --out ./export \
  --assets
```
- 输出：`export/yuque/nbklz3/dn5ehb/docs/tmawm6eavb3dthx4.html` 与 `tmawm6eavb3dthx4.json`

### 整库导出示例
```bash
YUQUE_TOKEN=<TOKEN> node scripts/export-yuque.js \
  --group nbklz3 --book dn5ehb \
  --base https://jdpiaozone.yuque.com \
  --out ./export \
  --pageSize 50 --delayMs 200 \
  --assets
```
- 输出：
  - `toc.json`（目录）、`docs-list.json`（列表元数据）
  - 每篇：`docs/<slug>.md|html` 与 `docs/<slug>.json`
  - 资源：`assets/<slug>/...`（启用 `--assets` 时）

## 正文与格式转换
- `format=markdown`：优先使用 `body` 保存为 `.md`
- 其他格式（lake/HTML）：使用 `body_html` 保存为 `.html`（兼容语雀富文本）
- 资源下载：扫描 `![](url)` 与 `<img src="...">`，下载到本地并将正文链接重写为相对路径

## 错误处理与限流
- 401 Unauthorized：令牌无效或无权限访问企业空间；检查令牌与空间权限
- 403 需 User-Agent：补充 `User-Agent` 与 `Accept: application/json`
- 429 限流：增大 `--delayMs`（如 300–500ms）、减小 `--pageSize`

## 开发注意事项
- 域名选择：优先你的企业子域，其次主域
- 幂等：以 `slug` 或 `doc_id` 作为自然键，避免重复
- 断链处理：导入时利用导出清单进行内部链接重写（需目标系统的 URL 映射）
- 权限：仅导出你令牌可访问范围内内容；企业空间可能需要管理员开放 API 访问

