# Word 格式导出支持 - 设计补充文档

本文档补充设计文档中缺失的实现细节，基于第二版评审结果。

## 1. API 认证和授权

### 1.1 认证中间件

```javascript
// server/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * JWT 认证中间件
 * 验证请求中的 Bearer Token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '未授权',
        message: '缺少认证令牌' 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // 验证 JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // 将用户信息附加到请求对象
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      permissions: decoded.permissions || []
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: '令牌已过期',
        message: '请重新登录' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: '无效的令牌',
        message: '认证失败' 
      });
    }
    
    return res.status(500).json({ 
      error: '认证错误',
      message: error.message 
    });
  }
};

/**
 * 权限验证中间件工厂
 * @param {string} permission 所需权限
 * @returns {Function} Express 中间件
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: '未授权',
        message: '请先登录' 
      });
    }
    
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: '权限不足',
        message: `需要权限: ${permission}` 
      });
    }
    
    next();
  };
};

module.exports = { authenticate, authorize };
```

### 1.2 应用到路由

```javascript
// server/storage.js
const { authenticate, authorize } = require('./middleware/auth');

// 保存 Word 文件（需要写权限）
app.post(
  '/api/storage/documents/:docId/docx',
  authenticate,
  authorize('document:write'),
  async (req, res) => {
    // 处理请求
  }
);

// 获取 Word 文件（需要读权限）
app.get(
  '/api/storage/documents/:docId/docx',
  authenticate,
  authorize('document:read'),
  async (req, res) => {
    // 处理请求
  }
);

// 下载 Word 文件（需要读权限）
app.get(
  '/api/storage/documents/:docId/download/docx',
  authenticate,
  authorize('document:read'),
  async (req, res) => {
    // 处理请求
  }
);
```


## 2. 优化的图片处理服务

### 2.1 OptimizedImageProcessor 完整实现

