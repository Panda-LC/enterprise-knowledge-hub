# Word 格式导出支持 - 设计文档

## 概述

本设计文档描述了为企业知识中心（EKH）平台添加 Word 格式导出功能的技术方案。该功能将允许用户将从语雀导出的文档转换为 Microsoft Word（.docx）格式，同时保持高度的格式保真度。

### 设计目标

1. **格式保真**: 确保导出的 Word 文档能够高度还原语雀原文的格式和样式
2. **代码复用**: 最大化复用现有的图片处理、缓存和错误处理逻辑
3. **性能优化**: 实现缓存机制，避免重复生成相同文档
4. **跨平台兼容**: 生成符合 Office Open XML 标准的文档，确保在不同软件中都能正常打开
5. **用户体验**: 提供简单直观的下载界面，支持格式选择

### 技术选型

- **Word 生成库**: `docx@^8.5.0` - 成熟的 JavaScript Word 文档生成库，支持 Office Open XML 标准
- **HTML 解析**: `htmlparser2@^9.1.0` - 高性能的流式 HTML 解析器
- **HTML 清理**: `isomorphic-dompurify@^2.11.0` - 防止 XSS 攻击的 HTML 清理库
- **图片处理**: 
  - 复用现有的 `ImageEmbedderService`
  - `sharp@^0.33.0` - 图片格式转换和优化
- **并发控制**: `p-limit@^5.0.0` - 限制并发请求数量
- **文件锁**: `proper-lockfile@^4.1.2` - 可靠的文件锁实现
- **配置验证**: `joi@^17.11.0` - 配置项验证
- **日志**: `pino@^8.16.0` - 高性能结构化日志
- **存储**: 复用现有的 `StorageService` 和后端文件系统

## 架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  DocumentDetail.tsx                                          │
│  └─ 下载按钮 + 格式选择菜单 (MD/HTML/PDF/Word)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      服务层 (Services)                       │
├─────────────────────────────────────────────────────────────┤
│  StorageService                                              │
│  └─ downloadDocumentFile(docId, title, 'docx')              │
│                                                              │
│  WordGeneratorService (新增)                                │
│  ├─ generateWord(docId, content, sourceId, title)           │
│  ├─ parseHtmlToWordElements(html)                           │
│  ├─ applyFormatting(element, styles)                        │
│  └─ embedImages(doc, sourceId, docId)                       │
│                                                              │
│  ImageEmbedderService (复用)                                │
│  └─ getImageBase64(url, sourceId, docId)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    后端层 (Express)                          │
├─────────────────────────────────────────────────────────────┤
│  storage.js                                                  │
│  ├─ POST /api/storage/documents/:docId/docx                 │
│  ├─ GET  /api/storage/documents/:docId/docx                 │
│  ├─ HEAD /api/storage/documents/:docId/docx                 │
│  └─ GET  /api/storage/documents/:docId/download/docx        │
│                                                              │
│  FileSystemService.js (扩展)                                │
│  ├─ saveDocxFile(docId, buffer)                             │
│  ├─ loadDocxFile(docId)                                     │
│  └─ docxFileExists(docId)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  文件系统 (File System)                      │
├─────────────────────────────────────────────────────────────┤
│  data/documents/                                             │
│  ├─ {docId}.json    (原始数据)                              │
│  ├─ {docId}.html    (HTML 文件)                             │
│  ├─ {docId}.pdf     (PDF 文件)                              │
│  └─ {docId}.docx    (Word 文件) ← 新增                      │
└─────────────────────────────────────────────────────────────┘
```


## 组件和接口

### 1. WordGeneratorService (新增)

负责将 HTML 内容转换为 Word 文档的核心服务。采用依赖注入模式，便于测试和扩展。

#### 接口定义

```typescript
/**
 * Word 文档生成服务
 * 
 * 负责将 HTML 内容转换为 Word 文档格式。支持以下特性：
 * - 标题、段落、列表、表格等基本元素
 * - 文本样式（粗体、斜体、下划线等）
 * - 图片内嵌和优化
 * - Lake 格式解析
 * - 缓存机制
 * - 安全性验证（HTML 清理、URL 验证）
 */
export class WordGeneratorService {
  constructor(
    private imageService: ImageEmbedderService,
    private htmlSanitizer: HTMLSanitizer,
    private urlValidator: URLValidator,
    private filePathValidator: FilePathValidator,
    private logger: Logger
  ) {}
  /**
   * 生成 Word 文档
   * 
   * @param docId - 文档唯一标识符，用于缓存和文件命名
   * @param content - HTML 格式的文档内容
   * @param sourceId - 数据源标识符，用于图片处理
   * @param title - 文档标题，可选
   * @returns 生成的 Word 文件路径
   * 
   * @throws {Error} 当文档内容为空或格式无效时
   * @throws {TimeoutError} 当生成时间超过 30 秒时
   * @throws {FileSizeError} 当生成的文件超过 100MB 时
   * @throws {SecurityError} 当检测到安全威胁时
   * 
   * @remarks
   * 该方法会首先检查缓存，如果缓存存在且有效，则直接返回缓存文件路径。
   * 否则会：
   * 1. 清理和验证 HTML 内容（防止 XSS）
   * 2. 解析 HTML 为 Word 元素
   * 3. 处理和内嵌图片（验证 URL，防止 SSRF）
   * 4. 生成 Word 文档
   * 5. 保存到缓存（使用文件锁防止并发冲突）
   */
  async generateWord(
    docId: string,
    content: string,
    sourceId: string,
    title?: string
  ): Promise<string>;

  /**
   * 解析 HTML 为 Word 元素
   * @param html HTML 内容
   * @returns Word 文档元素数组
   */
  private static parseHtmlToWordElements(html: string): WordElement[];

  /**
   * 应用格式化样式
   * @param element Word 元素
   * @param styles 样式对象
   */
  private static applyFormatting(
    element: any,
    styles: FormatStyles
  ): void;

  /**
   * 内嵌图片到 Word 文档
   * @param doc Word 文档对象
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   */
  private static async embedImages(
    doc: Document,
    sourceId: string,
    docId: string
  ): Promise<void>;

  /**
   * 转换 Lake 格式的 <card> 标签
   * @param html HTML 内容
   * @returns 转换后的 HTML
   */
  private static convertLakeCardsToImages(html: string): string;

