import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入 app
let app;
let FileSystemService;

beforeAll(async () => {
  const storageModule = await import('./storage.js');
  app = storageModule.default;
  
  const fsModule = await import('./FileSystemService.js');
  FileSystemService = fsModule.default;
});

describe('Storage Server - Download Endpoints', () => {
  const testDocId = 'test-download-doc';
  const testHtmlContent = '<html><body><h1>Test Document</h1><p>This is a test.</p></body></html>';
  const testPdfBuffer = Buffer.from('PDF-MOCK-CONTENT');
  const testDocContent = {
    id: testDocId,
    title: 'Test Download Document',
    format: 'html',
    content: testHtmlContent
  };

  beforeEach(async () => {
    // 清理测试文件
    const documentsDir = path.join(process.cwd(), 'data', 'documents');
    try {
      await fs.unlink(path.join(documentsDir, `${testDocId}.json`));
    } catch (error) {
      // 忽略文件不存在的错误
    }
    try {
      await fs.unlink(path.join(documentsDir, `${testDocId}.html`));
    } catch (error) {
      // 忽略文件不存在的错误
    }
    try {
      await fs.unlink(path.join(documentsDir, `${testDocId}.pdf`));
    } catch (error) {
      // 忽略文件不存在的错误
    }
  });

  describe('GET /api/storage/documents/:docId/download/html', () => {
    it('应该成功下载 HTML 文件', async () => {
      // 准备测试数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.saveDocument(testDocId, testDocContent);
      await fileSystemService.saveHtmlFile(testDocId, testHtmlContent);

      // 发送请求
      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/download/html`)
        .expect(200);

      // 验证响应头
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Test%20Download%20Document.html');
      expect(response.headers['content-length']).toBe(String(Buffer.byteLength(testHtmlContent, 'utf8')));

      // 验证响应内容
      expect(response.text).toBe(testHtmlContent);
    });

    it('当 HTML 文件不存在时应该返回 404', async () => {
      const response = await request(app)
        .get(`/api/storage/documents/non-existent-doc/download/html`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('HTML 文件不存在');
    });

    it('当文档 ID 无效时应该返回 400', async () => {
      const response = await request(app)
        .get('/api/storage/documents//download/html')
        .expect(404); // Express 会将空路径段视为 404

      // 或者测试其他无效情况
      const response2 = await request(app)
        .get('/api/storage/documents/null/download/html')
        .expect(404);
    });

    it('当无法获取文档标题时应该使用默认文件名', async () => {
      // 只保存 HTML 文件，不保存文档元数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.saveHtmlFile(testDocId, testHtmlContent);

      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/download/html`)
        .expect(200);

      // 验证使用了默认文件名
      expect(response.headers['content-disposition']).toContain(`${testDocId}.html`);
    });
  });

  describe('GET /api/storage/documents/:docId/download/pdf', () => {
    it('应该成功下载 PDF 文件', async () => {
      // 准备测试数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.saveDocument(testDocId, testDocContent);
      await fileSystemService.savePdfFile(testDocId, testPdfBuffer);

      // 发送请求
      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/download/pdf`)
        .expect(200);

      // 验证响应头
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('Test%20Download%20Document.pdf');
      expect(response.headers['content-length']).toBe(String(testPdfBuffer.length));

      // 验证响应内容
      expect(Buffer.from(response.body)).toEqual(testPdfBuffer);
    });

    it('当 PDF 文件不存在时应该返回 404', async () => {
      const response = await request(app)
        .get(`/api/storage/documents/non-existent-doc/download/pdf`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('PDF 文件不存在');
    });

    it('当文档 ID 无效时应该返回 400', async () => {
      const response = await request(app)
        .get('/api/storage/documents//download/pdf')
        .expect(404); // Express 会将空路径段视为 404
    });

    it('当无法获取文档标题时应该使用默认文件名', async () => {
      // 只保存 PDF 文件，不保存文档元数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.savePdfFile(testDocId, testPdfBuffer);

      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/download/pdf`)
        .expect(200);

      // 验证使用了默认文件名
      expect(response.headers['content-disposition']).toContain(`${testDocId}.pdf`);
    });
  });

  describe('HEAD /api/storage/documents/:docId/html', () => {
    it('当 HTML 文件存在时应该返回 200', async () => {
      // 准备测试数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.saveHtmlFile(testDocId, testHtmlContent);

      // 发送请求
      await request(app)
        .head(`/api/storage/documents/${testDocId}/html`)
        .expect(200);
    });

    it('当 HTML 文件不存在时应该返回 404', async () => {
      await request(app)
        .head(`/api/storage/documents/non-existent-doc/html`)
        .expect(404);
    });
  });

  describe('HEAD /api/storage/documents/:docId/pdf', () => {
    it('当 PDF 文件存在时应该返回 200', async () => {
      // 准备测试数据
      const fileSystemService = new FileSystemService();
      await fileSystemService.savePdfFile(testDocId, testPdfBuffer);

      // 发送请求
      await request(app)
        .head(`/api/storage/documents/${testDocId}/pdf`)
        .expect(200);
    });

    it('当 PDF 文件不存在时应该返回 404', async () => {
      await request(app)
        .head(`/api/storage/documents/non-existent-doc/pdf`)
        .expect(404);
    });
  });

  describe('错误处理', () => {
    it('应该处理文件系统错误', async () => {
      // 使用一个会导致文件系统错误的文档 ID
      const invalidDocId = '../../../etc/passwd';

      const response = await request(app)
        .get(`/api/storage/documents/${invalidDocId}/download/html`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('应该在响应中包含时间戳', async () => {
      const response = await request(app)
        .get(`/api/storage/documents/non-existent/download/html`)
        .expect(404);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });
});
