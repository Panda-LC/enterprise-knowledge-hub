# 需求文档

## 简介

本功能旨在为企业知识中心（EKH）平台增加 Word 格式的文档导出支持。目前系统已支持从语雀导出 Markdown、HTML 和 PDF 格式的文档，客户希望能够同时支持 Word（.docx）格式的导出，以便在 Microsoft Word 或其他兼容软件中编辑和使用文档。

## 术语表

- **EKH**: Enterprise Knowledge Hub，企业知识中心平台
- **语雀**: 阿里巴巴旗下的知识库平台
- **Word 文档**: Microsoft Word 格式的文档文件（.docx）
- **导出服务**: ExportService，负责从语雀导出文档的服务类
- **存储服务**: StorageService，负责本地文件存储的服务类
- **文档生成器**: 负责将文档内容转换为特定格式的服务组件
- **Lake 格式**: 语雀的富文本格式，包含 HTML 和结构化数据

## 需求

### 需求 1

**用户故事:** 作为知识管理员，我希望能够将语雀文档导出为 Word 格式，以便在 Microsoft Word 中编辑和分发文档。

#### 验收标准

1. WHEN 用户在文档详情页点击下载按钮 THEN 系统 SHALL 在格式选择菜单中显示 Word 选项
2. WHEN 用户选择 Word 格式下载 THEN 系统 SHALL 生成包含完整内容和格式的 .docx 文件
3. WHEN 生成 Word 文档 THEN 系统 SHALL 保留文档的标题、段落、列表、表格和代码块等格式元素
4. WHEN Word 文档包含图片 THEN 系统 SHALL 将图片内嵌到 Word 文档中
5. WHEN Word 文档生成完成 THEN 系统 SHALL 触发浏览器下载该文件

### 需求 2

**用户故事:** 作为系统开发者，我希望 Word 文档生成服务能够复用现有的图片处理逻辑，以便保持代码的一致性和可维护性。

#### 验收标准

1. WHEN 生成 Word 文档 THEN 系统 SHALL 使用现有的 ImageEmbedderService 处理图片
2. WHEN 处理图片失败 THEN 系统 SHALL 记录警告日志并继续生成文档
3. WHEN 图片文件过大（>10MB）THEN 系统 SHALL 记录警告信息
4. WHEN 并发处理多个图片 THEN 系统 SHALL 限制最多 5 个并发请求

### 需求 3

**用户故事:** 作为知识管理员，我希望系统能够缓存已生成的 Word 文档，以便提高下载速度和减少服务器负载。

#### 验收标准

1. WHEN 首次生成 Word 文档 THEN 系统 SHALL 将文档保存到本地文件系统
2. WHEN 用户再次下载相同文档的 Word 格式 THEN 系统 SHALL 优先使用已缓存的文件
3. WHEN 缓存的 Word 文件不存在 THEN 系统 SHALL 动态生成新的 Word 文档
4. WHEN 保存 Word 文档到本地 THEN 系统 SHALL 使用文件锁机制防止并发写入冲突

### 需求 4

**用户故事:** 作为系统开发者，我希望 Word 文档生成功能能够正确处理 Lake 格式的内容，以便支持语雀的富文本特性。

#### 验收标准

1. WHEN 文档包含 Lake 格式内容 THEN 系统 SHALL 解析 `<card>` 标签中的结构化数据
2. WHEN Lake 格式包含图片卡片 THEN 系统 SHALL 提取图片 URL 并转换为 Word 图片对象
3. WHEN Lake 格式包含代码块 THEN 系统 SHALL 保留代码格式和语法高亮信息
4. WHEN 解析 Lake 格式失败 THEN 系统 SHALL 回退到使用 HTML 内容

### 需求 5

**用户故事:** 作为知识管理员，我希望在批量导出时能够自动生成 Word 文档，以便一次性获取所有格式的文档。

#### 验收标准

1. WHEN 执行批量导出任务 THEN 系统 SHALL 为每个文档生成 JSON、HTML、PDF 和 Word 四种格式
2. WHEN 某个格式生成失败 THEN 系统 SHALL 记录错误日志但继续处理其他格式
3. WHEN 所有格式生成完成 THEN 系统 SHALL 更新任务状态为完成
4. WHEN 生成过程中发生错误 THEN 系统 SHALL 在日志中记录详细的错误信息

### 需求 6

**用户故事:** 作为系统用户，我希望下载的 Word 文档能够在不同的 Word 软件中正常打开，以便在各种环境中使用文档。

#### 验收标准

1. WHEN 生成 Word 文档 THEN 系统 SHALL 使用标准的 Office Open XML 格式（.docx）
2. WHEN Word 文档在 Microsoft Word 中打开 THEN 文档 SHALL 正确显示所有内容和格式
3. WHEN Word 文档在 WPS Office 中打开 THEN 文档 SHALL 正确显示所有内容和格式
4. WHEN Word 文档在 LibreOffice 中打开 THEN 文档 SHALL 正确显示所有内容和格式

### 需求 7

**用户故事:** 作为知识管理员，我希望导出的 Word 文档能够高度还原语雀原文的格式和样式，以便保持文档的专业性和可读性。

#### 验收标准

1. WHEN 文档包含标题（H1-H6）THEN 系统 SHALL 使用对应的 Word 标题样式并保留字体大小和粗细
2. WHEN 文档包含粗体、斜体、删除线等文本样式 THEN 系统 SHALL 在 Word 中保留这些样式
3. WHEN 文档包含有序列表和无序列表 THEN 系统 SHALL 保留列表类型、缩进层级和编号格式
4. WHEN 文档包含表格 THEN 系统 SHALL 保留表格的行列结构、边框样式和单元格对齐方式
5. WHEN 文档包含代码块 THEN 系统 SHALL 使用等宽字体并保留代码缩进和换行
6. WHEN 文档包含引用块 THEN 系统 SHALL 使用缩进或边框样式标识引用内容
7. WHEN 文档包含链接 THEN 系统 SHALL 保留链接文本和 URL，并设置为可点击的超链接
8. WHEN 文档包含图片 THEN 系统 SHALL 保留图片的原始尺寸比例和对齐方式
9. WHEN 文档包含分隔线 THEN 系统 SHALL 使用 Word 的水平线样式
10. WHEN 文档包含颜色标记的文本 THEN 系统 SHALL 尽可能保留文本颜色和背景色

### 需求 8

**用户故事:** 作为系统开发者，我希望 Word 文档生成服务能够处理各种边缘情况，以便提供稳定可靠的服务。

#### 验收标准

1. WHEN 文档内容为空 THEN 系统 SHALL 生成包含标题的空白 Word 文档
2. WHEN 文档包含特殊字符 THEN 系统 SHALL 正确转义并保留这些字符
3. WHEN 文档包含超大表格 THEN 系统 SHALL 正确处理表格布局
4. WHEN 文档包含嵌套列表 THEN 系统 SHALL 保留列表的层级结构
5. WHEN 生成过程超时（30 秒）THEN 系统 SHALL 中止生成并返回错误信息