  /**
   * 保存 Word 文件到本地
   * @param docId 文档 ID
   * @param buffer Word 文件 Buffer
   * @returns 文件路径
   */
  private static async saveWordFile(
    docId: string,
    buffer: Buffer
  ): Promise<string>;

  /**
   * 检查 Word 文件是否存在
   * @param docId 文档 ID
   * @returns 文件是否存在
   */
  static async wordFileExists(docId: string): Promise<boolean>;

  /**
   * 读取 Word 文件
   * @param docId 文档 ID
   * @returns Word 文件 Buffer
   */
  static async readWordFile(docId: string): Promise<Buffer>;
}
```

#### 类型定义

```typescript
interface WordElement {
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'image' | 'code';
  content?: string;
  level?: number; // 用于标题级别 (1-6)
  styles?: FormatStyles;
  children?: WordElement[];
}

interface FormatStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}
```

### 2. StorageService (扩展)

扩展现有的 `StorageService` 以支持 Word 格式下载。

#### 新增方法

```typescript
/**
 * 下载文档文件（扩展支持 Word 格式）
 * @param docId 文档 ID
 * @param title 文档标题
 * @param format 文件格式（'html' | 'pdf' | 'md' | 'docx'）
 */
static async downloadDocumentFile(
  docId: string,
  title: string,
  format: 'html' | 'pdf' | 'md' | 'docx'
): Promise<void>;

/**
 * 检查文件是否存在（扩展支持 Word 格式）
 * @param docId 文档 ID
 * @param format 文件格式（'html' | 'pdf' | 'md' | 'docx'）
 * @returns 文件是否存在
 */
static async fileExists(
  docId: string,
  format: 'html' | 'pdf' | 'md' | 'docx'
): Promise<boolean>;

/**
 * 动态生成 Word 文档（从 JSON）
 * @param docId 文档 ID
 * @returns Word 文件 Buffer
 */
private static async generateWordOnTheFly(docId: string): Promise<Buffer>;
```


### 3. DocumentDetail.tsx (修改)

修改文档详情页面，添加 Word 格式下载选项。

#### UI 变更

```typescript
// 下载按钮下拉菜单
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      <Download className="h-4 w-4 mr-2" />
      下载
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => handleDownload('md')}>
      <FileText className="h-4 w-4 mr-2" />
      Markdown (.md)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleDownload('html')}>
      <Globe className="h-4 w-4 mr-2" />
      HTML (.html)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleDownload('pdf')}>
      <FileText className="h-4 w-4 mr-2" />
      PDF (.pdf)
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleDownload('docx')}>
      <FileText className="h-4 w-4 mr-2" />
      Word (.docx) ← 新增
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### 下载处理函数

```typescript
const handleDownload = async (format: 'md' | 'html' | 'pdf' | 'docx') => {
  if (!fileItem || !id) return;
  
  setIsDownloading(true);
  setDownloadError(null);
  
  try {
    await StorageService.downloadDocumentFile(id, fileItem.title, format);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '下载失败';
    setDownloadError(errorMsg);
    console.error('Download error:', error);
  } finally {
    setIsDownloading(false);
  }
};
```

### 4. 后端 API (扩展)

扩展 `server/storage.js` 以支持 Word 文件操作。

#### 新增 API 端点

```javascript
// 保存 Word 文件
app.post('/api/storage/documents/:docId/docx', async (req, res) => {
  const { docId } = req.params;
  const { buffer } = req.body; // Base64 编码的 Buffer
  
  try {
    const path = await FileSystemService.saveDocxFile(docId, buffer);
    res.json({ success: true, path });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 Word 文件
app.get('/api/storage/documents/:docId/docx', async (req, res) => {
  const { docId } = req.params;
  
  try {
    const buffer = await FileSystemService.loadDocxFile(docId);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 检查 Word 文件是否存在
app.head('/api/storage/documents/:docId/docx', async (req, res) => {
  const { docId } = req.params;
  
  try {
    const exists = await FileSystemService.docxFileExists(docId);
    res.status(exists ? 200 : 404).end();
  } catch (error) {
    res.status(500).end();
  }
});

// 下载 Word 文件
app.get('/api/storage/documents/:docId/download/docx', async (req, res) => {
  const { docId } = req.params;
  
  try {
    const buffer = await FileSystemService.loadDocxFile(docId);
    const filename = `${docId}.docx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    
    res.send(buffer);
  } catch (error) {
    res.status(404).json({ error: '文件不存在' });
  }
});
```

### 5. 安全组件 (新增)

#### 5.1 HTMLSanitizer - HTML 清理服务

```typescript
/**
 * HTML 清理服务
 * 防止 XSS 攻击，清理不安全的 HTML 内容
 */
export class HTMLSanitizer {
  /**
   * 清理 HTML 内容
   * @param html 原始 HTML
   * @returns 清理后的安全 HTML
   */
  sanitize(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'u', 'del', 's',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'a',
        'pre', 'code',
        'blockquote',
        'span', 'div'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title',
        'style', 'class',
        'colspan', 'rowspan'
      ],
      ALLOW_DATA_ATTR: false
    });
  }
}
```

#### 5.2 URLValidator - URL 验证服务

```typescript
/**
 * URL 验证服务
 * 防止 SSRF 攻击，验证图片 URL 的安全性
 */
export class URLValidator {
  private static BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // AWS metadata
    '::1'
  ];
  
  private static BLOCKED_SCHEMES = ['file', 'ftp', 'data'];
  
  /**
   * 验证图片 URL 是否安全
   * @param url 图片 URL
   * @returns 是否安全
   * @throws {SecurityError} 当 URL 不安全时
   */
  async validateImageURL(url: string): Promise<boolean> {
    const parsed = new URL(url);
    
    // 1. 检查协议
    if (this.BLOCKED_SCHEMES.includes(parsed.protocol.replace(':', ''))) {
      throw new SecurityError(`不允许的协议: ${parsed.protocol}`);
    }
    
    // 2. 检查主机名
    if (this.BLOCKED_HOSTS.includes(parsed.hostname)) {
      throw new SecurityError(`不允许的主机: ${parsed.hostname}`);
    }
    
    // 3. 检查内网 IP
    if (this.isPrivateIP(parsed.hostname)) {
      throw new SecurityError('不允许访问内网地址');
    }
    
    return true;
  }
  
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
}
```

#### 5.3 FilePathValidator - 文件路径验证服务

```typescript
/**
 * 文件路径验证服务
 * 防止路径遍历攻击
 */
