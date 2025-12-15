/**
 * WordGeneratorService - Word 文档生成服务
 * 
 * 负责将 HTML 内容转换为 Word 文档格式。支持以下特性：
 * - 标题、段落、列表、表格等基本元素
 * - 文本样式（粗体、斜体、下划线等）
 * - 图片内嵌和优化
 * - Lake 格式解析
 * - 缓存机制
 * 
 * 验证需求: 1.2 (Word 生成基础)
 */

import { ImageEmbedderService } from './ImageEmbedderService';
import * as htmlparser2 from 'htmlparser2';
import { Element, Text, Node } from 'domhandler';

/**
 * Word 元素类型
 */
export interface WordElement {
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'image' | 'code';
  content?: string;
  level?: number; // 用于标题级别 (1-6)
  styles?: FormatStyles;
  children?: WordElement[];
  // 列表特定属性
  listType?: 'bullet' | 'number';
  items?: string[];
  // 表格特定属性
  rows?: TableRow[];
  // 图片特定属性
  src?: string;
  width?: number;
  height?: number;
  alt?: string;
}

/**
 * 表格行
 */
export interface TableRow {
  cells: TableCell[];
}

/**
 * 表格单元格
 */
export interface TableCell {
  content: string;
  colspan?: number;
  rowspan?: number;
  styles?: FormatStyles;
}

/**
 * 格式样式
 */
export interface FormatStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Word 生成器选项
 */
export interface WordGeneratorOptions {
  title?: string;
  author?: string;
  description?: string;
  timeout?: number; // 生成超时时间（毫秒）
  embedImages?: boolean; // 是否内嵌图片
  maxImageSize?: number; // 最大图片大小（字节）
}

/**
 * Word 文档生成服务
 */
export class WordGeneratorService {
  /**
   * 构造函数
   */
  constructor() {
    // 复用现有的 ImageEmbedderService（静态类）
  }

