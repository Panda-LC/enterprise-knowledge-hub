/**
 * HtmlGeneratorService 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HtmlGeneratorService } from './HtmlGeneratorService';
import { ImageEmbedderService } from './ImageEmbedderService';

// Mock fetch
global.fetch = vi.fn();

describe('HtmlGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateHtml', () => {
    it('应该生成包含内嵌图片和样式的 HTML 文件', async () => {
      const docId = 'test-doc-1';
      const content = '<p>测试内容</p><img src="http://example.com/image.png" />';
      const sourceId = 'test-source';
      const title = '测试文档';

      // Mock ImageEmbedderService.embedImages
      vi.spyOn(ImageEmbedderService, 'embedImages').mockResolvedValue(
        '<p>测试内容</p><img src="data:image/png;base64,abc123" />'
      );

      // Mock fetch for saving HTML file
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: `data/documents/${docId}.html` }),
      });

      const result = await HtmlGeneratorService.generateHtml(
        docId,
        content,
        sourceId,
        title
      );

      expect(result).toBe(`data/documents/${docId}.html`);
      expect(ImageEmbedderService.embedImages).toHaveBeenCalledWith(
        content,
        sourceId,
        docId
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/storage/documents/${docId}/html`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('应该在 HTML 中添加响应式样式', async () => {
      const docId = 'test-doc-2';
      const content = '<p>测试内容</p>';
      const sourceId = 'test-source';
      const title = '测试文档';

      // Mock ImageEmbedderService.embedImages
      vi.spyOn(ImageEmbedderService, 'embedImages').mockResolvedValue(content);

      // Capture the HTML content sent to the server
      let savedHtml = '';
      (global.fetch as any).mockImplementationOnce(async (url: string, options: any) => {
        const body = JSON.parse(options.body);
        savedHtml = body.content;
        return {
          ok: true,
          json: async () => ({ path: `data/documents/${docId}.html` }),
        };
      });

      await HtmlGeneratorService.generateHtml(docId, content, sourceId, title);

      // 验证 HTML 包含必要的元素
      expect(savedHtml).toContain('<!DOCTYPE html>');
      expect(savedHtml).toContain('<html lang="zh-CN">');
      expect(savedHtml).toContain('<meta charset="UTF-8">');
      expect(savedHtml).toContain('<meta name="viewport"');
      expect(savedHtml).toContain(`<title>${title}</title>`);
      expect(savedHtml).toContain('<style>');
      expect(savedHtml).toContain('max-width: 100%');
      expect(savedHtml).toContain('overflow-x: auto');
      expect(savedHtml).toContain(content);
    });

    it('应该处理保存失败的情况', async () => {
      const docId = 'test-doc-3';
      const content = '<p>测试内容</p>';
      const sourceId = 'test-source';

      // Mock ImageEmbedderService.embedImages
      vi.spyOn(ImageEmbedderService, 'embedImages').mockResolvedValue(content);

      // Mock fetch to fail
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: '保存失败' }),
      });

      await expect(
        HtmlGeneratorService.generateHtml(docId, content, sourceId)
      ).rejects.toThrow('保存 HTML 文件失败');
    });
  });

  describe('htmlFileExists', () => {
    it('应该检查 HTML 文件是否存在', async () => {
      const docId = 'test-doc-4';

      // Mock fetch to return success
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const exists = await HtmlGeneratorService.htmlFileExists(docId);

      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/storage/documents/${docId}/html`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('应该返回 false 当文件不存在时', async () => {
      const docId = 'test-doc-5';

      // Mock fetch to return 404
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const exists = await HtmlGeneratorService.htmlFileExists(docId);

      expect(exists).toBe(false);
    });
  });

  describe('readHtmlFile', () => {
    it('应该读取 HTML 文件内容', async () => {
      const docId = 'test-doc-6';
      const htmlContent = '<html><body>测试内容</body></html>';

      // Mock fetch to return HTML content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: htmlContent }),
      });

      const result = await HtmlGeneratorService.readHtmlFile(docId);

      expect(result).toBe(htmlContent);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/storage/documents/${docId}/html`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('应该处理文件不存在的情况', async () => {
      const docId = 'test-doc-7';

      // Mock fetch to return 404
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        HtmlGeneratorService.readHtmlFile(docId)
      ).rejects.toThrow('读取 HTML 文件失败');
    });
  });
});