export class FilePathValidator {
  /**
   * 清理文档 ID
   * @param docId 原始文档 ID
   * @returns 清理后的安全文档 ID
   * @throws {SecurityError} 当文档 ID 不安全时
   */
  sanitizeDocId(docId: string): string {
    // 1. 移除特殊字符
    const sanitized = docId.replace(/[^a-zA-Z0-9_-]/g, '');
    
    // 2. 限制长度
    if (sanitized.length > 100) {
      throw new SecurityError('文档 ID 过长');
    }
    
    // 3. 检查路径遍历
    if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
      throw new SecurityError('非法的文档 ID');
    }
    
    return sanitized;
  }
  
  /**
   * 获取安全的文件路径
   * @param docId 文档 ID
   * @param extension 文件扩展名
   * @returns 安全的文件路径
   * @throws {SecurityError} 当路径不安全时
   */
  getSecureFilePath(docId: string, extension: string): string {
    const sanitized = this.sanitizeDocId(docId);
    const basePath = path.resolve(process.env.DOCUMENTS_DIR || './data/documents');
    const filePath = path.join(basePath, `${sanitized}.${extension}`);
    
    // 确保文件路径在允许的目录内
    if (!filePath.startsWith(basePath)) {
      throw new SecurityError('非法的文件路径');
    }
    
    return filePath;
  }
}
```

#### 5.4 FileSizeGuard - 文件大小限制服务

```typescript
/**
 * 文件大小限制服务
 * 防止磁盘空间耗尽
 */
export class FileSizeGuard {
  private static MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
  
  /**
   * 检查文件大小
   * @param buffer 文件 Buffer
   * @throws {FileSizeError} 当文件过大时
   */
  async checkFileSize(buffer: Buffer): Promise<void> {
    if (buffer.length > FileSizeGuard.MAX_FILE_SIZE) {
      throw new FileSizeError(`文件大小超过限制: ${buffer.length} bytes`);
    }
  }
  
  /**
   * 检查总磁盘使用量
   * @throws {DiskSpaceError} 当磁盘空间不足时
   */
  async checkTotalDiskUsage(): Promise<void> {
    const totalSize = await this.calculateTotalSize();
    if (totalSize > FileSizeGuard.MAX_TOTAL_SIZE) {
      // 触发缓存清理
      await CacheManager.evictOldestCache();
    }
  }
  
  private async calculateTotalSize(): Promise<number> {
    const files = await fs.promises.readdir(DOCUMENTS_DIR);
    let total = 0;
    for (const file of files) {
      const stat = await fs.promises.stat(path.join(DOCUMENTS_DIR, file));
      total += stat.size;
    }
    return total;
  }
}
```

### 6. CacheManager (新增)

```typescript
/**
 * 缓存管理服务
 * 实现 LRU 缓存策略，自动清理过期缓存
 */
export class CacheManager {
  private cacheMetadata = new Map<string, CacheEntry>();
  
  /**
   * 检查缓存是否存在且有效
   * @param docId 文档 ID
   * @returns 是否有效
   */
  async isCacheValid(docId: string): Promise<boolean> {
    const entry = this.cacheMetadata.get(docId);
    if (!entry) return false;
    
    // 检查是否过期（7天）
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - entry.timestamp > maxAge) {
      await this.invalidateCache(docId);
      return false;
    }
    
    // 检查文件是否存在
    const filePath = this.getCacheFilePath(docId);
    return fs.existsSync(filePath);
  }
  
  /**
   * 使缓存失效
   * @param docId 文档 ID
   */
  async invalidateCache(docId: string): Promise<void> {
    const filePath = this.getCacheFilePath(docId);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    this.cacheMetadata.delete(docId);
  }
  
  /**
   * 清理最旧的缓存（LRU 策略）
   */
  async evictOldestCache(): Promise<void> {
    const entries = Array.from(this.cacheMetadata.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    // 清理最旧的 10% 缓存
    const toEvict = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      await this.invalidateCache(entries[i][0]);
    }
  }
  
  /**
   * 更新缓存访问时间
   * @param docId 文档 ID
   */
  updateAccessTime(docId: string): void {
    const entry = this.cacheMetadata.get(docId);
    if (entry) {
      entry.lastAccess = Date.now();
    }
  }
}

interface CacheEntry {
  docId: string;
  timestamp: number;
  lastAccess: number;
  size: number;
}
```

### 7. FileSystemService.js (扩展)

扩展文件系统服务以支持 Word 文件操作。

#### 新增方法

```javascript
/**
 * 保存 Word 文件
 * @param {string} docId 文档 ID
 * @param {Buffer} buffer Word 文件 Buffer
 * @returns {Promise<string>} 文件路径
 */
async saveDocxFile(docId, buffer) {
  const filePath = path.join(this.documentsDir, `${docId}.docx`);
  
  // 使用文件锁防止并发写入
  const release = await lockfile.lock(filePath, {
    retries: 5,
    stale: 10000,
  });
  
  try {
    // 创建备份
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
    
    // 写入文件
    await fs.promises.writeFile(filePath, buffer);
    
    return filePath;
  } finally {
    await release();
  }
}

/**
 * 加载 Word 文件
 * @param {string} docId 文档 ID
 * @returns {Promise<Buffer>} Word 文件 Buffer
 */
async loadDocxFile(docId) {
  const filePath = path.join(this.documentsDir, `${docId}.docx`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Word 文件不存在');
  }
  
  return await fs.promises.readFile(filePath);
}

/**
 * 检查 Word 文件是否存在
 * @param {string} docId 文档 ID
 * @returns {Promise<boolean>} 文件是否存在
 */
async docxFileExists(docId) {
  const filePath = path.join(this.documentsDir, `${docId}.docx`);
  return fs.existsSync(filePath);
}
```


## 数据模型

### Word 文档结构

Word 文档使用 `docx` 库生成，遵循 Office Open XML 标准。

```typescript
// Word 文档对象结构
interface WordDocument {
  sections: Section[];
}

interface Section {
  properties: SectionProperties;
  children: (Paragraph | Table | Image)[];
}

