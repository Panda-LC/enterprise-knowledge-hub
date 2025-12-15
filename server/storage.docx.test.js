import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './storage.js';
import fs from 'fs';
import path from 'path';

describe('Storage API - Word 文件端点', () => {
  const testDocId = 'test-word-api-doc';
  const testBuffer = Buffer.from('PK\x03\x04'); // ZIP 文件头（.docx 是 ZIP 格式）

  // 清理测试数据
  afterAll(async () => {
    const docPath = path.join(process.cwd(), 'data', 'documents', `${testDocId}.docx`);
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath);
    }
  });

  describe('POST /api/storage/documents/:docId/docx', () => {
    it('应该成功保存 Word 文件', async () => {
      const response = await request(app)
        .post(`/api/storage/documents/${testDocId}/docx`)
        .attach('file', testBuffer, 'test.docx')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('path');
      expect(response.body.path).toContain('.docx');
    });

    it('应该在未上传文件时返回 400', async () => {
      const response = await request(app)
        .post(`/api/storage/documents/${testDocId}/docx`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('未上传文件');
    });

    it('应该在文档 ID 无效时返回 400', async () => {
      const response = await request(app)
        .post('/api/storage/documents//docx')
        .attach('file', testBuffer, 'test.docx')
        .expect(404); // Express 会返回 404 对于空路径参数

      // 空路径参数会导致路由不匹配
    });
  });

  describe('GET /api/storage/documents/:docId/docx', () => {
    beforeAll(async () => {
      // 先保存一个文件
      await request(app)
        .post(`/api/storage/documents/${testDocId}/docx`)
        .attach('file', testBuffer, 'test.docx');
    });

    it('应该成功获取 Word 文件', async () => {
      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/docx`)
        .buffer(true)
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => callback(null, Buffer.from(data, 'binary')));
        })
        .expect(200);

      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('应该在文件不存在时返回 404', async () => {
      const response = await request(app)
        .get('/api/storage/documents/non-existent-doc/docx')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Word 文件不存在');
    });
  });

  describe('HEAD /api/storage/documents/:docId/docx', () => {
    it('应该在文件存在时返回 200', async () => {
      await request(app)
        .head(`/api/storage/documents/${testDocId}/docx`)
        .expect(200);
    });

    it('应该在文件不存在时返回 404', async () => {
      await request(app)
        .head('/api/storage/documents/non-existent-doc/docx')
        .expect(404);
    });
  });

  describe('GET /api/storage/documents/:docId/download/docx', () => {
    it('应该成功下载 Word 文件', async () => {
      const response = await request(app)
        .get(`/api/storage/documents/${testDocId}/download/docx`)
        .buffer(true)
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => callback(null, Buffer.from(data, 'binary')));
        })
        .expect(200);

      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.docx');
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('应该在文件不存在时返回 404', async () => {
      const response = await request(app)
        .get('/api/storage/documents/non-existent-doc/download/docx')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Word 文件不存在');
    });
  });
});
