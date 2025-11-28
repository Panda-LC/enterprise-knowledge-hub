# Enterprise Knowledge Hub (EKH)

企业知识中心 - 一个现代化的知识资产管理平台，支持从语雀等知识库平台导出文档到本地资产库。

## 🚀 功能特性

### 已实现功能
- ✅ **语雀集成**: 支持配置多个语雀知识库源，自动导出文档和文件夹结构
- ✅ **自动化任务**: 支持手动触发和定时任务（每小时/每天/每周）
- ✅ **文档管理**: 支持 Markdown 和 HTML 格式文档，保持与语雀一致的文件夹层级
- ✅ **本地文件存储**: 使用本地文件系统存储数据，突破浏览器存储限制
- ✅ **文档预览下载**: 支持文档内容预览和下载，图片资源本地化
- ✅ **HTML/PDF 导出**: 导出时自动生成包含内嵌图片的 HTML 和 PDF 文件，支持离线查看
- ✅ **图片内嵌**: 自动将图片转换为 Base64 Data URL，实现完全离线的文档查看
- ✅ **响应式样式**: 生成的 HTML 文件包含响应式 CSS，适配不同屏幕尺寸
- ✅ **格式选择下载**: 支持选择下载 HTML 或 PDF 格式，优先使用已生成的文件
- ✅ **错误处理**: 完善的 API 错误处理和自动重试机制
- ✅ **实时日志**: 详细的任务执行日志，支持成功/错误/警告级别
- ✅ **国际化**: 支持中英文切换

### 规划中功能
- ⏳ 支持更多数据源（Notion、Confluence）
- ⏳ 增量同步
- ⏳ 全文搜索
- ⏳ RAG 性能监控

## 📋 前置要求

- Node.js 16+
- npm 或 yarn

## 🛠️ 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量（可选）

在项目根目录创建 `.env.local` 文件：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 启动开发服务器

```bash
npm run dev
```

这将同时启动三个服务：
- 前端开发服务器（端口 3000）
- 代理服务器（端口 3001）
- 存储服务器（端口 3002）

访问 http://localhost:3000 查看应用。

> **注意**: 首次启动时，系统会自动在项目根目录创建 `data/` 文件夹用于存储数据。

### 4. 配置语雀集成

1. 打开应用，导航到"渠道连接器"页面
2. 点击"新增集成"，选择"入站" → "语雀集成"
3. 填写配置信息：
   - 配置名称：自定义名称
   - 企业域名：如 `https://www.yuque.com`
   - 团队 Login：语雀团队标识
   - 知识库 Slug：知识库路径
   - 访问令牌：从语雀个人设置获取
4. 保存配置

### 5. 创建导出任务

1. 导航到"自动化任务"页面
2. 点击"创建任务"
3. 选择语雀源和触发方式（手动/定时）
4. 保存并执行任务

### 6. 下载文档

导出完成后，您可以下载文档：

1. 在"知识资产库"中找到您的文档
2. 点击文档进入详情页
3. 点击"下载"按钮，选择格式：
   - **HTML**: 包含内嵌图片的完整 HTML 文件，可离线查看
   - **PDF**: 专业格式的 PDF 文档（需要安装 Chrome 或 wkhtmltopdf）

**特性说明**：
- 导出时自动生成 `.json`、`.html` 和 `.pdf` 三种格式
- HTML 文件中的图片已转换为 Base64，无需网络连接即可查看
- 下载时优先使用已生成的文件，无需等待重新生成
- 文档更新后会自动重新生成 HTML 和 PDF 文件

## 📦 项目结构

```
/
├── components/          # React 组件
├── contexts/            # React Context 状态管理
├── services/            # 服务层（API、存储、导出）
├── server/              # 后端服务
│   ├── proxy.js        # 代理服务器（端口 3001）
│   ├── storage.js      # 存储服务器（端口 3002）
│   └── FileSystemService.js  # 文件系统服务
├── data/               # 本地数据存储（自动创建，不提交到 Git）
│   ├── configs/        # 配置文件
│   ├── documents/      # 文档内容（.json、.html、.pdf）
│   └── assets/         # 资源文件（图片、附件）
├── .kiro/              # Kiro AI 助手配置
│   ├── specs/          # 功能规格文档
│   └── steering/       # AI 引导规则
└── docs/               # 项目文档
```