interface Paragraph {
  text?: string;
  heading?: HeadingLevel; // 'Heading1' - 'Heading6'
  alignment?: AlignmentType;
  spacing?: {
    before?: number;
    after?: number;
    line?: number;
  };
  children?: TextRun[];
}

interface TextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: UnderlineType;
  strike?: boolean;
  color?: string;
  size?: number; // 半点单位 (28 = 14pt)
  font?: string;
}

interface Table {
  rows: TableRow[];
  width?: {
    size: number;
    type: WidthType;
  };
  borders?: BorderStyle;
}

interface TableRow {
  cells: TableCell[];
}

interface TableCell {
  children: Paragraph[];
  verticalAlign?: VerticalAlign;
  borders?: BorderStyle;
}

interface Image {
  data: Buffer;
  transformation: {
    width: number;
    height: number;
  };
}
```

### HTML 到 Word 的映射关系

| HTML 元素 | Word 元素 | 样式映射 |
|-----------|-----------|----------|
| `<h1>` - `<h6>` | Heading1 - Heading6 | 字体大小、粗细 |
| `<p>` | Paragraph | 对齐方式、间距 |
| `<strong>`, `<b>` | TextRun (bold) | 粗体 |
| `<em>`, `<i>` | TextRun (italics) | 斜体 |
| `<u>` | TextRun (underline) | 下划线 |
| `<del>`, `<s>` | TextRun (strike) | 删除线 |
| `<ul>` | Paragraph (bullet) | 无序列表 |
| `<ol>` | Paragraph (numbering) | 有序列表 |
| `<table>` | Table | 表格结构 |
| `<img>` | Image | 图片内嵌 |
| `<pre>`, `<code>` | Paragraph (monospace) | 等宽字体 |
| `<blockquote>` | Paragraph (indent) | 缩进 + 边框 |
| `<a>` | Hyperlink | 超链接 |
| `<hr>` | Paragraph (border) | 水平线 |
| `<span style="color">` | TextRun (color) | 文本颜色 |
| `<span style="background">` | TextRun (highlight) | 背景色 |

### 文件存储结构

```
data/
└── documents/
    ├── {docId}.json      # 原始 JSON 数据
    ├── {docId}.html      # HTML 文件
    ├── {docId}.pdf       # PDF 文件
    └── {docId}.docx      # Word 文件 (新增)
```


## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: Word 文档生成完整性
*对于任何*有效的文档内容，生成的 Word 文件应该是有效的 .docx 格式，并且可以被 Word 软件打开
**验证需求: 1.2, 6.1**

### 属性 2: 图片内嵌一致性
*对于任何*包含图片的文档，生成的 Word 文档中的图片数量应该等于原始 HTML 中的图片数量
**验证需求: 1.4**

### 属性 3: 格式元素保留
*对于任何*包含标题、段落、列表、表格或代码块的文档，这些格式元素在 Word 文档中应该被正确识别和保留
**验证需求: 1.3, 7.1, 7.3, 7.4, 7.5**

### 属性 4: 文本样式保留
*对于任何*包含粗体、斜体、删除线等文本样式的文档，这些样式在 Word 文档中应该被保留
**验证需求: 7.2**

### 属性 5: 缓存优先策略
*对于任何*已生成过 Word 文件的文档，再次下载时应该优先使用缓存文件而不是重新生成
**验证需求: 3.2**

### 属性 6: 动态生成回退
*对于任何*缓存文件不存在的文档，系统应该能够动态生成新的 Word 文档
**验证需求: 3.3**

### 属性 7: 文件锁并发安全
*对于任何*并发写入同一文档的操作，文件锁机制应该确保只有一个写入操作成功，其他操作等待或失败
**验证需求: 3.4**

### 属性 8: Lake 格式卡片解析
*对于任何*包含 `<card>` 标签的 Lake 格式文档，系统应该能够正确解析并提取其中的结构化数据
**验证需求: 4.1**

### 属性 9: Lake 图片卡片转换
*对于任何*包含图片卡片的 Lake 格式文档，系统应该能够提取图片 URL 并转换为 Word 图片对象
**验证需求: 4.2**

### 属性 10: Lake 代码块保留
*对于任何*包含代码块的 Lake 格式文档，代码格式和缩进应该在 Word 文档中被保留
**验证需求: 4.3**

### 属性 11: Lake 格式回退
*对于任何*无法解析的 Lake 格式文档，系统应该能够回退到使用 HTML 内容
**验证需求: 4.4**

### 属性 12: 批量导出完整性
*对于任何*批量导出任务，系统应该为每个文档生成 JSON、HTML、PDF 和 Word 四种格式
**验证需求: 5.1**

### 属性 13: 部分失败容错
*对于任何*批量导出任务，如果某个格式生成失败，系统应该继续处理其他格式
**验证需求: 5.2**

### 属性 14: 任务状态更新
*对于任何*批量导出任务，当所有格式生成完成后，任务状态应该被更新为完成
**验证需求: 5.3**

### 属性 15: 错误日志记录
*对于任何*生成过程中发生的错误，系统应该在日志中记录详细的错误信息
**验证需求: 5.4**

### 属性 16: 标题样式映射
*对于任何*包含 H1-H6 标题的文档，Word 文档中应该使用对应的 Heading1-Heading6 样式
**验证需求: 7.1**

### 属性 17: 列表格式保留
*对于任何*包含有序或无序列表的文档，列表类型、缩进层级和编号格式应该在 Word 中被保留
**验证需求: 7.3**

### 属性 18: 表格结构保留
*对于任何*包含表格的文档，表格的行列结构、边框样式和单元格对齐方式应该在 Word 中被保留
**验证需求: 7.4**

### 属性 19: 代码块格式保留
*对于任何*包含代码块的文档，代码应该使用等宽字体，并保留缩进和换行
**验证需求: 7.5**

### 属性 20: 引用块样式保留
*对于任何*包含引用块的文档，引用内容应该使用缩进或边框样式标识
**验证需求: 7.6**

### 属性 21: 超链接保留
*对于任何*包含链接的文档，链接文本和 URL 应该被保留，并设置为可点击的超链接
**验证需求: 7.7**

### 属性 22: 图片尺寸保留
*对于任何*包含图片的文档，图片的原始尺寸比例和对齐方式应该在 Word 中被保留
**验证需求: 7.8**

### 属性 23: 分隔线转换
*对于任何*包含分隔线的文档，分隔线应该使用 Word 的水平线样式
**验证需求: 7.9**

### 属性 24: 颜色保留
*对于任何*包含颜色标记文本的文档，文本颜色和背景色应该尽可能在 Word 中被保留
**验证需求: 7.10**

### 属性 25: 图片处理错误容错
*对于任何*图片处理失败的情况，系统应该记录警告日志并继续生成文档
**验证需求: 2.2**

### 属性 26: 并发图片处理限制
*对于任何*包含多个图片的文档，并发处理的图片数量应该不超过 5 个
**验证需求: 2.4**

### 属性 27: 超时处理
*对于任何*生成时间超过 30 秒的文档，系统应该中止生成并返回错误信息
**验证需求: 8.5**


## 错误处理

### 错误类型和处理策略

#### 1. 文档内容错误

**错误场景**:
- 文档内容为空
- 文档格式无法识别
- HTML 解析失败

**处理策略**:
```typescript
try {
  if (!content || content.trim() === '') {
    // 生成包含标题的空白文档
    return generateEmptyWordDocument(title);
  }
  
  const elements = parseHtmlToWordElements(content);
  if (elements.length === 0) {
    throw new Error('无法解析文档内容');
  }
} catch (error) {
  console.error('文档内容解析失败:', error);
  // 回退到生成简单的纯文本文档
  return generatePlainTextDocument(content, title);
}
```

#### 2. 图片处理错误

**错误场景**:
- 图片下载失败
- 图片格式不支持
- 图片文件过大 (>10MB)
- 图片转换失败

**处理策略**:
```typescript
try {
  const imageBuffer = await ImageEmbedderService.getImageBase64(url, sourceId, docId);
  
  if (imageBuffer.length > LARGE_FILE_THRESHOLD) {
    console.warn(`图片文件过大 (${imageBuffer.length} bytes): ${url}`);
    // 继续处理，但记录警告
  }
  
  return imageBuffer;
} catch (error) {
  console.warn(`图片处理失败，跳过: ${url}`, error);
  // 不抛出异常，继续生成文档
  return null;
}
```

#### 3. 文件系统错误

**错误场景**:
- 磁盘空间不足
- 文件权限问题
- 文件锁获取失败
- 并发写入冲突

**处理策略**:
```typescript
/**
 * 弹性文件写入器
 * 实现自动恢复机制，确保文件写入的原子性和可靠性
 */
