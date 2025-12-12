/**
 * 测试 getFormattedDocument 方法
 */

import FileSystemService from './server/FileSystemService.js';

const fileSystemService = new FileSystemService();

async function testGetFormattedDocument() {
  console.log('=== 测试 getFormattedDocument 方法 ===\n');

  const docId = 'yuque_yuque_1764227624269_eup1ds0bm_133314706';
  
  try {
    console.log(`测试文档 ID: ${docId}\n`);
    
    const result = await fileSystemService.getFormattedDocument(docId);
    
    if (result === null) {
      console.log('❌ 文档不存在');
      return;
    }
    
    console.log('✅ 获取格式化文档成功');
    console.log(`   格式: ${result.format}`);
    console.log(`   标题: ${result.title}`);
    console.log(`   内容长度: ${result.content.length} 字符`);
    console.log('');
    
    // 检查 HTML 结构
    if (result.format === 'html') {
      const checks = {
        '包含 <!doctype html>': result.content.includes('<!doctype html>'),
        '包含 <html>': result.content.includes('<html>'),
        '包含 <head>': result.content.includes('<head>'),
        '包含 <body>': result.content.includes('<body>'),
        '包含 UTF-8 字符集': result.content.includes('charset="UTF-8"'),
        '包含 viewport': result.content.includes('viewport'),
        '包含标题': result.content.includes('<title>')
      };
      
      console.log('HTML 结构检查:');
      for (const [check, passed] of Object.entries(checks)) {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      }
      
      // 显示前 500 个字符
      console.log('\n内容预览（前 500 字符）:');
      console.log(result.content.substring(0, 500));
      console.log('...\n');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testGetFormattedDocument().catch(console.error);
