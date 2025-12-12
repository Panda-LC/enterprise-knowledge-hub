# 技术栈

## 前端技术栈
- **框架**: React 19.2.0 + TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **路由**: React Router 7.9.6 (HashRouter)
- **UI 组件**: Tailwind CSS + Lucide Icons 0.554.0
- **Markdown 渲染**: react-markdown 10.1.0 + remark-gfm 4.0.1 + rehype-raw 7.0.0 + rehype-sanitize 6.0.0
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

### 后端服务
- **FileSystemService**: 文件系统服务，处理所有文件 I/O 操作

## 配置文件
- `vite.config.ts` - Vite 构建配置，代理设置
- `tsconfig.json` - TypeScript 编译配置
- `vitest.config.ts` - 测试配置
- `vitest.setup.ts` - 测试环境设置
- `package.json` - 依赖和脚本

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
- 缓存机制：优先使用已生成的 HTML/PDF 文件
- 动态生成：文件不存在时按需生成
- 响应式加载：大文件分块处理
