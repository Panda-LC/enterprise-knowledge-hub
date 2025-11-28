import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageService } from './services/StorageService';
import type { FileSystemItem, FileType } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('文档预览和下载 - 端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('需求 1.1, 1.5: 文档内容预览', () => {
    it('应该能够加载并显示完整的 Markdown 文档内容', async () => {
      const docId = 'test-md-doc';
      const mockContent = {
        id: 123,
        title: '测试 Markdown 文档',
        format: 'markdown',
        body: '# 标题\n\n这是测试内容',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        user: {
          name: '测试用户',
          login: 'testuser'
        }
      };

      // Mock 文档内容加载
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: mockContent }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(loaded).toBeDefined();
      expect(loaded.body).toBe('# 标题\n\n这是测试内容');
      expect(loaded.format).toBe('markdown');
      expect(loaded.title).toBe('测试 Markdown 文档');
    });

    it('应该能够加载并显示完整的 HTML 文档内容', async () => {
      const docId = 'test-html-doc';
      const mockContent = {
        id: 456,
        title: '测试 HTML 文档',
        format: 'lake',
        body_html: '<h1>标题</h1><p>这是测试内容</p>',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        user: {
          name: '测试用户',
          login: 'testuser'
        }
      };

      // Mock 文档内容加载
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: mockContent }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(loaded).toBeDefined();
      expect(loaded.body_html).toBe('<h1>标题</h1><p>这是测试内容</p>');
      expect(loaded.format).toBe('lake');
      expect(loaded.title).toBe('测试 HTML 文档');
    });

    it('应该处理文档内容加载失败的情况', async () => {
      const docId = 'non-existent-doc';

      // Mock 加载失败
      (global.fetch as any).mockRejectedValueOnce(new Error('Document not found'));

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(loaded).toBeNull();
    });

    it('应该处理文档内容为空的情况', async () => {
      const docId = 'empty-doc';

      // Mock 空内容
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: null }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(loaded).toBeNull();
    });
  });

  describe('需求 2.1, 3.1, 3.3: 文档详情页下载', () => {
    it('应该能够从详情页下载 Markdown 文档', async () => {
      const docId = 'test-md-doc';
      const title = '测试文档';
      const format = 'markdown';
      const mockContent = '# 测试文档\n\n这是测试内容';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as any);
      
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 验证下载 URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/documents/${docId}/download?format=md`)
      );

      // 验证文件下载触发
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it('应该能够从详情页下载 HTML 文档', async () => {
      const docId = 'test-html-doc';
      const title = '测试文档';
      const format = 'lake';
      const mockContent = '<h1>测试文档</h1><p>这是测试内容</p>';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 验证下载 URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/documents/${docId}/download?format=html`)
      );

      // 验证文件下载触发
      expect(mockClick).toHaveBeenCalled();
    });

    it('应该正确清理文件名中的特殊字符', async () => {
      const docId = 'test-doc';
      const title = '测试/文档:特殊*字符?"<>|';
      const format = 'markdown';
      const mockContent = '# 测试';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      let downloadFilename = '';
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: vi.fn(),
        href: '',
        set download(value: string) {
          downloadFilename = value;
        },
        get download() {
          return downloadFilename;
        },
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 验证文件名不包含特殊字符
      expect(downloadFilename).not.toMatch(/[/\\:*?"<>|]/);
      expect(downloadFilename).toContain('.md');
    });

    it('应该处理下载失败的情况', async () => {
      const docId = 'test-doc';
      const title = '测试文档';
      const format = 'markdown';

      // Mock 下载失败
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: '文档不存在' }),
      });

      await expect(
        StorageService.downloadDocument(docId, title, format)
      ).rejects.toThrow();
    });
  });

  describe('需求 3.1, 3.4, 3.5: 资产库列表下载', () => {
    it('应该能够从列表页下载文档', async () => {
      const docId = 'list-doc';
      const title = '列表文档';
      const format = 'markdown';
      const mockContent = '# 列表文档内容';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      expect(mockClick).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/documents/${docId}/download`)
      );
    });

    it('应该使用正确的文件名和格式', async () => {
      const docId = 'format-test-doc';
      const title = '格式测试文档';
      const format = 'lake';
      const mockContent = '<h1>HTML 内容</h1>';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      let downloadFilename = '';
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: vi.fn(),
        href: '',
        set download(value: string) {
          downloadFilename = value;
        },
        get download() {
          return downloadFilename;
        },
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 验证文件扩展名
      expect(downloadFilename).toContain('.html');
      expect(downloadFilename).toContain('格式测试文档');
    });

    it('应该处理文档不存在的错误', async () => {
      const docId = 'non-existent';
      const title = '不存在的文档';
      const format = 'markdown';

      // Mock 404 错误
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: '文档不存在' }),
      });

      await expect(
        StorageService.downloadDocument(docId, title, format)
      ).rejects.toThrow('文档不存在');
    });
  });

  describe('需求 1.4: 图片 URL 重写', () => {
    it('应该生成正确的资源 URL', () => {
      const sourceId = 'yuque-source-1';
      const docId = 'doc-123';
      const filename = 'image.png';

      const url = StorageService.getAssetUrl(sourceId, docId, filename);

      expect(url).toBe('http://localhost:3002/api/storage/assets/yuque-source-1/doc-123/image.png');
    });

    it('应该正确编码文件名中的特殊字符', () => {
      const sourceId = 'source-1';
      const docId = 'doc-1';
      const filename = '图片 (1).png';

      const url = StorageService.getAssetUrl(sourceId, docId, filename);

      expect(url).toContain(encodeURIComponent('图片 (1).png'));
      expect(url).toContain('%E5%9B%BE%E7%89%87'); // '图片' encoded
    });

    it('应该处理中文文件名', () => {
      const sourceId = 'source-1';
      const docId = 'doc-1';
      const filename = '测试图片.jpg';

      const url = StorageService.getAssetUrl(sourceId, docId, filename);

      expect(url).toContain(encodeURIComponent('测试图片.jpg'));
    });
  });

  describe('完整流程测试', () => {
    it('应该完成从加载到下载的完整流程', async () => {
      const docId = 'full-flow-doc';
      const title = '完整流程测试';
      const mockContent = {
        id: 789,
        title: '完整流程测试',
        format: 'markdown',
        body: '# 完整流程\n\n测试内容',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        user: {
          name: '测试用户',
          login: 'testuser'
        }
      };

      // 步骤 1: 加载文档内容
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: mockContent }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);
      expect(loaded).toBeDefined();
      expect(loaded.body).toBe('# 完整流程\n\n测试内容');

      // 步骤 2: 下载文档
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => loaded.body,
      });

      // Mock DOM 操作
      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, 'markdown');

      expect(mockClick).toHaveBeenCalled();
    });

    it('应该处理包含图片的文档', async () => {
      const docId = 'doc-with-images';
      const sourceId = 'yuque-1';
      const mockContent = {
        id: 999,
        title: '包含图片的文档',
        format: 'markdown',
        body: '# 文档\n\n![图片](https://example.com/image.png)',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        user: {
          name: '测试用户',
          login: 'testuser'
        }
      };

      // 加载文档
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: mockContent }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);
      expect(loaded.body).toContain('![图片]');

      // 验证可以生成正确的资源 URL
      const assetUrl = StorageService.getAssetUrl(sourceId, docId, 'image.png');
      expect(assetUrl).toContain('/api/storage/assets/');
      expect(assetUrl).toContain(sourceId);
      expect(assetUrl).toContain(docId);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理网络超时', async () => {
      const docId = 'timeout-doc';

      // Mock 超时错误 - 需要 mock 所有重试次数
      (global.fetch as any)
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new TypeError('Network request failed'));

      const loaded = await StorageService.loadDocumentContent(docId);
      expect(loaded).toBeNull();
    }, 10000); // 增加超时时间以适应重试机制

    it('应该处理服务器错误', async () => {
      const docId = 'server-error-doc';

      // Mock 500 错误
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: '服务器内部错误' }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);
      expect(loaded).toBeNull();
    });

    it('应该处理空文件名', async () => {
      const docId = 'empty-title-doc';
      const title = '';
      const format = 'markdown';
      const mockContent = '# 内容';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      let downloadFilename = '';
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: vi.fn(),
        href: '',
        set download(value: string) {
          downloadFilename = value;
        },
        get download() {
          return downloadFilename;
        },
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 应该有默认文件名
      expect(downloadFilename).toContain('.md');
    });

    it('应该处理超长文件名', async () => {
      const docId = 'long-title-doc';
      const title = 'a'.repeat(300); // 超过 200 字符限制
      const format = 'markdown';
      const mockContent = '# 内容';

      // Mock 下载请求
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockContent,
      });

      // Mock DOM 操作
      let downloadFilename = '';
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: vi.fn(),
        href: '',
        set download(value: string) {
          downloadFilename = value;
        },
        get download() {
          return downloadFilename;
        },
      } as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await StorageService.downloadDocument(docId, title, format);

      // 文件名应该被截断
      expect(downloadFilename.length).toBeLessThan(210); // 200 + '.md'
    });
  });
});