```typescript
import sharp from 'sharp';
import pLimit from 'p-limit';
import { ImageEmbedderService } from './ImageEmbedderService';
import { URLValidator, SecurityError } from './URLValidator';
import { Logger } from './Logger';
import { WordExportConfig } from '../config/word-export.config';
import { RetryableOperation } from './RetryableOperation';

/**
 * 优化的图片处理服务
 * 实现图片下载、缓存、优化和格式转换
 */
export class OptimizedImageProcessor {
  private imageCache = new Map<string, Buffer>();
  private config: WordExportConfig['word']['image'];
  
  constructor(
    private imageService: ImageEmbedderService,
    private urlValidator: URLValidator,
    private logger: Logger,
    config: WordExportConfig
  ) {
    this.config = config.word.image;
  }
  
  /**
   * 批量处理图片（带并发控制）
   * @param urls 图片 URL 列表
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns 处理结果列表
   */
  async processImages(
    urls: string[],
    sourceId: string,
    docId: string
  ): Promise<ImageResult[]> {
    if (urls.length === 0) {
      return [];
    }
    
    this.logger.info('processImages', '开始批量处理图片', {
      docId,
      imageCount: urls.length,
      maxConcurrent: this.config.maxConcurrent
    });
    
    // 使用 p-limit 限制并发数
    const limit = pLimit(this.config.maxConcurrent);
    
    const results = await Promise.all(
      urls.map(url => limit(async () => {
        try {
          return await this.processImage(url, sourceId, docId);
        } catch (error) {
          this.logger.error('processImage', error, { url, sourceId, docId });
          return {
            url,
            buffer: null,
            error: error.message,
            cached: false
          };
        }
      }))
    );
    
    // 统计结果
    const successCount = results.filter(r => r.buffer !== null).length;
    const failedCount = results.length - successCount;
    const cachedCount = results.filter(r => r.cached).length;
    
    this.logger.info('processImages', '批量处理完成', {
      docId,
      total: results.length,
      success: successCount,
      failed: failedCount,
      cached: cachedCount
    });
    
    return results;
  }
  
  /**
   * 处理单个图片
   * @param url 图片 URL
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns 处理结果
   */
  private async processImage(
    url: string,
    sourceId: string,
    docId: string
  ): Promise<ImageResult> {
    // 1. 验证 URL 安全性
    try {
      await this.urlValidator.validateImageURL(url);
    } catch (error) {
      if (error instanceof SecurityError) {
        this.logger.warn('processImage', 'URL 验证失败', { url, error: error.message });
        throw error;
      }
    }
    
    // 2. 检查缓存
    if (this.imageCache.has(url)) {
      this.logger.info('processImage', '使用缓存图片', { url });
      return {
        url,
        buffer: this.imageCache.get(url)!,
        cached: true
      };
    }
    
    // 3. 下载图片（带重试）
    const buffer = await RetryableOperation.withRetry(
      () => this.downloadImage(url, sourceId, docId),
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffFactor: 2
      }
    );
    
    // 4. 检查文件大小
    if (buffer.length > this.config.maxSize) {
      this.logger.warn('processImage', '图片文件过大', {
        url,
        size: buffer.length,
        maxSize: this.config.maxSize,
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2)
      });
      // 继续处理，但记录警告
    }
    
    // 5. 优化图片
    const optimized = await this.optimizeImage(buffer, url);
    
    // 6. 缓存结果
    this.imageCache.set(url, optimized);
    
    return {
      url,
      buffer: optimized,
      cached: false
    };
  }
  
  /**
   * 下载图片
   * @param url 图片 URL
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns 图片 Buffer
   */
  private async downloadImage(
    url: string,
    sourceId: string,
    docId: string
  ): Promise<Buffer> {
    // 使用现有的 ImageEmbedderService 下载图片
    const base64Url = await this.imageService.getImageBase64(url, sourceId, docId);
    
    // 将 Base64 Data URL 转换为 Buffer
    if (base64Url.startsWith('data:')) {
      const base64Data = base64Url.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }
    
    throw new Error('无效的图片数据格式');
  }
  
  /**
   * 优化图片（压缩、格式转换、调整大小）
   * @param buffer 原始图片 Buffer
   * @param url 图片 URL（用于日志）
   * @returns 优化后的图片 Buffer
   */
  private async optimizeImage(buffer: Buffer, url: string): Promise<Buffer> {
    if (!this.config.optimization.enabled) {
      this.logger.info('optimizeImage', '图片优化已禁用', { url });
      return buffer;
    }
    
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      this.logger.info('optimizeImage', '开始优化图片', {
        url,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length
      });
      
      let needsProcessing = false;
      let pipeline = image;
      
      // 1. 检查是否需要调整大小
      if (
        metadata.width && metadata.width > this.config.optimization.maxWidth ||
        metadata.height && metadata.height > this.config.optimization.maxHeight
      ) {
        needsProcessing = true;
        pipeline = pipeline.resize(
          this.config.optimization.maxWidth,
          this.config.optimization.maxHeight,
          {
            fit: 'inside',
            withoutEnlargement: true
          }
        );
        
        this.logger.info('optimizeImage', '调整图片大小', {
          url,
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          maxWidth: this.config.optimization.maxWidth,
          maxHeight: this.config.optimization.maxHeight
        });
      }
      
      // 2. 转换为 JPEG 格式（Word 兼容性更好）
      if (metadata.format && !['jpeg', 'jpg'].includes(metadata.format)) {
        needsProcessing = true;
        pipeline = pipeline.jpeg({
          quality: this.config.optimization.quality,
          mozjpeg: true // 使用 mozjpeg 获得更好的压缩
        });
        
        this.logger.info('optimizeImage', '转换图片格式', {
          url,
          originalFormat: metadata.format,
          targetFormat: 'jpeg'
        });
      } else if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        // 即使是 JPEG，也可以重新压缩以减小文件大小
        pipeline = pipeline.jpeg({
          quality: this.config.optimization.quality,
          mozjpeg: true
        });
        needsProcessing = true;
      }
      
      // 3. 执行优化
      if (needsProcessing) {
        const optimized = await pipeline.toBuffer();
        
        const compressionRatio = ((1 - optimized.length / buffer.length) * 100).toFixed(2);
        
        this.logger.info('optimizeImage', '图片优化完成', {
          url,
          originalSize: buffer.length,
          optimizedSize: optimized.length,
          compressionRatio: `${compressionRatio}%`
        });
        
        return optimized;
      }
      
      this.logger.info('optimizeImage', '图片无需优化', { url });
      return buffer;
      
    } catch (error) {
      this.logger.warn('optimizeImage', '图片优化失败，使用原图', {
        url,
        error: error.message
      });
      return buffer;
    }
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.imageCache.clear();
    this.logger.info('clearCache', '图片缓存已清空');
  }
  
  /**
   * 获取缓存统计信息
   */
  getCacheStats(): CacheStats {
    let totalSize = 0;
    for (const buffer of this.imageCache.values()) {
      totalSize += buffer.length;
    }
    
    return {
      count: this.imageCache.size,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

/**
 * 图片处理结果
 */
export interface ImageResult {
  url: string;
  buffer: Buffer | null;
  cached: boolean;
  error?: string;
}

/**
 * 缓存统计信息
 */
interface CacheStats {
  count: number;
  totalSize: number;
  totalSizeMB: string;
}
```


