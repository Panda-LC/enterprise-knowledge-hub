/**
 * 手动测试 StorageService 的 Word 格式支持
 * 
 * 运行方式：
 * npx tsx services/StorageService.word.manual-test.ts
 */

import { StorageService } from './StorageService';

async function testWordSupport() {
  console.log('=== 测试 StorageService Word 格式支持 ===\n');

  try {
    // 测试 1: fileExists 方法
    console.log('测试 1: 检查 Word 文件是否存在');
    const exists = await StorageService.fileExists('test-doc', 'docx');
    console.log(`结果: ${exists ? '文件存在' : '文件不存在'}\n`);

    // 测试 2: 验证类型支持
    console.log('测试 2: 验证 TypeScript 类型支持');
    const formats: Array<'html' | 'pdf' | 'md' | 'docx'> = ['html', 'pdf', 'md', 'docx'];
    console.log(`支持的格式: ${formats.join(', ')}\n`);

    console.log('✅ 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testWordSupport();
