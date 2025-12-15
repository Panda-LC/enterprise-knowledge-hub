import { YuqueSourceConfig, YuqueTocNode, FileSystemItem, FileType, DocStatus } from '../types';
import { YuqueApiService } from './YuqueApiService';
import { StorageService } from './StorageService';
import { HtmlGeneratorService } from './HtmlGeneratorService';

interface FileSystemContextType {
  items: FileSystemItem[];
  createFolder: (name: string, parentId: string | null) => void;
  addFolder: (folder: Omit<FileSystemItem, 'id'> & { id?: string }) => string;
  addDocument: (doc: Omit<FileSystemItem, 'id'> & { id?: string }) => string;
  updateItem: (id: string, updates: Partial<FileSystemItem>) => void;
  getPath: (itemId: string) => FileSystemItem[];
  getItem: (id: string) => FileSystemItem | undefined;
}

type LogCallback = (message: string, status: 'Success' | 'Error' | 'Info') => void;

export class ExportService {
  private apiService: YuqueApiService;
  private fileSystemContext: FileSystemContextType;
  private logCallback: LogCallback;
  private sourceId: string;

  constructor(
    config: YuqueSourceConfig,
    fileSystemContext: FileSystemContextType,
    logCallback: LogCallback
  ) {
    this.apiService = new YuqueApiService(config);
    this.fileSystemContext = fileSystemContext;
    this.logCallback = logCallback;
    this.sourceId = config.id;
  }

  // ============ Main Export Flow ============

  async export(): Promise<{ success: boolean; message: string }> {
    try {
      this.logCallback('开始导出流程...', 'Info');

      // Step 1: Fetch and parse TOC
      this.logCallback('正在获取目录结构...', 'Info');
      const tocMap = await this.fetchAndParseToc();
      this.logCallback(`成功获取 ${tocMap.size} 个目录节点`, 'Success');

      // Step 2: Create folder structure
      this.logCallback('正在创建文件夹结构...', 'Info');
      const folderMap = await this.createFolderStructure(tocMap);
      this.logCallback(`成功创建 ${folderMap.size} 个文件夹`, 'Success');

      // Step 3: Export documents
      this.logCallback('正在导出文档...', 'Info');
      await this.exportDocuments(tocMap, folderMap);

      this.logCallback('导出完成！', 'Success');
      return { success: true, message: '导出成功' };
    } catch (error) {
      let errorMsg = '未知错误';
      
      if (error instanceof Error) {
        errorMsg = error.message;
        
        // Provide more context for common errors
        if (errorMsg.includes('令牌')) {
          errorMsg = '访问令牌无效或已过期，请更新语雀配置';
        } else if (errorMsg.includes('权限')) {
          errorMsg = '无权限访问知识库，请检查配置和权限设置';
        } else if (errorMsg.includes('CORS') || errorMsg.includes('跨域')) {
          errorMsg = 'CORS 跨域错误，请确保代理服务器正在运行';
        } else if (errorMsg.includes('存储空间')) {
          errorMsg = '存储空间不足，请清理旧数据后重试';
        } else if (errorMsg.includes('网络') || errorMsg.includes('timeout')) {
          errorMsg = '网络连接失败或超时，请检查网络连接';
        }
      }
      
      this.logCallback(`导出失败: ${errorMsg}`, 'Error');
      return { success: false, message: errorMsg };
    }
  }

  // ============ Step 1: Fetch and Parse TOC ============

  private async fetchAndParseToc(): Promise<Map<string, YuqueTocNode>> {
    const tocNodes = await this.apiService.getToc();
    const tocMap = new Map<string, YuqueTocNode>();
    
    tocNodes.forEach(node => {
      tocMap.set(node.uuid, node);
    });

    return tocMap;
  }

  // ============ Step 2: Create Folder Structure ============

  private async createFolderStructure(
    tocMap: Map<string, YuqueTocNode>
  ): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>();
    
    // Create root folder for this Yuque source
    const rootFolderId = `yuque_root_${this.sourceId}`;
    
