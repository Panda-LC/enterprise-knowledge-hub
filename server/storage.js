import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import FileSystemService from './FileSystemService.js';

const app = express();
const PORT = 3002;

// 创建 FileSystemService 实例
const fileSystemService = new FileSystemService();

// 配置 multer 用于处理文件上传
// 使用内存存储，文件将作为 Buffer 存储在内存中
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 限制文件大小为 50MB
  }
});

// 初始化目录结构
(async () => {
  try {
    await fileSystemService.initializeDirectories();
    console.log('[Storage] 文件系统服务初始化完成');
  } catch (error) {
    console.error('[Storage] 文件系统服务初始化失败:', error);
    process.exit(1);
  }
})();

// CORS 配置 - 只允许 localhost:3000 访问
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// JSON 解析器中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'storage-service'
  });
});

// ==================== 配置 API 端点 ====================

/**
 * POST /api/storage/configs/:type
 * 保存配置数据
 * 请求体: { data: any }
 * 响应: { success: true } | { error: string }
 */
app.post('/api/storage/configs/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { data } = req.body;

    // 验证请求体
    if (data === undefined) {
      return res.status(400).json({
        error: '请求体必须包含 data 字段',
        timestamp: new Date().toISOString()
      });
    }

    // 验证配置类型
    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        error: '配置类型无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存配置
    await fileSystemService.saveConfig(type, data);

    // 返回成功响应
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/configs/:type
 * 加载配置数据
 * 响应: { data: any } | { error: string }
 */
app.get('/api/storage/configs/:type', async (req, res, next) => {
  try {
    const { type } = req.params;

    // 验证配置类型
    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        error: '配置类型无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载配置
    const data = await fileSystemService.loadConfig(type);

    // 返回配置数据
    res.json({
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

// ==================== 文档 API 端点 ====================

/**
 * POST /api/storage/documents/:docId
 * 保存文档内容
 * 请求体: { content: any }
 * 响应: { success: true } | { error: string }
 */
app.post('/api/storage/documents/:docId', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const { content } = req.body;

    // 验证请求体
    if (content === undefined) {
      return res.status(400).json({
        error: '请求体必须包含 content 字段',
        timestamp: new Date().toISOString()
      });
    }

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存文档
    await fileSystemService.saveDocument(docId, content);

    // 返回成功响应
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId
 * 加载文档内容
 * 响应: { content: any } | { error: string }
 */
app.get('/api/storage/documents/:docId', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载文档
    const content = await fileSystemService.loadDocument(docId);

    // 如果文档不存在，返回 404
    if (content === null) {
      return res.status(404).json({
        error: '文档不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 返回文档内容
    res.json({
      content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * POST /api/storage/documents/:docId/html
 * 保存 HTML 文件
 * 请求体: { content: string }
 * 响应: { path: string } | { error: string }
 */
app.post('/api/storage/documents/:docId/html', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const { content } = req.body;

    // 验证请求体
    if (content === undefined || typeof content !== 'string') {
      return res.status(400).json({
        error: '请求体必须包含 content 字段（字符串类型）',
        timestamp: new Date().toISOString()
      });
    }

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存 HTML 文件
    const filePath = await fileSystemService.saveHtmlFile(docId, content);

    // 返回成功响应
    res.json({
      success: true,
      path: filePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/html
 * 获取 HTML 文件
 * 响应: { content: string } | { error: string }
 */
app.get('/api/storage/documents/:docId/html', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 HTML 文件
    const content = await fileSystemService.loadHtmlFile(docId);

    // 如果文件不存在，返回 404
    if (content === null) {
      return res.status(404).json({
        error: 'HTML 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 返回 HTML 内容
    res.json({
      content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * HEAD /api/storage/documents/:docId/html
 * 检查 HTML 文件是否存在
 * 响应: 200 (存在) | 404 (不存在)
 */
app.head('/api/storage/documents/:docId/html', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).end();
    }

    // 调用 FileSystemService 检查文件是否存在
    const exists = await fileSystemService.htmlFileExists(docId);

    // 返回状态码
    res.status(exists ? 200 : 404).end();
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * POST /api/storage/documents/:docId/pdf
 * 保存 PDF 文件
 * 请求体: multipart/form-data（使用 multer 处理）
 * 响应: { path: string } | { error: string }
 */
app.post('/api/storage/documents/:docId/pdf', upload.single('file'), async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 验证文件是否上传
    if (!req.file) {
      return res.status(400).json({
        error: '未上传文件',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存 PDF 文件
    const filePath = await fileSystemService.savePdfFile(docId, req.file.buffer);

    // 返回成功响应
    res.json({
      success: true,
      path: filePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/pdf
 * 获取 PDF 文件
 * 响应: 二进制 PDF 数据 | { error: string }
 */
app.get('/api/storage/documents/:docId/pdf', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 PDF 文件
    const pdfBuffer = await fileSystemService.loadPdfFile(docId);

    // 如果文件不存在，返回 404
    if (pdfBuffer === null) {
      return res.status(404).json({
        error: 'PDF 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年

    // 返回 PDF 内容
    res.send(pdfBuffer);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * HEAD /api/storage/documents/:docId/pdf
 * 检查 PDF 文件是否存在
 * 响应: 200 (存在) | 404 (不存在)
 */
app.head('/api/storage/documents/:docId/pdf', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).end();
    }

    // 调用 FileSystemService 检查文件是否存在
    const exists = await fileSystemService.pdfFileExists(docId);

    // 返回状态码
    res.status(exists ? 200 : 404).end();
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/download
 * 下载文档文件
 * 查询参数: format=md|html (可选，默认根据文档格式自动判断)
 * 响应: 文件下载（设置 Content-Disposition 和 Content-Type 响应头）
 */
app.get('/api/storage/documents/:docId/download', async (req, res, next) => {
  try {
    const { docId } = req.params;
    const { format } = req.query;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 获取格式化文档
    const formattedDoc = await fileSystemService.getFormattedDocument(docId);

    // 如果文档不存在，返回 404
    if (formattedDoc === null) {
      return res.status(404).json({
        error: '文档不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 确定文件格式和扩展名
    let fileFormat = formattedDoc.format;
    let fileExtension = '.md';
    let contentType = 'text/markdown; charset=utf-8';

    // 如果查询参数指定了格式，使用指定的格式
    if (format === 'md' || format === 'markdown') {
      fileFormat = 'markdown';
      fileExtension = '.md';
      contentType = 'text/markdown; charset=utf-8';
    } else if (format === 'html') {
      fileFormat = 'html';
      fileExtension = '.html';
      contentType = 'text/html; charset=utf-8';
    } else {
      // 根据文档格式自动判断
      if (fileFormat === 'html' || fileFormat === 'lake') {
        fileExtension = '.html';
        contentType = 'text/html; charset=utf-8';
      } else {
        fileExtension = '.md';
        contentType = 'text/markdown; charset=utf-8';
      }
    }

    // 清理文件名
    const safeFilename = fileSystemService.sanitizeFilename(formattedDoc.title, fileExtension);

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);

    // 返回格式化的文档内容（纯文本）
    res.send(formattedDoc.content);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/download/html
 * 下载 HTML 文件
 * 响应: HTML 文件下载（设置 Content-Disposition 头）
 */
app.get('/api/storage/documents/:docId/download/html', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 HTML 文件
    const content = await fileSystemService.loadHtmlFile(docId);

    // 如果文件不存在，返回 404
    if (content === null) {
      return res.status(404).json({
        error: 'HTML 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 获取文档信息以生成文件名
    let filename = `${docId}.html`;
    try {
      const docContent = await fileSystemService.loadDocument(docId);
      if (docContent && docContent.title) {
        filename = fileSystemService.sanitizeFilename(docContent.title, '.html');
      }
    } catch (error) {
      console.warn('[Storage] 无法获取文档标题，使用默认文件名:', error.message);
    }

    // 设置响应头
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));

    // 返回 HTML 内容
    res.send(content);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/download/pdf
 * 下载 PDF 文件
 * 响应: PDF 文件下载（设置 Content-Disposition 头）
 */
app.get('/api/storage/documents/:docId/download/pdf', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 PDF 文件
    const pdfBuffer = await fileSystemService.loadPdfFile(docId);

    // 如果文件不存在，返回 404
    if (pdfBuffer === null) {
      return res.status(404).json({
        error: 'PDF 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 获取文档信息以生成文件名
    let filename = `${docId}.pdf`;
    try {
      const docContent = await fileSystemService.loadDocument(docId);
      if (docContent && docContent.title) {
        filename = fileSystemService.sanitizeFilename(docContent.title, '.pdf');
      }
    } catch (error) {
      console.warn('[Storage] 无法获取文档标题，使用默认文件名:', error.message);
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // 返回 PDF 内容
    res.send(pdfBuffer);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * POST /api/storage/documents/:docId/docx
 * 保存 Word 文件
 * 请求体: multipart/form-data（使用 multer 处理）
 * 响应: { path: string } | { error: string }
 */
app.post('/api/storage/documents/:docId/docx', upload.single('file'), async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 验证文件是否上传
    if (!req.file) {
      return res.status(400).json({
        error: '未上传文件',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存 Word 文件
    const filePath = await fileSystemService.saveDocxFile(docId, req.file.buffer);

    // 返回成功响应
    res.json({
      success: true,
      path: filePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/docx
 * 获取 Word 文件
 * 响应: 二进制 Word 数据 | { error: string }
 */
app.get('/api/storage/documents/:docId/docx', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 Word 文件
    const docxBuffer = await fileSystemService.loadDocxFile(docId);

    // 如果文件不存在，返回 404
    if (docxBuffer === null) {
      return res.status(404).json({
        error: 'Word 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', docxBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年

    // 返回 Word 内容
    res.send(docxBuffer);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * HEAD /api/storage/documents/:docId/docx
 * 检查 Word 文件是否存在
 * 响应: 200 (存在) | 404 (不存在)
 */
app.head('/api/storage/documents/:docId/docx', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).end();
    }

    // 调用 FileSystemService 检查文件是否存在
    const exists = await fileSystemService.docxFileExists(docId);

    // 返回状态码
    res.status(exists ? 200 : 404).end();
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/documents/:docId/download/docx
 * 下载 Word 文件
 * 响应: Word 文件下载（设置 Content-Disposition 头）
 */
app.get('/api/storage/documents/:docId/download/docx', async (req, res, next) => {
  try {
    const { docId } = req.params;

    // 验证文档 ID
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载 Word 文件
    const docxBuffer = await fileSystemService.loadDocxFile(docId);

    // 如果文件不存在，返回 404
    if (docxBuffer === null) {
      return res.status(404).json({
        error: 'Word 文件不存在',
        docId,
        timestamp: new Date().toISOString()
      });
    }

    // 获取文档信息以生成文件名
    let filename = `${docId}.docx`;
    try {
      const docContent = await fileSystemService.loadDocument(docId);
      if (docContent && docContent.title) {
        filename = fileSystemService.sanitizeFilename(docContent.title, '.docx');
      }
    } catch (error) {
      console.warn('[Storage] 无法获取文档标题，使用默认文件名:', error.message);
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    // 返回 Word 内容
    res.send(docxBuffer);
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

// ==================== 资源 API 端点 ====================

/**
 * POST /api/storage/assets/:sourceId/:docId/:filename
 * 保存资源文件（图片、附件等）
 * 请求体: multipart/form-data（使用 multer 处理）
 * 响应: { path: string } | { error: string }
 */
app.post('/api/storage/assets/:sourceId/:docId/:filename', upload.single('file'), async (req, res, next) => {
  try {
    const { sourceId, docId, filename } = req.params;

    // 验证参数
    if (!sourceId || typeof sourceId !== 'string') {
      return res.status(400).json({
        error: '数据源 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        error: '文件名无效',
        timestamp: new Date().toISOString()
      });
    }

    // 验证文件是否上传
    if (!req.file) {
      return res.status(400).json({
        error: '未上传文件',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 保存资源
    const relativePath = await fileSystemService.saveAsset(
      sourceId,
      docId,
      filename,
      req.file.buffer
    );

    // 返回成功响应，包含资源的相对路径
    res.json({
      path: relativePath,
      size: req.file.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 传递错误到错误处理中间件
    next(error);
  }
});

/**
 * GET /api/storage/assets/:sourceId/:docId/:filename
 * 获取资源文件
 * 响应: 二进制文件数据（设置正确的 Content-Type 响应头）
 */
app.get('/api/storage/assets/:sourceId/:docId/:filename', async (req, res, next) => {
  try {
    const { sourceId, docId, filename } = req.params;

    // 验证参数
    if (!sourceId || typeof sourceId !== 'string') {
      return res.status(400).json({
        error: '数据源 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: '文档 ID 无效',
        timestamp: new Date().toISOString()
      });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        error: '文件名无效',
        timestamp: new Date().toISOString()
      });
    }

    // 调用 FileSystemService 加载资源
    const buffer = await fileSystemService.loadAsset(sourceId, docId, filename);

    // 根据文件扩展名设置 Content-Type
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年

    // 返回文件内容
    res.send(buffer);
  } catch (error) {
    // 如果是文件不存在错误，返回 404
    if (error.message.includes('资源文件不存在')) {
      return res.status(404).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // 传递其他错误到错误处理中间件
    next(error);
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// 启动服务器（仅在非测试环境）
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Storage service is running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
  });
}

export default app;
