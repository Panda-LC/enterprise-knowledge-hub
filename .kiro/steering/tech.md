# 技术栈

## 前端技术栈
- **框架**: React 19.2.0 + TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **路由**: React Router 7.9.6 (HashRouter)
- **UI 组件**: Tailwind CSS + Lucide Icons 0.554.0
- **Markdown 渲染**: react-markdown 10.1.0 + remark-gfm 4.0.1 + rehype-raw 7.0.0 + rehype-sanitize 6.0.0
- **Word 生成**: docx 8.5.0 + htmlparser2 9.1.0 + isomorphic-dompurify 2.11.0
- **图表**: recharts 3.4.1
- **测试**: Vitest 4.0.14 + Testing Library + happy-dom 20.0.10

## 后端技术栈
- **运行时**: Node.js 16+
- **服务器**: Express 4.21.2
- **文件上传**: multer 2.0.2
- **文件锁**: proper-lockfile 4.1.2
- **跨域**: cors 2.8.5

## 开发工具
- **并发运行**: concurrently 9.1.2
- **类型检查**: TypeScript 5.8.2
- **测试工具**: vitest, supertest 7.1.4, fast-check 4.3.0

## 常用命令

### 开发
```bash
# 启动所有服务（前端 + 代理服务器 + 存储服务器）
npm run dev

# 单独启动前端开发服务器（端口 3000）
npm run dev:client

# 单独启动代理服务器（端口 3001）
npm run dev:server

# 单独启动存储服务器（端口 3002）
npm run dev:storage
```

### 测试
```bash
# 运行所有测试（单次执行）
npm test

# 运行测试（监听模式）
npm run test:watch
```

### 构建
```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 服务架构
项目采用三层服务架构：

1. **前端服务器** (端口 3000)
   - Vite 开发服务器
   - React 应用
   - 代理 `/yuque-api` 请求到语雀

2. **代理服务器** (端口 3001)
   - Express 服务器
   - 处理跨域请求
   - 转发语雀 API 请求
   - 代理图片下载（避免 CORS）

3. **存储服务器** (端口 3002)
   - Express 服务器
   - RESTful API 设计
   - 文件系统操作（CRUD）
   - 配置管理（yuque.json、tasks.json、items.json）
   - 文档管理（JSON、HTML、PDF）
   - 资源文件管理（图片、附件）
   - 文件锁和备份机制

## 核心服务类

### 前端服务
- **StorageService**: 存储 API 客户端，封装所有后端 API 调用
- **YuqueApiService**: 语雀 API 客户端，处理认证、限流、重试
- **ExportService**: 导出服务，协调 TOC 解析、文件夹创建、文档导出
- **HtmlGeneratorService**: HTML 生成服务，添加响应式样式，内嵌图片
- **ImageEmbedderService**: 图片内嵌服务，Base64 转换，并发处理
- **PdfGeneratorService**: PDF 生成服务（Node.js 环境）
- **WordGeneratorService**: Word 文档生成服务，HTML 解析，格式转换，图片内嵌

### 后端服务
- **FileSystemService**: 文件系统服务，处理所有文件 I/O 操作

## 配置文件
- `vite.config.ts` - Vite 构建配置，代理设置
- `tsconfig.json` - TypeScript 编译配置
- `vitest.config.ts` - 测试配置
- `vitest.setup.ts` - 测试环境设置
- `package.json` - 依赖和脚本
- `.gitignore` - Git 忽略配置（node_modules、dist、data、tasks）
- `metadata.json` - 项目元数据

## 环境变量
可选的 `.env.local` 文件：
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 关键技术特性

### 错误处理和重试
- 网络超时：最多重试 3 次，指数退避（1s, 2s, 4s）
- 限流处理：429 状态码自动等待重试
- 部分失败：继续处理其他项目，记录错误日志

### 并发控制
- 图片处理：最多 5 个并发
- 大文件警告：>10MB
- 超时控制：30 秒

### 文件安全
- 文件锁：proper-lockfile 防止并发写入冲突
- 自动备份：写入前创建 .bak 文件
- 文件名清理：移除不安全字符

### 性能优化
- 缓存机制：优先使用已生成的 HTML/PDF/Word 文件
- 动态生成：文件不存在时按需生成
- 响应式加载：大文件分块处理

## Word 导出技术栈

### 核心依赖
- **docx@^8.5.0**: Word 文档生成库
  - 支持 Office Open XML 标准
  - 提供丰富的格式化选项
  - 支持图片、表格、列表等元素
  
- **htmlparser2@^9.1.0**: HTML 解析库
  - 高性能流式解析器
  - 支持复杂的 HTML 结构
  - 提供 DOM 树遍历功能
  
- **isomorphic-dompurify@^2.11.0**: HTML 清理库
  - 防止 XSS 攻击
  - 清理不安全的 HTML 内容
  - 支持自定义白名单

### Word 生成流程
1. **HTML 清理**: 使用 DOMPurify 清理 HTML，防止 XSS
2. **Lake 格式转换**: 解析语雀 `<card>` 标签，提取结构化数据
3. **HTML 解析**: 使用 htmlparser2 解析为 DOM 树
4. **元素映射**: 将 HTML 元素映射为 Word 元素
   - `<h1>-<h6>` → Heading1-Heading6
   - `<p>` → Paragraph
   - `<ul>/<ol>` → List
   - `<table>` → Table
   - `<img>` → Image
   - `<pre>/<code>` → Code Block
5. **图片内嵌**: 并发下载图片并内嵌到 Word 文档
6. **文档生成**: 使用 docx 库生成 .docx 文件

### 格式支持
- **文本样式**: 粗体、斜体、下划线、删除线、颜色
- **段落格式**: 对齐方式、缩进、间距
- **标题**: H1-H6，自动应用 Word 标题样式
- **列表**: 有序列表、无序列表、嵌套列表
- **表格**: 行列结构、边框样式、单元格对齐
- **图片**: 内嵌图片、尺寸保留、对齐方式
- **代码块**: 等宽字体、保留缩进
- **超链接**: 可点击的链接
- **引用块**: 缩进样式
- **分隔线**: 水平线

### 兼容性
- Microsoft Word (Windows/Mac)
- WPS Office
- LibreOffice Writer
- Google Docs (导入后)

### 相关命令

```bash
# 测试 Word 生成功能
npm test -- WordGeneratorService

# 测试 Word 集成
npm test -- WordGeneratorService.integration

# 运行所有 Word 相关测试
npm test -- word
```

## 项目组织

### 文件夹用途
- **components/**: React UI 组件
- **contexts/**: React Context 状态管理
- **services/**: 业务逻辑服务层
- **server/**: Node.js 后端服务
- **data/**: 运行时数据存储（不提交到 Git）
- **docs/**: 项目文档和示例
- **tasks/**: 测试脚本和中间产物（不提交到 Git）
- **dist/**: 构建输出（不提交到 Git）
- **.kiro/**: Kiro AI 助手配置

### Git 忽略策略
项目使用 `.gitignore` 忽略以下内容：
- `node_modules/` - 依赖包
- `dist/` - 构建产物
- `data/` - 本地数据存储
- `tasks/` - 测试和中间产物
- `.env.local` - 环境变量
- `*.log` - 日志文件
- `*.bak` - 备份文件