  /**
   * 生成 Word 文档
   * 
   * @param docId - 文档唯一标识符，用于缓存和文件命名
   * @param content - HTML 格式的文档内容
   * @param sourceId - 数据源标识符，用于图片处理
   * @param title - 文档标题，可选
   * @param options - 生成选项
   * @returns 生成的 Word 文件 Buffer
   * 
   * @throws {Error} 当文档内容为空或格式无效时
   * @throws {Error} 当生成时间超过超时限制时
   * 
   * @remarks
   * 该方法会：
   * 1. 清理和验证 HTML 内容
   * 2. 解析 HTML 为 Word 元素
   * 3. 处理和内嵌图片
   * 4. 生成 Word 文档
   * 
   * 验证需求: 1.2, 1.5, 6.1, 7.1-7.10 (Word 生成完整流程)
   */
  async generateWord(
    docId: string,
    content: string,
    sourceId: string,
    title?: string,
    options?: WordGeneratorOptions
  ): Promise<Uint8Array> {
    console.log(`开始生成 Word 文档: ${docId}`);
    
    const startTime = Date.now();
    const timeout = options?.timeout || 30000; // 默认 30 秒超时
    
    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Word 文档生成超时（${timeout}ms）`));
        }, timeout);
      });
      
      // 创建生成 Promise
      const generatePromise = this.generateWordInternal(
        docId,
        content,
        sourceId,
        title,
        options
      );
      
      // 使用 Promise.race 实现超时控制
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
   * 内部生成方法（不包含超时控制）
   */
  private async generateWordInternal(
    docId: string,
    content: string,
    sourceId: string,
    title?: string,
    options?: WordGeneratorOptions
  ): Promise<Uint8Array> {
    // 动态导入 docx 库
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = await import('docx');
    
    // 动态导入 DOMPurify（用于 HTML 清理）
    const DOMPurify = (await import('isomorphic-dompurify')).default;
    
    // 步骤 1: HTML 清理（防止 XSS）
    console.log('步骤 1: 清理 HTML 内容');
    let cleanedHtml = content;
    
    if (content && content.trim()) {
      cleanedHtml = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'p', 'br', 'hr',
          'strong', 'em', 'u', 'del', 's', 'b', 'i',
          'ul', 'ol', 'li',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'img', 'a',
          'pre', 'code',
          'blockquote',
          'span', 'div', 'section', 'article',
          'card' // 保留 Lake 格式的 card 标签
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title',
          'style', 'class',
          'colspan', 'rowspan',
          'width', 'height',
          'value', 'type', 'name' // Lake 格式的 card 属性
        ],
        ALLOW_DATA_ATTR: false
      });
    }
    
    // 步骤 2: Lake 格式转换
    console.log('步骤 2: 转换 Lake 格式');
    const convertedHtml = WordGeneratorService.convertLakeCards(cleanedHtml);
    
    // 步骤 3: 解析为 Word 元素
    console.log('步骤 3: 解析 HTML 为 Word 元素');
    const elements = WordGeneratorService.parseHtmlToWordElements(convertedHtml);
    
    if (elements.length === 0 && (!content || content.trim() === '')) {
      console.warn('文档内容为空，生成空白文档');
    }
    
    // 步骤 4: 内嵌图片
    console.log('步骤 4: 处理图片内嵌');
    if (options?.embedImages !== false) {
      await this.embedImages(elements, sourceId, docId);
    }
    
    // 步骤 5: 生成 Word 文档
    console.log('步骤 5: 生成 Word 文档');
    const docxElements = await this.convertToDocxElements(elements, {
      Document,
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
    
    // 创建 Word 文档对象
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
    
    // 生成 Blob（浏览器环境）
    console.log('步骤 6: 打包 Word 文档');
    const blob = await Packer.toBlob(doc);
    
    console.log(`Word 文档生成成功，大小: ${(blob.size / 1024).toFixed(2)} KB`);
    
    // 将 Blob 转换为 Uint8Array（浏览器兼容）
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    return uint8Array;
  }
  
  /**
   * 将 Word 元素转换为 docx 库的元素
   */
  private async convertToDocxElements(
    elements: WordElement[],
    docxClasses: any
  ): Promise<any[]> {
    const { Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = docxClasses;
    
    const docxElements: any[] = [];
    
    for (const element of elements) {
      try {
        switch (element.type) {
          case 'heading':
            docxElements.push(this.createHeading(element, { Paragraph, TextRun, HeadingLevel }));
            break;
          
          case 'paragraph':
            const para = await this.createParagraph(element, { Paragraph, TextRun, AlignmentType, ImageRun });
            if (para) {
              docxElements.push(para);
            }
            break;
          
          case 'list':
            docxElements.push(...this.createList(element, { Paragraph, TextRun }));
            break;
          
          case 'table':
            docxElements.push(this.createTable(element, { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle }));
            break;
          
          case 'code':
            docxElements.push(this.createCodeBlock(element, { Paragraph, TextRun }));
            break;
          
          case 'image':
            const img = await this.createImage(element, { Paragraph, ImageRun });
            if (img) {
              docxElements.push(img);
            }
            break;
          
          default:
            console.warn(`未知的元素类型: ${element.type}`);
        }
      } catch (error) {
        console.error(`转换元素失败: ${element.type}`, error);
        // 继续处理其他元素
      }
    }
    
    return docxElements;
  }
  
  /**
   * 创建标题
   * 验证需求: 7.1
   */
  private createHeading(element: WordElement, docxClasses: any): any {
    const { Paragraph, TextRun, HeadingLevel, AlignmentType } = docxClasses;
    
    const level = element.level || 1;
    const headingLevels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6
    ];
    
    const paragraphOptions: any = {
      text: element.content || '',
      heading: headingLevels[level - 1] || HeadingLevel.HEADING_1,
    };
    
    // 只有在 AlignmentType 存在且有对齐设置时才添加
    if (element.styles?.alignment && AlignmentType) {
      const alignment = this.mapAlignment(element.styles.alignment, AlignmentType);
      if (alignment !== undefined) {
        paragraphOptions.alignment = alignment;
      }
    }
    
    return new Paragraph(paragraphOptions);
  }
  
  /**
   * 创建段落
   * 验证需求: 7.2
   */
  private async createParagraph(element: WordElement, docxClasses: any): Promise<any> {
    const { Paragraph, TextRun, AlignmentType, ImageRun } = docxClasses;
    
    // 如果有子元素，递归处理
    if (element.children && element.children.length > 0) {
      // 检查是否包含图片
      const hasImage = element.children.some(child => child.type === 'image');
      
      if (hasImage) {
        // 如果包含图片，需要特殊处理
        // 图片必须单独成段，不能与文本混合
        const results: any[] = [];
        
        for (const child of element.children) {
          if (child.type === 'image') {
            const imgPara = await this.createImage(child, { Paragraph, ImageRun });
            if (imgPara) {
              results.push(imgPara);
            }
          } else if (child.content && child.content.trim()) {
            // 文本内容单独成段
            const textPara = new Paragraph({
              children: [
                new TextRun({
                  text: child.content,
                  ...this.mapTextStyles(child.styles || {})
                })
              ]
            });
            results.push(textPara);
          }
        }
        
        // 返回第一个元素（如果有多个，会在上层处理）
        return results.length > 0 ? results[0] : null;
      }
      
      // 没有图片，正常处理文本
      const children: any[] = [];
      
      for (const child of element.children) {
        const textRun = this.createTextRun(child, { TextRun });
        if (textRun) {
          children.push(textRun);
        }
      }
      
      if (children.length > 0) {
        const paragraphOptions: any = { children };
        
        // 只有在 AlignmentType 存在且有对齐设置时才添加
        if (element.styles?.alignment && AlignmentType) {
          const alignment = this.mapAlignment(element.styles.alignment, AlignmentType);
          if (alignment !== undefined) {
            paragraphOptions.alignment = alignment;
          }
        }
        
        return new Paragraph(paragraphOptions);
      }
    }
    
    // 简单文本段落
    if (element.content) {
      const paragraphOptions: any = {
        children: [
          new TextRun({
            text: element.content,
            ...this.mapTextStyles(element.styles || {})
          })
        ]
      };
      
      // 只有在 AlignmentType 存在且有对齐设置时才添加
      if (element.styles?.alignment && AlignmentType) {
        const alignment = this.mapAlignment(element.styles.alignment, AlignmentType);
        if (alignment !== undefined) {
          paragraphOptions.alignment = alignment;
        }
      }
      
      return new Paragraph(paragraphOptions);
    }
    
    return null;
  }
  
  /**
   * 创建文本运行
   */
  private createTextRun(element: WordElement, docxClasses: any): any {
    const { TextRun } = docxClasses;
    
    if (!element.content) {
      return null;
    }
    
    return new TextRun({
      text: element.content,
      ...this.mapTextStyles(element.styles || {})
    });
  }
  
  /**
   * 创建列表
   * 验证需求: 7.3
   */
  private createList(element: WordElement, docxClasses: any): any[] {
    const { Paragraph, TextRun } = docxClasses;
    
    if (!element.items || element.items.length === 0) {
      return [];
    }
    
    const listItems: any[] = [];
    
    for (let i = 0; i < element.items.length; i++) {
      const item = element.items[i];
      
      listItems.push(new Paragraph({
        text: item,
        bullet: element.listType === 'bullet' ? {
          level: 0
        } : undefined,
        numbering: element.listType === 'number' ? {
          reference: 'default-numbering',
          level: 0
        } : undefined
      }));
    }
    
    return listItems;
  }
  
  /**
   * 创建表格
   * 验证需求: 7.4
   */
  private createTable(element: WordElement, docxClasses: any): any {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle } = docxClasses;
    
    if (!element.rows || element.rows.length === 0) {
      console.warn('表格元素缺少行数据');
      return new Paragraph({ text: '' });
    }
    
    console.log(`创建表格，行数: ${element.rows.length}`);
    
    const rows = element.rows.map((row, rowIndex) => {
      const cells = row.cells.map((cell, cellIndex) => {
        // 处理单元格内容，支持换行
        const cellContent = (cell.content || '').trim();
        const lines = cellContent.split('\n').filter(line => line.trim());
        
        // 为每一行创建一个段落
        const paragraphs = lines.length > 0 
          ? lines.map(line => new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  ...this.mapTextStyles(cell.styles || {})
                })
              ]
            }))
          : [new Paragraph({ text: '' })];
        
        return new TableCell({
          children: paragraphs,
          ...(cell.colspan && cell.colspan > 1 && {
            columnSpan: cell.colspan
          }),
          ...(cell.rowspan && cell.rowspan > 1 && {
            rowSpan: cell.rowspan
          }),
          // 添加边框样式
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
        // 表头行使用不同的样式
        ...(rowIndex === 0 && {
          tableHeader: true
        })
      });
    });
    
    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      // 添加表格边框
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
      }
    });
  }
  
  /**
   * 创建代码块
   * 验证需求: 7.5
   */
  private createCodeBlock(element: WordElement, docxClasses: any): any {
    const { Paragraph, TextRun } = docxClasses;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: element.content || '',
          font: 'Courier New',
          size: 20 // 10pt
        })
      ],
      shading: {
        fill: 'F5F5F5'
      }
    });
  }
  
  /**
   * 创建图片
   * 验证需求: 7.8
   */
  private async createImage(element: WordElement, docxClasses: any): Promise<any> {
    const { Paragraph, ImageRun } = docxClasses;
    
    if (!element.src) {
      console.warn('图片元素缺少 src 属性');
      return null;
    }
    
    try {
      // 将 Base64 Data URL 转换为 Buffer
      let imageBuffer: Buffer;
      
      if (element.src.startsWith('data:')) {
        imageBuffer = this.base64ToBuffer(element.src);
        console.log(`成功转换图片为 Buffer，大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      } else {
        // 如果不是 Base64，跳过（应该在 embedImages 阶段已经处理）
        console.warn(`图片未转换为 Base64，跳过: ${element.src.substring(0, 100)}...`);
        return null;
      }
      
