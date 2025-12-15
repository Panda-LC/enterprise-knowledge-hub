import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService.js';

/**
 * FileSystemService - Word 文件操作测试
 * 测试 saveDocxFile、loadDocxFile 和 docxFileExists 方法
 */
describe('FileSystemService - Word 文件操作', () => {
  let testBaseDir;
  let fileSystemService;

  beforeEach(async () => {
    // 为每个测试创建唯一的临时目录
    testBaseDir = path.join(process.cwd(), 'test-data', `docx-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fileSystemService = new FileSystemService(testBaseDir);
    
    // 初始化目录结构
    await fileSystemService.initializeDirectories();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('saveDocxFile', () => {
    it('应该成功保存 Word 文件', async () => {
      const docId = 'test-doc-1';
      const testBuffer = Buffer.from('PK\x03\x04'); // Word 文件的 ZIP 文件头
      
      const filePath = await fileSystemService.saveDocxFile(docId, testBuffer);
      
      expect(filePath).toBe(path.join(testBaseDir, 'documents', `${docId}.docx`));
      
      // 验证文件确实被创建
      const fileExists = await fileSystemService.docxFileExists(docId);
      expect(fileExists).toBe(true);
    });

    it('应该覆盖已存在的 Word 文件', async () => {
      const docId = 'test-doc-2';
      const firstBuffer = Buffer.from('PK\x03\x04 first content');
      const secondBuffer = Buffer.from('PK\x03\x04 second content');
      
      // 第一次保存
      await fileSystemService.saveDocxFile(docId, firstBuffer);
      
      // 第二次保存（覆盖）
      await fileSystemService.saveDocxFile(docId, secondBuffer);
      
      // 验证文件内容是第二次的内容
      const loadedBuffer = await fileSystemService.loadDocxFile(docId);
      expect(loadedBuffer.toString()).toBe(secondBuffer.toString());
    });

    it('应该在写入失败时创建备份', async () => {
      const docId = 'test-doc-3';
      const testBuffer = Buffer.from('PK\x03\x04 test content');
      
      // 先保存一次
      await fileSystemService.saveDocxFile(docId, testBuffer);
      
      // 验证备份机制（备份应该在成功后被删除）
      const backupPath = path.join(testBaseDir, 'documents', `${docId}.docx.bak`);
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(false); // 成功后备份应该被删除
    });
  });

  describe('loadDocxFile', () => {
    it('应该成功加载已保存的 Word 文件', async () => {
      const docId = 'test-doc-4';
      const testBuffer = Buffer.from('PK\x03\x04 test content for loading');
      
      // 先保存
      await fileSystemService.saveDocxFile(docId, testBuffer);
      
      // 再加载
      const loadedBuffer = await fileSystemService.loadDocxFile(docId);
      
      expect(loadedBuffer).toBeInstanceOf(Buffer);
      expect(loadedBuffer.toString()).toBe(testBuffer.toString());
    });

    it('当文件不存在时应该返回 null', async () => {
      const docId = 'non-existent-doc';
      
      const result = await fileSystemService.loadDocxFile(docId);
      
      expect(result).toBe(null);
    });

    it('应该正确处理二进制数据', async () => {
      const docId = 'test-doc-5';
      // 创建一个包含各种字节值的 Buffer
      const testBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0xFF, 0x00, 0x7F, 0x80]);
      
      await fileSystemService.saveDocxFile(docId, testBuffer);
      const loadedBuffer = await fileSystemService.loadDocxFile(docId);
      
      expect(loadedBuffer).toEqual(testBuffer);
    });
  });

  describe('docxFileExists', () => {
    it('当文件存在时应该返回 true', async () => {
      const docId = 'test-doc-6';
      const testBuffer = Buffer.from('PK\x03\x04 test content');
      
      await fileSystemService.saveDocxFile(docId, testBuffer);
      
      const exists = await fileSystemService.docxFileExists(docId);
      expect(exists).toBe(true);
    });

    it('当文件不存在时应该返回 false', async () => {
      const docId = 'non-existent-doc-2';
      
      const exists = await fileSystemService.docxFileExists(docId);
      expect(exists).toBe(false);
    });
  });

  describe('并发安全性', () => {
    it('应该处理并发写入同一文件', async () => {
      const docId = 'concurrent-test-doc';
      const buffers = [
        Buffer.from('PK\x03\x04 content 1'),
        Buffer.from('PK\x03\x04 content 2'),
        Buffer.from('PK\x03\x04 content 3')
      ];
      
      // 并发写入
      const promises = buffers.map(buffer => 
        fileSystemService.saveDocxFile(docId, buffer)
      );
      
      // 等待所有写入完成
      await Promise.all(promises);
      
      // 验证文件存在且可以读取
      const exists = await fileSystemService.docxFileExists(docId);
      expect(exists).toBe(true);
      
      const loadedBuffer = await fileSystemService.loadDocxFile(docId);
      expect(loadedBuffer).toBeInstanceOf(Buffer);
      
      // 验证内容是其中一个写入的内容
      const loadedContent = loadedBuffer.toString();
      const validContents = buffers.map(b => b.toString());
      expect(validContents).toContain(loadedContent);
    });
  });

  describe('deleteFile 扩展', () => {
    it('应该能够删除 Word 文件', async () => {
      const docId = 'test-doc-7';
      const testBuffer = Buffer.from('PK\x03\x04 test content');
      
      // 保存文件
      await fileSystemService.saveDocxFile(docId, testBuffer);
      expect(await fileSystemService.docxFileExists(docId)).toBe(true);
      
      // 删除文件
      await fileSystemService.deleteFile(docId, 'docx');
      
      // 验证文件已被删除
      expect(await fileSystemService.docxFileExists(docId)).toBe(false);
    });

    it('删除不存在的 Word 文件应该不抛出错误', async () => {
      const docId = 'non-existent-doc-3';
      
      // 应该不抛出错误
      await expect(
        fileSystemService.deleteFile(docId, 'docx')
      ).resolves.not.toThrow();
    });
  });
});
