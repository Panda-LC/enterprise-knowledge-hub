import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './StorageService';
import type { YuqueSourceConfig, ExportTask, FileSystemItem } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('语雀配置 API 调用', () => {
    it('应该调用后端 API 保存语雀配置', async () => {
      const configs: YuqueSourceConfig[] = [
        {
          id: 'test-1',
          name: '测试知识库',
          baseUrl: 'https://test.yuque.com',
          groupLogin: 'test-group',
          bookSlug: 'test-book',
          token: 'test-token',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveYuqueConfigs(configs);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/configs/yuque',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: { configs } }),
        })
      );
    });

    it('应该调用后端 API 加载语雀配置', async () => {
      const configs: YuqueSourceConfig[] = [
        {
          id: 'test-1',
          name: '测试知识库',
          baseUrl: 'https://test.yuque.com',
          groupLogin: 'test-group',
          bookSlug: 'test-book',
          token: 'test-token',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { configs } }),
      });

      const loaded = await StorageService.loadYuqueConfigs();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/configs/yuque',
        expect.any(Object)
      );
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-1');
    });

    it('应该处理加载失败返回空数组', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const loaded = await StorageService.loadYuqueConfigs();
      expect(loaded).toEqual([]);
    });
  });

  describe('导出任务 API 调用', () => {
    it('应该调用后端 API 保存导出任务', async () => {
      const tasks: ExportTask[] = [
        {
          id: 'task-1',
          name: '测试任务',
          sourceId: 'source-1',
          sourceName: '测试源',
          triggerType: 'manual',
          status: 'idle',
          createdAt: new Date().toISOString(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveExportTasks(tasks);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/configs/tasks',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('文件系统数据 API 调用', () => {
    it('应该调用后端 API 保存文件系统项', async () => {
      const items: FileSystemItem[] = [
        {
          id: 'item-1',
          title: '测试文档',
          type: 'MD' as any,
          parentId: null,
          updated_at: new Date().toISOString(),
          owner_name: '测试用户',
          size: 1024,
          status: 'Active' as any,
          sync_status: 'Synced',
          tags: ['test'],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveFileSystemItems(items);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/storage/configs/items',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('文档内容 API 调用', () => {
    it('应该调用后端 API 保存文档内容', async () => {
      const docId = 'doc-123';
      const content = { body: '# 测试文档\n\n这是测试内容' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await StorageService.saveDocumentContent(docId, content);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/storage/documents/${docId}`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('应该调用后端 API 加载文档内容', async () => {
      const docId = 'doc-123';
      const content = { body: '# 测试文档' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content }),
      });

      const loaded = await StorageService.loadDocumentContent(docId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/storage/documents/${docId}`,
        expect.any(Object)
      );
      expect(loaded).toEqual(content);
    });

    it('应该处理不存在的文档返回 null', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Not found'));

      const loaded = await StorageService.loadDocumentContent('non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('资源 URL 生成', () => {
    it('应该生成正确的资源 URL', () => {
      const url = StorageService.getAssetUrl('source-1', 'doc-1', 'image.png');
      expect(url).toBe('http://localhost:3002/api/storage/assets/source-1/doc-1/image.png');
    });

    it('应该生成正确的文档下载 URL', () => {
      const url = StorageService.getDocumentDownloadUrl('doc-123');
      expect(url).toBe('http://localhost:3002/api/storage/documents/doc-123/download');
    });
  });
});
