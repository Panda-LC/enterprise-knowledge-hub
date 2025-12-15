/**
 * ExportService Word 导出功能测试
 * 
 * 验证需求: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from './ExportService';
import { YuqueApiService } from './YuqueApiService';
import { StorageService } from './StorageService';
import { HtmlGeneratorService } from './HtmlGeneratorService';
import { WordGeneratorService } from './WordGeneratorService';
import { YuqueSourceConfig, FileSystemItem, FileType } from '../types';

describe('ExportService - Word 导出功能', () => {
  let mockConfig: YuqueSourceConfig;
  let mockFileSystemContext: any;
  let mockLogCallback: any;
  let exportService: ExportService;

  beforeEach(() => {
    // 清理所有 mock
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Mock 配置
    mockConfig = {
      id: 'test-source',
      name: '测试知识库',
      token: 'test-token',
      namespace: 'test-namespace',
      repoSlug: 'test-repo',
    };

    // Mock FileSystemContext
    mockFileSystemContext = {
      items: [] as FileSystemItem[],
      createFolder: vi.fn(),
      addFolder: vi.fn((folder) => {
        const id = folder.id || `folder-${Date.now()}`;
        mockFileSystemContext.items.push({ ...folder, id });
        return id;
      }),
      addDocument: vi.fn((doc) => {
        const id = doc.id || `doc-${Date.now()}`;
        mockFileSystemContext.items.push({ ...doc, id });
        return id;
      }),
      updateItem: vi.fn(),
      getPath: vi.fn(() => []),
      getItem: vi.fn((id) => mockFileSystemContext.items.find((item: FileSystemItem) => item.id === id)),
    };

    // Mock 日志回调
    mockLogCallback = vi.fn();

    // 创建 ExportService 实例
    exportService = new ExportService(mockConfig, mockFileSystemContext, mockLogCallback);
  });

  describe('批量导出 Word 格式', () => {
    it('应该在导出时生成 Word 文件（需求 5.1）', async () => {
      // Mock API 响应
      vi.spyOn(YuqueApiService.prototype, 'getToc').mockResolvedValue([
        {
          uuid: 'doc-1',
          type: 'DOC',
          title: '测试文档',
          slug: 'test-doc',
          depth: 0,
          parent_uuid: null,
        },
      ]);

      vi.spyOn(YuqueApiService.prototype, 'getDoc').mockResolvedValue({
        id: 1,
        slug: 'test-doc',
        title: '测试文档',
        format: 'lake',
        body: '<h1>测试标题</h1><p>测试内容</p>',
        body_html: '<h1>测试标题</h1><p>测试内容</p>',
        body_lake: '<h1>测试标题</h1><p>测试内容</p>',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user: {
          name: '测试用户',
          login: 'test-user',
        },
      });

      // Mock StorageService
      vi.spyOn(StorageService, 'saveDocumentContent').mockResolvedValue();
      vi.spyOn(StorageService, 'saveDocxFile').mockResolvedValue('data/documents/test-doc.docx');

      // Mock HtmlGeneratorService
      vi.spyOn(HtmlGeneratorService, 'generateHtml').mockResolvedValue('data/documents/test-doc.html');

      // Mock WordGeneratorService
      const mockBuffer = Buffer.from('mock word content');
      vi.spyOn(WordGeneratorService.prototype, 'generateWord').mockResolvedValue(mockBuffer);

      // 执行导出
      const result = await exportService.export();

      // 验证结果
      expect(result.success).toBe(true);
      expect(StorageService.saveDocxFile).toHaveBeenCalledWith(
        'yuque_test-source_1',
        mockBuffer
      );
      expect(mockLogCallback).toHaveBeenCalledWith(
        expect.stringContaining('Word 文件已生成'),
        'Success'
      );
    });

    it('应该在 Word 生成失败时继续处理其他格式（需求 5.2）', async () => {
      // Mock API 响应
      vi.spyOn(YuqueApiService.prototype, 'getToc').mockResolvedValue([
        {
          uuid: 'doc-1',
          type: 'DOC',
          title: '测试文档',
          slug: 'test-doc',
          depth: 0,
          parent_uuid: null,
        },
      ]);

      vi.spyOn(YuqueApiService.prototype, 'getDoc').mockResolvedValue({
        id: 1,
        slug: 'test-doc',
        title: '测试文档',
        format: 'lake',
        body: '<h1>测试标题</h1>',
        body_html: '<h1>测试标题</h1>',
        body_lake: '<h1>测试标题</h1>',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user: {
          name: '测试用户',
          login: 'test-user',
        },
      });

      // Mock StorageService
      vi.spyOn(StorageService, 'saveDocumentContent').mockResolvedValue();
      vi.spyOn(HtmlGeneratorService, 'generateHtml').mockResolvedValue('data/documents/test-doc.html');

      // Mock Word 生成失败
      vi.spyOn(WordGeneratorService.prototype, 'generateWord').mockRejectedValue(
        new Error('Word 生成失败')
      );

      // 执行导出
      const result = await exportService.export();

      // 验证：导出应该成功（尽管 Word 生成失败）
      expect(result.success).toBe(true);
      expect(StorageService.saveDocumentContent).toHaveBeenCalled();
      expect(HtmlGeneratorService.generateHtml).toHaveBeenCalled();
      expect(mockLogCallback).toHaveBeenCalledWith(
        expect.stringContaining('Word 生成失败'),
        'Error'
      );
    });

    it('应该记录 Word 生成状态（需求 5.3, 5.4）', async () => {
      // Mock API 响应
      vi.spyOn(YuqueApiService.prototype, 'getToc').mockResolvedValue([
        {
          uuid: 'doc-1',
          type: 'DOC',
          title: '测试文档',
          slug: 'test-doc',
          depth: 0,
          parent_uuid: null,
        },
      ]);

      vi.spyOn(YuqueApiService.prototype, 'getDoc').mockResolvedValue({
        id: 1,
        slug: 'test-doc',
        title: '测试文档',
        format: 'lake',
        body: '<h1>测试标题</h1>',
        body_html: '<h1>测试标题</h1>',
        body_lake: '<h1>测试标题</h1>',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user: {
          name: '测试用户',
          login: 'test-user',
        },
      });

      // Mock StorageService
      vi.spyOn(StorageService, 'saveDocumentContent').mockResolvedValue();
      vi.spyOn(StorageService, 'saveDocxFile').mockResolvedValue('data/documents/test-doc.docx');
      vi.spyOn(HtmlGeneratorService, 'generateHtml').mockResolvedValue('data/documents/test-doc.html');

      // Mock WordGeneratorService
      const mockBuffer = Buffer.from('mock word content');
      vi.spyOn(WordGeneratorService.prototype, 'generateWord').mockResolvedValue(mockBuffer);

      // 执行导出
      await exportService.export();

      // 验证日志记录
      expect(mockLogCallback).toHaveBeenCalledWith(
        '正在生成 Word 文件: 测试文档',
        'Info'
      );
      expect(mockLogCallback).toHaveBeenCalledWith(
        'Word 文件已生成: 测试文档',
        'Success'
      );
    });

    it('应该跳过空内容的 Word 生成', async () => {
      // Mock API 响应
      vi.spyOn(YuqueApiService.prototype, 'getToc').mockResolvedValue([
        {
          uuid: 'doc-1',
          type: 'DOC',
          title: '空文档',
          slug: 'empty-doc',
          depth: 0,
          parent_uuid: null,
        },
      ]);

      vi.spyOn(YuqueApiService.prototype, 'getDoc').mockResolvedValue({
        id: 1,
        slug: 'empty-doc',
        title: '空文档',
        format: 'lake',
        body: '',
        body_html: '',
        body_lake: '',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user: {
          name: '测试用户',
          login: 'test-user',
        },
      });

      // Mock StorageService
      vi.spyOn(StorageService, 'saveDocumentContent').mockResolvedValue();
      const saveDocxFileSpy = vi.spyOn(StorageService, 'saveDocxFile').mockResolvedValue('');

      // 执行导出
      await exportService.export();

      // 验证：不应该调用 saveDocxFile（因为内容为空）
      expect(saveDocxFileSpy).not.toHaveBeenCalled();
      expect(mockLogCallback).toHaveBeenCalledWith(
        '跳过 Word 生成（无内容）: 空文档',
        'Info'
      );
    });
  });

  describe('生成顺序', () => {
    it('应该按照 JSON → HTML → Word 的顺序生成（需求 5.1）', async () => {
      const callOrder: string[] = [];

      // Mock API 响应
      vi.spyOn(YuqueApiService.prototype, 'getToc').mockResolvedValue([
        {
          uuid: 'doc-1',
          type: 'DOC',
          title: '测试文档',
          slug: 'test-doc',
          depth: 0,
          parent_uuid: null,
        },
      ]);

      vi.spyOn(YuqueApiService.prototype, 'getDoc').mockResolvedValue({
        id: 1,
        slug: 'test-doc',
        title: '测试文档',
        format: 'lake',
        body: '<h1>测试</h1>',
        body_html: '<h1>测试</h1>',
        body_lake: '<h1>测试</h1>',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user: {
          name: '测试用户',
          login: 'test-user',
        },
      });

      // Mock StorageService
      vi.spyOn(StorageService, 'saveDocumentContent').mockImplementation(async () => {
        callOrder.push('JSON');
      });

      vi.spyOn(StorageService, 'saveDocxFile').mockImplementation(async () => {
        callOrder.push('Word');
        return '';
      });

      // Mock HtmlGeneratorService
      vi.spyOn(HtmlGeneratorService, 'generateHtml').mockImplementation(async () => {
        callOrder.push('HTML');
        return '';
      });

      // Mock WordGeneratorService
      vi.spyOn(WordGeneratorService.prototype, 'generateWord').mockResolvedValue(
        Buffer.from('mock')
      );

      // 执行导出
      await exportService.export();

      // 验证顺序
      expect(callOrder).toEqual(['JSON', 'HTML', 'Word']);
    });
  });
});