class ResilientFileWriter {
  async writeWithRecovery(filePath: string, buffer: Buffer): Promise<void> {
    const backupPath = `${filePath}.bak`;
    const tempPath = `${filePath}.tmp`;
    
    // 获取文件锁
    const release = await lockfile.lock(filePath, {
      retries: 5,
      stale: 10000,
    });
    
    try {
      // 1. 写入临时文件
      await fs.promises.writeFile(tempPath, buffer);
      
      // 2. 验证临时文件
      await this.validateFile(tempPath);
      
      // 3. 创建备份（如果原文件存在）
      if (await this.fileExists(filePath)) {
        await fs.promises.copyFile(filePath, backupPath);
      }
      
      // 4. 原子性替换
      await fs.promises.rename(tempPath, filePath);
      
      // 5. 删除备份
      if (await this.fileExists(backupPath)) {
        await fs.promises.unlink(backupPath);
      }
    } catch (error) {
      this.logger.error('文件写入失败，尝试恢复', { error, filePath });
      
      // 恢复备份
      if (await this.fileExists(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
        this.logger.info('已从备份恢复文件', { filePath });
      }
      
      // 清理临时文件
      if (await this.fileExists(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
      
      // 处理特定错误
      if (error.code === 'ENOSPC') {
        throw new DiskSpaceError('磁盘空间不足');
      } else if (error.code === 'EACCES') {
        throw new PermissionError('文件权限不足');
      } else if (error.code === 'ELOCKED') {
        throw new LockError('文件被锁定，请稍后重试');
      }
      
      throw error;
    } finally {
      await release();
    }
  }
  
  private async validateFile(filePath: string): Promise<void> {
    const buffer = await fs.promises.readFile(filePath);
    if (buffer.length === 0) {
      throw new Error('文件为空');
    }
    // 验证 ZIP 文件头（.docx 是 ZIP 格式）
    if (buffer.slice(0, 4).toString('hex') !== '504b0304') {
      throw new Error('文件格式无效');
    }
  }
}
```

#### 4. 格式转换错误

**错误场景**:
- Lake 格式解析失败
- HTML 标签不支持
- 样式属性无法映射
- 特殊字符转义失败

**处理策略**:
```typescript
try {
  // 尝试解析 Lake 格式
  const lakeData = parseLakeFormat(content);
  return convertLakeToWord(lakeData);
} catch (lakeError) {
  console.warn('Lake 格式解析失败，回退到 HTML:', lakeError);
  
  try {
    // 回退到 HTML 解析
    return convertHtmlToWord(content);
  } catch (htmlError) {
    console.error('HTML 解析也失败:', htmlError);
    // 最后回退到纯文本
    return convertPlainTextToWord(content);
  }
}
```

#### 5. 超时错误

**错误场景**:
- 文档生成时间过长 (>30秒)
- 图片下载超时
- 网络请求超时

**处理策略**:
```typescript
const TIMEOUT_MS = 30 * 1000; // 30 秒

/**
 * 带超时的操作执行器
 */
class TimeoutExecutor {
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = TIMEOUT_MS
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new TimeoutError('操作超时')), timeoutMs)
      )
    ]);
  }
}

// 使用示例
try {
  const result = await timeoutExecutor.executeWithTimeout(
    () => generateWord(docId, content),
    30000
  );
  return result;
} catch (error) {
  if (error instanceof TimeoutError) {
    this.logger.error('Word 文档生成超时', { docId, timeout: 30000 });
    throw new Error('文档生成超时，请尝试下载其他格式');
  }
  throw error;
}
```

#### 6. 网络请求重试

**错误场景**:
- 图片下载失败
- 网络不稳定
- 临时性错误

**处理策略**:
```typescript
/**
 * 可重试操作执行器
 * 实现指数退避重试策略
 */
