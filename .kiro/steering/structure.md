# 项目结构

## 目录组织

```
/
├── components/          # React 组件
│   ├── AssetsLibrary.tsx       # 知识资产库（文档列表）
│   ├── AutomationScheduler.tsx # 自动化任务管理
│   ├── ChannelConnectors.tsx   # 渠道连接器（语雀配置）
│   ├── Common.tsx              # 通用组件
│   ├── Dashboard.tsx           # 仪表盘
│   ├── DocumentDetail.tsx      # 文档详情页
│   ├── ErrorBoundary.tsx       # 错误边界
│   ├── LoadingSpinner.tsx      # 加载动画
│   └── Settings.tsx            # 设置页面
│
├── contexts/            # React Context 状态管理
│   ├── ExportTaskContext.tsx   # 导出任务状态
│   ├── FileSystemContext.tsx   # 文件系统状态
│   └── YuqueConfigContext.tsx  # 语雀配置状态
│
├── services/            # 服务层（业务逻辑）
│   ├── ExportService.ts        # 导出服务（语雀数据导出）
│   ├── HtmlGeneratorService.ts # HTML 生成服务
│   ├── ImageEmbedderService.ts # 图片内嵌服务
│   ├── PdfGeneratorService.ts  # PDF 生成服务
│   ├── WordGeneratorService.ts # Word 文档生成服务
│   ├── StorageService.ts       # 存储服务（API 客户端）
│   └── YuqueApiService.ts      # 语雀 API 服务
│
├── server/              # 后端服务
│   ├── proxy.js                # 代理服务器（端口 3001）
│   ├── storage.js              # 存储服务器（端口 3002）
│   └── FileSystemService.js    # 文件系统服务
│
├── data/                # 本地数据存储（自动创建，不提交到 Git）
│   ├── configs/                # 配置文件
│   │   ├── yuque.json         # 语雀配置
│   │   ├── tasks.json         # 导出任务
│   │   └── items.json         # 文件系统项
│   ├── documents/              # 文档内容
│   │   ├── {docId}.json       # 原始 JSON 数据
│   │   ├── {docId}.html       # 包含内嵌图片的 HTML
│   │   └── {docId}.docx       # Word 文件
│   └── assets/                 # 资源文件
│       └── {sourceId}/{docId}/{filename}
│
├── .kiro/               # Kiro AI 助手配置
│   ├── specs/                  # 功能规格文档
│   └── steering/               # AI 引导规则
│
├── docs/                # 项目文档
│   ├── example/                # 示例文件
│   ├── export-yuque.js         # 语雀导出脚本
│   ├── html-to-pdf.js          # HTML 转 PDF 脚本
│   └── yuque-export-integration.md
│
├── tasks/               # 测试和中间产物（不提交到 Git）
│   ├── summaries/              # 修复总结文档
│   ├── temp/                   # 临时文件
│   ├── test-data/              # 测试数据
│   ├── tests/                  # 测试脚本
│   ├── debug-*.mjs             # 调试脚本
│   ├── test-*.mjs              # 测试脚本
│   ├── test-*.html             # 测试页面
│   └── *.md                    # 任务文档
│
├── .gitignore           # Git 忽略配置
├── App.tsx              # 主应用组件
├── index.tsx            # 应用入口
├── i18n.tsx             # 国际化配置
├── types.ts             # TypeScript 类型定义
├── index.html           # HTML 模板
├── metadata.json        # 项目元数据
├── package.json         # 依赖和脚本
├── tsconfig.json        # TypeScript 配置
├── vite.config.ts       # Vite 配置
├── vitest.config.ts     # 测试配置
└── vitest.setup.ts      # 测试设置
```

## 架构模式

### 1. 组件层 (components/)
- 纯 UI 组件，负责渲染和用户交互
- 通过 Context 获取状态和方法
- 使用 React Router 进行页面导航

### 2. 状态管理层 (contexts/)
- 使用 React Context API 管理全局状态
- 每个 Context 负责一个领域的状态
- 提供 Provider 组件和自定义 Hook

### 3. 服务层 (services/)
- 封装业务逻辑和 API 调用
- 使用类的静态方法组织代码
- 处理错误和重试逻辑

### 4. 后端服务层 (server/)
- Express 服务器处理文件系统操作
- 提供 RESTful API
- 实现文件锁和备份机制

## 代码组织原则

### 文件命名
- React 组件：PascalCase（如 `AssetsLibrary.tsx`）
- 服务类：PascalCase（如 `StorageService.ts`）
- 后端服务：kebab-case（如 `storage.js`）
- 测试文件：`*.test.ts` 或 `*.test.tsx`

### 导入顺序
1. React 和第三方库
2. 本地组件
3. 服务和工具
4. 类型定义
5. 样式文件

### 类型定义
- 所有类型定义集中在 `types.ts`
- 使用 TypeScript 枚举定义常量
- 接口命名使用 PascalCase

## 数据流

