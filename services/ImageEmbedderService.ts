/**
 * ImageEmbedderService - 图片内嵌服务
 * 
 * 负责将 HTML 中的图片 URL 转换为 Base64 Data URL，实现离线查看功能
 * 
 * 功能：
 * - 提取 HTML 中的图片 URL
 * - 下载远程图片或读取本地图片
 * - 转换为 Base64 编码
 * - 并发处理（最多 5 个并发）
 * - 错误处理和恢复
 * - 大文件警告和超时处理
 */

const BASE_URL = 'http://localhost:3002/api/storage';
const MAX_CONCURRENT = 5; // 最大并发数
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 30 * 1000; // 30 秒超时

export class ImageEmbedderService {
  /**
   * 内嵌图片到 HTML
   * @param html HTML 内容
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns 内嵌图片后的 HTML
   */
  static async embedImages(
    html: string,
    sourceId: string,
    docId: string
  ): Promise<string> {
    try {
      // 提取所有图片 URL
      const imageUrls = this.extractImageUrls(html);
      
      if (imageUrls.length === 0) {
        console.log('未找到需要处理的图片');
        return html;
      }

      console.log(`找到 ${imageUrls.length} 个图片，开始处理...`);

      // 并发处理图片（最多 5 个并发）
      const urlToBase64Map = await this.processImagesWithConcurrency(
        imageUrls,
        sourceId,
        docId
      );

      // 替换 HTML 中的图片 URL
      let processedHtml = html;
      let successCount = 0;
      let failCount = 0;

      for (const [originalUrl, base64Url] of urlToBase64Map.entries()) {
        if (base64Url) {
          // 成功转换，替换 URL
          // 需要同时替换编码和解码的版本，因为 HTML 中可能包含 URL 编码的 URL
          const escapedUrl = this.escapeRegExp(originalUrl);
          const encodedUrl = this.escapeRegExp(encodeURIComponent(originalUrl));
          
          // 先替换解码版本
          processedHtml = processedHtml.replace(
            new RegExp(escapedUrl, 'g'),
            base64Url
          );
          
          // 再替换编码版本（在 value 属性中）
          processedHtml = processedHtml.replace(
            new RegExp(encodedUrl, 'g'),
            base64Url
          );
          
          successCount++;
          console.log(`已替换图片 URL: ${originalUrl.substring(0, 80)}...`);
        } else {
          // 转换失败，保留原始 URL
          failCount++;
          console.warn(`图片转换失败，保留原始 URL: ${originalUrl}`);
        }
      }

      console.log(`图片处理完成: 成功 ${successCount} 个，失败 ${failCount} 个`);

      return processedHtml;
    } catch (error) {
      console.error('图片内嵌处理失败:', error);
      // 发生错误时返回原始 HTML
      return html;
    }
  }