## 🧪 测试

运行单元测试：

```bash
npm test
```

运行测试（监听模式）：

```bash
npm run test:watch
```

测试覆盖：
- 单元测试：31 个测试用例
- 覆盖率：核心服务 100%

## 🏗️ 构建

构建生产版本：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 📚 技术栈

- **前端**: React 19.2.0 + TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **路由**: React Router 7.9.6
- **UI**: Tailwind CSS + Lucide Icons
- **Markdown**: react-markdown + remark-gfm
- **测试**: Vitest + Testing Library
- **后端**: Express (代理服务器)

## 📖 文档

### 产品文档
- [产品概述](.kiro/steering/product.md)
- [项目结构](.kiro/steering/structure.md)
- [技术栈](.kiro/steering/tech.md)

### 功能规格
- [语雀集成需求](.kiro/specs/yuque-integration/requirements.md)
- [语雀集成设计](.kiro/specs/yuque-integration/design.md)
- [本地文件存储需求](.kiro/specs/local-file-storage/requirements.md)
- [本地文件存储设计](.kiro/specs/local-file-storage/design.md)
- [HTML 下载与内嵌图片需求](.kiro/specs/html-download-with-embedded-images/requirements.md)
- [HTML 下载与内嵌图片设计](.kiro/specs/html-download-with-embedded-images/design.md)

### 数据管理
- [数据目录结构说明](data/README.md)
- [功能验证报告](VERIFICATION_REPORT.md)

## 🔧 开发指南

### 添加新的数据源

1. 在 `services/` 创建新的 API 服务类
2. 在 `contexts/` 创建配置管理 Context
3. 在 `components/ChannelConnectors.tsx` 添加配置界面
4. 实现导出服务逻辑

### 数据持久化

所有数据通过 `StorageService` 存储到本地文件系统：
- 配置数据：`data/configs/yuque.json`、`data/configs/tasks.json`、`data/configs/items.json`
- 文档内容：`data/documents/{docId}.json`（原始数据）
- HTML 文件：`data/documents/{docId}.html`（包含内嵌图片）
- PDF 文件：`data/documents/{docId}.pdf`（专业格式）
- 资源文件：`data/assets/{sourceId}/{docId}/{filename}`

数据文件特点：
- 自动备份机制（写入前创建 `.bak` 文件）
- 文件锁保证并发安全
- 支持大文件和大量文档
- 易于备份和迁移
- 多格式支持（JSON、HTML、PDF）

### 错误处理

- API 错误：401/403/429 自动处理
- 网络超时：最多重试 3 次
- 限流：等待 500ms 后重试
- 部分失败：继续处理其他文档

## 💡 使用示例

### 示例 1: 导出语雀文档并下载 HTML

```bash
# 1. 启动应用
npm run dev

# 2. 在浏览器中配置语雀集成
# 访问 http://localhost:3000/#/channels
# 添加语雀配置（域名、团队、知识库、令牌）

# 3. 创建并执行导出任务
# 访问 http://localhost:3000/#/automation
# 创建任务并点击"立即执行"

# 4. 查看导出结果
# 访问 http://localhost:3000/#/documents
# 点击文档进入详情页

# 5. 下载 HTML 文件
# 点击"下载"按钮，选择"HTML"
# 下载的文件包含所有内嵌图片，可离线查看
```

### 示例 2: 生成 PDF 文档

```bash
# 前提：安装 Chrome 或 wkhtmltopdf

# macOS 安装 Chrome（如果未安装）
brew install --cask google-chrome

# 或安装 wkhtmltopdf
brew install wkhtmltopdf

# 执行导出任务后，系统会自动生成 PDF
# 在文档详情页点击"下载" → "PDF"
```

### 示例 3: 查看生成的文件

