import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './services/StorageService';
import type { YuqueSourceConfig, ExportTask, FileSystemItem } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('语雀集成 - 端到端测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('配置流程测试', () => {
    it('应该能够完整保存和加载语雀配置', async () => {
      const config: YuqueSourceConfig = {
        id: 'test-1',
        name: '测试知识库',
        baseUrl: 'https://test.yuque.com',
        groupLogin: 'test-group',
        bookSlug: 'test-book',
        token: 'test-token-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
      };

      // Mock save
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // 保存配置
      await StorageService.saveYuqueConfigs([config]);

      // Mock load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { configs: [config] } }),
      });

      // 加载配置
      const loaded = await StorageService.loadYuqueConfigs();

      // 验证配置正确保存和加载
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-1');
      expect(loaded[0].name).toBe('测试知识库');
      expect(loaded[0].baseUrl).toBe('https://test.yuque.com');
      expect(loaded[0].status).toBe('active');
    });
  });

  describe('导出任务测试', () => {
    it('应该能够创建和保存导出任务', async () => {
      const task: ExportTask = {
        id: 'task-1',
        name: '测试导出任务',
        sourceId: 'source-1',
        sourceName: '测试知识库',
        triggerType: 'manual',
        status: 'idle',
        createdAt: new Date().toISOString(),
      };

      // Mock save
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveExportTasks([task]);

      // Mock load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tasks: [task] } }),
      });

      const loaded = await StorageService.loadExportTasks();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('测试导出任务');
      expect(loaded[0].triggerType).toBe('manual');
    });
  });

  describe('文档内容测试', () => {
    it('应该能够保存和加载文档内容', async () => {
      const docId = 'doc-123';
      const content = { body: '# 测试文档\n\n这是测试内容' };

      // Mock save
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveDocumentContent(docId, content);

      // Mock load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(loaded).toEqual(content);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理不存在的文档内容', async () => {
      // Mock fetch to return error
      (global.fetch as any).mockRejectedValueOnce(new Error('Not found'));
      
      const loaded = await StorageService.loadDocumentContent('non-existent-doc');
      expect(loaded).toBeNull();
    });

    it('应该处理加载配置失败', async () => {
      // Mock fetch to return error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const loaded = await StorageService.loadYuqueConfigs();
      expect(loaded).toEqual([]);
    });
  });

  describe('资源 URL 生成测试', () => {
    it('应该生成正确的资源 URL', () => {
      const url = StorageService.getAssetUrl('source-1', 'doc-1', 'image.png');
      expect(url).toBe('http://localhost:3002/api/storage/assets/source-1/doc-1/image.png');
    });

    it('应该生成正确的文档下载 URL', () => {
      const url = StorageService.getDocumentDownloadUrl('doc-123');
      expect(url).toBe('http://localhost:3002/api/storage/documents/doc-123/download');
    });

    it('应该正确编码文件名中的特殊字符', () => {
      const url = StorageService.getAssetUrl('source-1', 'doc-1', '图片 (1).png');
      expect(url).toContain(encodeURIComponent('图片 (1).png'));
    });
  });
});