    // Check if root folder already exists, if not create it
    const existingRoot = this.fileSystemContext.getItem(rootFolderId);
    if (!existingRoot) {
      this.fileSystemContext.addFolder({
        id: rootFolderId,
        parentId: null,
        title: `Yuque - ${this.sourceId}`,
        type: FileType.FOLDER,
        updated_at: new Date().toISOString().split('T')[0],
        owner_name: 'Yuque',
        itemCount: 0,
        yuqueSourceId: this.sourceId
      });
    }
    
    // Process TITLE nodes (folders) in TOC
    const titleNodes = Array.from(tocMap.values()).filter(node => node.type === 'TITLE');
    
    // Sort by depth to create parent folders first
    titleNodes.sort((a, b) => a.depth - b.depth);

    for (const node of titleNodes) {
      const parentFolderId = node.parent_uuid 
        ? folderMap.get(node.parent_uuid) || rootFolderId
        : rootFolderId;

      const folderId = `yuque_folder_${this.sourceId}_${node.uuid}`;
      
      // Check if folder already exists
      const existingFolder = this.fileSystemContext.getItem(folderId);
      if (!existingFolder) {
        // Create folder in FileSystemContext using addFolder
        this.fileSystemContext.addFolder({
          id: folderId,
          parentId: parentFolderId,
          title: node.title,
          type: FileType.FOLDER,
          updated_at: new Date().toISOString().split('T')[0],
          owner_name: 'Yuque',
          itemCount: 0,
          yuqueSourceId: this.sourceId
        });
      }
      
      folderMap.set(node.uuid, folderId);
    }