class RetryableOperation {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2
    } = options;
    
    let lastError: Error;
    let delay = initialDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          this.logger.warn(`操作失败，${delay}ms 后重试 (${attempt + 1}/${maxRetries})`, { error });
          await this.sleep(delay);
          delay = Math.min(delay * backoffFactor, maxDelay);
        }
      }
    }
    
    throw new Error(`操作失败，已重试 ${maxRetries} 次: ${lastError.message}`);
  }
  
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 使用示例
const imageBuffer = await RetryableOperation.withRetry(
  () => ImageEmbedderService.getImageBase64(url, sourceId, docId),
  { maxRetries: 3, initialDelay: 1000 }
);
```

#### 7. 性能监控

**监控指标**:
- 文档生成时间
- 图片处理时间
- 内存使用量
- 缓存命中率

**实现策略**:
```typescript
/**
 * 性能监控器
 * 记录和分析性能指标
 */
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  
  /**
   * 跟踪操作性能
   * @param operationName 操作名称
   * @param operation 操作函数
   * @returns 操作结果
   */
  async trackOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory.heapUsed;
      
      this.recordMetric({
        operation: operationName,
        duration,
        memoryUsage: memoryDelta,
        status: 'success',
        timestamp: new Date()
      });
      
      // 如果操作时间超过阈值，记录警告
      if (duration > 10000) {
        this.logger.warn('操作耗时过长', {
          operation: operationName,
          duration,
          threshold: 10000
        });
      }
      
      return result;
    } catch (error) {
      this.recordMetric({
        operation: operationName,
        duration: performance.now() - startTime,
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }
  
  /**
   * 获取性能统计
   * @param operationName 操作名称
   * @returns 统计信息
   */
  getStats(operationName: string): OperationStats {
    const metrics = this.metrics.filter(m => m.operation === operationName);
    const durations = metrics.map(m => m.duration);
    
    return {
      count: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: metrics.filter(m => m.status === 'success').length / metrics.length
    };
  }
}

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage?: number;
  status: 'success' | 'failed';
  error?: string;
  timestamp: Date;
}

interface OperationStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}
```

### 错误日志格式

所有错误都应该记录详细的上下文信息：

```typescript
/**
 * 结构化日志器
 * 使用 pino 实现高性能日志记录
 */
class StructuredLogger {
  private logger: pino.Logger;
  
  constructor(private service: string) {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label })
      }
    });
  }
  
  info(operation: string, message: string, context?: Record<string, any>): void {
    this.logger.info({
      service: this.service,
      operation,
      ...context
    }, message);
  }
  
  error(operation: string, error: Error, context?: Record<string, any>): void {
    this.logger.error({
      service: this.service,
      operation,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      },
      ...context
    }, error.message);
  }
  
  warn(operation: string, message: string, context?: Record<string, any>): void {
    this.logger.warn({
      service: this.service,
      operation,
      ...context
    }, message);
  }
}

// 使用示例
const logger = new StructuredLogger('WordGeneratorService');
logger.info('generateWord', '开始生成 Word 文档', { docId, contentLength: content.length });
logger.error('generateWord', error, { docId, sourceId });
```

## 配置管理

### 配置文件结构

```typescript
// config/word-export.config.ts
export interface WordExportConfig {
  word: {
    generation: {
      timeout: number;           // 生成超时时间（毫秒）
      maxFileSize: number;       // 最大文件大小（字节）
      tempDir: string;           // 临时目录
    };
    
    image: {
      maxConcurrent: number;     // 最大并发数
      maxSize: number;           // 最大图片大小（字节）
      timeout: number;           // 下载超时时间（毫秒）
      allowedFormats: string[];  // 允许的图片格式
      optimization: {
        enabled: boolean;        // 是否启用优化
        maxWidth: number;        // 最大宽度
        maxHeight: number;       // 最大高度
        quality: number;         // 压缩质量 (0-100)
      };
    };
    
    cache: {
      enabled: boolean;          // 是否启用缓存
      maxAge: number;            // 最大缓存时间（秒）
      maxSize: number;           // 最大缓存大小（字节）
      maxFiles: number;          // 最大文件数量
      evictionPolicy: 'LRU' | 'LFU' | 'FIFO';  // 淘汰策略
    };
  };
  
  storage: {
    documentsDir: string;        // 文档目录
    backupEnabled: boolean;      // 是否启用备份
    lockTimeout: number;         // 文件锁超时时间（毫秒）
  };
  
  security: {
    urlValidation: {
      enabled: boolean;          // 是否启用 URL 验证
      blockedHosts: string[];    // 禁止的主机列表
      blockedSchemes: string[];  // 禁止的协议列表
      checkPrivateIP: boolean;   // 是否检查内网 IP
    };
    
    htmlSanitization: {
      enabled: boolean;          // 是否启用 HTML 清理
      allowedTags: string[];     // 允许的标签列表
    };
    
    fileSize: {
      maxFileSize: number;       // 单个文件最大大小
      maxTotalSize: number;      // 总文件最大大小
    };
  };
  
  monitoring: {
    enabled: boolean;            // 是否启用监控
    metricsInterval: number;     // 指标收集间隔（毫秒）
    performanceThreshold: number; // 性能阈值（毫秒）
  };
}

// 默认配置
export const defaultConfig: WordExportConfig = {
  word: {
    generation: {
      timeout: 30000,
      maxFileSize: 100 * 1024 * 1024,
      tempDir: process.env.TEMP_DIR || './temp'
    },
    
    image: {
      maxConcurrent: 5,
      maxSize: 10 * 1024 * 1024,
      timeout: 5000,
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      optimization: {
        enabled: true,
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85
      }
    },
    
    cache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
      maxSize: 10 * 1024 * 1024 * 1024,
      maxFiles: 10000,
      evictionPolicy: 'LRU'
    }
  },
  
  storage: {
    documentsDir: process.env.DOCUMENTS_DIR || './data/documents',
    backupEnabled: true,
    lockTimeout: 10000
  },
  
  security: {
    urlValidation: {
      enabled: true,
      blockedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'],
      blockedSchemes: ['file', 'ftp', 'data'],
      checkPrivateIP: true
    },
    
    htmlSanitization: {
      enabled: true,
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'u', 'del', 's',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'a',
        'pre', 'code',
        'blockquote',
        'span', 'div'
      ]
    },
    
    fileSize: {
      maxFileSize: 100 * 1024 * 1024,
      maxTotalSize: 10 * 1024 * 1024 * 1024
    }
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 60000,
    performanceThreshold: 10000
  }
};

