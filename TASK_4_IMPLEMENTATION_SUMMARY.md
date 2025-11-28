# 任务 4 实现总结：扩展 StorageService

## 实现概述

成功扩展了 `StorageService`，添加了文件存在检查方法和文件下载方法，实现了缓存逻辑和动态生成回退逻辑。

## 实现的功能

### 1. 前端 StorageService 扩展 (services/StorageService.ts)

#### 新增方法：

1. **fileExists(docId: string, format: 'html' | 'pdf'): Promise<boolean>**
   - 检查指定格式的文件是否存在
   - 使用 HEAD 请求检查文件状态
   - 网络错误时返回 false
   - 验证 Requirements: 7.2, 7.3, 9.1, 9.2

2. **downloadDocumentFile(docId: string, title: string, format: 'html' | 'pdf'): Promise<void>**
   - 下载指定格式的文档文件
   - 实现缓存逻辑：优先使用本地已存在的文件
   - 实现回退逻辑：文件不存在时动态生成
   - 自动清理文件名中的不安全字符
   - 验证 Requirements: 7.2, 7.3, 7.4, 9.1, 9.2, 9.3

3. **generateHtmlOnTheFly(docId: string): Promise<string>** (私有方法)
   - 从 JSON 动态生成 HTML
   - 添加基础的响应式样式
   - 作为 HTML 文件不存在时的回退方案

4. **generatePdfOnTheFly(docId: string): Promise<Blob>** (私有方法)
   - PDF 动态生成的占位方法
   - 抛出错误提示用户需要先在导出时生成 PDF

5. **sanitizeFilename(filename: string): string** (私有方法)
   - 清理文件名中的不安全字符
   - 替换空格为下划线
   - 限制文件名长度为 200 字符

### 2. 后端 FileSystemService 扩展 (server/FileSystemService.js)

#### 新增方法：

1. **savePdfFile(docId, pdfBuffer): Promise<string>**
   - 保存 PDF 文件到 data/documents/{docId}.pdf
   - 使用文件锁保护并发写入
   - 自动创建备份和恢复机制

2. **loadPdfFile(docId): Promise<Buffer|null>**
   - 加载 PDF 文件内容
   - 文件不存在时返回 null
   - 错误处理和日志记录

3. **pdfFileExists(docId): Promise<boolean>**
   - 检查 PDF 文件是否存在
   - 使用 fs.access 检查文件访问权限

4. **deleteFile(docId, fileType): Promise<void>**
   - 删除指定类型的文件（HTML 或 PDF）
   - 用于文档更新时清理旧文件
   - 文件不存在时不抛出错误

### 3. 后端 API 端点扩展 (server/storage.js)

#### 新增端点：

1. **HEAD /api/storage/documents/:docId/html**
   - 检查 HTML 文件是否存在
   - 返回 200 (存在) 或 404 (不存在)

2. **POST /api/storage/documents/:docId/pdf**
   - 保存 PDF 文件
   - 使用 multipart/form-data 上传
   - 返回文件路径

3. **GET /api/storage/documents/:docId/pdf**
   - 获取 PDF 文件内容
   - 返回二进制 PDF 数据
   - 设置正确的 Content-Type 和缓存头

4. **HEAD /api/storage/documents/:docId/pdf**
   - 检查 PDF 文件是否存在
   - 返回 200 (存在) 或 404 (不存在)

## 缓存逻辑实现

### 工作流程：

1. **检查阶段**：使用 `fileExists()` 方法检查本地文件是否存在
2. **缓存命中**：如果文件存在，直接从本地读取并下载
3. **缓存未命中**：如果文件不存在，触发动态生成逻辑
4. **动态生成**：
   - HTML：从 JSON 文档动态生成简单的 HTML
   - PDF：抛出错误，提示需要先在导出时生成

### 优势：

- 减少重复生成，提升性能
- 降低服务器负载
- 提供更快的下载体验
- 支持离线查看（已生成的文件）

## 回退逻辑实现

### HTML 回退：

当 HTML 文件不存在时：
1. 从 data/documents/{docId}.json 加载文档内容
2. 提取 body_html 或 body 字段
3. 包装成完整的 HTML 文档（带基础样式）
4. 直接下载生成的 HTML

### PDF 回退：

当 PDF 文件不存在时：
- 抛出友好的错误提示
- 建议用户先在导出时生成 PDF 文件
- 避免在浏览器端进行复杂的 PDF 生成

## 测试覆盖

### 单元测试 (services/StorageService.fileops.test.ts)

- ✅ 检查 HTML 文件是否存在
- ✅ 检查 PDF 文件是否存在
- ✅ 文件不存在时返回 false
- ✅ 网络错误时返回 false
- ✅ 下载已存在的 HTML 文件
- ✅ 下载已存在的 PDF 文件
- ✅ 文件不存在时动态生成 HTML
- ✅ PDF 不存在时抛出错误
- ✅ 清理文件名中的不安全字符
- ✅ 替换空格为下划线
- ✅ 限制文件名长度

### 集成测试 (services/StorageService.integration.test.ts)

- ✅ 验证缓存逻辑
- ✅ 验证回退逻辑
- ✅ 支持 HTML 和 PDF 两种格式
- ✅ 优雅处理网络错误

### 后端测试

- ✅ 所有现有的 FileSystemService 测试通过 (25 个测试)
- ✅ 所有现有的 StorageService 测试通过 (10 个测试)

## 验证的需求

- ✅ **Requirement 7.2**: 系统应检查本地是否存在对应的文件
- ✅ **Requirement 7.3**: 本地存在文件时，系统应直接下载该文件
- ✅ **Requirement 7.4**: 本地不存在文件时，系统应动态生成并下载
- ✅ **Requirement 9.1**: 用户选择下载时，系统应检查本地是否存在对应的文件
- ✅ **Requirement 9.2**: 本地存在文件时，系统应直接下载该文件
- ✅ **Requirement 9.3**: 本地不存在文件时，系统应动态生成并下载

## 文件结构

```
services/
├── StorageService.ts                      # 扩展的前端服务
├── StorageService.fileops.test.ts         # 文件操作单元测试
└── StorageService.integration.test.ts     # 集成测试

server/
├── FileSystemService.js                   # 扩展的后端服务
└── storage.js                             # 扩展的 API 端点
```

## 使用示例

### 检查文件是否存在

```typescript
const exists = await StorageService.fileExists('doc-123', 'html');
if (exists) {
  console.log('HTML 文件已存在');
}
```

### 下载文档文件

```typescript
// 下载 HTML 文件（自动使用缓存或动态生成）
await StorageService.downloadDocumentFile('doc-123', '我的文档', 'html');

// 下载 PDF 文件（自动使用缓存）
await StorageService.downloadDocumentFile('doc-123', '我的文档', 'pdf');
```

## 性能优化

1. **缓存优先**：优先使用本地已生成的文件，避免重复生成
2. **HEAD 请求**：使用 HEAD 请求检查文件存在，不传输文件内容
3. **错误处理**：网络错误时优雅降级，不阻塞用户操作
4. **文件名清理**：自动清理不安全字符，避免下载失败

## 安全性

1. **文件名清理**：移除路径遍历和不安全字符
2. **长度限制**：限制文件名长度，防止文件系统错误
3. **类型验证**：严格验证文件格式参数
4. **错误隔离**：错误不会暴露内部路径信息

## 下一步

任务 4 已完成，可以继续执行：
- 任务 5: 扩展后端文件系统服务
- 任务 6: 扩展后端存储服务器
- 任务 7: 集成到 ExportService
- 任务 8: 更新 DocumentDetail 组件