```bash
# 查看文档目录
ls -la data/documents/

# 输出示例：
# yuque_source_timestamp_docid.json  # 原始 JSON 数据
# yuque_source_timestamp_docid.html  # 包含内嵌图片的 HTML
# yuque_source_timestamp_docid.pdf   # PDF 文件

# 直接在浏览器中打开 HTML 文件
open data/documents/yuque_source_timestamp_docid.html
```

### 示例 4: 图片内嵌原理

导出的 HTML 文件中，图片 URL 会被转换为 Base64 Data URL：

```html
<!-- 原始图片 URL -->
<img src="https://cdn.yuque.com/xxx/image.png" />

<!-- 转换后的 Base64 Data URL -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." />
```

这样 HTML 文件可以完全离线查看，无需网络连接。

### 示例 5: 自定义响应式样式

生成的 HTML 文件包含响应式 CSS 样式：

```css
body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

img {
  max-width: 100%;
  height: auto;
}

table {
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 768px) {
  body {
    padding: 10px;
  }
}
```

## 🔍 故障排除

### 存储服务器无法启动

**问题**: 运行 `npm run dev` 时存储服务器启动失败

**解决方案**:
1. 检查端口 3002 是否被占用：`lsof -i :3002`
2. 确保有权限创建 `data/` 目录
3. 查看控制台错误日志

### 数据文件损坏

**问题**: 配置或文档数据无法加载

**解决方案**:
1. 检查 `data/` 目录下是否有 `.bak` 备份文件
2. 手动将 `.bak` 文件重命名为原文件名（去掉 `.bak` 后缀）
3. 重启应用

### 资源文件无法显示

**问题**: 文档中的图片无法显示

**解决方案**:
1. 确保存储服务器（端口 3002）正在运行
2. 检查 `data/assets/` 目录下是否有对应的资源文件
3. 查看浏览器控制台的网络请求错误

### 并发写入冲突

**问题**: 多个任务同时执行时出现数据不一致

**解决方案**:
- 系统已实现文件锁机制，自动处理并发写入
- 如果仍有问题，尝试逐个执行任务而非并发执行

### 磁盘空间不足

**问题**: 导出大量文档时提示磁盘空间不足

**解决方案**:
1. 清理 `data/` 目录下不需要的文档和资源
2. 定期备份并归档旧数据
3. 考虑使用外部存储或云存储

### 数据迁移

**问题**: 需要将数据迁移到新机器

**解决方案**:
1. 复制整个 `data/` 目录到新机器的项目根目录
2. 确保目录权限正确
3. 启动应用，数据会自动加载

### PDF 生成失败

**问题**: 导出时 PDF 文件生成失败

**解决方案**:
1. 检查是否安装了 Chrome 或 wkhtmltopdf：
   ```bash
   # 检查 Chrome
   which google-chrome-stable || which chromium || which google-chrome
   
   # 检查 wkhtmltopdf
   which wkhtmltopdf
   ```

2. macOS 安装方法：
   ```bash
   # 安装 Chrome
   brew install --cask google-chrome
   
   # 或安装 wkhtmltopdf
   brew install wkhtmltopdf
   ```

3. Linux 安装方法：
   ```bash
   # Ubuntu/Debian
   sudo apt-get install chromium-browser
   # 或
   sudo apt-get install wkhtmltopdf
   
   # CentOS/RHEL
   sudo yum install chromium
   # 或
   sudo yum install wkhtmltopdf
   ```

4. 查看日志了解具体错误：
   - 在"自动化任务"页面查看任务日志
   - PDF 生成失败不会影响 HTML 文件的生成

### 图片内嵌失败

**问题**: HTML 文件中的图片未转换为 Base64

**解决方案**:
1. 检查图片是否已下载到 `data/assets/` 目录
2. 查看任务日志，确认图片处理状态
3. 大于 10MB 的图片会记录警告但仍会尝试处理
4. 处理超时（30 秒）的图片会保留原始 URL
5. 如果图片转换失败，原始 URL 会被保留，不影响其他图片

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- 语雀 API 文档
- React 社区
- Vite 团队

---

**开发状态**: ✅ 语雀集成已完成 | ✅ 本地文件存储已完成 | ✅ HTML/PDF 导出已完成  
**版本**: v2.1.0  
**最后更新**: 2024年1月
