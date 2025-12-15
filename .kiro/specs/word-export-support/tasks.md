# Word 格式导出支持 - 实施任务列表

## 任务概述

本任务列表将 Word 格式导出功能的设计转化为可执行的开发任务。任务按照依赖关系组织,确保每个任务都可以独立完成并集成到现有系统中。

**注意**: 本项目已有完善的图片处理、缓存、错误处理和文件系统基础设施。任务列表已简化,专注于 Word 导出的核心功能实现。

---

## 阶段 1: 依赖安装和基础配置

- [x] 1. 安装 Word 导出依赖包
  - 安装 `docx@^8.5.0` - Word 文档生成库
  - 安装 `htmlparser2@^9.1.0` - HTML 解析库
  - 安装 `isomorphic-dompurify@^2.11.0` - HTML 清理库(防止 XSS)
  - 安装 `p-limit@^5.0.0` - 并发控制库(如果尚未安装)
  - _验证需求: 所有需求的技术基础_

---

## 阶段 2: Word 文档生成核心服务

- [x] 2. 创建 WordGeneratorService 基础结构
  - 创建 `services/WordGeneratorService.ts` 文件
  - 定义 `WordGeneratorService` 类
  - 定义类型接口: `WordElement`, `FormatStyles`, `WordGeneratorOptions`
  - 实现构造函数,复用现有的 `ImageEmbedderService`
  - _验证需求: 1.2 (Word 生成基础)_

- [x] 3. 实现 HTML 到 Word 元素解析
  - 在 `WordGeneratorService` 中实现 `parseHtmlToWordElements` 静态方法
  - 使用 `htmlparser2` 解析 HTML
  - 支持标题 (H1-H6)、段落、列表 (ul/ol)、表格、图片、代码块
  - 提取文本样式: 粗体、斜体、下划线、删除线
  - 处理嵌套结构和特殊字符
  - _验证需求: 1.3, 7.1, 7.2, 7.3, 7.4, 7.5 (格式元素解析)_

- [x] 4. 实现 Lake 格式卡片转换
  - 在 `WordGeneratorService` 中实现 `convertLakeCards` 静态方法
  - 解析 `<card>` 标签中的 JSON 数据
  - 转换图片卡片为标准 `<img>` 标签
  - 转换代码块卡片为 `<pre><code>` 标签
  - 处理其他卡片类型(表格、文件、视频、链接)
  - 实现错误回退机制
  - _验证需求: 4.1, 4.2, 4.3, 4.4 (Lake 格式支持)_

- [x] 5. 实现图片内嵌和处理
  - 在 `WordGeneratorService` 中实现 `embedImages` 方法
  - 复用现有的 `ImageEmbedderService.getImageBase64` 方法
  - 使用 `p-limit` 限制并发数量(最多 5 个)
  - 将图片 Buffer 转换为 Word 图片对象
  - 保留图片尺寸和对齐方式
  - 处理图片下载失败的情况(记录警告但继续)
  - _验证需求: 1.4, 2.1, 2.2, 2.3, 2.4, 7.8 (图片处理)_

- [x] 6. 实现 Word 文档生成主方法
  - 在 `WordGeneratorService` 中实现 `generateWord` 方法
  - 整合流程: HTML 清理 → Lake 格式转换 → 解析为 Word 元素 → 内嵌图片 → 生成文档
  - 使用 `docx` 库创建 Word 文档对象
  - 应用样式映射(标题、段落、列表、表格、代码块)
  - 添加超时控制(30 秒)
  - 返回 Word 文档 Buffer
  - _验证需求: 1.2, 1.5, 6.1, 7.1-7.10 (Word 生成完整流程)_

- [ ]* 6.1 编写 WordGeneratorService 单元测试
  - 创建 `services/WordGeneratorService.test.ts` 文件
  - 测试 `parseHtmlToWordElements`: 标题、段落、列表、表格、样式
  - 测试 `convertLakeCards`: 各种卡片类型转换
  - 测试 `generateWord`: 空内容、正常内容、包含图片
  - 测试错误处理和边缘情况
  - _验证需求: 所有 Word 生成相关需求_

---

## 阶段 3: 后端 API 扩展

