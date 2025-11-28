import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService.js';

/**
 * Feature: local-file-storage, Property 1: 目录结构完整性
 * 
 * 属性测试：验证对于任何系统启动，data 目录及其所有子目录（configs、documents、assets）应当被创建
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
describe('FileSystemService - Property-Based Tests', () => {
  let testBaseDir;

  beforeEach(async () => {
    // 为每个测试创建唯一的临时目录
    testBaseDir = path.join(process.cwd(), 'test-data', `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  /**
   * 属性 1: 目录结构完整性
   * 对于任何系统启动，data 目录及其所有子目录（configs、documents、assets）应当被创建
   */
  it('Property 1: 目录结构完整性 - 对于任何基础目录路径，初始化后应创建完整的目录结构', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成随机的目录名称组件
        fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 0, maxLength: 3 }),
        async (pathComponents) => {
          // 构建测试目录路径
          const testDir = path.join(testBaseDir, ...pathComponents, `data-${Date.now()}`);
          
          // 创建 FileSystemService 实例
          const testService = new FileSystemService(testDir);
          
          // 执行初始化
          await testService.initializeDirectories();
          
          // 验证主目录存在
          const dataStats = await fs.stat(testDir);
          expect(dataStats.isDirectory()).toBe(true);
          
          // 验证 configs 子目录存在
          const configsPath = path.join(testDir, 'configs');
          const configsStats = await fs.stat(configsPath);
          expect(configsStats.isDirectory()).toBe(true);
          
          // 验证 documents 子目录存在
          const documentsPath = path.join(testDir, 'documents');
          const documentsStats = await fs.stat(documentsPath);
          expect(documentsStats.isDirectory()).toBe(true);
          
          // 验证 assets 子目录存在
          const assetsPath = path.join(testDir, 'assets');
          const assetsStats = await fs.stat(assetsPath);
          expect(assetsStats.isDirectory()).toBe(true);
          
          // 清理这个特定的测试目录
          await fs.rm(testDir, { recursive: true, force: true });
        }
      ),
      { numRuns: 100 } // 运行 100 次迭代
    );
  });

  /**
   * 属性 1 的变体：幂等性测试
   * 多次调用 initializeDirectories 应该是安全的（幂等操作）
   */
  it('Property 1 (幂等性): 多次初始化应该是安全的', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成 1-5 次的初始化调用次数
        fc.integer({ min: 1, max: 5 }),
        async (numInitializations) => {
          const testDir = path.join(testBaseDir, `idempotent-${Date.now()}`);
          const testService = new FileSystemService(testDir);
          
          // 多次调用初始化
          for (let i = 0; i < numInitializations; i++) {
            await testService.initializeDirectories();
          }
          
          // 验证目录结构仍然正确
          const dataStats = await fs.stat(testDir);
          expect(dataStats.isDirectory()).toBe(true);
          
          const configsStats = await fs.stat(path.join(testDir, 'configs'));
          expect(configsStats.isDirectory()).toBe(true);
          
          const documentsStats = await fs.stat(path.join(testDir, 'documents'));
          expect(documentsStats.isDirectory()).toBe(true);
          
          const assetsStats = await fs.stat(path.join(testDir, 'assets'));
          expect(assetsStats.isDirectory()).toBe(true);
          
          // 清理
          await fs.rm(testDir, { recursive: true, force: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 1 的变体：并发初始化测试
   * 并发调用 initializeDirectories 应该是安全的
   */
  it('Property 1 (并发安全): 并发初始化应该是安全的', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成 2-10 个并发调用
        fc.integer({ min: 2, max: 10 }),
        async (numConcurrent) => {
          const testDir = path.join(testBaseDir, `concurrent-${Date.now()}`);
          const testService = new FileSystemService(testDir);
          
          // 并发调用初始化
          const promises = Array(numConcurrent).fill(null).map(() => 
            testService.initializeDirectories()
          );
          
          await Promise.all(promises);
          
          // 验证目录结构正确
          const dataStats = await fs.stat(testDir);
          expect(dataStats.isDirectory()).toBe(true);
          
          const configsStats = await fs.stat(path.join(testDir, 'configs'));
          expect(configsStats.isDirectory()).toBe(true);
          
          const documentsStats = await fs.stat(path.join(testDir, 'documents'));
          expect(documentsStats.isDirectory()).toBe(true);
          
          const assetsStats = await fs.stat(path.join(testDir, 'assets'));
          expect(assetsStats.isDirectory()).toBe(true);
          
          // 清理
          await fs.rm(testDir, { recursive: true, force: true });
        }
      ),
      { numRuns: 50 } // 并发测试运行次数少一些
    );
  });
});

/**
 * 文档操作单元测试
 */