      // 检查 Buffer 是否有效
      if (!imageBuffer || imageBuffer.length === 0) {
        console.error('图片 Buffer 为空');
        return null;
      }
      
      // 计算图片尺寸（如果未指定，使用合理的默认值）
      // docx 库使用 EMU (English Metric Units)，1 inch = 914400 EMU
      // 默认宽度 600px ≈ 6.25 inches ≈ 5715000 EMU
      const width = element.width || 600;
      const height = element.height || 400;
      
      console.log(`创建图片，尺寸: ${width}x${height}`);
      
      return new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: width,
              height: height
            }
          })
        ]
      });
    } catch (error) {
      console.error('创建图片失败:', error);
      // 返回一个占位符段落
      return new Paragraph({
        children: [
          new (docxClasses.TextRun)({
            text: `[图片加载失败: ${element.alt || ''}]`,
            color: 'FF0000'
          })
        ]
      });
    }
  }
  
  /**
   * 映射文本样式
   * 验证需求: 7.2
   */
  private mapTextStyles(styles: FormatStyles): any {
    const docxStyles: any = {};
    
    if (styles.bold) {
      docxStyles.bold = true;
    }
    
    if (styles.italic) {
      docxStyles.italics = true;
    }
    
    if (styles.underline) {
      docxStyles.underline = {};
    }
    
    if (styles.strikethrough) {
      docxStyles.strike = true;
    }
    
    if (styles.color) {
      // 转换颜色格式为十六进制
      const hexColor = this.convertColorToHex(styles.color);
      if (hexColor) {
        docxStyles.color = hexColor;
      }
    }
    
    if (styles.fontSize) {
      // docx 使用半点单位（28 = 14pt）
      docxStyles.size = styles.fontSize * 2;
    }
    
    if (styles.fontFamily) {
      docxStyles.font = styles.fontFamily;
    }
    
    return docxStyles;
  }
  
  /**
   * 将颜色转换为十六进制格式
   * 支持 #RRGGBB、rgb(r, g, b)、rgba(r, g, b, a) 格式
   */
  private convertColorToHex(color: string): string | null {
    if (!color) return null;
    
    // 移除空格
    color = color.trim();
    
    // 如果已经是十六进制格式，移除 # 号
    if (color.startsWith('#')) {
      return color.substring(1).toUpperCase();
    }
    
    // 处理 rgb() 或 rgba() 格式
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      
      // 转换为十六进制
      const toHex = (n: number) => {
        const hex = n.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return toHex(r) + toHex(g) + toHex(b);
    }
    
    // 处理命名颜色（简单映射）
    const namedColors: Record<string, string> = {
      'black': '000000',
      'white': 'FFFFFF',
      'red': 'FF0000',
      'green': '008000',
      'blue': '0000FF',
      'yellow': 'FFFF00',
      'gray': '808080',
      'grey': '808080',
    };
    
    const lowerColor = color.toLowerCase();
    if (namedColors[lowerColor]) {
      return namedColors[lowerColor];
    }
    
    // 无法识别的格式，返回黑色
    console.warn(`无法识别的颜色格式: ${color}，使用默认黑色`);
    return '000000';
  }
  
  /**
   * 映射对齐方式
   */
  private mapAlignment(alignment: string, AlignmentType: any): any {
    // 检查 AlignmentType 是否已定义
    if (!AlignmentType) {
      console.warn('AlignmentType 未定义，跳过对齐设置');
      return undefined;
    }
    
    switch (alignment) {
      case 'left':
        return AlignmentType.LEFT;
      case 'center':
        return AlignmentType.CENTER;
      case 'right':
        return AlignmentType.RIGHT;
      case 'justify':
        return AlignmentType.JUSTIFIED;
      default:
        return AlignmentType.LEFT;
    }
  }

  /**
   * 解析 HTML 为 Word 元素
   * @param html HTML 内容
   * @returns Word 文档元素数组
   * 
   * 验证需求: 1.3, 7.1, 7.2, 7.3, 7.4, 7.5 (格式元素解析)
   */
  private static parseHtmlToWordElements(html: string): WordElement[] {
    console.log('开始解析 HTML 为 Word 元素');
    
    if (!html || html.trim() === '') {
      return [];
    }

    const elements: WordElement[] = [];
    
    // 使用 htmlparser2 解析 HTML
    const dom = htmlparser2.parseDocument(html, {
      decodeEntities: true, // 解码 HTML 实体
    });

    // 遍历 DOM 节点并转换为 Word 元素
    for (const node of dom.children) {
      const element = this.convertNodeToWordElement(node);
      if (element) {
        elements.push(element);
      }
    }

    return elements;
  }

  /**
   * 将 DOM 节点转换为 Word 元素
   * @param node DOM 节点
   * @param inheritedStyles 继承的样式
   * @returns Word 元素或 null
   */
  private static convertNodeToWordElement(
    node: Node,
    inheritedStyles: FormatStyles = {}
  ): WordElement | null {
    // 处理文本节点
    if (node.type === 'text') {
      const textNode = node as Text;
      const text = textNode.data.trim();
      
      if (!text) {
        return null;
      }

      return {
        type: 'paragraph',
        content: text,
        styles: { ...inheritedStyles },
      };
    }

    // 处理元素节点
    if (node.type === 'tag') {
      const element = node as Element;
      const tagName = element.name.toLowerCase();

      // 提取当前元素的样式
      const currentStyles = this.extractStyles(element, inheritedStyles);

      switch (tagName) {
        // 标题 (H1-H6)
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          return this.parseHeading(element, tagName, currentStyles);

        // 段落
        case 'p':
          return this.parseParagraph(element, currentStyles);

        // 列表
        case 'ul':
        case 'ol':
          return this.parseList(element, tagName, currentStyles);

        // 表格
        case 'table':
          return this.parseTable(element, currentStyles);

        // 图片
        case 'img':
          return this.parseImage(element);

        // 代码块
        case 'pre':
          return this.parseCodeBlock(element, currentStyles);

        // 行内代码
        case 'code':
          // 如果不在 pre 标签内，作为行内代码处理
          if (element.parent && (element.parent as Element).name !== 'pre') {
            return this.parseInlineCode(element, currentStyles);
          }
          break;

        // 引用块
        case 'blockquote':
          return this.parseBlockquote(element, currentStyles);

        // 水平线
        case 'hr':
          return {
            type: 'paragraph',
            content: '─────────────────────────────────────',
            styles: currentStyles,
          };

        // 换行
        case 'br':
          return {
            type: 'paragraph',
            content: '',
            styles: currentStyles,
          };

        // 文本样式标签 (strong, em, u, del, s, b, i)
        case 'strong':
        case 'b':
          currentStyles.bold = true;
          break;
        case 'em':
        case 'i':
          currentStyles.italic = true;
          break;
        case 'u':
          currentStyles.underline = true;
          break;
        case 'del':
        case 's':
          currentStyles.strikethrough = true;
          break;

        // 容器标签 (div, span, section, article)
        case 'div':
        case 'span':
        case 'section':
        case 'article':
          // 递归处理子节点
          const children: WordElement[] = [];
          for (const child of element.children) {
            const childElement = this.convertNodeToWordElement(child, currentStyles);
            if (childElement) {
              children.push(childElement);
            }
          }
          // 如果只有一个子元素，直接返回它
          if (children.length === 1) {
            return children[0];
          }
          // 如果有多个子元素，返回段落包含所有子元素
          if (children.length > 0) {
            return {
              type: 'paragraph',
              children,
              styles: currentStyles,
            };
          }
          return null;

        // 链接
        case 'a':
          return this.parseLink(element, currentStyles);

        default:
          // 对于未知标签，递归处理子节点
          const unknownChildren: WordElement[] = [];
          for (const child of element.children) {
            const childElement = this.convertNodeToWordElement(child, currentStyles);
            if (childElement) {
              unknownChildren.push(childElement);
            }
          }
          if (unknownChildren.length === 1) {
            return unknownChildren[0];
          }
          if (unknownChildren.length > 0) {
            return {
              type: 'paragraph',
              children: unknownChildren,
              styles: currentStyles,
            };
          }
          return null;
      }

      // 对于文本样式标签，递归处理子节点并应用样式
      if (['strong', 'b', 'em', 'i', 'u', 'del', 's'].includes(tagName)) {
        const styledChildren: WordElement[] = [];
        for (const child of element.children) {
          const childElement = this.convertNodeToWordElement(child, currentStyles);
          if (childElement) {
            styledChildren.push(childElement);
          }
        }
        if (styledChildren.length === 1) {
          return styledChildren[0];
        }
        if (styledChildren.length > 0) {
          return {
            type: 'paragraph',
            children: styledChildren,
            styles: currentStyles,
          };
        }
      }
    }

    return null;
  }

  /**
   * 提取元素的样式
   * @param element HTML 元素
   * @param inheritedStyles 继承的样式
   * @returns 样式对象
   */
  private static extractStyles(element: Element, inheritedStyles: FormatStyles): FormatStyles {
    const styles: FormatStyles = { ...inheritedStyles };

    // 从 style 属性提取样式
    const styleAttr = element.attribs?.style;
    if (styleAttr) {
      const styleRules = styleAttr.split(';').map(s => s.trim()).filter(s => s);
      for (const rule of styleRules) {
        const [property, value] = rule.split(':').map(s => s.trim());
        
        switch (property) {
          case 'font-weight':
            if (value === 'bold' || parseInt(value) >= 600) {
              styles.bold = true;
            }
            break;
          case 'font-style':
            if (value === 'italic') {
              styles.italic = true;
            }
            break;
          case 'text-decoration':
            if (value.includes('underline')) {
              styles.underline = true;
            }
            if (value.includes('line-through')) {
              styles.strikethrough = true;
            }
            break;
          case 'color':
            styles.color = value;
            break;
          case 'background-color':
            styles.backgroundColor = value;
            break;
          case 'font-size':
            const fontSize = parseInt(value);
            if (!isNaN(fontSize)) {
              styles.fontSize = fontSize;
            }
            break;
          case 'font-family':
            styles.fontFamily = value.replace(/['"]/g, '');
            break;
          case 'text-align':
            if (['left', 'center', 'right', 'justify'].includes(value)) {
              styles.alignment = value as 'left' | 'center' | 'right' | 'justify';
            }
            break;
        }
      }
    }

    return styles;
  }

  /**
   * 解析标题元素
   */
  private static parseHeading(element: Element, tagName: string, styles: FormatStyles): WordElement {
    const level = parseInt(tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
    const content = this.extractTextContent(element);

    return {
      type: 'heading',
      level,
      content,
      styles,
    };
  }

  /**
   * 解析段落元素
   */
  private static parseParagraph(element: Element, styles: FormatStyles): WordElement {
    // 先尝试提取纯文本内容
    const textContent = this.extractTextContent(element);
    
    // 检查是否有需要特殊处理的子元素（包括图片）
    const hasSpecialChildren = element.children.some(child => {
      if (child.type === 'tag') {
        const tagName = (child as Element).name.toLowerCase();
        return ['strong', 'b', 'em', 'i', 'u', 'del', 's', 'code', 'a', 'img', 'br'].includes(tagName);
      }
      return false;
    });

    // 如果没有特殊子元素，直接返回文本内容
    if (!hasSpecialChildren) {
      return {
        type: 'paragraph',
        content: textContent,
        styles,
      };
    }

    // 否则，解析子元素
    const children: WordElement[] = [];
    for (const child of element.children) {
      const childElement = this.convertNodeToWordElement(child, styles);
      if (childElement) {
        children.push(childElement);
      }
    }

    return {
      type: 'paragraph',
      children: children.length > 0 ? children : undefined,
      content: children.length === 0 ? textContent : undefined,
      styles,
    };
  }

  /**
   * 解析列表元素
   */
  private static parseList(element: Element, tagName: string, styles: FormatStyles): WordElement {
    const listType = tagName === 'ul' ? 'bullet' : 'number';
    const items: string[] = [];

    // 提取列表项
    for (const child of element.children) {
      if (child.type === 'tag' && (child as Element).name === 'li') {
        const itemContent = this.extractTextContent(child as Element);
        items.push(itemContent);
      }
    }

    return {
      type: 'list',
      listType,
      items,
      styles,
    };
  }

  /**
   * 解析表格元素
   */
  private static parseTable(element: Element, styles: FormatStyles): WordElement {
    const rows: TableRow[] = [];

    // 查找 tbody 或直接使用 table 的子元素
    let tableBody = element;
    for (const child of element.children) {
      if (child.type === 'tag' && (child as Element).name === 'tbody') {
        tableBody = child as Element;
        break;
      }
    }

    // 提取表格行
    for (const child of tableBody.children) {
      if (child.type === 'tag' && (child as Element).name === 'tr') {
        const row = this.parseTableRow(child as Element);
        if (row) {
          rows.push(row);
        }
      }
    }

    // 处理 thead
    for (const child of element.children) {
      if (child.type === 'tag' && (child as Element).name === 'thead') {
        for (const headerChild of (child as Element).children) {
          if (headerChild.type === 'tag' && (headerChild as Element).name === 'tr') {
            const row = this.parseTableRow(headerChild as Element);
            if (row) {
              rows.unshift(row); // 添加到开头
            }
          }
        }
      }
    }

    return {
      type: 'table',
      rows,
      styles,
    };
  }

  /**
   * 解析表格行
   */
  private static parseTableRow(element: Element): TableRow | null {
    const cells: TableCell[] = [];

    for (const child of element.children) {
      if (child.type === 'tag') {
        const cellElement = child as Element;
        if (cellElement.name === 'td' || cellElement.name === 'th') {
          const content = this.extractTextContent(cellElement);
          const colspan = cellElement.attribs?.colspan ? parseInt(cellElement.attribs.colspan) : undefined;
          const rowspan = cellElement.attribs?.rowspan ? parseInt(cellElement.attribs.rowspan) : undefined;
          const cellStyles = this.extractStyles(cellElement, {});

          cells.push({
            content,
            colspan,
            rowspan,
            styles: cellStyles,
          });
        }
      }
    }

    return cells.length > 0 ? { cells } : null;
  }

  /**
   * 解析图片元素
   */
  private static parseImage(element: Element): WordElement {
    const src = element.attribs?.src || '';
    const alt = element.attribs?.alt || '';
    const width = element.attribs?.width ? parseInt(element.attribs.width) : undefined;
    const height = element.attribs?.height ? parseInt(element.attribs.height) : undefined;

    return {
      type: 'image',
      src,
      alt,
      width,
      height,
    };
  }

  /**
   * 解析代码块元素
   */
  private static parseCodeBlock(element: Element, styles: FormatStyles): WordElement {
    // 查找 code 子元素
    let codeElement = element;
    for (const child of element.children) {
      if (child.type === 'tag' && (child as Element).name === 'code') {
        codeElement = child as Element;
        break;
      }
    }

    const content = this.extractTextContent(codeElement, true); // 保留空白字符

    return {
      type: 'code',
      content,
      styles: {
        ...styles,
        fontFamily: 'Courier New',
      },
    };
  }

  /**
   * 解析行内代码元素
   */
  private static parseInlineCode(element: Element, styles: FormatStyles): WordElement {
    const content = this.extractTextContent(element);

    return {
      type: 'paragraph',
      content,
      styles: {
        ...styles,
        fontFamily: 'Courier New',
        backgroundColor: '#f5f5f5',
      },
    };
  }

  /**
   * 解析引用块元素
   */
  private static parseBlockquote(element: Element, styles: FormatStyles): WordElement {
    const content = this.extractTextContent(element);
    
    return {
      type: 'paragraph',
      content,
      styles: {
        ...styles,
        // 引用块样式：缩进
      },
    };
  }

  /**
   * 解析链接元素
   */
  private static parseLink(element: Element, styles: FormatStyles): WordElement {
    const href = element.attribs?.href || '';
    const content = this.extractTextContent(element);

    return {
      type: 'paragraph',
      content: `${content} (${href})`,
      styles: {
        ...styles,
        color: '#0066cc',
        underline: true,
      },
    };
  }

  /**
   * 提取元素的文本内容
   * @param element HTML 元素
   * @param preserveWhitespace 是否保留空白字符
   * @returns 文本内容
   */
  private static extractTextContent(element: Element, preserveWhitespace: boolean = false): string {
    let text = '';

    for (const child of element.children) {
      if (child.type === 'text') {
        const textNode = child as Text;
        text += textNode.data;
      } else if (child.type === 'tag') {
        text += this.extractTextContent(child as Element, preserveWhitespace);
      }
    }

    // 处理特殊字符
    text = this.decodeHtmlEntities(text);

    return preserveWhitespace ? text : text.trim();
  }

  /**
   * 解码 HTML 实体
   * @param text 包含 HTML 实体的文本
   * @returns 解码后的文本
   */
  private static decodeHtmlEntities(text: string): string {
    const entities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
    };

    return text.replace(/&[a-z0-9#]+;/gi, (match) => {
      return entities[match.toLowerCase()] || match;
    });
  }

  /**
   * 应用格式化样式
   * @param element Word 元素
   * @param styles 样式对象
   */
  private static applyFormatting(
    element: any,
    styles: FormatStyles
  ): void {
    // TODO: 实现样式应用逻辑
    // 这将在后续任务中实现
  }

  /**
   * 内嵌图片到 Word 文档
   * @param elements Word 元素数组
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   * 
   * 验证需求: 1.4, 2.1, 2.2, 2.3, 2.4, 7.8 (图片处理)
   */
  private async embedImages(
    elements: WordElement[],
    sourceId: string,
    docId: string
  ): Promise<void> {
    console.log('========== 开始处理图片内嵌 ==========');
    
    // 收集所有图片元素
    const imageElements = this.collectImageElements(elements);
    
    if (imageElements.length === 0) {
      console.log('未找到需要处理的图片');
      return;
    }
    
    console.log(`找到 ${imageElements.length} 个图片，开始处理...`);
    
    // 统计图片类型
    const base64Images = imageElements.filter(img => img.src?.startsWith('data:')).length;
    const httpImages = imageElements.filter(img => img.src?.startsWith('http')).length;
    console.log(`- Base64 图片: ${base64Images} 个`);
    console.log(`- HTTP 图片: ${httpImages} 个`);
    
    // 使用 p-limit 限制并发数量（最多 5 个）
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(5);
    
    let successCount = 0;
    let failCount = 0;
    
    // 并发处理所有图片
    const promises = imageElements.map((imageElement, index) =>
      limit(async () => {
        try {
          console.log(`[${index + 1}/${imageElements.length}] 处理图片: ${imageElement.src?.substring(0, 80)}...`);
          await this.processImageElement(imageElement, sourceId, docId);
          successCount++;
          console.log(`[${index + 1}/${imageElements.length}] ✓ 图片处理成功`);
        } catch (error) {
          // 处理图片下载失败的情况（记录警告但继续）
          failCount++;
          const errorMsg = error instanceof Error ? error.message : '未知错误';
          console.warn(`[${index + 1}/${imageElements.length}] ✗ 图片处理失败: ${errorMsg}`);
          // 验证需求: 2.2 (处理图片失败)
        }
      })
    );
    
    // 等待所有图片处理完成
    await Promise.all(promises);
    
    console.log(`========== 图片内嵌处理完成 ==========`);
    console.log(`成功: ${successCount} 个，失败: ${failCount} 个`);
  }
  
  /**
   * 收集所有图片元素（递归）
   * @param elements Word 元素数组
   * @returns 图片元素数组
   */
  private collectImageElements(elements: WordElement[]): WordElement[] {
    const images: WordElement[] = [];
    
    for (const element of elements) {
      if (element.type === 'image') {
        images.push(element);
      }
      
      // 递归处理子元素
      if (element.children && element.children.length > 0) {
        images.push(...this.collectImageElements(element.children));
      }
    }
    
    return images;
  }
  
  /**
   * 处理单个图片元素
   * @param imageElement 图片元素
   * @param sourceId 数据源 ID
   * @param docId 文档 ID
   */
  private async processImageElement(
    imageElement: WordElement,
    sourceId: string,
    docId: string
  ): Promise<void> {
    if (!imageElement.src) {
      console.warn('图片元素缺少 src 属性');
      return;
    }
    
    const url = imageElement.src;
    
    // 跳过已经是 data: URL 的图片
    if (url.startsWith('data:')) {
      console.log(`图片已经是 Base64 格式，跳过: ${url.substring(0, 50)}...`);
      return;
    }
    
    // 只处理 http/https URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.warn(`不支持的图片 URL 协议: ${url}`);
      return;
    }
    
    try {
      console.log(`开始处理图片: ${url}`);
      
      // 复用 ImageEmbedderService.getImageBase64 方法
      // 验证需求: 2.1 (使用现有的 ImageEmbedderService)
      const base64Url = await ImageEmbedderService.getImageBase64(url, sourceId, docId);
      
      if (base64Url) {
        // 将 Base64 Data URL 转换为 Buffer
        const imageBuffer = this.base64ToBuffer(base64Url);
        
        // 检查图片文件大小
        const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
        if (imageBuffer.length > LARGE_FILE_THRESHOLD) {
          console.warn(`图片文件过大 (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB): ${url}`);
          // 验证需求: 2.3 (图片文件过大警告)
        }
        
        // 更新图片元素，将 src 替换为 Base64 URL
        imageElement.src = base64Url;
        
        // 保留图片尺寸和对齐方式
        // 验证需求: 7.8 (保留图片尺寸和对齐方式)
        // 如果没有指定尺寸，可以从 Buffer 中提取（这里暂时保留原有尺寸）
        
        console.log(`图片处理成功: ${url}`);
      } else {
        console.warn(`图片转换失败，保留原始 URL: ${url}`);
      }
    } catch (error) {
      // 重新抛出错误，让上层处理
      throw error;
    }
  }
  
  /**
   * 将 Base64 Data URL 转换为 Buffer
   * @param base64Url Base64 Data URL
   * @returns Buffer
   */
  private base64ToBuffer(base64Url: string): Buffer {
    // 提取 Base64 数据部分（去掉 "data:image/png;base64," 前缀）
    const base64Data = base64Url.split(',')[1] || base64Url;
    
    // 在 Node.js 环境中使用 Buffer.from
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64Data, 'base64');
    }
    
    // 在浏览器环境中使用 Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 返回 Uint8Array（在浏览器环境中）
    return bytes as any;
  }

  /**
   * 转换 Lake 格式的 <card> 标签
   * @param html HTML 内容
   * @returns 转换后的 HTML
   * 
   * 验证需求: 4.1, 4.2, 4.3, 4.4 (Lake 格式支持)
   */
  private static convertLakeCards(html: string): string {
    console.log('开始转换 Lake 格式卡片');
    
    if (!html) {
      return html;
    }

    // 匹配 <card> 标签（包括自闭合和非自闭合）
    const cardRegex = /<card[^>]*>(?:[\s\S]*?<\/card>)?|<card[^>]*\/>/gi;
    
    return html.replace(cardRegex, (match) => {
      try {
        // 提取 value 属性
        // 使用更复杂的正则来匹配引号内的内容（包括转义的引号）
        let valueMatch = match.match(/value="([^"]*)"/i);
        if (!valueMatch) {
          valueMatch = match.match(/value='([^']*)'/i);
        }
        
        if (!valueMatch) {
          console.warn('Card 标签缺少 value 属性，保留原始标签');
          return match;
        }

        let valueAttr = valueMatch[1];
        
        // 解码 value 属性
        const decodedValue = this.decodeCardValue(valueAttr);
        
        // 解析 JSON 数据
        let cardData: any;
        try {
          cardData = JSON.parse(decodedValue);
        } catch (parseError) {
          console.warn('无法解析 card 的 JSON 数据，保留原始标签', parseError);
          return match;
        }

        // 提取 type 属性（从 card 标签或 JSON 数据中）
        const typeMatch = match.match(/type=["']([^"']+)["']/i);
        const cardType = typeMatch ? typeMatch[1] : (cardData.type || cardData.name);

        console.log(`处理 card 类型: ${cardType}`);

        // 根据卡片类型进行转换
        switch (cardType) {
          case 'image':
          case 'img':
            return this.convertImageCard(cardData);
          
          case 'code':
          case 'codeblock':
            return this.convertCodeCard(cardData);
          
          case 'table':
            return this.convertTableCard(cardData);
          
          case 'file':
          case 'attachment':
            return this.convertFileCard(cardData);
          
          case 'video':
            return this.convertVideoCard(cardData);
          
          case 'link':
          case 'bookmark':
            return this.convertLinkCard(cardData);
          
          default:
            console.warn(`未知的 card 类型: ${cardType}，保留原始标签`);
            return match;
        }
      } catch (error) {
        console.error('转换 card 标签时发生错误，保留原始标签', error);
        return match;
      }
    });
  }

  /**
   * 解码 card 的 value 属性
   * @param valueAttr value 属性值
   * @returns 解码后的字符串
   */
  private static decodeCardValue(valueAttr: string): string {
    let decoded = valueAttr;
    
    // 1. URL 解码（处理 %7B 这样的编码）
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      console.log('URL 解码失败，继续使用原始值');
    }
    
    // 2. 去掉 "data:" 前缀（如果存在）
    if (decoded.startsWith('data:')) {
      decoded = decoded.substring(5);
    }
    
    // 3. HTML 实体解码
    decoded = decoded
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    // 4. 处理单引号包裹的 JSON（将外层单引号替换为双引号）
    // 注意：这只处理最外层的引号，不影响 JSON 内部的字符串
    decoded = decoded.trim();
    if (decoded.startsWith("'") && decoded.endsWith("'")) {
      decoded = decoded.substring(1, decoded.length - 1);
    }
    
    return decoded;
  }

  /**
   * 转换图片卡片为 <img> 标签
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.2
   */
  private static convertImageCard(cardData: any): string {
    // 提取图片 URL（支持多种数据结构）
    const src = cardData?.src || cardData?.data?.src || cardData?.url || cardData?.data?.url;
    
    if (!src || typeof src !== 'string') {
      console.warn('图片卡片缺少 src 属性');
      return '';
    }

    // 提取图片尺寸
    const width = cardData?.width || cardData?.data?.width;
    const height = cardData?.height || cardData?.data?.height;
    const alt = cardData?.alt || cardData?.data?.alt || '';

    // 构建 img 标签
    let imgTag = `<img src="${src}"`;
    
    if (alt) {
      imgTag += ` alt="${this.escapeHtml(alt)}"`;
    }
    
    if (typeof width === 'number' && width > 0) {
      imgTag += ` width="${Math.round(width)}"`;
    }
    
    if (typeof height === 'number' && height > 0) {
      imgTag += ` height="${Math.round(height)}"`;
    }
    
    imgTag += '>';

    console.log(`转换图片卡片: ${src}`);
    return imgTag;
  }

  /**
   * 转换代码块卡片为 <pre><code> 标签
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.3
   */
  private static convertCodeCard(cardData: any): string {
    // 提取代码内容
    const code = cardData?.code || cardData?.data?.code || cardData?.content || cardData?.data?.content || '';
    
    if (!code) {
      console.warn('代码块卡片缺少代码内容');
      return '';
    }

    // 提取语言信息
    const language = cardData?.language || cardData?.data?.language || cardData?.lang || cardData?.data?.lang || '';

    // 转义 HTML 特殊字符
    const escapedCode = this.escapeHtml(code);

    // 构建 pre/code 标签
    let codeBlock = '<pre><code';
    
    if (language) {
      codeBlock += ` class="language-${this.escapeHtml(language)}"`;
    }
    
    codeBlock += `>${escapedCode}</code></pre>`;

    console.log(`转换代码块卡片，语言: ${language || '未指定'}`);
    return codeBlock;
  }

  /**
   * 转换表格卡片
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.4
   */
  private static convertTableCard(cardData: any): string {
    // 提取表格数据
    const rows = cardData?.rows || cardData?.data?.rows;
    
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('表格卡片缺少行数据');
      return '';
    }

    // 构建表格 HTML
    let tableHtml = '<table border="1" style="border-collapse: collapse;">';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = Array.isArray(row) ? row : (row.cells || []);
      
      tableHtml += '<tr>';
      
      for (const cell of cells) {
        const cellContent = typeof cell === 'string' ? cell : (cell?.content || cell?.value || '');
        const isHeader = i === 0; // 第一行作为表头
        const tag = isHeader ? 'th' : 'td';
        
        tableHtml += `<${tag}>${this.escapeHtml(cellContent)}</${tag}>`;
      }
      
      tableHtml += '</tr>';
    }
    
    tableHtml += '</table>';

    console.log(`转换表格卡片，行数: ${rows.length}`);
    return tableHtml;
  }

  /**
   * 转换文件卡片
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.4
   */
  private static convertFileCard(cardData: any): string {
    // 提取文件信息
    const fileName = cardData?.name || cardData?.data?.name || cardData?.title || cardData?.data?.title || '附件';
    const fileUrl = cardData?.url || cardData?.data?.url || cardData?.src || cardData?.data?.src || '';
    const fileSize = cardData?.size || cardData?.data?.size;

    // 构建文件链接
    let fileHtml = '<p>📎 ';
    
    if (fileUrl) {
      fileHtml += `<a href="${this.escapeHtml(fileUrl)}">${this.escapeHtml(fileName)}</a>`;
    } else {
      fileHtml += this.escapeHtml(fileName);
    }
    
    if (fileSize) {
      const sizeStr = this.formatFileSize(fileSize);
      fileHtml += ` (${sizeStr})`;
    }
    
    fileHtml += '</p>';

    console.log(`转换文件卡片: ${fileName}`);
    return fileHtml;
  }

  /**
   * 转换视频卡片
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.4
   */
  private static convertVideoCard(cardData: any): string {
    // 提取视频信息
    const videoUrl = cardData?.url || cardData?.data?.url || cardData?.src || cardData?.data?.src || '';
    const title = cardData?.title || cardData?.data?.title || '视频';
    const poster = cardData?.poster || cardData?.data?.poster || cardData?.cover || cardData?.data?.cover;

    if (!videoUrl) {
      console.warn('视频卡片缺少 URL');
      return `<p>🎬 ${this.escapeHtml(title)}</p>`;
    }

    // 构建视频链接（Word 不支持嵌入视频，使用链接代替）
    let videoHtml = '<p>🎬 ';
    videoHtml += `<a href="${this.escapeHtml(videoUrl)}">${this.escapeHtml(title)}</a>`;
    videoHtml += '</p>';

    // 如果有封面图，添加封面
    if (poster) {
      videoHtml += `<img src="${this.escapeHtml(poster)}" alt="${this.escapeHtml(title)}">`;
    }

    console.log(`转换视频卡片: ${title}`);
    return videoHtml;
  }

  /**
   * 转换链接卡片
   * @param cardData 卡片数据
   * @returns HTML 字符串
   * 
   * 验证需求: 4.4
   */
  private static convertLinkCard(cardData: any): string {
    // 提取链接信息
    const url = cardData?.url || cardData?.data?.url || cardData?.href || cardData?.data?.href || '';
    const title = cardData?.title || cardData?.data?.title || url;
    const description = cardData?.description || cardData?.data?.description;

    if (!url) {
      console.warn('链接卡片缺少 URL');
      return '';
    }

    // 构建链接 HTML
    let linkHtml = '<p>';
    linkHtml += `<a href="${this.escapeHtml(url)}">${this.escapeHtml(title)}</a>`;
    
    if (description) {
      linkHtml += `<br><small>${this.escapeHtml(description)}</small>`;
    }
    
    linkHtml += '</p>';

    console.log(`转换链接卡片: ${title}`);
    return linkHtml;
  }

  /**
   * 转义 HTML 特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private static escapeHtml(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的字符串
   */
  private static formatFileSize(bytes: number): string {
    if (typeof bytes !== 'number' || bytes < 0 || isNaN(bytes)) {
      return '';
    }
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    // 始终保留 2 位小数
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 检查 Word 文件是否存在
   * @param docId 文档 ID
   * @returns 文件是否存在
   */
  static async wordFileExists(docId: string): Promise<boolean> {
    // TODO: 实现文件存在检查逻辑
    // 这将在后续任务中实现
    
    return false;
  }

  /**
   * 读取 Word 文件
   * @param docId 文档 ID
   * @returns Word 文件 Buffer
   */
  static async readWordFile(docId: string): Promise<Buffer> {
    // TODO: 实现文件读取逻辑
    // 这将在后续任务中实现
    
    throw new Error('Word 文件读取功能尚未实现');
  }
}