## 3. Lake 格式完整解析

### 3.1 LakeFormatParser 实现

```typescript
/**
 * Lake 格式解析器
 * 支持图片、代码块、附件、表格等多种卡片类型
 */
export class LakeFormatParser {
  constructor(private logger: Logger) {}
  
  /**
   * 转换 Lake 格式的 <card> 标签
   * @param html HTML 内容
   * @returns 转换后的 HTML
   */
  convertLakeCards(html: string): string {
    if (!html) return html;
    
    // 匹配 <card> 标签（包括自闭合和非自闭合）
    const cardRegex = /<card[^>]*>(?:[\s\S]*?<\/card>)?|<card[^>]*\/>/gi;
    
    return html.replace(cardRegex, (match) => {
      try {
        return this.parseCard(match);
      } catch (error) {
        this.logger.warn('convertLakeCards', '卡片解析失败', {
          card: match.substring(0, 100),
          error: error.message
        });
        return match; // 解析失败，保持原样
      }
    });
  }
  
  /**
   * 解析单个卡片
   * @param cardHtml 卡片 HTML
   * @returns 转换后的 HTML
   */
  private parseCard(cardHtml: string): string {
    // 提取 value 属性
    const valueMatch = cardHtml.match(/value=["']([^"']+)["']/i);
    if (!valueMatch) {
      this.logger.warn('parseCard', '未找到 value 属性', { cardHtml });
      return cardHtml;
    }
    
    let raw = valueMatch[1];
    
    try {
      // 1. URL 解码
      let decoded = raw;
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        this.logger.warn('parseCard', 'URL 解码失败', { raw });
      }
      
      // 2. 去掉 "data:" 前缀（如果存在）
      if (decoded.startsWith('data:')) {
        decoded = decoded.slice(5);
      }
      
      // 3. HTML 实体解码
      decoded = decoded
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      // 4. 解析 JSON
      const cardData = JSON.parse(decoded);
      
      // 5. 根据卡片类型处理
      return this.convertCardByType(cardData);
      
    } catch (error) {
      this.logger.error('parseCard', error, { raw });
      return cardHtml;
    }
  }
  
  /**
   * 根据卡片类型转换
   * @param cardData 卡片数据
   * @returns 转换后的 HTML
   */
  private convertCardByType(cardData: any): string {
    const type = cardData.type || this.inferCardType(cardData);
    
    switch (type) {
      case 'image':
      case 'img':
        return this.convertImageCard(cardData);
      
      case 'code':
      case 'codeblock':
        return this.convertCodeCard(cardData);
      
      case 'file':
      case 'attachment':
        return this.convertFileCard(cardData);
      
      case 'table':
        return this.convertTableCard(cardData);
      
      case 'video':
        return this.convertVideoCard(cardData);
      
      case 'link':
        return this.convertLinkCard(cardData);
      
      default:
        this.logger.warn('convertCardByType', '不支持的卡片类型', { type, cardData });
        return `<!-- 不支持的卡片类型: ${type} -->`;
    }
  }
  
  /**
   * 推断卡片类型（当 type 字段不存在时）
   * @param cardData 卡片数据
   * @returns 卡片类型
   */
  private inferCardType(cardData: any): string {
    if (cardData.src || cardData.url) {
      // 检查是否是图片 URL
      const url = cardData.src || cardData.url;
      if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
        return 'image';
      }
      // 检查是否是视频 URL
      if (/\.(mp4|webm|ogg)$/i.test(url)) {
        return 'video';
      }
      return 'file';
    }
    
    if (cardData.code || cardData.language) {
      return 'code';
    }
    
    if (cardData.rows || cardData.columns) {
      return 'table';
    }
    
    if (cardData.href) {
      return 'link';
    }
    
    return 'unknown';
  }
  
  /**
   * 转换图片卡片
   * @param cardData 卡片数据
   * @returns HTML img 标签
   */
  private convertImageCard(cardData: any): string {
    const src = cardData.src || cardData.url || cardData.data?.src;
    if (!src || typeof src !== 'string') {
      this.logger.warn('convertImageCard', '未找到图片 URL', { cardData });
      return '';
    }
    
    const alt = cardData.alt || cardData.name || cardData.title || '';
    const width = cardData.width || cardData.data?.width;
    const height = cardData.height || cardData.data?.height;
    
    const wAttr = typeof width === 'number' ? ` width="${Math.round(width)}"` : '';
    const hAttr = typeof height === 'number' ? ` height="${Math.round(height)}"` : '';
    
    return `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}"${wAttr}${hAttr} />`;
  }
  
  /**
   * 转换代码块卡片
   * @param cardData 卡片数据
   * @returns HTML pre/code 标签
   */
  private convertCodeCard(cardData: any): string {
    const language = cardData.language || cardData.lang || '';
    const code = cardData.code || cardData.value || cardData.content || '';
    
    if (!code) {
      this.logger.warn('convertCodeCard', '代码内容为空', { cardData });
      return '';
    }
    
    // 转义 HTML 特殊字符
    const escapedCode = this.escapeHtml(code);
    
    // 添加语言类名（用于语法高亮）
    const langClass = language ? ` class="language-${language}"` : '';
    
    return `<pre><code${langClass}>${escapedCode}</code></pre>`;
  }
  
  /**
   * 转换文件/附件卡片
   * @param cardData 卡片数据
   * @returns HTML a 标签
   */
  private convertFileCard(cardData: any): string {
    const url = cardData.url || cardData.src || cardData.href;
    const name = cardData.name || cardData.title || cardData.filename || '附件';
    const size = cardData.size || cardData.fileSize;
    
    if (!url) {
      this.logger.warn('convertFileCard', '未找到文件 URL', { cardData });
      return '';
    }
    
    const sizeText = size ? ` (${this.formatFileSize(size)})` : '';
    
    return `<a href="${this.escapeHtml(url)}" download>${this.escapeHtml(name)}${sizeText}</a>`;
  }
  
  /**
   * 转换表格卡片
   * @param cardData 卡片数据
   * @returns HTML table 标签
   */
  private convertTableCard(cardData: any): string {
    const rows = cardData.rows || cardData.data?.rows;
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      this.logger.warn('convertTableCard', '表格数据为空', { cardData });
      return '';
    }
    
    // 检查是否有表头
    const hasHeader = cardData.hasHeader !== false; // 默认有表头
    
    let html = '<table>';
    
    // 渲染表头
    if (hasHeader && rows.length > 0) {
      html += '<thead><tr>';
      const headerRow = rows[0];
      for (const cell of headerRow) {
        html += `<th>${this.escapeHtml(String(cell))}</th>`;
      }
      html += '</tr></thead>';
    }
    
    // 渲染表体
    html += '<tbody>';
    const bodyRows = hasHeader ? rows.slice(1) : rows;
    for (const row of bodyRows) {
      html += '<tr>';
      for (const cell of row) {
        html += `<td>${this.escapeHtml(String(cell))}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';
    
    html += '</table>';
    
    return html;
  }
  
  /**
   * 转换视频卡片
   * @param cardData 卡片数据
   * @returns HTML video 标签或链接
   */
  private convertVideoCard(cardData: any): string {
    const src = cardData.src || cardData.url;
    const poster = cardData.poster || cardData.thumbnail;
    
    if (!src) {
      this.logger.warn('convertVideoCard', '未找到视频 URL', { cardData });
      return '';
    }
    
    // Word 不支持嵌入视频，转换为链接
    const name = cardData.name || cardData.title || '视频';
    return `<a href="${this.escapeHtml(src)}">${this.escapeHtml(name)} (视频)</a>`;
  }
  
  /**
   * 转换链接卡片
   * @param cardData 卡片数据
   * @returns HTML a 标签
   */
  private convertLinkCard(cardData: any): string {
    const href = cardData.href || cardData.url;
    const text = cardData.text || cardData.title || href;
    
    if (!href) {
      this.logger.warn('convertLinkCard', '未找到链接 URL', { cardData });
      return '';
    }
    
    return `<a href="${this.escapeHtml(href)}">${this.escapeHtml(text)}</a>`;
  }
  
  /**
   * 转义 HTML 特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的字符串
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
```


## 4. 测试工具库

### 4.1 WordDocumentTestUtils 实现

```typescript
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';

/**
 * Word 文档测试工具类
 * 提供用于测试的辅助方法
 */
export class WordDocumentTestUtils {
  /**
   * 统计 Word 文档中的图片数量
   * @param buffer Word 文件 Buffer
   * @returns 图片数量
   */
  static async countImagesInWordDocument(buffer: Buffer): Promise<number> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const mediaFolder = zip.folder('word/media');
      
      if (!mediaFolder) {
        return 0;
      }
      
      const files = Object.keys(mediaFolder.files);
      const imageFiles = files.filter(f => 
        /\.(png|jpg|jpeg|gif|bmp|tiff|webp)$/i.test(f)
      );
      
      return imageFiles.length;
    } catch (error) {
      console.error('统计图片数量失败:', error);
      return 0;
    }
  }
  
  /**
   * 提取 Word 文档的文本内容
   * @param buffer Word 文件 Buffer
   * @returns 文本内容
   */
  static async extractText(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        return '';
      }
      
      // 解析 XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      // 提取所有文本节点
      const textNodes = doc.getElementsByTagName('w:t');
      const texts: string[] = [];
      
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        if (node.textContent) {
          texts.push(node.textContent);
        }
      }
      
      return texts.join('');
    } catch (error) {
      console.error('提取文本失败:', error);
      return '';
    }
  }
  
  /**
   * 验证 Word 文档结构
   * @param buffer Word 文件 Buffer
   * @returns 验证结果
   */
  static async validateStructure(buffer: Buffer): Promise<ValidationResult> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      
      // 必需的文件列表
      const requiredFiles = [
        '[Content_Types].xml',
        '_rels/.rels',
        'word/document.xml',
        'word/_rels/document.xml.rels'
      ];
      
      const missingFiles: string[] = [];
      
      for (const file of requiredFiles) {
        if (!zip.file(file)) {
          missingFiles.push(file);
        }
      }
      
      return {
        valid: missingFiles.length === 0,
        missingFiles
      };
    } catch (error) {
      return {
        valid: false,
        missingFiles: [],
        error: error.message
      };
    }
  }
  
  /**
   * 提取 Word 文档的标题列表
   * @param buffer Word 文件 Buffer
   * @returns 标题列表
   */
  static async extractHeadings(buffer: Buffer): Promise<Heading[]> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        return [];
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      const headings: Heading[] = [];
      const paragraphs = doc.getElementsByTagName('w:p');
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        
        // 查找段落样式
        const pStyle = paragraph.getElementsByTagName('w:pStyle')[0];
        if (!pStyle) continue;
        
        const styleId = pStyle.getAttribute('w:val');
        if (!styleId || !styleId.startsWith('Heading')) continue;
        
        // 提取标题级别
        const level = parseInt(styleId.replace('Heading', ''), 10);
        if (isNaN(level)) continue;
        
        // 提取标题文本
        const textNodes = paragraph.getElementsByTagName('w:t');
        const texts: string[] = [];
        for (let j = 0; j < textNodes.length; j++) {
          if (textNodes[j].textContent) {
            texts.push(textNodes[j].textContent);
          }
        }
        
        headings.push({
          level,
          text: texts.join('')
        });
      }
      
      return headings;
    } catch (error) {
      console.error('提取标题失败:', error);
      return [];
    }
  }
  
  /**
   * 统计 Word 文档中的表格数量
   * @param buffer Word 文件 Buffer
   * @returns 表格数量
   */
  static async countTables(buffer: Buffer): Promise<number> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        return 0;
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      const tables = doc.getElementsByTagName('w:tbl');
      return tables.length;
    } catch (error) {
      console.error('统计表格数量失败:', error);
      return 0;
    }
  }
  
  /**
   * 检查 Word 文档是否包含特定样式
   * @param buffer Word 文件 Buffer
   * @param styleName 样式名称
   * @returns 是否包含该样式
   */
  static async hasStyle(buffer: Buffer, styleName: string): Promise<boolean> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        return false;
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      const styles = doc.getElementsByTagName('w:pStyle');
      
      for (let i = 0; i < styles.length; i++) {
        const styleId = styles[i].getAttribute('w:val');
        if (styleId === styleName) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('检查样式失败:', error);
      return false;
    }
  }
  
  /**
   * 获取 Word 文档的元数据
   * @param buffer Word 文件 Buffer
   * @returns 元数据
   */
  static async getMetadata(buffer: Buffer): Promise<DocumentMetadata> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const coreXml = await zip.file('docProps/core.xml')?.async('text');
      
      if (!coreXml) {
        return {};
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(coreXml, 'text/xml');
      
      const metadata: DocumentMetadata = {};
      
      // 提取标题
      const titleNode = doc.getElementsByTagName('dc:title')[0];
      if (titleNode && titleNode.textContent) {
        metadata.title = titleNode.textContent;
      }
      
      // 提取作者
      const creatorNode = doc.getElementsByTagName('dc:creator')[0];
      if (creatorNode && creatorNode.textContent) {
        metadata.creator = creatorNode.textContent;
      }
      
      // 提取创建时间
      const createdNode = doc.getElementsByTagName('dcterms:created')[0];
      if (createdNode && createdNode.textContent) {
        metadata.created = new Date(createdNode.textContent);
      }
      
      // 提取修改时间
      const modifiedNode = doc.getElementsByTagName('dcterms:modified')[0];
      if (modifiedNode && modifiedNode.textContent) {
        metadata.modified = new Date(modifiedNode.textContent);
      }
      
      return metadata;
    } catch (error) {
      console.error('获取元数据失败:', error);
      return {};
    }
  }
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  missingFiles: string[];
  error?: string;
}

/**
 * 标题接口
 */
export interface Heading {
  level: number;
  text: string;
}

/**
 * 文档元数据接口
 */
export interface DocumentMetadata {
  title?: string;
  creator?: string;
  created?: Date;
  modified?: Date;
}
```