describe('FileSystemService - Document Operations', () => {
  let testBaseDir;
  let service;

  beforeEach(async () => {
    // 为每个测试创建唯一的临时目录
    testBaseDir = path.join(process.cwd(), 'test-data', `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    service = new FileSystemService(testBaseDir);
    await service.initializeDirectories();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  /**
   * 测试保存和加载 Markdown 格式文档
   */
  it('应该能够保存和加载 Markdown 格式的文档', async () => {
    const docId = 'test-doc-markdown';
    const content = {
      id: docId,
      body: '# 测试文档\n\n这是一个测试文档。',
      format: 'markdown'
    };

    // 保存文档
    await service.saveDocument(docId, content);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容一致
    expect(loadedContent).toEqual(content);
    expect(loadedContent.body).toBe(content.body);
    expect(loadedContent.format).toBe('markdown');
  });

  /**
   * 测试保存和加载 HTML 格式文档
   */
  it('应该能够保存和加载 HTML 格式的文档', async () => {
    const docId = 'test-doc-html';
    const content = {
      id: docId,
      body_html: '<h1>测试文档</h1><p>这是一个测试文档。</p>',
      format: 'html'
    };

    // 保存文档
    await service.saveDocument(docId, content);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容一致
    expect(loadedContent).toEqual(content);
    expect(loadedContent.body_html).toBe(content.body_html);
    expect(loadedContent.format).toBe('html');
  });

  /**
   * 测试加载不存在的文档
   */
  it('加载不存在的文档应该返回 null', async () => {
    const docId = 'non-existent-doc';

    // 加载不存在的文档
    const loadedContent = await service.loadDocument(docId);

    // 验证返回 null
    expect(loadedContent).toBeNull();
  });

  /**
   * 测试更新已存在的文档
   */
  it('应该能够更新已存在的文档', async () => {
    const docId = 'test-doc-update';
    const originalContent = {
      id: docId,
      body: '# 原始内容',
      format: 'markdown'
    };

    const updatedContent = {
      id: docId,
      body: '# 更新后的内容',
      format: 'markdown'
    };

    // 保存原始文档
    await service.saveDocument(docId, originalContent);

    // 更新文档
    await service.saveDocument(docId, updatedContent);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容已更新
    expect(loadedContent).toEqual(updatedContent);
    expect(loadedContent.body).toBe(updatedContent.body);
  });

  /**
   * 测试保存包含资源映射的文档
   */
  it('应该能够保存包含资源映射的文档', async () => {
    const docId = 'test-doc-with-assets';
    const content = {
      id: docId,
      body: '# 文档标题\n\n![图片](image.png)',
      format: 'markdown',
      assets: {
        'https://example.com/image.png': '/api/storage/assets/source1/doc1/image.png'
      }
    };

    // 保存文档
    await service.saveDocument(docId, content);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容一致
    expect(loadedContent).toEqual(content);
    expect(loadedContent.assets).toEqual(content.assets);
  });

  /**
   * 测试保存空文档
   */
  it('应该能够保存空文档', async () => {
    const docId = 'test-doc-empty';
    const content = {
      id: docId,
      body: '',
      format: 'markdown'
    };

    // 保存文档
    await service.saveDocument(docId, content);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容一致
    expect(loadedContent).toEqual(content);
  });

  /**
   * 测试保存包含特殊字符的文档
   */
  it('应该能够保存包含特殊字符的文档', async () => {
    const docId = 'test-doc-special-chars';
    const content = {
      id: docId,
      body: '# 特殊字符测试\n\n中文、日本語、한글、Emoji 😀🎉\n\n"引号" \'单引号\' `反引号`',
      format: 'markdown'
    };

    // 保存文档
    await service.saveDocument(docId, content);

    // 加载文档
    const loadedContent = await service.loadDocument(docId);

    // 验证内容一致
    expect(loadedContent).toEqual(content);
    expect(loadedContent.body).toBe(content.body);
  });
});

/**
 * 格式化文档和文件名清理测试
 */
describe('FileSystemService - Formatted Document and Filename Sanitization', () => {
  let testBaseDir;
  let service;

  beforeEach(async () => {
    testBaseDir = path.join(process.cwd(), 'test-data', `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    service = new FileSystemService(testBaseDir);
    await service.initializeDirectories();
  });

  afterEach(async () => {
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  /**
   * 测试获取 Markdown 格式文档
   */
  it('应该能够获取 Markdown 格式的文档内容', async () => {
    const docId = 'test-markdown-doc';
    const content = {
      id: docId,
      title: '测试文档',
      format: 'markdown',
      body: '# 标题\n\n这是内容。',
      body_html: '<h1>标题</h1><p>这是内容。</p>'
    };

    await service.saveDocument(docId, content);
    const formatted = await service.getFormattedDocument(docId);

    expect(formatted).not.toBeNull();
    expect(formatted.content).toBe(content.body);
    expect(formatted.format).toBe('markdown');
    expect(formatted.title).toBe(content.title);
  });

  /**
   * 测试获取 HTML 格式文档
   */
  it('应该能够获取 HTML 格式的文档内容', async () => {
    const docId = 'test-html-doc';
    const content = {
      id: docId,
      title: 'HTML 文档',
      format: 'lake',
      body: '# 标题',
      body_html: '<h1>标题</h1><p>这是 HTML 内容。</p>'
    };

    await service.saveDocument(docId, content);
    const formatted = await service.getFormattedDocument(docId);

    expect(formatted).not.toBeNull();
    // HTML 格式文档应该被包装成完整的 HTML 文档
    expect(formatted.content).toContain('<!doctype html>');
    expect(formatted.content).toContain('<html>');
    expect(formatted.content).toContain('<head>');
    expect(formatted.content).toContain('<body>');
    expect(formatted.content).toContain(content.body_html);
    expect(formatted.content).toContain(content.title);
    expect(formatted.format).toBe('html');
    expect(formatted.title).toBe(content.title);
  });

  /**
   * 测试获取不存在的文档
   */
  it('获取不存在的文档应该返回 null', async () => {
    const formatted = await service.getFormattedDocument('non-existent');
    expect(formatted).toBeNull();
  });

  /**
   * 测试文件名清理 - 移除不安全字符
   */
  it('应该移除文件名中的不安全字符', () => {
    const unsafeFilename = '文档/标题:测试*文件?.md';
    const safeFilename = service.sanitizeFilename(unsafeFilename, '.md');
    
    expect(safeFilename).not.toContain('/');
    expect(safeFilename).not.toContain(':');
    expect(safeFilename).not.toContain('*');
    expect(safeFilename).not.toContain('?');
    expect(safeFilename).toContain('文档');
    expect(safeFilename).toContain('标题');
    expect(safeFilename).toContain('测试');
    expect(safeFilename).toContain('文件');
    expect(safeFilename.endsWith('.md')).toBe(true);
  });

  /**
   * 测试文件名清理 - 限制长度
   */
  it('应该限制文件名长度', () => {
    const longFilename = 'a'.repeat(250);
    const safeFilename = service.sanitizeFilename(longFilename, '.md');
    
    expect(safeFilename.length).toBeLessThanOrEqual(203); // 200 + '.md'
  });

  /**
   * 测试文件名清理 - 保留扩展名
   */
  it('应该正确保留文件扩展名', () => {
    const filename = '测试文档';
    const safeFilename = service.sanitizeFilename(filename, '.html');
    
    expect(safeFilename.endsWith('.html')).toBe(true);
    expect(safeFilename).toContain('测试文档');
  });
});

/**
 * 资源文件操作单元测试
 */
describe('FileSystemService - Asset Operations', () => {
  let testBaseDir;
  let service;

  beforeEach(async () => {
    // 为每个测试创建唯一的临时目录
    testBaseDir = path.join(process.cwd(), 'test-data', `test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    service = new FileSystemService(testBaseDir);
    await service.initializeDirectories();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  /**
   * 测试保存和加载资源文件
   */
  it('应该能够保存和加载资源文件', async () => {
    const sourceId = 'yuque-source-1';
    const docId = 'doc-123';
    const filename = 'test-image.png';
    const buffer = Buffer.from('fake image data');

    // 保存资源
    const relativePath = await service.saveAsset(sourceId, docId, filename, buffer);

    // 验证返回的相对路径格式正确
    expect(relativePath).toBe(path.join('assets', sourceId, docId, filename));

    // 加载资源
    const loadedBuffer = await service.loadAsset(sourceId, docId, filename);

    // 验证内容一致
    expect(loadedBuffer).toEqual(buffer);
  });

  /**
   * 测试保存资源时自动创建目录结构
   */
  it('应该在保存资源时自动创建必要的目录结构', async () => {
    const sourceId = 'yuque-source-2';
    const docId = 'doc-456';
    const filename = 'attachment.pdf';
    const buffer = Buffer.from('fake pdf data');

    // 保存资源（目录不存在）
    await service.saveAsset(sourceId, docId, filename, buffer);

    // 验证目录结构已创建
    const assetDir = path.join(testBaseDir, 'assets', sourceId, docId);
    const stats = await fs.stat(assetDir);
    expect(stats.isDirectory()).toBe(true);

    // 验证文件存在
    const filePath = path.join(assetDir, filename);
    const fileStats = await fs.stat(filePath);
    expect(fileStats.isFile()).toBe(true);
  });

  /**
   * 测试保存多个资源到同一文档
   */
  it('应该能够保存多个资源到同一文档', async () => {
    const sourceId = 'yuque-source-3';
    const docId = 'doc-789';
    const files = [
      { filename: 'image1.png', buffer: Buffer.from('image1 data') },
      { filename: 'image2.jpg', buffer: Buffer.from('image2 data') },
      { filename: 'document.pdf', buffer: Buffer.from('pdf data') }
    ];

    // 保存多个资源
    for (const file of files) {
      await service.saveAsset(sourceId, docId, file.filename, file.buffer);
    }

    // 加载并验证每个资源
    for (const file of files) {
      const loadedBuffer = await service.loadAsset(sourceId, docId, file.filename);
      expect(loadedBuffer).toEqual(file.buffer);
    }
  });

  /**
   * 测试保存资源到不同的数据源和文档
   */
  it('应该能够保存资源到不同的数据源和文档', async () => {
    const assets = [
      { sourceId: 'source-1', docId: 'doc-1', filename: 'file1.png', buffer: Buffer.from('data1') },
      { sourceId: 'source-1', docId: 'doc-2', filename: 'file2.png', buffer: Buffer.from('data2') },
      { sourceId: 'source-2', docId: 'doc-1', filename: 'file3.png', buffer: Buffer.from('data3') }
    ];

    // 保存所有资源
    for (const asset of assets) {
      await service.saveAsset(asset.sourceId, asset.docId, asset.filename, asset.buffer);
    }

    // 加载并验证每个资源
    for (const asset of assets) {
      const loadedBuffer = await service.loadAsset(asset.sourceId, asset.docId, asset.filename);
      expect(loadedBuffer).toEqual(asset.buffer);
    }
  });

  /**
   * 测试加载不存在的资源文件
   */
  it('加载不存在的资源文件应该抛出错误', async () => {
    const sourceId = 'yuque-source-4';
    const docId = 'doc-999';
    const filename = 'non-existent.png';

    // 尝试加载不存在的资源
    await expect(service.loadAsset(sourceId, docId, filename)).rejects.toThrow('资源文件不存在');
  });

  /**
   * 测试更新已存在的资源文件
   */
  it('应该能够更新已存在的资源文件', async () => {
    const sourceId = 'yuque-source-5';
    const docId = 'doc-111';
    const filename = 'update-test.png';
    const originalBuffer = Buffer.from('original data');
    const updatedBuffer = Buffer.from('updated data');

    // 保存原始资源
    await service.saveAsset(sourceId, docId, filename, originalBuffer);

    // 更新资源
    await service.saveAsset(sourceId, docId, filename, updatedBuffer);

    // 加载资源
    const loadedBuffer = await service.loadAsset(sourceId, docId, filename);

    // 验证内容已更新
    expect(loadedBuffer).toEqual(updatedBuffer);
    expect(loadedBuffer).not.toEqual(originalBuffer);
  });

  /**
   * 测试保存包含特殊字符的文件名
   */
  it('应该能够保存包含特殊字符的文件名', async () => {
    const sourceId = 'yuque-source-6';
    const docId = 'doc-222';
    const filename = '测试图片-2024_01_01.png';
    const buffer = Buffer.from('image data with special chars');

    // 保存资源
    await service.saveAsset(sourceId, docId, filename, buffer);

    // 加载资源
    const loadedBuffer = await service.loadAsset(sourceId, docId, filename);

    // 验证内容一致
    expect(loadedBuffer).toEqual(buffer);
  });

  /**
   * 测试保存空文件
   */
  it('应该能够保存空文件', async () => {
    const sourceId = 'yuque-source-7';
    const docId = 'doc-333';
    const filename = 'empty-file.txt';
    const buffer = Buffer.from('');

    // 保存空文件
    await service.saveAsset(sourceId, docId, filename, buffer);

    // 加载文件
    const loadedBuffer = await service.loadAsset(sourceId, docId, filename);

    // 验证内容一致
    expect(loadedBuffer).toEqual(buffer);
    expect(loadedBuffer.length).toBe(0);
  });

  /**
   * 测试保存大文件
   */
  it('应该能够保存大文件', async () => {
    const sourceId = 'yuque-source-8';
    const docId = 'doc-444';
    const filename = 'large-file.bin';
    // 创建一个 1MB 的缓冲区
    const buffer = Buffer.alloc(1024 * 1024, 'a');

    // 保存大文件
    await service.saveAsset(sourceId, docId, filename, buffer);

    // 加载文件
    const loadedBuffer = await service.loadAsset(sourceId, docId, filename);

    // 验证内容一致
    expect(loadedBuffer).toEqual(buffer);
    expect(loadedBuffer.length).toBe(buffer.length);
  });
});