- [x] 7. 扩展 FileSystemService 支持 Word 文件
  - 修改 `server/FileSystemService.js` 文件
  - 实现 `saveDocxFile(docId, buffer)` 方法
  - 实现 `loadDocxFile(docId)` 方法
  - 实现 `docxFileExists(docId)` 方法
  - 复用现有的文件锁机制 (`proper-lockfile`)
  - 复用现有的备份机制
  - _验证需求: 3.1, 3.4 (后端文件操作)_

- [x] 8. 添加 Word 文件 API 端点
  - 修改 `server/storage.js` 文件
  - 添加 `POST /api/storage/documents/:docId/docx` - 保存 Word 文件
  - 添加 `GET /api/storage/documents/:docId/docx` - 获取 Word 文件
  - 添加 `HEAD /api/storage/documents/:docId/docx` - 检查文件存在
  - 添加 `GET /api/storage/documents/:docId/download/docx` - 下载 Word 文件
  - 设置正确的 Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - 复用现有的错误处理机制
  - _验证需求: 1.5, 3.2, 3.3 (API 端点)_

- [ ]* 8.1 编写后端 API 集成测试
  - 创建 `server/FileSystemService.docx.test.js` 文件
  - 测试 Word 文件的保存、加载、检查存在
  - 测试文件锁和并发安全
  - 测试 API 端点的完整流程
  - _验证需求: 3.1, 3.4, API 端点_

---

## 阶段 4: 前端服务集成

- [x] 9. 扩展 StorageService 支持 Word 格式
  - 修改 `services/StorageService.ts` 文件
  - 扩展 `fileExists` 方法支持 `'docx'` 格式
  - 扩展 `downloadDocumentFile` 方法支持 `'docx'` 格式
  - 实现 `generateWordOnTheFly(docId)` 私有方法
    - 加载文档内容
    - 调用 `WordGeneratorService.generateWord`
    - 返回 Word Buffer
  - 实现缓存优先策略: 优先使用已生成的文件,不存在时动态生成
  - _验证需求: 1.2, 3.2, 3.3 (前端服务扩展)_

- [ ]* 9.1 编写 StorageService Word 功能测试
  - 扩展 `services/StorageService.fileops.test.ts` 文件
  - 测试 `fileExists` 对 Word 格式的支持
  - 测试 `downloadDocumentFile` 对 Word 格式的支持
  - 测试缓存优先策略
  - 测试动态生成回退逻辑
  - _验证需求: 1.2, 3.2, 3.3_

---

## 阶段 5: 前端 UI 集成

- [x] 10. 修改 DocumentDetail 组件添加 Word 下载选项
  - 修改 `components/DocumentDetail.tsx` 文件
  - 将下载按钮改为下拉菜单
  - 添加格式选项: Markdown (.md)、HTML (.html)、PDF (.pdf)、Word (.docx)
  - 修改 `handleDownload` 函数接受 `format` 参数
  - 调用 `StorageService.downloadDocumentFile(docId, title, format)`
  - 添加下载状态指示器和错误提示
  - _验证需求: 1.1, 1.5 (UI 集成)_

- [x] 11. 扩展 ExportService 支持 Word 格式批量导出
  - 修改 `services/ExportService.ts` 文件
  - 在 `exportDocument` 方法中添加 Word 文档生成逻辑
  - 生成顺序: JSON → HTML → PDF → Word
  - 处理生成失败: 记录错误但继续处理其他格式
  - 更新任务日志,显示 Word 生成状态
  - _验证需求: 5.1, 5.2, 5.3, 5.4 (批量导出)_

- [ ]* 11.1 编写 ExportService Word 功能测试
  - 扩展 `services/ExportService.test.ts` 文件
  - 测试批量导出包含 Word 格式
  - 测试部分失败容错机制
  - 测试任务状态更新
  - _验证需求: 5.1, 5.2, 5.3, 5.4_

---

## 阶段 6: 属性测试 (Property-Based Testing)

- [ ]* 12. 编写属性测试 - Word 文档生成完整性
  - 创建 `services/WordGeneratorService.property.test.ts` 文件
  - **属性 1**: 对于任何有效的文档内容,生成的 Word 文件应该是有效的 .docx 格式
  - **验证需求: 1.2, 6.1**
  - 使用 `fast-check` 生成随机 HTML 内容
  - 验证生成的文件是有效的 ZIP 格式(文件头 `504b0304`)
  - 验证文件可以被读取且大小 > 0
  - 配置运行 100 次迭代