```
用户操作 → 组件 → Context → Service → 后端 API → 文件系统
                    ↓
                  状态更新
                    ↓
                  组件重渲染
```

## 数据流

```
用户操作 → 组件 → Context → Service → 后端 API → 文件系统
                    ↓
                  状态更新
                    ↓
                  组件重渲染
```

### 导出流程
```
1. ExportService.export()
   ↓
2. fetchAndParseToc() - 获取语雀目录结构
   ↓
3. createFolderStructure() - 创建文件夹层级
   ↓
4. exportDocuments() - 批量导出文档
   ↓
5. exportDocument() - 单个文档处理
   ├─ 获取文档详情（YuqueApiService）
   ├─ 处理资源文件（processAssets）
   ├─ 保存 JSON（StorageService）
   ├─ 生成 HTML（HtmlGeneratorService）
   │   └─ 内嵌图片（ImageEmbedderService）
   ├─ 生成 Word（WordGeneratorService）
   │   ├─ 解析 HTML 为 Word 元素
   │   ├─ 处理 Lake 格式
   │   └─ 内嵌图片
   └─ 更新文件系统（FileSystemContext）
```

### 下载流程
```
1. 用户点击下载按钮
   ↓
2. StorageService.downloadDocumentFile()
   ↓
3. 检查本地文件是否存在（fileExists）
   ├─ 存在：直接下载
   └─ 不存在：动态生成
       ├─ HTML: generateHtmlOnTheFly()
       └─ Word: generateWordOnTheFly()
   ↓
4. 触发浏览器下载
```

## 测试策略
- 单元测试：服务层和工具函数
- 集成测试：API 端点和数据流
- 组件测试：关键 UI 组件
- 测试文件与源文件同目录
- 测试脚本和中间产物：统一存放在 `tasks/` 文件夹

## 项目清理规则
- **核心代码**: 保持在项目根目录和对应的功能文件夹（components/、services/、contexts/、server/）
- **测试和调试**: 所有测试脚本（test-*.mjs、debug-*.mjs）统一放在 `tasks/` 文件夹
- **中间产物**: 修复总结、任务文档等临时文件放在 `tasks/` 文件夹
- **数据文件**: 运行时数据存储在 `data/` 文件夹（已在 .gitignore 中）
- **构建产物**: 构建输出存储在 `dist/` 文件夹（已在 .gitignore 中）

## API 端点设计

### 存储服务器 (端口 3002)

#### 配置管理
- `POST /api/storage/configs/:type` - 保存配置
- `GET /api/storage/configs/:type` - 加载配置

#### 文档管理
- `POST /api/storage/documents/:docId` - 保存文档 JSON
- `GET /api/storage/documents/:docId` - 加载文档 JSON
- `POST /api/storage/documents/:docId/html` - 保存 HTML 文件
- `GET /api/storage/documents/:docId/html` - 获取 HTML 文件
- `HEAD /api/storage/documents/:docId/html` - 检查 HTML 文件是否存在
- `POST /api/storage/documents/:docId/docx` - 保存 Word 文件
- `GET /api/storage/documents/:docId/docx` - 获取 Word 文件
- `HEAD /api/storage/documents/:docId/docx` - 检查 Word 文件是否存在
- `GET /api/storage/documents/:docId/download` - 下载文档（Markdown/HTML）
- `GET /api/storage/documents/:docId/download/html` - 下载 HTML 文件
- `GET /api/storage/documents/:docId/download/docx` - 下载 Word 文件

#### 资源管理
- `POST /api/storage/assets/:sourceId/:docId/:filename` - 保存资源文件
- `GET /api/storage/assets/:sourceId/:docId/:filename` - 获取资源文件

### 代理服务器 (端口 3001)
- `/api/yuque/*` - 转发语雀 API 请求
- `/api/yuque/proxy-image` - 代理图片下载（避免 CORS）

## 关键实现细节

### 图片内嵌处理
1. 提取图片 URL（支持 `<img>` 和 `<card>` 标签）
2. 并发下载（最多 5 个并发）
3. 转换为 Base64 Data URL
4. 替换 HTML 中的原始 URL
5. 错误处理：失败时保留原始 URL

### Lake 格式处理
- 优先使用 `body_lake` 字段（真正的 HTML 内容）
- 解析 `<card>` 标签中的 JSON 数据
- 提取图片 URL（支持 URL 编码和 HTML 实体解码）
- 转换为标准 `<img>` 标签

### 文件安全机制
- 文件锁：使用 proper-lockfile 防止并发写入
- 自动备份：写入前创建 .bak 文件
- 文件名清理：移除不安全字符（`/\:*?"<>|`）
- 长度限制：文件名最多 200 字符

### 错误处理策略
- 网络错误：指数退避重试（1s, 2s, 4s）
- 限流（429）：等待后重试，最多 5 次
- 服务器错误（5xx）：重试最多 2 次
- 超时：30 秒超时，重试最多 3 次
- 部分失败：记录错误但继续处理其他项目