  /**
   * 提取 HTML 中的图片 URL
   * @param html HTML 内容
   * @returns 图片 URL 数组
   */
  private static extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    
    // 1. 提取标准 <img> 标签的 src 属性
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1];
      // 只处理 http/https URL，跳过已经是 data: URL 的图片
      if ((url.startsWith('http://') || url.startsWith('https://')) && 
          !url.startsWith('data:')) {
        urls.push(url);
      }
    }
    
    // 2. 提取 <card> 标签中的图片 URL
    const cardUrls = this.extractCardImageUrls(html);
    urls.push(...cardUrls);
    
    console.log(`图片提取完成: 共提取 ${urls.length} 个 URL (img: ${urls.length - cardUrls.length}, card: ${cardUrls.length})`);
    
    // 3. 去重
    return Array.from(new Set(urls));
  }

  /**
   * 提取 <card> 标签中的图片 URL
   * @param html HTML 内容
   * @returns 图片 URL 数组
   */
  private static extractCardImageUrls(html: string): string[] {
    const urls: string[] = [];
    
    // 匹配 <card> 标签（包括自闭合和非自闭合）
    const cardRegex = /<card[^>]*>[\s\S]*?<\/card>|<card[^>]*\/>/gi;
    const matches = html.match(cardRegex);
    
    if (!matches) {
      console.log('未找到 <card> 标签');
      return urls;
    }
    
    console.log(`找到 ${matches.length} 个 <card> 标签`);
    
    for (const cardTag of matches) {
      // 1. 尝试从 value 属性提取
      const valueMatch = cardTag.match(/value=["']([^"']+)["']/i);
      if (valueMatch) {
        let valueAttr = valueMatch[1];
        console.log(`提取到 value 属性: ${valueAttr.substring(0, 100)}...`);
        
        // 先尝试 URL 解码（处理 %7B 这样的编码）
        try {
          valueAttr = decodeURIComponent(valueAttr);
          console.log(`URL 解码后: ${valueAttr.substring(0, 100)}...`);
          
          // 去掉 "data:" 前缀（如果存在）
          if (valueAttr.startsWith('data:')) {
            valueAttr = valueAttr.substring(5);
            console.log(`去掉 data: 前缀后: ${valueAttr.substring(0, 100)}...`);
          }
        } catch (e) {
          console.log('URL 解码失败，尝试 HTML 解码');
        }
        
        // HTML 解码
        const decodedValue = valueAttr
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        const url = this.extractUrlFromJson(decodedValue);
        if (url) {
          console.log(`从 value 属性提取到图片 URL: ${url}`);
          urls.push(url);
          continue; // 找到 URL 后跳过内部 img 标签检查
        }
      }
      
      // 2. 尝试从内部 <img> 标签提取
      const imgMatch = cardTag.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        const url = imgMatch[1];
        if (url.startsWith('http://') || url.startsWith('https://')) {
          console.log(`从 <card> 内部 <img> 标签提取到图片 URL: ${url}`);
          urls.push(url);
        }
      }
    }
    
    return urls;
  }

  /**
   * 从 JSON 字符串中提取图片 URL
   * @param jsonStr JSON 字符串
   * @returns 图片 URL 或 null
   */
  private static extractUrlFromJson(jsonStr: string): string | null {
    try {
      const data = JSON.parse(jsonStr);
      
      // 尝试不同的字段名
      const possibleFields = ['src', 'url'];
      
      // 直接字段
      for (const field of possibleFields) {
        if (data[field] && typeof data[field] === 'string') {
          const url = data[field];
          if (url.startsWith('http://') || url.startsWith('https://')) {
            console.log(`从 JSON 字段 "${field}" 提取到 URL: ${url}`);
            return url;
          }
        }
      }
      
      // 嵌套在 data 对象中
      if (data.data && typeof data.data === 'object') {
        for (const field of possibleFields) {
          if (data.data[field] && typeof data.data[field] === 'string') {
            const url = data.data[field];
            if (url.startsWith('http://') || url.startsWith('https://')) {
              console.log(`从 JSON 嵌套字段 "data.${field}" 提取到 URL: ${url}`);
              return url;
            }
          }
        }
      }
      
      console.log('JSON 中未找到有效的图片 URL');
      return null;
    } catch (error) {
      console.warn('JSON 解析失败:', error, '原始内容:', jsonStr.substring(0, 100));
      return null;
    }
  }

  /**
   * 并发处理图片（限制并发数）
   * @param urls 图片 URL 数组
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns URL 到 Base64 的映射
   */
  private static async processImagesWithConcurrency(
    urls: string[],
    sourceId: string,
    docId: string
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const queue = [...urls];
    const processing: Promise<void>[] = [];

    // 处理单个图片的函数
    const processImage = async (url: string): Promise<void> => {
      try {
        const base64Url = await this.getImageBase64(url, sourceId, docId);
        results.set(url, base64Url);
      } catch (error) {
        console.error(`处理图片失败 ${url}:`, error);
        results.set(url, null);
      }
    };

    // 并发处理，最多 MAX_CONCURRENT 个
    while (queue.length > 0 || processing.length > 0) {
      // 启动新任务直到达到并发限制
      while (processing.length < MAX_CONCURRENT && queue.length > 0) {
        const url = queue.shift()!;
        const promise = processImage(url).then(() => {
          // 任务完成后从处理列表中移除
          const index = processing.indexOf(promise);
          if (index > -1) {
            processing.splice(index, 1);
          }
        });
        processing.push(promise);
      }

      // 等待至少一个任务完成
      if (processing.length > 0) {
        await Promise.race(processing);
      }
    }

    return results;
  }

  /**
   * 获取图片的 Base64 编码
   * @param url 图片 URL
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns Base64 Data URL
   */
  private static async getImageBase64(
    url: string,
    sourceId: string,
    docId: string
  ): Promise<string | null> {
    try {
      // 首先尝试从本地资源读取
      const localBase64 = await this.tryGetLocalImage(url, sourceId, docId);
      if (localBase64) {
        return localBase64;
      }

      // 本地不存在，下载远程图片
      return await this.downloadAndConvertImage(url);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.warn(`获取图片 Base64 失败 ${url}: ${errorMsg}`);
      return null;
    }
  }

  /**
   * 尝试从本地资源读取图片
   * @param url 原始图片 URL
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * @returns Base64 Data URL 或 null
   */
  private static async tryGetLocalImage(
    url: string,
    sourceId: string,
    docId: string
  ): Promise<string | null> {
    try {
      // 从 URL 提取文件名
      const filename = this.extractFilename(url);
      
      // 构建本地资源 URL
      const localUrl = `${BASE_URL}/assets/${sourceId}/${docId}/${encodeURIComponent(filename)}`;
      
      // 尝试获取本地资源
      const response = await fetch(localUrl);
      
      if (response.ok) {
        const blob = await response.blob();
        
        // 检查文件大小
        if (blob.size > LARGE_FILE_THRESHOLD) {
          console.warn(`图片文件过大 (${(blob.size / 1024 / 1024).toFixed(2)} MB): ${filename}`);
        }
        
        return await this.blobToBase64(blob, filename);
      }
      
      return null;
    } catch (error) {
      // 本地读取失败，返回 null 以便尝试下载
      return null;
    }
  }

  /**
   * 下载远程图片并转换为 Base64
   * @param url 图片 URL
   * @returns Base64 Data URL
   */
  private static async downloadAndConvertImage(url: string): Promise<string | null> {
    try {
      // 创建超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        // 使用代理服务器下载图片以避免 CORS 问题
        const proxyUrl = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(url)}`;
        console.log(`通过代理下载图片: ${url}`);
        
        const response = await fetch(proxyUrl, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();

        // 检查文件大小
        if (blob.size > LARGE_FILE_THRESHOLD) {
          console.warn(`图片文件过大 (${(blob.size / 1024 / 1024).toFixed(2)} MB): ${url}`);
        }

        const filename = this.extractFilename(url);
        return await this.blobToBase64(blob, filename);
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`图片下载超时 (${TIMEOUT_MS / 1000}秒): ${url}`);
          return null;
        }
        
        throw error;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.warn(`下载图片失败 ${url}: ${errorMsg}`);
      return null;
    }
  }

  /**
   * 将 Blob 转换为 Base64 Data URL
   * @param blob Blob 对象
   * @param filename 文件名（用于确定 MIME 类型）
   * @returns Base64 Data URL
   */
  private static async blobToBase64(blob: Blob, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const result = reader.result as string;
        
        // 如果 Blob 已经有正确的 MIME 类型，直接使用
        if (blob.type && blob.type.startsWith('image/')) {
          resolve(result);
          return;
        }
        
        // 否则根据文件名推断 MIME 类型
        const mimeType = this.getMimeType(filename);
        const base64Data = result.split(',')[1];
        resolve(`data:${mimeType};base64,${base64Data}`);
      };
      
      reader.onerror = () => {
        reject(new Error('Base64 转换失败'));
      };
      
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   * @param filename 文件名
   * @returns MIME 类型
   */
  private static getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || '';
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',
    };
    
    return mimeTypes[ext] || 'image/png'; // 默认使用 image/png
  }

  /**
   * 从 URL 提取文件名
   * @param url 图片 URL
   * @returns 文件名
   */
  private static extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'unknown.png';
      
      // 解码 URL 编码的文件名
      return decodeURIComponent(filename);
    } catch (error) {
      // URL 解析失败，使用 URL 的哈希值作为文件名
      const hash = this.simpleHash(url);
      const ext = url.split('.').pop()?.split('?')[0] || 'png';
      return `image_${hash}.${ext}`;
    }
  }

  /**
   * 简单哈希函数
   * @param str 字符串
   * @returns 哈希值
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为 32 位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 转义正则表达式特殊字符
   * @param str 字符串
   * @returns 转义后的字符串
   */
  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
