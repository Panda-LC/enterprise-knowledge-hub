import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './StorageService';

describe('StorageService - 文件操作扩展', () => {
  beforeEach(() => {
    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe('fileExists', () => {
    it('应该检查 HTML 文件是否存在', async () => {
      // Mock fetch 返回成功
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const exists = await StorageService.fileExists('test-doc', 'html');

      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/test-doc/html',
        { method: 'HEAD' }
      );
    });

    it('应该检查 PDF 文件是否存在', async () => {
      // Mock fetch 返回成功
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const exists = await StorageService.fileExists('test-doc', 'pdf');

      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/test-doc/pdf',
        { method: 'HEAD' }
      );
    });

    it('应该在文件不存在时返回 false', async () => {
      // Mock fetch 返回 404
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const exists = await StorageService.fileExists('non-existent', 'html');

      expect(exists).toBe(false);
    });

    it('应该在网络错误时返回 false', async () => {
      // Mock fetch 抛出错误
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const exists = await StorageService.fileExists('test-doc', 'html');

      expect(exists).toBe(false);
    });
  });

  describe('downloadDocumentFile', () => {
    beforeEach(() => {
      // Mock DOM 元素
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
      document.createElement = vi.fn().mockReturnValue({
        click: vi.fn(),
        href: '',
        download: '',
      });
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
    });

    it('应该下载已存在的 HTML 文件', async () => {
      // Mock fileExists 返回 true
      vi.spyOn(StorageService, 'fileExists').mockResolvedValue(true);

      // Mock fetch 返回 HTML 内容
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      });

      await StorageService.downloadDocumentFile('test-doc', '测试文档', 'html');

      expect(StorageService.fileExists).toHaveBeenCalledWith('test-doc', 'html');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/test-doc/download/html'
      );
    });

    it('应该下载已存在的 PDF 文件', async () => {
      // Mock fileExists 返回 true
      vi.spyOn(StorageService, 'fileExists').mockResolvedValue(true);

      // Mock fetch 返回 PDF blob
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      await StorageService.downloadDocumentFile('test-doc', '测试文档', 'pdf');

      expect(StorageService.fileExists).toHaveBeenCalledWith('test-doc', 'pdf');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/test-doc/download/pdf'
      );
    });

    it('应该在文件不存在时动态生成 HTML', async () => {
      // Mock fileExists 返回 false
      vi.spyOn(StorageService, 'fileExists').mockResolvedValue(false);

      // Mock loadDocumentContent 返回文档数据
      vi.spyOn(StorageService, 'loadDocumentContent').mockResolvedValue({
        title: '测试文档',
        body_html: '<p>Test content</p>',
      });

      await StorageService.downloadDocumentFile('test-doc', '测试文档', 'html');

      expect(StorageService.fileExists).toHaveBeenCalledWith('test-doc', 'html');
      expect(StorageService.loadDocumentContent).toHaveBeenCalledWith('test-doc');
    });

    it('应该在 PDF 不存在时抛出错误', async () => {
      // Mock fileExists 返回 false
      vi.spyOn(StorageService, 'fileExists').mockResolvedValue(false);

      await expect(
        StorageService.downloadDocumentFile('test-doc', '测试文档', 'pdf')
      ).rejects.toThrow('PDF 文件不存在，且无法动态生成');
    });

    it('应该清理文件名中的不安全字符', async () => {
      // Mock fileExists 返回 true
      vi.spyOn(StorageService, 'fileExists').mockResolvedValue(true);

      // Mock fetch 返回 HTML 内容
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      });

      await StorageService.downloadDocumentFile(
        'test-doc',
        '测试/文档:名称*?',
        'html'
      );

      // 验证创建的下载链接使用了清理后的文件名
      const mockElement = document.createElement('a') as any;
      expect(mockElement.download).toContain('测试-文档-名称');
    });
  });

  describe('sanitizeFilename', () => {
    it('应该替换不安全字符', () => {
      const result = (StorageService as any).sanitizeFilename('test/file:name*?.txt');
      expect(result).toBe('test-file-name--.txt');
    });

    it('应该替换空格为下划线', () => {
      const result = (StorageService as any).sanitizeFilename('test file name');
      expect(result).toBe('test_file_name');
    });

    it('应该限制文件名长度', () => {
      const longName = 'a'.repeat(250);
      const result = (StorageService as any).sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });
});
