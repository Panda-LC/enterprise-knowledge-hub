import { YuqueSourceConfig, ExportTask, FileSystemItem } from '../types';
import { HtmlGeneratorService } from './HtmlGeneratorService';
import { ImageEmbedderService } from './ImageEmbedderService';

const BASE_URL = 'http://localhost:3002/api/storage';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class StorageService {
  // ============ Generic Request Method ============
  
  private static async request<T>(
    url: string,
    options?: RequestInit,
    retries = 0
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Retry on network errors or timeouts
      if (retries < MAX_RETRIES && (
        error instanceof TypeError || // Network error
        (error instanceof Error && error.message.includes('timeout'))
      )) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retries); // Exponential backoff
        console.warn(`Request failed, retrying in ${delay}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(url, options, retries + 1);
      }
      
      // Log error and rethrow
      console.error('Storage API request failed:', error);
      throw error;
    }
  }

  // ============ Yuque Configs ============
  
  static async saveYuqueConfigs(configs: YuqueSourceConfig[]): Promise<void> {
    await this.request(`${BASE_URL}/configs/yuque`, {
      method: 'POST',
      body: JSON.stringify({ data: { configs } }),
    });
  }

  static async loadYuqueConfigs(): Promise<YuqueSourceConfig[]> {
    try {
      const response = await this.request<{ data: { configs: YuqueSourceConfig[] } }>(
        `${BASE_URL}/configs/yuque`
      );
      return response.data?.configs || [];
    } catch (error) {
      console.error('Failed to load Yuque configs:', error);
      return [];
    }
  }

  // ============ Export Tasks ============
  
  static async saveExportTasks(tasks: ExportTask[]): Promise<void> {
    await this.request(`${BASE_URL}/configs/tasks`, {
      method: 'POST',
      body: JSON.stringify({ data: { tasks } }),
    });
  }

  static async loadExportTasks(): Promise<ExportTask[]> {
    try {
      const response = await this.request<{ data: { tasks: ExportTask[] } }>(
        `${BASE_URL}/configs/tasks`
      );
      return response.data?.tasks || [];
    } catch (error) {
      console.error('Failed to load export tasks:', error);
      return [];
    }
  }

  // ============ FileSystem Items ============
  
  static async saveFileSystemItems(items: FileSystemItem[]): Promise<void> {
    await this.request(`${BASE_URL}/configs/items`, {
      method: 'POST',
      body: JSON.stringify({ data: { items } }),
    });
  }

  static async loadFileSystemItems(): Promise<FileSystemItem[]> {
    try {
      const response = await this.request<{ data: { items: FileSystemItem[] } }>(
        `${BASE_URL}/configs/items`
      );
      return response.data?.items || [];
    } catch (error) {
      console.error('Failed to load filesystem items:', error);
      return [];
    }
  }

  // ============ Document Content ============
  
  static async saveDocumentContent(docId: string, content: any): Promise<void> {
    await this.request(`${BASE_URL}/documents/${docId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  static async loadDocumentContent(docId: string): Promise<any | null> {
    try {
      const response = await this.request<{ content: any }>(
        `${BASE_URL}/documents/${docId}`
      );
      return response.content || null;
    } catch (error) {
      console.error(`Failed to load document content for ${docId}:`, error);
      return null;
    }
  }

  // ============ Assets ============
  
  static async saveAsset(
    sourceId: string,
    docId: string,
    filename: string,
    blob: Blob
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob, filename);

    try {
      const response = await fetch(
        `${BASE_URL}/assets/${sourceId}/${docId}/${filename}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.path || '';
    } catch (error) {
      console.error(`Failed to save asset ${filename}:`, error);
      throw error;
    }
  }

  static getAssetUrl(sourceId: string, docId: string, filename: string): string {
    return `${BASE_URL}/assets/${sourceId}/${docId}/${encodeURIComponent(filename)}`;
  }

  // ============ Document Download ============
  
  static getDocumentDownloadUrl(docId: string, format?: 'md' | 'html'): string {
    const url = `${BASE_URL}/documents/${docId}/download`;
    return format ? `${url}?format=${format}` : url;
  }

  /**
   * 下载格式化的文档文件
   * @param docId 文档 ID
   * @param title 文档标题
   * @param format 文档格式 ('markdown' 或 'lake')
   */
  static async downloadDocument(
    docId: string,
    title: string,
    format: 'markdown' | 'lake'
  ): Promise<void> {
    try {
      // 确定文件格式和扩展名
      const fileFormat = format === 'markdown' ? 'md' : 'html';
      const fileExtension = format === 'markdown' ? '.md' : '.html';
      
      // 清理文件名：移除不安全字符
      const safeTitle = title
        .replace(/[/\\:*?"<>|]/g, '-') // 替换不安全字符
        .replace(/\s+/g, '_') // 替换空格为下划线
        .substring(0, 200); // 限制长度
      
      const filename = `${safeTitle}${fileExtension}`;
      
      // 请求文档内容
      const url = this.getDocumentDownloadUrl(docId, fileFormat);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `下载失败: ${response.statusText}`);
      }
      
      // 获取文本内容
      const content = await response.text();
      
      // 创建 Blob 并触发下载
      const contentType = format === 'markdown' 
        ? 'text/markdown; charset=utf-8' 
        : 'text/html; charset=utf-8';
      
      const blob = new Blob([content], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      
      // 创建临时链接并触发下载
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  // ============ HTML/PDF File Operations ============

  /**
   * 检查文件是否存在
   * @param docId 文档 ID
   * @param format 文件格式（'html'、'pdf' 或 'md'）
   * @returns 文件是否存在
   */
  static async fileExists(
    docId: string,
    format: 'html' | 'pdf' | 'md'
  ): Promise<boolean> {
    try {
      const url = `${BASE_URL}/documents/${docId}/${format}`;
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error(`检查文件存在失败 (${docId}.${format}):`, error);
      return false;
    }
  }

  /**
   * 下载文档文件（HTML、PDF 或 Markdown）
   * @param docId 文档 ID
   * @param title 文档标题
   * @param format 文件格式（'html'、'pdf' 或 'md'）
   */
  static async downloadDocumentFile(
    docId: string,
    title: string,
    format: 'html' | 'pdf' | 'md'
  ): Promise<void> {
    try {
      console.log(`开始下载 ${format.toUpperCase()} 文件: ${docId}`);

      // 1. 检查本地是否存在文件（缓存逻辑）
      const exists = await this.fileExists(docId, format);
      
      let content: string | Blob;
      let contentType: string;
      let fileExtension: string;

      if (format === 'md') {
        // Markdown 格式：直接从 JSON 中提取 body 内容
        const docData = await this.loadDocumentContent(docId);
        if (!docData || !docData.body) {
          throw new Error('Markdown 内容不存在');
        }
        content = docData.body;
        contentType = 'text/markdown; charset=utf-8';
        fileExtension = '.md';
      } else if (exists) {
        // 2. 如果文件存在，直接下载
        console.log(`使用缓存的 ${format.toUpperCase()} 文件`);
        const url = `${BASE_URL}/documents/${docId}/download/${format}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`下载失败: ${response.statusText}`);
        }

        if (format === 'pdf') {
          content = await response.blob();
          contentType = 'application/pdf';
          fileExtension = '.pdf';
        } else {
          // HTML 文件直接返回文本内容
          content = await response.text();
          contentType = 'text/html; charset=utf-8';
          fileExtension = '.html';
        }
      } else {
        // 3. 如果文件不存在，动态生成并下载（回退逻辑）
        console.log(`本地不存在 ${format.toUpperCase()} 文件，动态生成中...`);
        
        if (format === 'html') {
          // 动态生成 HTML
          content = await this.generateHtmlOnTheFly(docId);
          contentType = 'text/html; charset=utf-8';
          fileExtension = '.html';
        } else {
          // PDF 暂不支持动态生成，直接抛出错误
          throw new Error('PDF 文件不存在，且无法动态生成');
        }
      }

      // 4. 触发浏览器下载
      // 移除标题中已有的扩展名，避免重复
      const titleWithoutExt = title.replace(/\.(html|pdf|md|markdown)$/i, '');
      const safeTitle = this.sanitizeFilename(titleWithoutExt);
      const filename = `${safeTitle}${fileExtension}`;

      const blob = typeof content === 'string'
        ? new Blob([content], { type: contentType })
        : content;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      console.log(`${format.toUpperCase()} 文件下载完成: ${filename}`);
    } catch (error) {
      console.error(`下载 ${format.toUpperCase()} 文件失败:`, error);
      throw error;
    }
  }

  /**
   * 动态生成 HTML（从 JSON）
   * @param docId 文档 ID
   * @returns HTML 内容
   */
  private static async generateHtmlOnTheFly(docId: string): Promise<string> {
    try {
      // 加载文档内容
      const doc = await this.loadDocumentContent(docId);
      if (!doc) {
        throw new Error('文档不存在');
      }

      // 获取文档的 HTML 内容
      const htmlContent = doc.body_html || doc.body || '';

      let sourceId = '';
      try {
        const items = await this.loadFileSystemItems();
        const item = items.find(i => i.id === docId);
        sourceId = item?.yuqueSourceId || '';
      } catch {}

      const processed = await ImageEmbedderService.embedImages(htmlContent, sourceId, docId);
      await HtmlGeneratorService.generateHtml(docId, processed, sourceId, doc.title);
      const finalHtml = await HtmlGeneratorService.readHtmlFile(docId);
      return finalHtml;
    } catch (error) {
      console.error('动态生成 HTML 失败:', error);
      throw new Error('动态生成 HTML 失败');
    }
  }

  /**
   * 动态生成 PDF（从 HTML）
   * @param docId 文档 ID
   * @returns PDF Blob
   */
  private static async generatePdfOnTheFly(docId: string): Promise<Blob> {
    try {
      // 调用后端 API 动态生成 PDF
      const url = `${BASE_URL}/documents/${docId}/generate/pdf`;
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'PDF 生成失败' }));
        throw new Error(errorData.error || 'PDF 生成失败');
      }

      return await response.blob();
    } catch (error) {
      console.error('动态生成 PDF 失败:', error);
      throw new Error('PDF 功能暂未启用或生成失败。请下载 HTML 格式，或等待后续版本支持。');
    }
  }

  /**
   * 清理文件名
   * @param filename 原始文件名
   * @returns 安全的文件名
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[/\\:*?"<>|]/g, '-') // 替换不安全字符
      .replace(/\s+/g, '_') // 替换空格为下划线
      .substring(0, 200); // 限制长度
  }

}
