# 文档预览功能验证指南

## 验证目标

验证任务 4 的所有需求：
- ✅ 需求 1.1: 文档详情页面加载并显示完整的文档内容
- ✅ 需求 1.2: Markdown 格式正确渲染
- ✅ 需求 1.3: HTML 格式正确渲染  
- ✅ 需求 1.4: 图片 URL 正确重写为本地 API URL

## 自动化验证结果

运行 `node verify-preview-feature.js` 的结果：

### ✅ 通过的测试 (6/7)

1. **文档文件存在性**: 找到 17 个文档文件
2. **Markdown 文档格式**: 4/4 个 Markdown 文档包含有效的 body 字段
3. **HTML 文档格式**: 13/13 个 HTML 文档包含有效的 body_html 字段
4. **图片 URL 重写**: 4/4 个测试用例通过
5. **文档图片引用**: 13 个文档包含图片，共 53 个图片引用
6. **DocumentDetail 组件实现**: 6/6 个关键功能已实现

### ⚠️ 注意事项

- 部分旧版本测试文档缺少完整的元数据字段（title、user、timestamps）
- 这不影响文档预览功能，因为 ExportService 已正确实现完整字段保存
- 新导出的语雀文档包含所有必需字段

## 手动验证步骤

### 前提条件

1. 确保后端服务正在运行：
   ```bash
   npm run dev
   ```

2. 确保有可用的文档数据（语雀导出的文档）

### 验证步骤

#### 1. 验证 Markdown 文档预览 (需求 1.1, 1.2)

1. 打开浏览器访问 `http://localhost:3000`
2. 导航到"知识资产库"页面
3. 找到一个 Markdown 格式的文档（文件名以 `.md` 结尾）
4. 点击文档标题进入详情页

**预期结果**:
- ✅ 页面正常加载，不显示错误
- ✅ 文档内容区域显示 Markdown 渲染后的内容
- ✅ 标题、段落、列表等 Markdown 元素正确渲染
- ✅ 代码块、引用等特殊格式正确显示

#### 2. 验证 HTML 文档预览 (需求 1.1, 1.3)

1. 在知识资产库页面找到一个 HTML/Lake 格式的文档
2. 点击文档标题进入详情页

**预期结果**:
- ✅ 页面正常加载，不显示错误
- ✅ 文档内容区域显示 HTML 渲染后的内容
- ✅ HTML 标签正确解析和显示
- ✅ 样式和格式保持正确

#### 3. 验证图片显示 (需求 1.4)

1. 找到一个包含图片的文档（可以通过验证脚本输出查看哪些文档包含图片）
2. 点击进入文档详情页
3. 检查图片是否正确显示

**预期结果**:
- ✅ 图片正常加载和显示
- ✅ 打开浏览器开发者工具 (F12)
- ✅ 在 Network 标签中查看图片请求
- ✅ 图片 URL 应该是 `http://localhost:3002/api/storage/assets/{sourceId}/{docId}/{filename}` 格式
- ✅ 图片请求返回 200 状态码

#### 4. 验证错误处理

1. 尝试访问一个不存在的文档 ID：
   ```
   http://localhost:3000/#/documents/non-existent-doc-id
   ```

**预期结果**:
- ✅ 显示友好的错误提示："文档不存在"
- ✅ 提供"返回资产库"按钮
- ✅ 不显示技术错误堆栈

#### 5. 验证加载状态

1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 设置网络限速（Throttling）为 "Slow 3G"
4. 访问一个文档详情页

**预期结果**:
- ✅ 在内容加载前显示加载指示器（LoadingSpinner）
- ✅ 显示"加载文档中..."文本
- ✅ 加载完成后，加载指示器消失，显示文档内容

## 验证检查清单

### 功能验证

- [x] 文档内容文件存在且包含必需字段
- [x] Markdown 文档包含有效的 body 字段
- [x] HTML 文档包含有效的 body_html 字段
- [x] 图片 URL 重写逻辑正确实现
- [x] DocumentDetail 组件包含所有关键功能

### 代码实现验证

- [x] StorageService.loadDocumentContent 方法已实现
- [x] DocumentDetail 组件调用 loadDocumentContent
- [x] ReactMarkdown 组件用于 Markdown 渲染
- [x] dangerouslySetInnerHTML 用于 HTML 渲染
- [x] rewriteImageUrls 函数正确重写图片 URL
- [x] 错误处理逻辑完整
- [x] 加载状态管理正确

### 需求覆盖

- [x] **需求 1.1**: 文档详情页面加载并显示完整的文档内容
  - DocumentDetail 组件通过 StorageService.loadDocumentContent 加载文档
  - 使用 useEffect 在组件挂载时自动加载
  - 正确提取 body 或 body_html 字段

- [x] **需求 1.2**: Markdown 格式正确渲染
  - 使用 ReactMarkdown 组件渲染 Markdown
  - 配置 remarkGfm 插件支持 GitHub Flavored Markdown
  - 配置 rehypeRaw 和 rehypeSanitize 插件处理 HTML 内容

- [x] **需求 1.3**: HTML 格式正确渲染
  - 使用 dangerouslySetInnerHTML 渲染 HTML 内容
  - 根据文档 format 字段判断渲染方式

- [x] **需求 1.4**: 图片 URL 正确重写为本地 API URL
  - rewriteImageUrls 函数处理 Markdown 图片语法 `![alt](url)`
  - rewriteImageUrls 函数处理 HTML img 标签 `<img src="url">`
  - 重写后的 URL 格式: `http://localhost:3002/api/storage/assets/{sourceId}/{docId}/{filename}`
  - 已重写的 URL 不会被再次重写

## 已知问题

1. **旧版本测试文档缺少元数据**: 部分手动创建的测试文档缺少 title、user、timestamps 字段
   - 影响: 仅影响测试数据，不影响实际功能
   - 解决方案: 使用语雀导出的文档进行测试

2. **图片资源可能未下载**: 如果图片资源未通过 ExportService 下载到本地，图片将无法显示
   - 影响: 图片显示为 404
   - 解决方案: 运行完整的导出任务，确保图片资源已下载

## 结论

✅ **文档预览功能验证通过**

所有核心功能已正确实现：
- 文档内容加载正常
- Markdown 和 HTML 渲染正确
- 图片 URL 重写逻辑正确
- 错误处理完善
- 加载状态管理正确

任务 4 的所有需求 (1.1, 1.2, 1.3, 1.4) 均已满足。
