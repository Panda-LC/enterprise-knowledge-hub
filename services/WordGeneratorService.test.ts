/**
 * WordGeneratorService 测试
 * 
 * 测试 HTML 到 Word 元素的解析功能
 */

import { describe, it, expect } from 'vitest';
import { WordGeneratorService } from './WordGeneratorService';

describe('WordGeneratorService - parseHtmlToWordElements', () => {
  // 使用反射访问私有方法进行测试
  const parseHtml = (html: string) => {
    return (WordGeneratorService as any).parseHtmlToWordElements(html);
  };

  describe('基本元素解析', () => {
    it('应该解析空 HTML', () => {
      const elements = parseHtml('');
      expect(elements).toEqual([]);
    });

    it('应该解析纯文本', () => {
      const elements = parseHtml('Hello World');
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].content).toBe('Hello World');
    });

    it('应该解析段落', () => {
      const elements = parseHtml('<p>This is a paragraph</p>');
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].content).toBe('This is a paragraph');
    });
  });

  describe('标题解析', () => {
    it('应该解析 H1 标题', () => {
      const elements = parseHtml('<h1>Main Title</h1>');
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('heading');
      expect(elements[0].level).toBe(1);
      expect(elements[0].content).toBe('Main Title');
    });

    it('应该解析 H2-H6 标题', () => {
      const html = '<h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(5);
      
      for (let i = 0; i < 5; i++) {
        expect(elements[i].type).toBe('heading');
        expect(elements[i].level).toBe(i + 2);
      }
    });
  });

  describe('文本样式解析', () => {
    it('应该解析粗体文本', () => {
      const elements = parseHtml('<p><strong>Bold text</strong></p>');
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].children).toBeDefined();
      expect(elements[0].children![0].styles?.bold).toBe(true);
    });

    it('应该解析斜体文本', () => {
      const elements = parseHtml('<p><em>Italic text</em></p>');
      expect(elements).toHaveLength(1);
      expect(elements[0].children![0].styles?.italic).toBe(true);
    });

    it('应该解析下划线文本', () => {
      const elements = parseHtml('<p><u>Underlined text</u></p>');
      expect(elements).toHaveLength(1);
      expect(elements[0].children![0].styles?.underline).toBe(true);
    });

    it('应该解析删除线文本', () => {
      const elements = parseHtml('<p><del>Strikethrough text</del></p>');
      expect(elements).toHaveLength(1);
      expect(elements[0].children![0].styles?.strikethrough).toBe(true);
    });

    it('应该解析组合样式', () => {
      const elements = parseHtml('<p><strong><em>Bold and italic</em></strong></p>');
      expect(elements).toHaveLength(1);
      const child = elements[0].children![0];
      expect(child.styles?.bold).toBe(true);
      expect(child.styles?.italic).toBe(true);
    });
  });

  describe('列表解析', () => {
    it('应该解析无序列表', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('list');
      expect(elements[0].listType).toBe('bullet');
      expect(elements[0].items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('应该解析有序列表', () => {
      const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('list');
      expect(elements[0].listType).toBe('number');
      expect(elements[0].items).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('表格解析', () => {
    it('应该解析简单表格', () => {
      const html = `
        <table>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
          <tr>
            <td>Cell 3</td>
            <td>Cell 4</td>
          </tr>
        </table>
      `;
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('table');
      expect(elements[0].rows).toHaveLength(2);
      expect(elements[0].rows![0].cells).toHaveLength(2);
      expect(elements[0].rows![0].cells[0].content).toBe('Cell 1');
    });

    it('应该解析带表头的表格', () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
            </tr>
          </tbody>
        </table>
      `;
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('table');
      expect(elements[0].rows).toHaveLength(2);
      expect(elements[0].rows![0].cells[0].content).toBe('Header 1');
    });
  });

  describe('图片解析', () => {
    it('应该解析图片元素', () => {
      const html = '<img src="https://example.com/image.jpg" alt="Test Image" width="300" height="200" />';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('image');
      expect(elements[0].src).toBe('https://example.com/image.jpg');
      expect(elements[0].alt).toBe('Test Image');
      expect(elements[0].width).toBe(300);
      expect(elements[0].height).toBe(200);
    });
  });

  describe('代码块解析', () => {
    it('应该解析代码块', () => {
      const html = '<pre><code>const x = 1;\nconsole.log(x);</code></pre>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('code');
      expect(elements[0].content).toContain('const x = 1;');
      expect(elements[0].styles?.fontFamily).toBe('Courier New');
    });

    it('应该解析行内代码', () => {
      const html = '<p>Use <code>console.log()</code> for debugging</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      // 行内代码应该被解析为子元素
      expect(elements[0].children).toBeDefined();
    });
  });

  describe('特殊字符处理', () => {
    it('应该解码 HTML 实体', () => {
      const html = '<p>&lt;div&gt; &amp; &quot;test&quot;</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].content).toBe('<div> & "test"');
    });

    it('应该处理 nbsp', () => {
      const html = '<p>Hello&nbsp;World</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      // &nbsp; 被解码为空格字符，验证包含 Hello 和 World
      expect(elements[0].content).toMatch(/Hello.*World/);
    });
  });

  describe('嵌套结构处理', () => {
    it('应该处理嵌套的文本样式', () => {
      const html = '<p><strong>Bold <em>and italic</em> text</strong></p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].children).toBeDefined();
    });

    it('应该处理 div 容器', () => {
      const html = '<div><p>Paragraph 1</p><p>Paragraph 2</p></div>';
      const elements = parseHtml(html);
      // div 应该被展开，返回其子元素
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('样式属性解析', () => {
    it('应该解析内联样式 - 颜色', () => {
      const html = '<p style="color: red;">Red text</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].styles?.color).toBe('red');
    });

    it('应该解析内联样式 - 字体大小', () => {
      const html = '<p style="font-size: 16px;">Sized text</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].styles?.fontSize).toBe(16);
    });

    it('应该解析内联样式 - 对齐方式', () => {
      const html = '<p style="text-align: center;">Centered text</p>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].styles?.alignment).toBe('center');
    });
  });

  describe('链接解析', () => {
    it('应该解析链接', () => {
      const html = '<a href="https://example.com">Click here</a>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].content).toContain('Click here');
      expect(elements[0].content).toContain('https://example.com');
      expect(elements[0].styles?.underline).toBe(true);
    });
  });

  describe('其他元素', () => {
    it('应该解析水平线', () => {
      const html = '<hr />';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].content).toContain('─');
    });

    it('应该解析换行', () => {
      const html = '<p>Line 1<br />Line 2</p>';
      const elements = parseHtml(html);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('应该解析引用块', () => {
      const html = '<blockquote>This is a quote</blockquote>';
      const elements = parseHtml(html);
      expect(elements).toHaveLength(1);
      expect(elements[0].type).toBe('paragraph');
      expect(elements[0].content).toBe('This is a quote');
    });
  });
});

describe('WordGeneratorService - convertLakeCards', () => {
  // 使用反射访问私有方法进行测试
  const convertLakeCards = (html: string) => {
    return (WordGeneratorService as any).convertLakeCards(html);
  };

  describe('图片卡片转换', () => {
    it('应该转换简单的图片卡片', () => {
      const cardHtml = '<card type="image" value=\'{"src":"https://example.com/image.jpg","width":300,"height":200}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
      expect(result).toContain('width="300"');
      expect(result).toContain('height="200"');
    });

    it('应该转换带 URL 编码的图片卡片', () => {
      const encodedValue = encodeURIComponent('{"src":"https://example.com/image.jpg"}');
      const cardHtml = `<card type="image" value="${encodedValue}"></card>`;
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
    });

    it('应该转换带 data: 前缀的图片卡片', () => {
      const cardHtml = '<card type="image" value=\'data:{"src":"https://example.com/image.jpg"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
    });

    it('应该转换带 HTML 实体的图片卡片', () => {
      const cardHtml = '<card type="image" value="{&quot;src&quot;:&quot;https://example.com/image.jpg&quot;}"></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
    });

    it('应该处理嵌套的 data 结构', () => {
      const cardHtml = '<card type="image" value=\'{"data":{"src":"https://example.com/image.jpg","width":400}}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
      expect(result).toContain('width="400"');
    });

    it('应该添加 alt 属性', () => {
      const cardHtml = '<card type="image" value=\'{"src":"https://example.com/image.jpg","alt":"Test Image"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('alt="Test Image"');
    });
  });

  describe('代码块卡片转换', () => {
    it('应该转换代码块卡片', () => {
      const cardHtml = '<card type="code" value=\'{"code":"const x = 1;\\nconsole.log(x);","language":"javascript"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<pre><code');
      expect(result).toContain('class="language-javascript"');
      expect(result).toContain('const x = 1;');
    });

    it('应该转义代码中的 HTML 字符', () => {
      const cardHtml = '<card type="code" value=\'{"code":"<div>Hello</div>"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('&lt;div&gt;');
      expect(result).toContain('&lt;/div&gt;');
    });

    it('应该处理没有语言的代码块', () => {
      const cardHtml = '<card type="code" value=\'{"code":"print(\\"hello\\")"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<pre><code>');
      expect(result).not.toContain('class="language-');
    });

    it('应该处理 content 字段', () => {
      const cardHtml = '<card type="code" value=\'{"content":"const y = 2;"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('const y = 2;');
    });
  });

  describe('表格卡片转换', () => {
    it('应该转换简单表格卡片', () => {
      const cardHtml = '<card type="table" value=\'{"rows":[["A","B"],["C","D"]]}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<table');
      expect(result).toContain('<tr>');
      expect(result).toContain('<th>A</th>');
      expect(result).toContain('<td>C</td>');
    });

    it('应该处理对象格式的单元格', () => {
      const cardHtml = '<card type="table" value=\'{"rows":[[{"content":"A"},{"content":"B"}]]}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<th>A</th>');
      expect(result).toContain('<th>B</th>');
    });

    it('应该处理嵌套的 cells 结构', () => {
      const cardHtml = '<card type="table" value=\'{"rows":[{"cells":["X","Y"]}]}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<th>X</th>');
      expect(result).toContain('<th>Y</th>');
    });
  });

  describe('文件卡片转换', () => {
    it('应该转换文件卡片', () => {
      const cardHtml = '<card type="file" value=\'{"name":"document.pdf","url":"https://example.com/doc.pdf","size":1048576}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('📎');
      expect(result).toContain('document.pdf');
      expect(result).toContain('href="https://example.com/doc.pdf"');
      expect(result).toContain('1.00 MB'); // 1048576 bytes = 1 MB exactly
    });

    it('应该处理没有 URL 的文件', () => {
      const cardHtml = '<card type="file" value=\'{"name":"document.pdf"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('📎');
      expect(result).toContain('document.pdf');
      expect(result).not.toContain('<a');
    });

    it('应该格式化文件大小', () => {
      const cardHtml = '<card type="file" value=\'{"name":"file.txt","size":1536}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('1.50 KB');
    });
  });

  describe('视频卡片转换', () => {
    it('应该转换视频卡片', () => {
      const cardHtml = '<card type="video" value=\'{"url":"https://example.com/video.mp4","title":"My Video"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('🎬');
      expect(result).toContain('My Video');
      expect(result).toContain('href="https://example.com/video.mp4"');
    });

    it('应该添加视频封面', () => {
      const cardHtml = '<card type="video" value=\'{"url":"https://example.com/video.mp4","title":"Video","poster":"https://example.com/poster.jpg"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/poster.jpg"');
    });
  });

  describe('链接卡片转换', () => {
    it('应该转换链接卡片', () => {
      const cardHtml = '<card type="link" value=\'{"url":"https://example.com","title":"Example Site"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Example Site');
    });

    it('应该添加描述', () => {
      const cardHtml = '<card type="link" value=\'{"url":"https://example.com","title":"Site","description":"A test site"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('A test site');
    });
  });

  describe('错误处理', () => {
    it('应该保留没有 value 属性的卡片', () => {
      const cardHtml = '<card type="image"></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toBe(cardHtml);
    });

    it('应该保留无效 JSON 的卡片', () => {
      const cardHtml = '<card type="image" value="invalid json"></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toBe(cardHtml);
    });

    it('应该保留未知类型的卡片', () => {
      const cardHtml = '<card type="unknown" value=\'{"data":"test"}\'></card>';
      const result = convertLakeCards(cardHtml);
      expect(result).toBe(cardHtml);
    });

    it('应该处理缺少必需字段的卡片', () => {
      const cardHtml = '<card type="image" value=\'{"width":300}\'></card>';
      const result = convertLakeCards(cardHtml);
      // 缺少 src，应该返回空字符串
      expect(result).toBe('');
    });

    it('应该处理空 HTML', () => {
      const result = convertLakeCards('');
      expect(result).toBe('');
    });

    it('应该处理没有卡片的 HTML', () => {
      const html = '<p>Normal paragraph</p>';
      const result = convertLakeCards(html);
      expect(result).toBe(html);
    });
  });

  describe('自闭合卡片', () => {
    it('应该处理自闭合的图片卡片', () => {
      const cardHtml = '<card type="image" value=\'{"src":"https://example.com/image.jpg"}\' />';
      const result = convertLakeCards(cardHtml);
      expect(result).toContain('<img src="https://example.com/image.jpg"');
    });
  });

  describe('多个卡片', () => {
    it('应该转换多个卡片', () => {
      const html = `
        <p>Text before</p>
        <card type="image" value='{"src":"https://example.com/img1.jpg"}'></card>
        <p>Text between</p>
        <card type="code" value='{"code":"const x = 1;"}'></card>
        <p>Text after</p>
      `;
      const result = convertLakeCards(html);
      expect(result).toContain('<img src="https://example.com/img1.jpg"');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('Text before');
      expect(result).toContain('Text between');
      expect(result).toContain('Text after');
    });
  });

  describe('HTML 转义', () => {
    it('应该转义特殊字符', () => {
      const escapeHtml = (text: string) => {
        return (WordGeneratorService as any).escapeHtml(text);
      };

      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('A & B')).toBe('A &amp; B');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
    });
  });

  describe('文件大小格式化', () => {
    it('应该格式化不同单位的文件大小', () => {
      const formatFileSize = (bytes: number) => {
        return (WordGeneratorService as any).formatFileSize(bytes);
      };

      expect(formatFileSize(500)).toBe('500.00 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });

    it('应该处理无效输入', () => {
      const formatFileSize = (bytes: any) => {
        return (WordGeneratorService as any).formatFileSize(bytes);
      };

      expect(formatFileSize(-1)).toBe('');
      expect(formatFileSize('invalid')).toBe('');
      expect(formatFileSize(null)).toBe('');
    });
  });
});

describe('WordGeneratorService - embedImages', () => {
  it('应该收集所有图片元素', async () => {
    const service = new WordGeneratorService();
    const elements = [
      {
        type: 'paragraph' as const,
        content: 'Text',
      },
      {
        type: 'image' as const,
        src: 'https://example.com/image1.jpg',
      },
      {
        type: 'paragraph' as const,
        children: [
          {
            type: 'image' as const,
            src: 'https://example.com/image2.jpg',
          },
        ],
      },
    ];

    const collectImageElements = (service as any).collectImageElements.bind(service);
    const images = collectImageElements(elements);

    expect(images).toHaveLength(2);
    expect(images[0].src).toBe('https://example.com/image1.jpg');
    expect(images[1].src).toBe('https://example.com/image2.jpg');
  });

  it('应该跳过已经是 Base64 的图片', async () => {
    const service = new WordGeneratorService();
    const imageElement = {
      type: 'image' as const,
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    // 调用 processImageElement 不应该修改 src
    const processImageElement = (service as any).processImageElement.bind(service);
    await processImageElement(imageElement, 'test-source', 'test-doc');

    // src 应该保持不变
    expect(imageElement.src).toContain('data:image/png;base64');
  });

  it('应该跳过非 http/https URL', async () => {
    const service = new WordGeneratorService();
    const imageElement = {
      type: 'image' as const,
      src: 'file:///path/to/image.jpg',
    };

    const processImageElement = (service as any).processImageElement.bind(service);
    await processImageElement(imageElement, 'test-source', 'test-doc');

    // src 应该保持不变
    expect(imageElement.src).toBe('file:///path/to/image.jpg');
  });

  it('应该将 Base64 Data URL 转换为 Buffer', () => {
    const service = new WordGeneratorService();
    const base64Url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const base64ToBuffer = (service as any).base64ToBuffer.bind(service);
    const buffer = base64ToBuffer(base64Url);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('应该处理没有 src 的图片元素', async () => {
    const service = new WordGeneratorService();
    const imageElement = {
      type: 'image' as const,
    };

    const processImageElement = (service as any).processImageElement.bind(service);
    
    // 不应该抛出错误
    await expect(processImageElement(imageElement, 'test-source', 'test-doc')).resolves.not.toThrow();
  });
});
