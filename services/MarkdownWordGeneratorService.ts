/**
 * MarkdownWordGeneratorService - 基于 Markdown 的 Word 文档生成服务
 * 
 * 直接从语雀文档的 body 字段（Markdown 格式）生成 Word 文档
 * 相比 HTML 转换方案，Markdown 转换更加可靠，图片处理更简单
 */

import { ImageEmbedderService } from './ImageEmbedderService';

/**
 * Markdown Word 生成器选项
 */
export interface MarkdownWordGeneratorOptions {
  title?: string;
  author?: string;
  description?: string;
  timeout?: number;
  embedImages?: boolean;
  maxImageSize?: number;
}

/**
 * Markdown Word 文档生成服务
 */
export class MarkdownWordGeneratorService {
  /**
   * 从 Markdown 生成 Word 文档
   * 
   * @param docId - 文档 ID
   * @param markdown - Markdown 内容
   * @param sourceId - 数据源 ID
   * @param title - 文档标题
   * @param options - 生成选项
   * @returns Word 文件 Buffer
   */
  async generateWord(
    docId: string,
    markdown: string,
    sourceId: string,
    title?: string,
    options?: MarkdownWordGeneratorOptions
  ): Promise<Uint8Array> {
    console.log(`开始从 Markdown 生成 Word 文档: ${docId}`);
    
    const startTime = Date.now();
    const timeout = options?.timeout || 30000;
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Word 文档生成超时（${timeout}ms）`));
        }, timeout);
      });
      
      const generatePromise = this.generateWordInternal(
        docId,
        markdown,
        sourceId,
        title,
        options
      );
      
      const buffer = await Promise.race([generatePromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`Word 文档生成完成: ${docId}，耗时: ${duration}ms`);
      
      return buffer;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Word 文档生成失败: ${docId}，耗时: ${duration}ms`, error);
      throw error;
    }
  }
  
  /**
   * 内部生成方法
   */
  private async generateWordInternal(
    docId: string,
    markdown: string,
    sourceId: string,
    title?: string,
    options?: MarkdownWordGeneratorOptions
  ): Promise<Uint8Array> {
    // 动态导入 docx 库
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
            Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = await import('docx');
    
    console.log('步骤 1: 解析 Markdown 内容');
    const elements = this.parseMarkdown(markdown);
    
    console.log('步骤 2: 处理图片内嵌');
    if (options?.embedImages !== false) {
      await this.embedImages(elements, sourceId, docId);
    }
    
    console.log('步骤 3: 生成 Word 文档');
    const docxElements = await this.convertToDocxElements(elements, {
      Paragraph,
      TextRun,
      HeadingLevel,
      AlignmentType,
      Table,
      TableRow,
      TableCell,
      WidthType,
      BorderStyle,
      ImageRun
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: docxElements
      }],
      ...(title && {
        title: title,
        description: options?.description,
        creator: options?.author || 'Enterprise Knowledge Hub'
      })
    });
    
    console.log('步骤 4: 打包 Word 文档');
    const blob = await Packer.toBlob(doc);
    
    console.log(`Word 文档生成成功，大小: ${(blob.size / 1024).toFixed(2)} KB`);
    
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  
  /**
   * 解析 Markdown 为结构化元素
   */
  private parseMarkdown(markdown: string): MarkdownElement[] {
    const elements: MarkdownElement[] = [];
    const lines = markdown.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // 标题
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        elements.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2].trim()
        });
        i++;
        continue;
      }
      
      // 表格
      if (line.trim().startsWith('|')) {
        const tableResult = this.parseTable(lines, i);
        if (tableResult) {
          elements.push(tableResult.element);
          i = tableResult.nextIndex;
          continue;
        }
      }
      
      // 代码块
      if (line.trim().startsWith('```')) {
        const codeResult = this.parseCodeBlock(lines, i);
        if (codeResult) {
          elements.push(codeResult.element);
          i = codeResult.nextIndex;
          continue;
        }
      }
      
      // 无序列表
      if (line.match(/^[\s]*[-*+]\s+/)) {
        const listResult = this.parseList(lines, i, 'bullet');
        elements.push(listResult.element);
        i = listResult.nextIndex;
        continue;
      }
      
      // 有序列表
      if (line.match(/^[\s]*\d+\.\s+/)) {
        const listResult = this.parseList(lines, i, 'number');
        elements.push(listResult.element);
        i = listResult.nextIndex;
        continue;
      }
      
      // 图片
      const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imageMatch) {
        elements.push({
          type: 'image',
          alt: imageMatch[1],
          src: imageMatch[2]
        });
        i++;
        continue;
      }
      
      // 普通段落
      if (line.trim()) {
        const textRuns = this.parseInlineFormatting(line);
        elements.push({
          type: 'paragraph',
          runs: textRuns
        });
      } else {
        // 空行
        elements.push({
          type: 'paragraph',
          runs: [{ text: '' }]
        });
      }
      
      i++;
    }
    
    return elements;
  }
  
  /**
   * 解析表格
   */
  private parseTable(lines: string[], startIndex: number): { element: MarkdownElement; nextIndex: number } | null {
    const rows: string[][] = [];
    let i = startIndex;
    
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const line = lines[i].trim();
      // 跳过分隔行 (如 | --- | --- |)
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        i++;
        continue;
      }
      
      const cells = line
        .split('|')
        .slice(1, -1) // 移除首尾空元素
        .map(cell => cell.trim());
      
      rows.push(cells);
      i++;
    }
    
    if (rows.length === 0) {
      return null;
    }
    
    return {
      element: {
        type: 'table',
        rows: rows.map(cells => ({
          cells: cells.map(content => ({ content }))
        }))
      },
      nextIndex: i
    };
  }
  
  /**
   * 解析代码块
   */
  private parseCodeBlock(lines: string[], startIndex: number): { element: MarkdownElement; nextIndex: number } | null {
    let i = startIndex + 1;
    const codeLines: string[] = [];
    
    while (i < lines.length && !lines[i].trim().startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    
    return {
      element: {
        type: 'code',
        content: codeLines.join('\n')
      },
      nextIndex: i + 1
    };
  }
  
  /**
   * 解析列表
   */
  private parseList(lines: string[], startIndex: number, listType: 'bullet' | 'number'): { element: MarkdownElement; nextIndex: number } {
    const items: string[] = [];
    let i = startIndex;
    const pattern = listType === 'bullet' ? /^[\s]*[-*+]\s+(.+)$/ : /^[\s]*\d+\.\s+(.+)$/;
    
    while (i < lines.length) {
      const match = lines[i].match(pattern);
      if (!match) break;
      
      items.push(match[1].trim());
      i++;
    }
    
    return {
      element: {
        type: 'list',
        listType,
        items
      },
      nextIndex: i
    };
  }
  
  /**
   * 解析行内格式（粗体、斜体、链接等）
   */
  private parseInlineFormatting(text: string): TextRunInfo[] {
    const runs: TextRunInfo[] = [];
    let currentText = '';
    let i = 0;
    
    while (i < text.length) {
      // 粗体 **text** 或 __text__
      if ((text[i] === '*' && text[i + 1] === '*') || (text[i] === '_' && text[i + 1] === '_')) {
        if (currentText) {
          runs.push({ text: currentText });
          currentText = '';
        }
        
        const delimiter = text.substring(i, i + 2);
        const endIndex = text.indexOf(delimiter, i + 2);
        if (endIndex !== -1) {
          runs.push({
            text: text.substring(i + 2, endIndex),
            bold: true
          });
          i = endIndex + 2;
          continue;
        }
      }
      
      // 斜体 *text* 或 _text_
      if (text[i] === '*' || text[i] === '_') {
        if (currentText) {
          runs.push({ text: currentText });
          currentText = '';
        }
        
        const delimiter = text[i];
        const endIndex = text.indexOf(delimiter, i + 1);
        if (endIndex !== -1) {
          runs.push({
            text: text.substring(i + 1, endIndex),
            italic: true
          });
          i = endIndex + 1;
          continue;
        }
      }
      
      // 行内代码 `code`
      if (text[i] === '`') {
        if (currentText) {
          runs.push({ text: currentText });
          currentText = '';
        }
        
        const endIndex = text.indexOf('`', i + 1);
        if (endIndex !== -1) {
          runs.push({
            text: text.substring(i + 1, endIndex),
            code: true
          });
          i = endIndex + 1;
          continue;
        }
      }
      
      // 链接 [text](url)
      if (text[i] === '[') {
        const closeBracket = text.indexOf(']', i);
        if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
          const closeParen = text.indexOf(')', closeBracket + 2);
          if (closeParen !== -1) {
            if (currentText) {
              runs.push({ text: currentText });
              currentText = '';
            }
            
            const linkText = text.substring(i + 1, closeBracket);
            runs.push({
              text: linkText,
              underline: true,
              color: '0000FF'
            });
            i = closeParen + 1;
            continue;
          }
        }
      }
      
      currentText += text[i];
      i++;
    }
    
    if (currentText) {
      runs.push({ text: currentText });
    }
    
    return runs.length > 0 ? runs : [{ text: text }];
  }
  
  /**
   * 内嵌图片
   */
  private async embedImages(elements: MarkdownElement[], sourceId: string, docId: string): Promise<void> {
    const imageElements = elements.filter(el => el.type === 'image');
    
    if (imageElements.length === 0) {
      console.log('没有找到图片元素');
      return;
    }
    
    console.log(`发现 ${imageElements.length} 个图片，开始内嵌处理`);
    
    // 提取所有图片 URL
    const imageUrls = imageElements
      .map(el => el.src)
      .filter((url): url is string => !!url);
    
    console.log(`提取出 ${imageUrls.length} 个有效图片 URL`);
    imageUrls.forEach((url, i) => {
      console.log(`  图片 [${i}]: ${url.substring(0, 80)}...`);
    });
    
    // 批量下载并转换图片
    console.log('开始批量下载并转换图片...');
    const embeddedImages = await this.downloadAndConvertImages(imageUrls, sourceId, docId);
    
    console.log(`下载转换完成，得到 ${embeddedImages.length} 个结果`);
    embeddedImages.forEach((url, i) => {
      const isBase64 = url.startsWith('data:');
      console.log(`  结果 [${i}]: ${isBase64 ? 'Base64' : '原始URL'}, 长度: ${url.length}`);
    });
    
    // 更新图片元素的 src
    console.log('\n=== 开始更新图片元素 ===');
    let imageIndex = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (const element of elements) {
      if (element.type === 'image' && element.src) {
        const originalSrc = element.src;
        const embeddedUrl = embeddedImages[imageIndex];
        
        console.log(`\n[更新图片 ${imageIndex + 1}/${imageUrls.length}]`);
        console.log(`  原始 src: ${originalSrc.substring(0, 60)}...`);
        
        if (!embeddedUrl) {
          console.log(`  ✗ 嵌入 URL 为空`);
          failCount++;
        } else if (embeddedUrl.startsWith('__IMAGE_FAILED__:')) {
          console.log(`  ✗ 图片处理失败，将显示占位符`);
          element.src = embeddedUrl; // 保留失败标记
          failCount++;
        } else if (embeddedUrl.startsWith('data:')) {
          element.src = embeddedUrl;
          console.log(`  ✓ 更新成功 (Base64 长度: ${element.src.length})`);
          successCount++;
        } else {
          console.log(`  ✗ 不是 Base64 格式: ${embeddedUrl.substring(0, 60)}...`);
          element.src = `__IMAGE_FAILED__:${originalSrc}`;
          failCount++;
        }
        
        imageIndex++;
      }
    }
    
    console.log(`\n=== 图片内嵌汇总 ===`);
    console.log(`✓ 成功: ${successCount} 张`);
    console.log(`✗ 失败: ${failCount} 张`);
    console.log(`总计: ${imageUrls.length} 张`);
    
    if (failCount > 0) {
      console.warn(`\n⚠️  ${failCount} 张图片处理失败，将在 Word 文档中显示占位符文本`);
    }
  }
  
  /**
   * 下载并转换图片为 Base64
   */
  private async downloadAndConvertImages(
    imageUrls: string[],
    sourceId: string,
    docId: string
  ): Promise<string[]> {
    const results: string[] = [];
    
    // 并发处理（最多 5 个并发）
    const concurrency = 5;
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      const batch = imageUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.downloadAndConvertImage(url, sourceId, docId))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * 下载并转换单个图片
   */
  private async downloadAndConvertImage(
    imageUrl: string,
    sourceId: string,
    docId: string
  ): Promise<string> {
    try {
      console.log(`\n[图片处理] 开始: ${imageUrl.substring(0, 80)}...`);
      
      // 如果已经是 Base64，直接返回
      if (imageUrl.startsWith('data:')) {
        console.log('[图片处理] ✓ 已是 Base64 格式');
        return imageUrl;
      }
      
      // 尝试从本地加载
      const localUrl = this.getLocalImageUrl(imageUrl, sourceId, docId);
      if (localUrl) {
        try {
          console.log(`[图片处理] 尝试本地加载...`);
          const response = await fetch(localUrl);
          if (response.ok) {
            console.log('[图片处理] ✓ 本地加载成功');
            const blob = await response.blob();
            const base64 = await this.blobToBase64(blob);
            console.log(`[图片处理] ✓ Base64 转换成功, 长度: ${base64.length}`);
            return base64;
          } else {
            console.log(`[图片处理] 本地不存在 (${response.status})`);
          }
        } catch (error) {
          console.warn(`[图片处理] 本地加载失败:`, error);
        }
      }
      
      // 从远程下载 - 使用完整的代理URL
      const proxyUrl = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      console.log(`[图片处理] 通过代理下载...`);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*'
        }
      });
      
      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.error(`[图片处理] ✗ 下载失败: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log('[图片处理] ✓ 下载成功');
      const blob = await response.blob();
      console.log(`[图片处理] Blob 大小: ${blob.size} bytes, 类型: ${blob.type}`);
      
      const base64 = await this.blobToBase64(blob);
      console.log(`[图片处理] ✓ Base64 转换成功, 长度: ${base64.length}`);
      
      // 验证 Base64 格式
      if (!base64.startsWith('data:')) {
        throw new Error('Base64 转换结果格式错误');
      }
      
      return base64;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`[图片处理] ✗ 失败: ${errorMsg}`);
      console.error(`[图片处理] ✗ 将使用占位符文本代替图片`);
      // 返回一个特殊标记，表示图片处理失败
      return `__IMAGE_FAILED__:${imageUrl}`;
    }
  }
  
  /**
   * 获取本地图片 URL
   */
  private getLocalImageUrl(imageUrl: string, sourceId: string, docId: string): string | null {
    try {
      const url = new URL(imageUrl);
      const filename = url.pathname.split('/').pop();
      if (filename) {
        // 使用完整的URL,包括协议和主机
        return `http://localhost:3002/api/storage/assets/${sourceId}/${docId}/${encodeURIComponent(filename)}`;
      }
    } catch (error) {
      console.warn(`无效的图片 URL: ${imageUrl}`);
    }
    return null;
  }
  
  /**
   * Blob 转 Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * 转换为 docx 元素
   */
  private async convertToDocxElements(elements: MarkdownElement[], docxClasses: any): Promise<any[]> {
    const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = docxClasses;
    
    const docxElements: any[] = [];
    
    for (const element of elements) {
      try {
        switch (element.type) {
          case 'heading':
            docxElements.push(this.createHeading(element, docxClasses));
            break;
          
          case 'paragraph':
            docxElements.push(this.createParagraph(element, docxClasses));
            break;
          
          case 'list':
            docxElements.push(...this.createList(element, docxClasses));
            break;
          
          case 'table':
            docxElements.push(this.createTable(element, docxClasses));
            break;
          
          case 'code':
            docxElements.push(this.createCodeBlock(element, docxClasses));
            break;
          
          case 'image':
            const img = await this.createImage(element, docxClasses);
            if (img) {
              docxElements.push(img);
            }
            break;
        }
      } catch (error) {
        console.error(`转换元素失败: ${element.type}`, error);
      }
    }
    
    return docxElements;
  }
  
  /**
   * 创建标题
   */
  private createHeading(element: MarkdownElement, docxClasses: any): any {
    const { Paragraph, HeadingLevel } = docxClasses;
    
    const level = element.level || 1;
    const headingLevels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6
    ];
    
    return new Paragraph({
      text: element.content || '',
      heading: headingLevels[level - 1] || HeadingLevel.HEADING_1
    });
  }
  
  /**
   * 创建段落
   */
  private createParagraph(element: MarkdownElement, docxClasses: any): any {
    const { Paragraph, TextRun } = docxClasses;
    
    const runs = (element.runs || []).map(run => {
      const textRunOptions: any = {
        text: run.text
      };
      
      if (run.bold) textRunOptions.bold = true;
      if (run.italic) textRunOptions.italics = true;
      if (run.underline) textRunOptions.underline = {};
      if (run.color) textRunOptions.color = run.color;
      if (run.code) {
        textRunOptions.font = 'Courier New';
        textRunOptions.shading = { fill: 'F5F5F5' };
      }
      
      return new TextRun(textRunOptions);
    });
    
    return new Paragraph({ children: runs });
  }
  
  /**
   * 创建列表
   */
  private createList(element: MarkdownElement, docxClasses: any): any[] {
    const { Paragraph } = docxClasses;
    
    return (element.items || []).map(item => {
      return new Paragraph({
        text: item,
        bullet: element.listType === 'bullet' ? { level: 0 } : undefined,
        numbering: element.listType === 'number' ? {
          reference: 'default-numbering',
          level: 0
        } : undefined
      });
    });
  }
  
  /**
   * 创建表格
   */
  private createTable(element: MarkdownElement, docxClasses: any): any {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle } = docxClasses;
    
    const rows = (element.rows || []).map((row, rowIndex) => {
      const cells = row.cells.map(cell => {
        return new TableCell({
          children: [new Paragraph({ text: cell.content || '' })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
          }
        });
      });
      
      return new TableRow({
        children: cells,
        tableHeader: rowIndex === 0
      });
    });
    
    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      }
    });
  }
  
  /**
   * 创建代码块
   */
  private createCodeBlock(element: MarkdownElement, docxClasses: any): any {
    const { Paragraph, TextRun } = docxClasses;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: element.content || '',
          font: 'Courier New',
          size: 20
        })
      ],
      shading: {
        fill: 'F5F5F5'
      }
    });
  }
  
  /**
   * 创建图片
   */
  private async createImage(element: MarkdownElement, docxClasses: any): Promise<any> {
    const { Paragraph, ImageRun, TextRun } = docxClasses;
    
    console.log(`\n=== createImage 被调用 ===`);
    console.log(`  Alt 文本: ${element.alt || '(无)'}`);
    console.log(`  Src 存在: ${!!element.src}`);
    
    if (!element.src) {
      console.log(`  ✗ Src 为空，返回占位符`);
      return new Paragraph({
        children: [
          new TextRun({
            text: `[图片: ${element.alt || '无描述'}]`,
            color: 'FF0000'
          })
        ]
      });
    }
    
    // 检查是否是失败标记
    if (element.src.startsWith('__IMAGE_FAILED__:')) {
      const originalUrl = element.src.substring('__IMAGE_FAILED__:'.length);
      console.log(`  ✗ 图片处理失败，显示占位符`);
      console.log(`  原始 URL: ${originalUrl.substring(0, 60)}...`);
      return new Paragraph({
        children: [
          new TextRun({
            text: `[图片加载失败: ${element.alt || ''}]`,
            color: 'FF0000',
            italics: true
          })
        ]
      });
    }
    
    const isBase64 = element.src.startsWith('data:');
    console.log(`  是 Base64: ${isBase64}`);
    console.log(`  Src 长度: ${element.src.length}`);
    console.log(`  Src 前缀: ${element.src.substring(0, 30)}...`);
    
    try {
      if (!isBase64) {
        console.warn(`  ✗ 不是 Base64 格式`);
        return new Paragraph({
          children: [
            new TextRun({
              text: `[图片未内嵌: ${element.alt || ''}]`,
              color: 'FF6600',
              italics: true
            })
          ]
        });
      }
      
      console.log(`  转换 Base64 为 Buffer...`);
      const imageBuffer = this.base64ToBuffer(element.src);
      
      console.log(`  Buffer 长度: ${imageBuffer.length} 字节`);
      
      if (!imageBuffer || imageBuffer.length === 0) {
        console.error('  ✗ Buffer 为空');
        return new Paragraph({
          children: [
            new TextRun({
              text: `[图片 Buffer 为空: ${element.alt || ''}]`,
              color: 'FF0000'
            })
          ]
        });
      }
      
      console.log(`  ✓ 创建 ImageRun (600x400)`);
      return new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: 600,
              height: 400
            }
          })
        ]
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`  ✗ 创建图片失败: ${errorMsg}`);
      return new Paragraph({
        children: [
          new TextRun({
            text: `[图片创建失败: ${element.alt || ''} - ${errorMsg}]`,
            color: 'FF0000',
            italics: true
          })
        ]
      });
    }
  }
  
  /**
   * Base64 转 Buffer（浏览器兼容）
   */
  private base64ToBuffer(dataUrl: string): Uint8Array {
    // 提取 Base64 数据部分（去掉 data:image/xxx;base64, 前缀）
    const base64Data = dataUrl.split(',')[1];
    
    // 在浏览器环境中使用 atob 解码 Base64
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  }
}

/**
 * Markdown 元素类型
 */
interface MarkdownElement {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'image';
  level?: number;
  content?: string;
  runs?: TextRunInfo[];
  listType?: 'bullet' | 'number';
  items?: string[];
  rows?: TableRowInfo[];
  src?: string;
  alt?: string;
}

/**
 * 文本运行信息
 */
interface TextRunInfo {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  code?: boolean;
}

/**
 * 表格行信息
 */
interface TableRowInfo {
  cells: TableCellInfo[];
}

/**
 * 表格单元格信息
 */
interface TableCellInfo {
  content: string;
}
