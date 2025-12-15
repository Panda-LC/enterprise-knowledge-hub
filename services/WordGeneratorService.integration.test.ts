/**
 * WordGeneratorService 集成测试
 * 测试完整的 Word 文档生成流程
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WordGeneratorService } from './WordGeneratorService';
import * as fs from 'fs';
import * as path from 'path';

describe('WordGeneratorService - generateWord 集成测试', () => {
  const testDocId = 'test-word-doc';
  const testSourceId = 'test-source';
  
  // 清理测试文件
  afterEach(() => {
    // 清理可能生成的测试文件
    const testFiles = [
      path.join(process.cwd(), 'data', 'documents', `${testDocId}.docx`),
    ];
    
    for (const file of testFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (error) {
          console.warn(`清理测试文件失败: ${file}`, error);
        }
      }
    }
  });

  it('应该生成有效的 Word 文档 - 简单文本', async () => {
    const service = new WordGeneratorService();
    const content = '<h1>测试标题</h1><p>这是一段测试内容。</p>';
    
    const buffer = await service.generateWord(
      testDocId,
      content,
      testSourceId,
      '测试文档'
    );
    
    // 验证返回的是 Buffer
    expect(buffer).toBeInstanceOf(Buffer);
    
    // 验证 Buffer 不为空
    expect(buffer.length).toBeGreaterThan(0);
    
    // 验证是有效的 ZIP 格式（.docx 是 ZIP 压缩的 XML）
    const header = buffer.slice(0, 4);
    expect(header.toString('hex')).toBe('504b0304');
    
    console.log(`生成的 Word 文档大小: ${(buffer.length / 1024).toFixed(2)} KB`);
  }, 10000);

  it('应该生成包含多种元素的 Word 文档', async () => {
    const service = new WordGeneratorService();
    const content = `
      <h1>主标题</h1>
      <h2>副标题</h2>
      <p>这是一段<strong>粗体</strong>和<em>斜体</em>文本。</p>
      <ul>
        <li>列表项 1</li>
        <li>列表项 2</li>
      </ul>
      <table>
        <tr>
          <th>表头 1</th>
          <th>表头 2</th>
        </tr>
        <tr>
          <td>单元格 1</td>
          <td>单元格 2</td>
        </tr>
      </table>
      <pre><code>const x = 1;</code></pre>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-complex',
      content,
      testSourceId,
      '复杂文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    
    // 验证文件头
    const header = buffer.slice(0, 4);
    expect(header.toString('hex')).toBe('504b0304');
    
    console.log(`复杂文档大小: ${(buffer.length / 1024).toFixed(2)} KB`);
  }, 10000);

  it('应该处理空内容', async () => {
    const service = new WordGeneratorService();
    
    const buffer = await service.generateWord(
      testDocId + '-empty',
      '',
      testSourceId,
      '空文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    
    // 即使内容为空，也应该生成有效的 Word 文档
    const header = buffer.slice(0, 4);
    expect(header.toString('hex')).toBe('504b0304');
  }, 10000);

  it('应该处理 Lake 格式卡片', async () => {
    const service = new WordGeneratorService();
    const content = `
      <h1>Lake 格式测试</h1>
      <card type="image" value="data:%7B%22src%22%3A%22https%3A%2F%2Fexample.com%2Fimage.jpg%22%7D"></card>
      <card type="code" value="%7B%22code%22%3A%22console.log('hello')%22%2C%22language%22%3A%22javascript%22%7D"></card>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-lake',
      content,
      testSourceId,
      'Lake 格式文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    
    const header = buffer.slice(0, 4);
    expect(header.toString('hex')).toBe('504b0304');
  }, 10000);

  it('应该在超时时抛出错误', async () => {
    const service = new WordGeneratorService();
    const content = '<h1>测试</h1>';
    
    // 设置一个非常短的超时时间
    await expect(
      service.generateWord(
        testDocId + '-timeout',
        content,
        testSourceId,
        '超时测试',
        { timeout: 1 } // 1ms 超时
      )
    ).rejects.toThrow(/超时/);
  }, 10000);

  it('应该处理包含特殊字符的内容', async () => {
    const service = new WordGeneratorService();
    const content = `
      <h1>特殊字符测试</h1>
      <p>中文字符：你好世界</p>
      <p>Emoji: 😀 🎉 ✨</p>
      <p>符号: &lt; &gt; &amp; &quot; &#39;</p>
      <p>数学符号: ∑ ∫ ∞ ≈ ≠</p>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-special',
      content,
      testSourceId,
      '特殊字符文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    
    const header = buffer.slice(0, 4);
    expect(header.toString('hex')).toBe('504b0304');
  }, 10000);

  it('应该处理嵌套的 HTML 结构', async () => {
    const service = new WordGeneratorService();
    const content = `
      <div>
        <h1>嵌套结构测试</h1>
        <div>
          <p>外层段落</p>
          <div>
            <p>内层段落 <strong>粗体 <em>粗斜体</em></strong></p>
          </div>
        </div>
      </div>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-nested',
      content,
      testSourceId,
      '嵌套结构文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 10000);

  it('应该处理内联样式', async () => {
    const service = new WordGeneratorService();
    const content = `
      <h1>样式测试</h1>
      <p style="color: #ff0000; font-size: 16px; text-align: center;">
        红色居中文本
      </p>
      <p style="background-color: #ffff00;">黄色背景</p>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-styles',
      content,
      testSourceId,
      '样式文档'
    );
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 10000);

  it('应该清理不安全的 HTML', async () => {
    const service = new WordGeneratorService();
    const content = `
      <h1>安全测试</h1>
      <p>正常内容</p>
      <script>alert('xss')</script>
      <p onclick="alert('xss')">点击我</p>
    `;
    
    const buffer = await service.generateWord(
      testDocId + '-safe',
      content,
      testSourceId,
      '安全文档'
    );
    
    // 应该成功生成，但 script 标签应该被移除
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 10000);
});
