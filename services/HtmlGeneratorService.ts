/**
 * HtmlGeneratorService - HTML 生成服务
 * 
 * 负责生成包含内嵌图片和响应式样式的 HTML 文件
 * 
 * 功能：
 * - 生成完整的 HTML 文档
 * - 添加响应式 CSS 样式
 * - 集成 ImageEmbedderService 内嵌图片
 * - 保存 HTML 文件到本地
 * - 日志记录和错误处理
 */

import { ImageEmbedderService } from './ImageEmbedderService';

const BASE_URL = 'http://localhost:3002/api/storage';

export class HtmlGeneratorService {
  private static convertLakeCardsToImages(html: string): string {
    if (!html) return html;
    return html.replace(/<card[^>]*>(?:[\s\S]*?<\/card>)?|<card[^>]*\/>/gi, (match) => {
      const valueMatch = match.match(/value=["']([^"']+)["']/i);
      if (!valueMatch) return match;
      let raw = valueMatch[1];
      try {
        let decoded = raw;
        try { decoded = decodeURIComponent(decoded); } catch {}
        if (decoded.startsWith('data:')) decoded = decoded.slice(5);
        decoded = decoded.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const obj = JSON.parse(decoded);
        const src = obj?.src || obj?.data?.src;
        if (!src || typeof src !== 'string') return match;
        const width = obj?.width || obj?.data?.width;
        const height = obj?.height || obj?.data?.height;
        const wAttr = typeof width === 'number' ? ` width="${Math.round(width)}"` : '';
        const hAttr = typeof height === 'number' ? ` height="${Math.round(height)}"` : '';
        return `<img src="${src}"${wAttr}${hAttr}>`;
      } catch {
        return match;
      }
    });
  }
  /**
   * 生成 HTML 文件
   * @param docId 文档 ID
   * @param content 文档内容（HTML 字符串）
   * @param sourceId 数据源 ID
   * @param title 文档标题（可选）
   * @returns 生成的 HTML 文件路径
   */
  static async generateHtml(
    docId: string,
    content: string,
    sourceId: string,
    title?: string
  ): Promise<string> {
    try {
      console.log(`开始生成 HTML 文件: ${docId}`);

      // 1. 内嵌图片
      console.log('正在处理图片...');
      const converted = this.convertLakeCardsToImages(content);
      const htmlWithImages = await ImageEmbedderService.embedImages(
        converted,
        sourceId,
        docId
      );

      // 2. 添加响应式样式
      console.log('正在添加响应式样式...');
      const styledHtml = this.addResponsiveStyles(htmlWithImages, title);

      // 3. 保存 HTML 文件
      console.log('正在保存 HTML 文件...');
      const filePath = await this.saveHtmlFile(docId, styledHtml);

      console.log(`HTML 文件已生成: ${filePath}`);
      return filePath;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`生成 HTML 文件失败 (${docId}):`, errorMsg);
      throw error;
    }
  }

  /**
   * 添加响应式 CSS 样式
   * @param html HTML 内容
   * @param title 文档标题（可选）
   * @returns 添加样式后的完整 HTML
   */
  private static addResponsiveStyles(html: string, title?: string): string {
    const styles = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || '文档'}</title>
  <style>
    /* 基础样式 */
    * {
      box-sizing: border-box;
    }

    body {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #fff;
    }

    /* 图片样式 */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em 0;
    }

    /* 表格样式 */
    table {
      max-width: 100%;
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      overflow-x: auto;
      display: block;
    }

    table thead {
      background-color: #f5f5f5;
    }

    table th,
    table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }

    table th {
      font-weight: 600;
    }

    /* 代码块样式 */
    pre {
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 1em 0;
    }

    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
      background-color: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
    }

    pre code {
      background-color: transparent;
      padding: 0;
    }

    /* 标题样式 */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }

    h1 {
      font-size: 2em;
      border-bottom: 2px solid #eee;
      padding-bottom: 0.3em;
    }

    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid #eee;
      padding-bottom: 0.3em;
    }

    h3 {
      font-size: 1.25em;
    }

    /* 段落样式 */
    p {
      margin: 1em 0;
    }

    /* 列表样式 */
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin: 0.5em 0;
    }

    /* 引用样式 */
    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 4px solid #ddd;
      background-color: #f9f9f9;
      color: #666;
    }

    /* 链接样式 */
    a {
      color: #0066cc;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    /* 水平线样式 */
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
      body {
        padding: 10px;
        font-size: 14px;
      }

      h1 {
        font-size: 1.5em;
      }

      h2 {
        font-size: 1.25em;
      }

      h3 {
        font-size: 1.1em;
      }

      table {
        font-size: 0.9em;
      }

      pre {
        font-size: 0.85em;
      }
    }

    @media (max-width: 480px) {
      body {
        padding: 8px;
        font-size: 13px;
      }

      table th,
      table td {
        padding: 6px 8px;
      }
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

    return styles;
  }

  /**
   * 保存 HTML 文件到本地
   * @param docId 文档 ID
   * @param html HTML 内容
   * @returns 文件路径
   */
  private static async saveHtmlFile(
    docId: string,
    html: string
  ): Promise<string> {
    try {
      const url = `${BASE_URL}/documents/${docId}/html`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: html }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.path || `data/documents/${docId}.html`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`保存 HTML 文件失败 (${docId}):`, errorMsg);
      throw new Error(`保存 HTML 文件失败: ${errorMsg}`);
    }
  }

  /**
   * 检查 HTML 文件是否存在
   * @param docId 文档 ID
   * @returns 文件是否存在
   */
  static async htmlFileExists(docId: string): Promise<boolean> {
    try {
      const url = `${BASE_URL}/documents/${docId}/html`;
      
      const response = await fetch(url, {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error(`检查 HTML 文件失败 (${docId}):`, error);
      return false;
    }
  }

  /**
   * 读取 HTML 文件内容
   * @param docId 文档 ID
   * @returns HTML 内容
   */
  static async readHtmlFile(docId: string): Promise<string> {
    try {
      const url = `${BASE_URL}/documents/${docId}/html`;
      
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.content || '';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`读取 HTML 文件失败 (${docId}):`, errorMsg);
      throw new Error(`读取 HTML 文件失败: ${errorMsg}`);
    }
  }
}
