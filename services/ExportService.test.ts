import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from './ExportService';
import { StorageService } from './StorageService';
import type { YuqueSourceConfig } from '../types';

// Mock StorageService
vi.mock('./StorageService', () => ({
  StorageService: {
    saveDocumentContent: vi.fn().mockResolvedValue(undefined),
    saveAsset: vi.fn().mockResolvedValue('path/to/asset'),
    getAssetUrl: vi.fn((sourceId, docId, filename) => 
      `http://localhost:3002/api/storage/assets/${sourceId}/${docId}/${filename}`
    ),
  },
}));

describe('ExportService', () => {
  let config: YuqueSourceConfig;
  let mockFileSystemContext: any;
  let mockLogCallback: any;

  beforeEach(() => {
    config = {
      id: 'test-1',
      name: '测试知识库',
      baseUrl: 'https://test.yuque.com',
      groupLogin: 'test-group',
      bookSlug: 'test-book',
      token: 'test-token',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    mockFileSystemContext = {
      addFolder: vi.fn().mockReturnValue('folder-id'),
      addDocument: vi.fn(),
      getItem: vi.fn(),
      items: [],
    };

    mockLogCallback = vi.fn();
    
    // Reset StorageService mocks
    vi.clearAllMocks();
  });

  describe('导出流程', () => {
    it('应该创建 ExportService 实例', () => {
      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );
      expect(service).toBeDefined();
    });

    it('应该在导出失败时记录错误日志', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      const result = await service.export();
      expect(result.success).toBe(false);
      // 验证有错误日志被记录
      const errorCalls = mockLogCallback.mock.calls.filter(
        (call: any) => call[1] === 'Error'
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });

    it('应该在成功导出时记录成功日志', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      const result = await service.export();
      expect(mockLogCallback).toHaveBeenCalled();
    });
  });

  describe('TOC 解析', () => {
    it('应该正确解析 TOC 层级结构', async () => {
      const mockToc = [
        {
          uuid: 'node-1',
          type: 'TITLE',
          title: '文件夹1',
          depth: 0,
        },
        {
          uuid: 'node-2',
          type: 'DOC',
          title: '文档1',
          doc_id: 123,
          slug: 'doc-1',
          parent_uuid: 'node-1',
          depth: 1,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: mockToc }),
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();
      expect(mockFileSystemContext.addFolder).toHaveBeenCalled();
    });
  });

  describe('文档处理', () => {
    it('应该处理 Markdown 格式文档', async () => {
      const mockDoc = {
        id: 123,
        slug: 'test-doc',
        title: '测试文档',
        format: 'markdown',
        body: '# 标题\n\n内容',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { name: '测试用户', login: 'test' },
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: mockDoc }),
        });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();
    });

    it('应该处理 HTML 格式文档', async () => {
      const mockDoc = {
        id: 124,
        slug: 'test-doc-html',
        title: '测试 HTML 文档',
        format: 'lake',
        body_html: '<h1>标题</h1><p>内容</p>',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { name: '测试用户', login: 'test' },
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: mockDoc }),
        });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();
    });
  });

  describe('部分失败处理', () => {
    it('应该在部分文档失败时继续处理其他文档', async () => {
      const mockToc = [
        {
          uuid: 'node-1',
          type: 'DOC',
          title: '文档1',
          doc_id: 123,
          slug: 'doc-1',
          depth: 0,
        },
        {
          uuid: 'node-2',
          type: 'DOC',
          title: '文档2',
          doc_id: 124,
          slug: 'doc-2',
          depth: 0,
        },
      ];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockToc }),
          });
        }
        if (callCount === 2) {
          return Promise.reject(new Error('Failed to fetch doc 1'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 124,
              slug: 'doc-2',
              title: '文档2',
              format: 'markdown',
              body: '内容',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user: { name: '测试', login: 'test' },
            },
          }),
        });
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      const result = await service.export();
      // 验证有错误日志被记录（部分文档失败）
      const errorCalls = mockLogCallback.mock.calls.filter(
        (call: any) => call[1] === 'Error'
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });
  });

  describe('资源处理', () => {
    it('应该下载并保存 Markdown 文档中的图片', async () => {
      const mockDoc = {
        id: 125,
        slug: 'doc-with-image',
        title: '带图片的文档',
        format: 'markdown',
        body: '# 标题\n\n![图片](https://example.com/image.png)\n\n内容',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { name: '测试用户', login: 'test' },
      };

      const mockToc = [
        {
          uuid: 'node-1',
          type: 'DOC',
          title: '带图片的文档',
          doc_id: 125,
          slug: 'doc-with-image',
          depth: 0,
        },
      ];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockToc }),
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockDoc }),
          });
        }
        // Mock image download
        if (url === 'https://example.com/image.png') {
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: async () => new Blob(['fake-image-data'], { type: 'image/png' }),
          });
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();

      // 验证 saveAsset 被调用
      expect(StorageService.saveAsset).toHaveBeenCalledWith(
        'test-1',
        '125',
        'image.png',
        expect.any(Blob)
      );

      // 验证 saveDocumentContent 被调用，且内容包含本地 URL
      expect(StorageService.saveDocumentContent).toHaveBeenCalled();
      const savedContent = (StorageService.saveDocumentContent as any).mock.calls[0][1];
      expect(savedContent.body).toContain('http://localhost:3002/api/storage/assets');
    });

    it('应该在资源下载失败时保留原始链接', async () => {
      const mockDoc = {
        id: 126,
        slug: 'doc-with-broken-image',
        title: '带损坏图片的文档',
        format: 'markdown',
        body: '# 标题\n\n![图片](https://example.com/broken.png)\n\n内容',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { name: '测试用户', login: 'test' },
      };

      const mockToc = [
        {
          uuid: 'node-1',
          type: 'DOC',
          title: '带损坏图片的文档',
          doc_id: 126,
          slug: 'doc-with-broken-image',
          depth: 0,
        },
      ];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockToc }),
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockDoc }),
          });
        }
        // Mock image download failure
        if (url === 'https://example.com/broken.png') {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          });
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();

      // 验证 saveDocumentContent 被调用，且内容保留原始 URL
      expect(StorageService.saveDocumentContent).toHaveBeenCalled();
      const savedContent = (StorageService.saveDocumentContent as any).mock.calls[0][1];
      expect(savedContent.body).toContain('https://example.com/broken.png');

      // 验证有错误日志被记录
      const errorCalls = mockLogCallback.mock.calls.filter(
        (call: any) => call[1] === 'Error'
      );
      expect(errorCalls.length).toBeGreaterThan(0);
    });

    it('应该处理 HTML 文档中的图片', async () => {
      const mockDoc = {
        id: 127,
        slug: 'html-doc-with-image',
        title: 'HTML 文档带图片',
        format: 'lake',
        body_html: '<h1>标题</h1><img src="https://example.com/image.jpg" /><p>内容</p>',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: { name: '测试用户', login: 'test' },
      };

      const mockToc = [
        {
          uuid: 'node-1',
          type: 'DOC',
          title: 'HTML 文档带图片',
          doc_id: 127,
          slug: 'html-doc-with-image',
          depth: 0,
        },
      ];

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockToc }),
          });
        }
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: mockDoc }),
          });
        }
        // Mock image download
        if (url === 'https://example.com/image.jpg') {
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: async () => new Blob(['fake-image-data'], { type: 'image/jpeg' }),
          });
        }
        return Promise.reject(new Error('Unexpected fetch call'));
      });

      const service = new ExportService(
        config,
        mockFileSystemContext,
        mockLogCallback
      );

      await service.export();

      // 验证 saveAsset 被调用
      expect(StorageService.saveAsset).toHaveBeenCalledWith(
        'test-1',
        '127',
        'image.jpg',
        expect.any(Blob)
      );

      // 验证 saveDocumentContent 被调用，且内容包含本地 URL
      expect(StorageService.saveDocumentContent).toHaveBeenCalled();
      const savedContent = (StorageService.saveDocumentContent as any).mock.calls[0][1];
      expect(savedContent.body_html).toContain('http://localhost:3002/api/storage/assets');
    });
  });
});