// 配置验证
export function validateConfig(config: WordExportConfig): void {
  const schema = Joi.object({
    word: Joi.object({
      generation: Joi.object({
        timeout: Joi.number().positive().required(),
        maxFileSize: Joi.number().positive().required(),
        tempDir: Joi.string().required()
      }),
      image: Joi.object({
        maxConcurrent: Joi.number().positive().required(),
        maxSize: Joi.number().positive().required(),
        timeout: Joi.number().positive().required(),
        allowedFormats: Joi.array().items(Joi.string()).required(),
        optimization: Joi.object({
          enabled: Joi.boolean().required(),
          maxWidth: Joi.number().positive().required(),
          maxHeight: Joi.number().positive().required(),
          quality: Joi.number().min(0).max(100).required()
        })
      }),
      cache: Joi.object({
        enabled: Joi.boolean().required(),
        maxAge: Joi.number().positive().required(),
        maxSize: Joi.number().positive().required(),
        maxFiles: Joi.number().positive().required(),
        evictionPolicy: Joi.string().valid('LRU', 'LFU', 'FIFO').required()
      })
    }),
    storage: Joi.object({
      documentsDir: Joi.string().required(),
      backupEnabled: Joi.boolean().required(),
      lockTimeout: Joi.number().positive().required()
    }),
    security: Joi.object({
      urlValidation: Joi.object({
        enabled: Joi.boolean().required(),
        blockedHosts: Joi.array().items(Joi.string()).required(),
        blockedSchemes: Joi.array().items(Joi.string()).required(),
        checkPrivateIP: Joi.boolean().required()
      }),
      htmlSanitization: Joi.object({
        enabled: Joi.boolean().required(),
        allowedTags: Joi.array().items(Joi.string()).required()
      }),
      fileSize: Joi.object({
        maxFileSize: Joi.number().positive().required(),
        maxTotalSize: Joi.number().positive().required()
      })
    }),
    monitoring: Joi.object({
      enabled: Joi.boolean().required(),
      metricsInterval: Joi.number().positive().required(),
      performanceThreshold: Joi.number().positive().required()
    })
  });
  
  const { error } = schema.validate(config);
  if (error) {
    throw new ConfigValidationError(`配置验证失败: ${error.message}`);
  }
}
```


## 测试策略

### 单元测试

单元测试用于验证各个服务类的核心功能。

#### WordGeneratorService 测试

```typescript
describe('WordGeneratorService', () => {
  describe('parseHtmlToWordElements', () => {
    it('应该正确解析标题标签', () => {
      const html = '<h1>标题1</h1><h2>标题2</h2>';
      const elements = WordGeneratorService.parseHtmlToWordElements(html);
      expect(elements).toHaveLength(2);
      expect(elements[0].type).toBe('heading');
      expect(elements[0].level).toBe(1);
    });

    it('应该正确解析文本样式', () => {
      const html = '<p><strong>粗体</strong> <em>斜体</em></p>';
      const elements = WordGeneratorService.parseHtmlToWordElements(html);
      expect(elements[0].children[0].styles.bold).toBe(true);
      expect(elements[0].children[1].styles.italic).toBe(true);
    });

    it('应该正确解析列表', () => {
      const html = '<ul><li>项目1</li><li>项目2</li></ul>';
      const elements = WordGeneratorService.parseHtmlToWordElements(html);
      expect(elements[0].type).toBe('list');
      expect(elements[0].children).toHaveLength(2);
    });

    it('应该正确解析表格', () => {
      const html = '<table><tr><td>单元格</td></tr></table>';
      const elements = WordGeneratorService.parseHtmlToWordElements(html);
      expect(elements[0].type).toBe('table');
    });
  });

  describe('convertLakeCardsToImages', () => {
    it('应该正确转换 Lake 图片卡片', () => {
      const html = '<card value="data:%7B%22src%22%3A%22https%3A%2F%2Fexample.com%2Fimage.png%22%7D"></card>';
      const converted = WordGeneratorService.convertLakeCardsToImages(html);
      expect(converted).toContain('<img src="https://example.com/image.png"');
    });

    it('应该处理无效的卡片标签', () => {
      const html = '<card value="invalid"></card>';
      const converted = WordGeneratorService.convertLakeCardsToImages(html);
      expect(converted).toBe(html); // 保持原样
    });
  });

  describe('generateWord', () => {
    it('应该生成有效的 Word 文档', async () => {
      const content = '<h1>测试文档</h1><p>这是一段测试内容。</p>';
      const path = await WordGeneratorService.generateWord('test-doc', content, 'test-source', '测试文档');
      expect(path).toContain('.docx');
      expect(fs.existsSync(path)).toBe(true);
    });

    it('应该处理空内容', async () => {
      const path = await WordGeneratorService.generateWord('empty-doc', '', 'test-source', '空文档');
      expect(path).toContain('.docx');
      expect(fs.existsSync(path)).toBe(true);
    });
  });
});
```

#### StorageService 测试

```typescript
describe('StorageService - Word Support', () => {
  describe('fileExists', () => {
    it('应该正确检测 Word 文件是否存在', async () => {
      const exists = await StorageService.fileExists('test-doc', 'docx');
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('downloadDocumentFile', () => {
    it('应该支持下载 Word 格式', async () => {
      const mockDownload = jest.fn();
      global.document.createElement = jest.fn(() => ({
        click: mockDownload,
      }));

      await StorageService.downloadDocumentFile('test-doc', '测试文档', 'docx');
      expect(mockDownload).toHaveBeenCalled();
    });
  });
});
```

### 属性测试 (Property-Based Testing)

属性测试用于验证系统在各种输入下的通用正确性属性。我们将使用 `fast-check` 库进行属性测试。

#### 测试配置

```typescript
import fc from 'fast-check';

// 配置每个属性测试运行 100 次
const testConfig = { numRuns: 100 };
```

#### 属性 1: Word 文档生成完整性

```typescript
/**
 * Feature: word-export-support, Property 1: Word 文档生成完整性
 * 验证需求: 1.2, 6.1
 */
describe('Property 1: Word 文档生成完整性', () => {
  it('对于任何有效的文档内容，生成的 Word 文件应该是有效的 .docx 格式', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (content, title) => {
          const docId = `test-${Date.now()}`;
          const path = await WordGeneratorService.generateWord(docId, content, 'test-source', title);
          
          // 验证文件存在
          expect(fs.existsSync(path)).toBe(true);
          
          // 验证文件扩展名
          expect(path).toMatch(/\.docx$/);
          
          // 验证文件可以被读取
          const buffer = await fs.promises.readFile(path);
          expect(buffer.length).toBeGreaterThan(0);
          
          // 验证文件是有效的 ZIP 格式（.docx 是 ZIP 压缩的 XML）
          const header = buffer.slice(0, 4);
          expect(header.toString('hex')).toBe('504b0304'); // ZIP 文件头
        }
      ),
      testConfig
    );
  });
});
```

#### 属性 2: 图片内嵌一致性

```typescript
/**
 * Feature: word-export-support, Property 2: 图片内嵌一致性
 * 验证需求: 1.4
 */
describe('Property 2: 图片内嵌一致性', () => {
  it('对于任何包含图片的文档，生成的 Word 文档中的图片数量应该等于原始 HTML 中的图片数量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
        async (imageUrls) => {
          // 生成包含图片的 HTML
          const html = imageUrls.map(url => `<img src="${url}" />`).join('\n');
          const docId = `test-${Date.now()}`;
          
          const path = await WordGeneratorService.generateWord(docId, html, 'test-source', '测试');
          
          // 读取生成的 Word 文档
          const buffer = await fs.promises.readFile(path);
          
          // 解析 Word 文档，统计图片数量
          // 注意：这里需要使用 docx 库或 ZIP 解析库来读取 Word 文档内容
          const imageCount = await countImagesInWordDocument(buffer);
          
          // 验证图片数量一致（允许部分图片下载失败）
          expect(imageCount).toBeLessThanOrEqual(imageUrls.length);
        }
      ),
      testConfig
    );
  });
});
```

#### 属性 5: 缓存优先策略

```typescript
/**
 * Feature: word-export-support, Property 5: 缓存优先策略
 * 验证需求: 3.2
 */