- [ ]* 13. 编写属性测试 - 图片内嵌一致性
  - **属性 2**: 对于任何包含图片的文档,生成的 Word 文档中的图片数量应该 ≤ 原始 HTML 中的图片数量
  - **验证需求: 1.4**
  - 使用 `fast-check` 生成随机图片 URL
  - 统计原始 HTML 中的图片数量
  - 解析生成的 Word 文档,统计内嵌图片数量
  - 验证: 内嵌图片数 ≤ 原始图片数(允许部分下载失败)

- [ ]* 14. 编写属性测试 - 缓存优先策略
  - **属性 5**: 对于任何已生成过 Word 文件的文档,再次下载时应该优先使用缓存文件
  - **验证需求: 3.2**
  - 生成随机文档内容
  - 第一次生成 Word 文件,记录文件修改时间
  - 第二次生成相同文档,记录文件修改时间
  - 验证: 两次修改时间相同(说明使用了缓存)

- [ ]* 15. 编写属性测试 - 文件锁并发安全
  - **属性 7**: 对于任何并发写入同一文档的操作,文件锁机制应该确保数据一致性
  - **验证需求: 3.4**
  - 生成随机并发数(2-10)
  - 并发生成同一文档的 Word 文件
  - 验证: 至少有一个操作成功
  - 验证: 最终文件内容一致且有效

---

## 阶段 7: 集成测试和验证

- [ ]* 16. 编写端到端集成测试
  - 创建 `services/WordExport.integration.test.ts` 文件
  - 测试完整下载流程: 创建文档 → 生成 Word → 检查存在 → 下载
  - 测试批量导出流程: 多个文档同时生成 Word
  - 测试缓存机制: 第二次下载使用缓存
  - 测试错误处理: 网络错误、超时、文件系统错误
  - _验证需求: 所有需求的集成测试_

- [x] 17. 手动测试和验证
  - 测试不同类型的文档:
    - 纯文本文档
    - 富文本文档(包含标题、列表、表格)
    - 包含图片的文档
    - 包含代码块的文档
    - Lake 格式文档
  - 测试不同的 Word 软件:
    - Microsoft Word (Windows/Mac)
    - WPS Office
    - LibreOffice Writer
  - 测试边缘情况:
    - 空文档
    - 超大文档(>1000 段落)
    - 特殊字符(中文、emoji、符号)
    - 超大图片(>10MB)
  - 测试错误处理:
    - 网络错误(图片下载失败)
    - 超时(30 秒)
    - 磁盘空间不足
  - _验证需求: 6.2, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5_

---

## 阶段 8: 文档和优化

- [x] 18. 更新项目文档
  - 更新 `README.md`:
    - 添加 Word 导出功能说明
    - 添加使用示例
    - 添加依赖说明
  - 更新 `.kiro/steering/tech.md`:
    - 添加 Word 导出技术栈
    - 添加相关命令
  - 更新 `.kiro/steering/structure.md`:
    - 添加 WordGeneratorService 说明
    - 更新 API 端点列表
  - 创建 `docs/word-export-guide.md`:
    - 详细的使用指南
    - 常见问题解答
    - 故障排除
  - _验证需求: 文档完整性_

---

## 任务统计

- **总任务数**: 18 个核心任务 + 7 个可选测试任务 = 25 个任务
- **阶段 1 (依赖安装)**: 1 个任务
- **阶段 2 (Word 生成核心)**: 5 个任务 + 1 个可选测试
- **阶段 3 (后端 API)**: 2 个任务 + 1 个可选测试
- **阶段 4 (前端服务)**: 1 个任务 + 1 个可选测试
- **阶段 5 (前端 UI)**: 2 个任务 + 1 个可选测试
- **阶段 6 (属性测试)**: 4 个可选测试任务
- **阶段 7 (集成测试)**: 1 个可选测试 + 1 个手动测试
- **阶段 8 (文档)**: 1 个任务

**预计完成时间**: 2-3 周 (假设 1 人全职开发)

**注意事项**:
- 标记为 `*` 的任务为可选测试任务,可以根据项目需求决定是否实施
- 核心功能实现优先,测试可以在功能稳定后补充
- 复用现有基础设施可以大幅减少开发时间
- 建议按阶段顺序执行,确保每个阶段完成后再进入下一阶段