    return folderMap;
  }

  // ============ Step 3: Export Documents ============

  private async exportDocuments(
    tocMap: Map<string, YuqueTocNode>,
    folderMap: Map<string, string>
  ): Promise<void> {
    const docNodes = Array.from(tocMap.values()).filter(node => node.type === 'DOC');
    
    let successCount = 0;
    let failCount = 0;
    const failedDocs: Array<{ title: string; error: string }> = [];

    for (const node of docNodes) {
      try {
        const folderId = node.parent_uuid 
          ? folderMap.get(node.parent_uuid) || `yuque_root_${this.sourceId}`
          : `yuque_root_${this.sourceId}`;

        await this.exportDocument(node, folderId);
        successCount++;
        this.logCallback(`导出文档: ${node.title}`, 'Success');
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        failedDocs.push({ title: node.title, error: errorMsg });
        
        // Log warning instead of error to continue processing
        this.logCallback(`导出文档失败 ${node.title}: ${errorMsg}`, 'Error');
        
        // Don't throw - continue with other documents
        console.error(`Failed to export document ${node.title}:`, error);
      }
    }

    // Summary log
    if (failCount > 0) {
      this.logCallback(
        `文档导出完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
        'Error'
      );
      
      // Log first few failed documents
      const maxToShow = 3;
      failedDocs.slice(0, maxToShow).forEach(doc => {
        this.logCallback(`  - ${doc.title}: ${doc.error}`, 'Info');
      });
      
      if (failedDocs.length > maxToShow) {
        this.logCallback(`  ... 还有 ${failedDocs.length - maxToShow} 个文档失败`, 'Info');
      }
    } else {
      this.logCallback(
        `文档导出完成: 成功 ${successCount} 个`,
        'Success'
      );
    }
  }

  // ============ Step 4: Export Single Document ============

  private async exportDocument(node: YuqueTocNode, folderId: string): Promise<void> {
    if (!node.slug) {
      throw new Error('文档缺少 slug');
    }

    // Get document details
    const doc = await this.apiService.getDoc(node.slug);

    // Determine file type
    const fileType = doc.format === 'markdown' ? FileType.MD : FileType.HTML;

    // Process assets and rewrite links
    // 对于 Lake 格式，优先使用 body_lake（真正的 HTML），否则使用 body_html 或 body
    const content = doc.format === 'lake' 
      ? (doc.body_lake || doc.body_html || doc.body || '')
      : (doc.body || doc.body_html || '');
    const processedContent = await this.processAssets(content, doc.id.toString(), doc.format);

    // Save document content with all required fields (需求 4.1, 4.2, 4.3, 4.4)
    const docId = `yuque_${this.sourceId}_${doc.id}`;
    await StorageService.saveDocumentContent(docId, {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      format: doc.format,
      body: doc.format === 'markdown' ? processedContent : doc.body,
      body_html: doc.format !== 'markdown' ? processedContent : doc.body_html,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      user: {
        name: doc.user.name,
        login: doc.user.login,
      },
    });

    // Generate HTML file with embedded images (需求 1.1, 2.1, 2.2, 2.3)
    try {
      this.logCallback(`正在生成 HTML 文件: ${doc.title}`, 'Info');
      
      // 使用处理后的内容生成 HTML
      const htmlContent = doc.format !== 'markdown' ? processedContent : doc.body_html || '';
      
      if (htmlContent) {
        await HtmlGeneratorService.generateHtml(
          docId,
          htmlContent,
          this.sourceId,
          doc.title
        );
        
        this.logCallback(`HTML 文件已生成: ${doc.title}`, 'Success');
        
        // Note: PDF generation is disabled in browser environment
        // PDF files should be generated on-demand when user requests download
      } else {
        this.logCallback(`跳过 HTML 生成（无内容）: ${doc.title}`, 'Info');
      }
    } catch (htmlError) {
      // HTML 生成失败，记录错误但不影响文档保存
      const htmlErrorMsg = htmlError instanceof Error ? htmlError.message : '未知错误';
      this.logCallback(`HTML 生成失败 ${doc.title}: ${htmlErrorMsg}`, 'Error');
      console.error(`HTML generation failed for ${doc.title}:`, htmlError);
      // 不抛出异常，文档 JSON 已保存
    }

    // Generate Word file (需求 5.1, 5.2, 5.3, 5.4)
    try {
      this.logCallback(`正在生成 Word 文件: ${doc.title}`, 'Info');
      
      // 使用 Markdown 内容生成 Word（body 字段）
      const markdownContent = doc.body || '';
      
      if (markdownContent) {
        const { MarkdownWordGeneratorService } = await import('./MarkdownWordGeneratorService');
        const wordGenerator = new MarkdownWordGeneratorService();
        const wordBuffer = await wordGenerator.generateWord(
          docId,
          markdownContent,
          this.sourceId,
          doc.title,
          {
            embedImages: true, // 明确启用图片内嵌
            timeout: 120000 // 2分钟超时（处理大文档）
          }
        );
        
        // 保存 Word 文件到后端
        await StorageService.saveDocxFile(docId, wordBuffer);
        
        this.logCallback(`Word 文件已生成: ${doc.title}`, 'Success');
      } else {
        this.logCallback(`跳过 Word 生成（无内容）: ${doc.title}`, 'Info');
      }
    } catch (wordError) {
      // Word 生成失败，记录错误但不影响文档保存（需求 5.2）
      const wordErrorMsg = wordError instanceof Error ? wordError.message : '未知错误';
      this.logCallback(`Word 生成失败 ${doc.title}: ${wordErrorMsg}`, 'Error');
      console.error(`Word generation failed for ${doc.title}:`, wordError);
      // 不抛出异常，继续处理其他格式（需求 5.2）
    }

    // Check if document already exists in FileSystemContext
    const existingDoc = this.fileSystemContext.getItem(docId);
    if (existingDoc) {
      // Update existing document
      this.fileSystemContext.updateItem(docId, {
        parentId: folderId,
        title: `${doc.title}.${fileType.toLowerCase()}`,
        updated_at: doc.updated_at,
        owner_name: doc.user.name,
        size: this.calculateSize(processedContent),
        sync_status: 'Synced',
      });
    } else {
      // Add new document to FileSystemContext using addDocument
      this.fileSystemContext.addDocument({
        id: docId,
        parentId: folderId,
        title: `${doc.title}.${fileType.toLowerCase()}`,
        type: fileType,
        updated_at: doc.updated_at,
        owner_name: doc.user.name,
        size: this.calculateSize(processedContent),
        status: DocStatus.ACTIVE,
        sync_status: 'Synced',
        tags: [`yuque:${this.sourceId}`],
        yuqueSourceId: this.sourceId,
        yuqueDocId: doc.id,
        yuqueSlug: doc.slug,
      });
    }
  }

  // ============ Helper Methods ============

  private calculateSize(content: string): string {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ============ Step 5: Process Assets ============

  private async processAssets(content: string, docId: string, format: string): Promise<string> {
    // Extract asset URLs from content
    const assetUrls = this.extractAssetUrls(content, format);
    
    if (assetUrls.length === 0) {
      return content;
    }

    let processedContent = content;
    let successCount = 0;
    let failCount = 0;

    // Download and save each asset
    for (const url of assetUrls) {
      try {
        // Extract filename from URL
        const filename = this.extractFilename(url);
        
        // Download asset
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Save asset using StorageService
        await StorageService.saveAsset(this.sourceId, docId, filename, blob);
        
        // Generate local URL
        const localUrl = StorageService.getAssetUrl(this.sourceId, docId, filename);
        
        // Rewrite link in content
        processedContent = processedContent.replace(
          new RegExp(this.escapeRegExp(url), 'g'),
          localUrl
        );
        
        successCount++;
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        
        // Log warning but keep original link
        console.warn(`Failed to download asset ${url}: ${errorMsg}`);
        this.logCallback(`资源下载失败 ${url}: ${errorMsg}`, 'Error');
        
        // Don't throw - continue with other assets and keep original link
      }
    }

    if (successCount > 0) {
      this.logCallback(`成功下载 ${successCount} 个资源`, 'Success');
    }
    if (failCount > 0) {
      this.logCallback(`${failCount} 个资源下载失败，保留原始链接`, 'Info');
    }

    return processedContent;
  }

  private extractAssetUrls(content: string, format: string): string[] {
    const urls: string[] = [];
    
    if (format === 'markdown') {
      // Match Markdown image syntax: ![alt](url)
      const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      while ((match = mdImageRegex.exec(content)) !== null) {
        const url = match[2];
        if (this.isExternalUrl(url)) {
          urls.push(url);
        }
      }
      
      // Match Markdown link syntax for attachments: [text](url)
      const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      while ((match = mdLinkRegex.exec(content)) !== null) {
        const url = match[2];
        if (this.isAssetUrl(url)) {
          urls.push(url);
        }
      }
    } else {
      // Match HTML img tags: <img src="url">
      const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/g;
      let match;
      while ((match = htmlImgRegex.exec(content)) !== null) {
        const url = match[1];
        if (this.isExternalUrl(url)) {
          urls.push(url);
        }
      }
      
      // Match HTML a tags for attachments: <a href="url">
      const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["']/g;
      while ((match = htmlLinkRegex.exec(content)) !== null) {
        const url = match[1];
        if (this.isAssetUrl(url)) {
          urls.push(url);
        }
      }
      
      // Extract URLs from Lake format <card> tags
      const cardRegex = /<card[^>]+value=["']data:([^"']+)["']/g;
      while ((match = cardRegex.exec(content)) !== null) {
        try {
          // Decode the URL-encoded JSON data
          const jsonStr = decodeURIComponent(match[1]);
          const cardData = JSON.parse(jsonStr);
          
          // Extract image URL from card data
          if (cardData.src && this.isExternalUrl(cardData.src)) {
            urls.push(cardData.src);
          }
        } catch (error) {
          // Ignore parsing errors for individual cards
          console.warn('Failed to parse card data:', error);
        }
      }
    }
    
    // Remove duplicates
    return Array.from(new Set(urls));
  }

  private isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  private isAssetUrl(url: string): boolean {
    if (!this.isExternalUrl(url)) {
      return false;
    }
    
    // Check if URL points to common asset file types
    const assetExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.gz'
    ];
    
    const lowerUrl = url.toLowerCase();
    return assetExtensions.some(ext => lowerUrl.includes(ext));
  }

  private extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'unknown';
      
      // Decode URL-encoded filename
      return decodeURIComponent(filename);
    } catch (error) {
      // If URL parsing fails, use a hash of the URL as filename
      const hash = this.simpleHash(url);
      const ext = url.split('.').pop()?.split('?')[0] || 'bin';
      return `asset_${hash}.${ext}`;
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