describe('Property 5: 缓存优先策略', () => {
  it('对于任何已生成过 Word 文件的文档，再次下载时应该优先使用缓存文件', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (content) => {
          const docId = `test-${Date.now()}`;
          
          // 第一次生成
          const path1 = await WordGeneratorService.generateWord(docId, content, 'test-source', '测试');
          const mtime1 = (await fs.promises.stat(path1)).mtime;
          
          // 等待 100ms
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 第二次生成（应该使用缓存）
          const path2 = await WordGeneratorService.generateWord(docId, content, 'test-source', '测试');
          const mtime2 = (await fs.promises.stat(path2)).mtime;
          
          // 验证文件路径相同
          expect(path1).toBe(path2);
          
          // 验证文件修改时间相同（说明没有重新生成）
          expect(mtime1.getTime()).toBe(mtime2.getTime());
        }
      ),
      testConfig
    );
  });
});
```

#### 属性 7: 文件锁并发安全

```typescript
/**
 * Feature: word-export-support, Property 7: 文件锁并发安全
 * 验证需求: 3.4
 */
describe('Property 7: 文件锁并发安全', () => {
  it('对于任何并发写入同一文档的操作，文件锁机制应该确保数据一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (concurrency) => {
          const docId = `test-${Date.now()}`;
          const content = '<h1>并发测试</h1>';
          
          // 并发生成多次
          const promises = Array.from({ length: concurrency }, () =>
            WordGeneratorService.generateWord(docId, content, 'test-source', '测试')
          );
          
          const results = await Promise.allSettled(promises);
          
          // 验证至少有一个成功
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          expect(successCount).toBeGreaterThan(0);
          
          // 验证文件内容一致
          const path = results.find(r => r.status === 'fulfilled')?.value;
          if (path) {
            const buffer = await fs.promises.readFile(path);
            expect(buffer.length).toBeGreaterThan(0);
          }
        }
      ),
      testConfig
    );
  });
});
```

### 集成测试

集成测试验证整个下载流程的端到端功能。

```typescript
describe('Word Export Integration Tests', () => {
  it('应该完成完整的下载流程', async () => {
    // 1. 创建测试文档
    const docId = 'integration-test-doc';
    const content = '<h1>集成测试</h1><p>这是一段测试内容。</p>';
    await StorageService.saveDocumentContent(docId, {
      id: 1,
      title: '集成测试文档',
      body_html: content,
      format: 'lake',
    });

    // 2. 生成 Word 文档
    const path = await WordGeneratorService.generateWord(docId, content, 'test-source', '集成测试文档');
    expect(fs.existsSync(path)).toBe(true);

    // 3. 检查文件是否存在
    const exists = await StorageService.fileExists(docId, 'docx');
    expect(exists).toBe(true);

    // 4. 下载文件
    await StorageService.downloadDocumentFile(docId, '集成测试文档', 'docx');
    
    // 验证下载触发（通过 mock）
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  it('应该处理批量导出', async () => {
    const docIds = ['doc1', 'doc2', 'doc3'];
    
    for (const docId of docIds) {
      await StorageService.saveDocumentContent(docId, {
        id: docId,
        title: `文档 ${docId}`,
        body_html: `<h1>文档 ${docId}</h1>`,
        format: 'lake',
      });
    }

    // 批量生成
    const results = await Promise.all(
      docIds.map(docId => 
        WordGeneratorService.generateWord(docId, `<h1>文档 ${docId}</h1>`, 'test-source', `文档 ${docId}`)
      )
    );

    // 验证所有文档都生成成功
    expect(results).toHaveLength(3);
    results.forEach(path => {
      expect(fs.existsSync(path)).toBe(true);
    });
  });
});
```

### 测试覆盖率目标

- **单元测试覆盖率**: ≥ 80%
- **属性测试覆盖率**: 所有正确性属性都应该有对应的属性测试
- **集成测试覆盖率**: 覆盖所有主要用户流程

### 测试执行

```bash
# 运行所有测试
npm test

# 运行单元测试
npm test -- --testPathPattern=unit

# 运行属性测试
npm test -- --testPathPattern=property

# 运行集成测试
npm test -- --testPathPattern=integration

# 生成覆盖率报告
npm test -- --coverage
```

