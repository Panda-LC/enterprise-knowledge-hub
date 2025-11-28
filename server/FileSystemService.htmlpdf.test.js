import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService.js';

/**
 * HTML 和 PDF 文件操作测试
 * 验证任务 5 中新添加的方法
 */
describe('FileSystemService - HTML and PDF Operations', () => {
  let testBaseDir;
  let service;

  beforeEach(async () => {
    testBaseDir = path.join(process.cwd(), 'test-data', `htmlpdf-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    service = new FileSystemService(testBaseDir);
    await service.initializeDirectories();
  });

  afterEach(async () => {
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('HTML 文件操作', () => {
    it('应该能够保存和加载 HTML 文件', async () => {
      const docId = 'test-doc-1';
      const htmlContent = '<html><body><h1>测试文档</h1></body></html>';

      // 保存 HTML 文件
      const savedPath = await service.saveHtmlFile(docId, htmlContent);
      expect(savedPath).toBe(path.join(testBaseDir, 'documents', `${docId}.html`));

      // 加载 HTML 文件
      const loadedContent = await service.loadHtmlFile(docId);
      expect(loadedContent).toBe(htmlContent);
    });

    it('应该能够检查 HTML 文件是否存在', async () => {
      const docId = 'test-doc-2';
      const htmlContent = '<html><body><p>内容</p></body></html>';

      // 文件不存在时应返回 false
      const existsBefore = await service.htmlFileExists(docId);
      expect(existsBefore).toBe(false);

      // 保存文件
      await service.saveHtmlFile(docId, htmlContent);

      // 文件存在时应返回 true
      const existsAfter = await service.htmlFileExists(docId);
      expect(existsAfter).toBe(true);
    });

    it('加载不存在的 HTML 文件应返回 null', async () => {
      const docId = 'non-existent-html';
      const content = await service.loadHtmlFile(docId);
      expect(content).toBeNull();
    });

    it('应该能够更新已存在的 HTML 文件', async () => {
      const docId = 'test-doc-3';
      const originalContent = '<html><body><h1>原始内容</h1></body></html>';
      const updatedContent = '<html><body><h1>更新后的内容</h1></body></html>';

      // 保存原始内容
      await service.saveHtmlFile(docId, originalContent);

      // 更新内容
      await service.saveHtmlFile(docId, updatedContent);

      // 验证内容已更新
      const loadedContent = await service.loadHtmlFile(docId);
      expect(loadedContent).toBe(updatedContent);
    });
  });

  describe('PDF 文件操作', () => {
    it('应该能够保存和加载 PDF 文件', async () => {
      const docId = 'test-doc-4';
      const pdfBuffer = Buffer.from('fake pdf content');

      // 保存 PDF 文件
      const savedPath = await service.savePdfFile(docId, pdfBuffer);
      expect(savedPath).toBe(path.join(testBaseDir, 'documents', `${docId}.pdf`));

      // 加载 PDF 文件
      const loadedBuffer = await service.loadPdfFile(docId);
      expect(loadedBuffer).toEqual(pdfBuffer);
    });

    it('应该能够检查 PDF 文件是否存在', async () => {
      const docId = 'test-doc-5';
      const pdfBuffer = Buffer.from('pdf data');

      // 文件不存在时应返回 false
      const existsBefore = await service.pdfFileExists(docId);
      expect(existsBefore).toBe(false);

      // 保存文件
      await service.savePdfFile(docId, pdfBuffer);

      // 文件存在时应返回 true
      const existsAfter = await service.pdfFileExists(docId);
      expect(existsAfter).toBe(true);
    });

    it('加载不存在的 PDF 文件应返回 null', async () => {
      const docId = 'non-existent-pdf';
      const content = await service.loadPdfFile(docId);
      expect(content).toBeNull();
    });

    it('应该能够更新已存在的 PDF 文件', async () => {
      const docId = 'test-doc-6';
      const originalBuffer = Buffer.from('original pdf');
      const updatedBuffer = Buffer.from('updated pdf');

      // 保存原始内容
      await service.savePdfFile(docId, originalBuffer);

      // 更新内容
      await service.savePdfFile(docId, updatedBuffer);

      // 验证内容已更新
      const loadedBuffer = await service.loadPdfFile(docId);
      expect(loadedBuffer).toEqual(updatedBuffer);
    });
  });

  describe('文件删除操作', () => {
    it('应该能够删除 HTML 文件', async () => {
      const docId = 'test-doc-7';
      const htmlContent = '<html><body><p>测试</p></body></html>';

      // 保存文件
      await service.saveHtmlFile(docId, htmlContent);

      // 验证文件存在
      const existsBefore = await service.htmlFileExists(docId);
      expect(existsBefore).toBe(true);

      // 删除文件
      await service.deleteFile(docId, 'html');

      // 验证文件已删除
      const existsAfter = await service.htmlFileExists(docId);
      expect(existsAfter).toBe(false);
    });

    it('应该能够删除 PDF 文件', async () => {
      const docId = 'test-doc-8';
      const pdfBuffer = Buffer.from('test pdf');

      // 保存文件
      await service.savePdfFile(docId, pdfBuffer);

      // 验证文件存在
      const existsBefore = await service.pdfFileExists(docId);
      expect(existsBefore).toBe(true);

      // 删除文件
      await service.deleteFile(docId, 'pdf');

      // 验证文件已删除
      const existsAfter = await service.pdfFileExists(docId);
      expect(existsAfter).toBe(false);
    });

    it('删除不存在的文件应该不抛出错误', async () => {
      const docId = 'non-existent-doc';

      // 删除不存在的 HTML 文件
      await expect(service.deleteFile(docId, 'html')).resolves.not.toThrow();

      // 删除不存在的 PDF 文件
      await expect(service.deleteFile(docId, 'pdf')).resolves.not.toThrow();
    });
  });

  describe('综合测试', () => {
    it('应该能够同时管理 JSON、HTML 和 PDF 文件', async () => {
      const docId = 'test-doc-9';
      const jsonContent = { id: docId, title: '测试文档', body: '内容' };
      const htmlContent = '<html><body><h1>测试文档</h1></body></html>';
      const pdfBuffer = Buffer.from('pdf content');

      // 保存所有三种格式
      await service.saveDocument(docId, jsonContent);
      await service.saveHtmlFile(docId, htmlContent);
      await service.savePdfFile(docId, pdfBuffer);

      // 验证所有文件都存在
      const jsonExists = await service.loadDocument(docId);
      const htmlExists = await service.htmlFileExists(docId);
      const pdfExists = await service.pdfFileExists(docId);

      expect(jsonExists).not.toBeNull();
      expect(htmlExists).toBe(true);
      expect(pdfExists).toBe(true);

      // 加载并验证内容
      const loadedJson = await service.loadDocument(docId);
      const loadedHtml = await service.loadHtmlFile(docId);
      const loadedPdf = await service.loadPdfFile(docId);

      expect(loadedJson).toEqual(jsonContent);
      expect(loadedHtml).toBe(htmlContent);
      expect(loadedPdf).toEqual(pdfBuffer);
    });

    it('删除 HTML 和 PDF 文件不应影响 JSON 文件', async () => {
      const docId = 'test-doc-10';
      const jsonContent = { id: docId, title: '测试' };
      const htmlContent = '<html><body>测试</body></html>';
      const pdfBuffer = Buffer.from('test');

      // 保存所有文件
      await service.saveDocument(docId, jsonContent);
      await service.saveHtmlFile(docId, htmlContent);
      await service.savePdfFile(docId, pdfBuffer);

      // 删除 HTML 和 PDF
      await service.deleteFile(docId, 'html');
      await service.deleteFile(docId, 'pdf');

      // 验证 JSON 文件仍然存在
      const jsonExists = await service.loadDocument(docId);
      expect(jsonExists).toEqual(jsonContent);

      // 验证 HTML 和 PDF 已删除
      const htmlExists = await service.htmlFileExists(docId);
      const pdfExists = await service.pdfFileExists(docId);
      expect(htmlExists).toBe(false);
      expect(pdfExists).toBe(false);
    });
  });
});
