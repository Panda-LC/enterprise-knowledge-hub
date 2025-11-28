import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageService } from './StorageService';

describe('StorageService - 文档下载功能', () => {
  let originalCreateElement: typeof document.createElement;
  let mockAnchor: any;

  beforeEach(() => {
    // Mock document.createElement
    originalCreateElement = document.createElement;
    mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    };
    
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'a') {
        return mockAnchor;
      }
      return originalCreateElement.call(document, tagName);
    }) as any;

    // Mock document.body
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });

  describe('downloadDocument', () => {
    it('应该正确下载 Markdown 文档', async () => {
      const mockContent = '# Test Document\n\nThis is a test.';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      await StorageService.downloadDocument('doc-123', 'Test Document', 'markdown');

      // 验证 fetch 调用
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/doc-123/download?format=md'
      );

      // 验证 Blob 创建
      expect(global.URL.createObjectURL).toHaveBeenCalled();

      // 验证下载触发
      expect(mockAnchor.download).toBe('Test_Document.md');
      expect(mockAnchor.click).toHaveBeenCalled();

      // 验证清理
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('应该正确下载 HTML 文档', async () => {
      const mockContent = '<html><body><h1>Test</h1></body></html>';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      await StorageService.downloadDocument('doc-456', 'HTML Test', 'lake');

      // 验证 fetch 调用
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/documents/doc-456/download?format=html'
      );

      // 验证文件名
      expect(mockAnchor.download).toBe('HTML_Test.html');
    });

    it('应该清理文件名中的不安全字符', async () => {
      const mockContent = 'test content';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      await StorageService.downloadDocument(
        'doc-789',
        'Test/Document:With*Special?Chars',
        'markdown'
      );

      // 验证文件名中的特殊字符被替换
      expect(mockAnchor.download).toBe('Test-Document-With-Special-Chars.md');
    });

    it('应该处理下载失败的情况', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ error: '文档不存在' }),
      });

      await expect(
        StorageService.downloadDocument('doc-999', 'Missing Doc', 'markdown')
      ).rejects.toThrow('文档不存在');
    });

    it('应该处理网络错误', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        StorageService.downloadDocument('doc-error', 'Error Doc', 'markdown')
      ).rejects.toThrow('Network error');
    });

    it('应该限制文件名长度', async () => {
      const mockContent = 'test content';
      const longTitle = 'A'.repeat(250); // 超过 200 字符限制
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      await StorageService.downloadDocument('doc-long', longTitle, 'markdown');

      // 验证文件名被截断（200 字符 + .md 扩展名）
      expect(mockAnchor.download.length).toBeLessThanOrEqual(203);
    });
  });

  describe('getDocumentDownloadUrl', () => {
    it('应该生成正确的下载 URL（带格式）', () => {
      const url = StorageService.getDocumentDownloadUrl('doc-123', 'md');
      expect(url).toBe('http://localhost:3002/api/storage/documents/doc-123/download?format=md');
    });

    it('应该生成正确的下载 URL（不带格式）', () => {
      const url = StorageService.getDocumentDownloadUrl('doc-123');
      expect(url).toBe('http://localhost:3002/api/storage/documents/doc-123/download');
    });
  });
});
