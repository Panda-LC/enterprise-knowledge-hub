/**
 * 简单的下载功能测试
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';

const STORAGE_API_BASE = 'http://localhost:3002';

async function testDownload() {
  console.log('=== 测试下载功能 ===\n');

  // 测试 Lake 格式文档
  const lakeDocId = 'yuque_yuque_1764227624269_eup1ds0bm_133314706';
  
  console.log(`测试 Lake 格式文档: ${lakeDocId}\n`);
  
  try {
    const response = await fetch(
      `${STORAGE_API_BASE}/api/storage/documents/${lakeDocId}/download`
    );
    
    if (!response.ok) {
      console.error(`❌ 下载失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const content = await response.text();
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    
    console.log(`✅ 下载成功`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    console.log(`   内容长度: ${content.length} 字符\n`);
    
    // 验证 HTML 结构
    const checks = {
      '包含 <!doctype html>': content.includes('<!doctype html>'),
      '包含 <html>': content.includes('<html>'),
      '包含 <head>': content.includes('<head>'),
      '包含 <body>': content.includes('<body>'),
      '包含 UTF-8 字符集': content.includes('charset="UTF-8"'),
      '包含 viewport': content.includes('viewport'),
      '包含标题': content.includes('<title>'),
      '包含原始内容': content.includes('ISV') || content.includes('发票'),
      '不包含 JSON 结构': !content.includes('"id":') && !content.includes('"format":')
    };
    
    console.log('HTML 结构检查:');
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    // 保存文件
    await fs.writeFile('test-download-result.html', content, 'utf8');
    console.log(`\n✅ HTML 文件已保存到: test-download-result.html`);
    console.log(`   可以在浏览器中打开此文件进行验证\n`);
    
    if (allPassed) {
      console.log('✅ 所有检查通过！下载功能正常工作。\n');
    } else {
      console.log('❌ 部分检查失败，请检查实现。\n');
    }
    
    // 显示内容预览
    console.log('内容预览（前 300 字符）:');
    console.log(content.substring(0, 300));
    console.log('...\n');
    
  } catch (error) {
    console.error(`❌ 测试失败:`, error.message);
  }
  
  console.log('=== 测试完成 ===');
}

testDownload().catch(console.error);
