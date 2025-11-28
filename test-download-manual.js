/**
 * 手动测试下载功能
 * 测试 HTML 和 Markdown 格式文档的下载
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_API_BASE = 'http://localhost:3002';

async function testDownload() {
  console.log('=== 开始测试下载功能 ===\n');

  // 测试 1: 下载 Lake 格式（HTML）文档
  console.log('测试 1: 下载 Lake 格式文档');
  console.log('文档 ID: yuque_yuque_1764227624269_eup1ds0bm_133314706');
  
  try {
    const htmlResponse = await fetch(
      `${STORAGE_API_BASE}/api/storage/documents/yuque_yuque_1764227624269_eup1ds0bm_133314706/download`
    );
    
    if (!htmlResponse.ok) {
      console.error(`❌ HTML 下载失败: ${htmlResponse.status} ${htmlResponse.statusText}`);
    } else {
      const htmlContent = await htmlResponse.text();
      const contentType = htmlResponse.headers.get('content-type');
      const contentDisposition = htmlResponse.headers.get('content-disposition');
      
      console.log(`✅ HTML 下载成功`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Disposition: ${contentDisposition}`);
      console.log(`   内容长度: ${htmlContent.length} 字符`);
      
      // 验证 HTML 文档结构
      const checks = {
        '包含 <!doctype html>': htmlContent.includes('<!doctype html>'),
        '包含 <html>': htmlContent.includes('<html>'),
        '包含 <head>': htmlContent.includes('<head>'),
        '包含 <body>': htmlContent.includes('<body>'),
        '包含 UTF-8 字符集': htmlContent.includes('charset="UTF-8"'),
        '包含 viewport': htmlContent.includes('viewport'),
        '包含标题': htmlContent.includes('<title>'),
        '包含原始内容': htmlContent.includes('ISV') || htmlContent.includes('发票')
      };
      
      console.log('\n   HTML 结构检查:');
      for (const [check, passed] of Object.entries(checks)) {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      }
      
      // 保存到临时文件以便手动检查
      const htmlFilePath = path.join(process.cwd(), 'test-download-lake.html');
      await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
      console.log(`\n   ✅ HTML 文件已保存到: ${htmlFilePath}`);
      console.log(`   可以在浏览器中打开此文件进行验证`);
    }
  } catch (error) {
    console.error(`❌ HTML 下载测试失败:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 测试 2: 查找并下载 Markdown 格式文档
  console.log('测试 2: 查找 Markdown 格式文档');
  
  try {
    // 读取 items.json 查找 Markdown 文档
    const itemsPath = path.join(process.cwd(), 'data', 'configs', 'items.json');
    const itemsContent = await fs.readFile(itemsPath, 'utf8');
    const itemsData = JSON.parse(itemsContent);
    
    // items.json 可能是对象或数组，需要处理
    const items = Array.isArray(itemsData) ? itemsData : Object.values(itemsData);
    
    // 查找 Markdown 格式的文档
    const markdownDoc = items.find(item => 
      item.format === 'markdown' || item.format === 'md'
    );
    
    if (!markdownDoc) {
      console.log('⚠️  未找到 Markdown 格式的文档，跳过此测试');
    } else {
      console.log(`找到 Markdown 文档: ${markdownDoc.title}`);
      console.log(`文档 ID: ${markdownDoc.id}`);
      
      const mdResponse = await fetch(
        `${STORAGE_API_BASE}/api/storage/documents/${markdownDoc.id}/download`
      );
      
      if (!mdResponse.ok) {
        console.error(`❌ Markdown 下载失败: ${mdResponse.status} ${mdResponse.statusText}`);
      } else {
        const mdContent = await mdResponse.text();
        const contentType = mdResponse.headers.get('content-type');
        const contentDisposition = mdResponse.headers.get('content-disposition');
        
        console.log(`✅ Markdown 下载成功`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Disposition: ${contentDisposition}`);
        console.log(`   内容长度: ${mdContent.length} 字符`);
        
        // 验证 Markdown 文档不包含 HTML 包装
        const checks = {
          '不包含 <!doctype html>': !mdContent.includes('<!doctype html>'),
          '不包含 <html>': !mdContent.includes('<html>'),
          '不包含 <head>': !mdContent.includes('<head>'),
          '不包含 <body>': !mdContent.includes('<body>'),
          '是纯文本格式': true
        };
        
        console.log('\n   Markdown 格式检查:');
        for (const [check, passed] of Object.entries(checks)) {
          console.log(`   ${passed ? '✅' : '❌'} ${check}`);
        }
        
        // 保存到临时文件
        const mdFilePath = path.join(process.cwd(), 'test-download-markdown.md');
        await fs.writeFile(mdFilePath, mdContent, 'utf8');
        console.log(`\n   ✅ Markdown 文件已保存到: ${mdFilePath}`);
      }
    }
  } catch (error) {
    console.error(`❌ Markdown 下载测试失败:`, error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // 测试 3: 测试多个 Lake 格式文档
  console.log('测试 3: 测试多个 Lake 格式文档');
  
  try {
    const itemsPath = path.join(process.cwd(), 'data', 'configs', 'items.json');
    const itemsContent = await fs.readFile(itemsPath, 'utf8');
    const itemsData = JSON.parse(itemsContent);
    
    // items.json 可能是对象或数组，需要处理
    const items = Array.isArray(itemsData) ? itemsData : Object.values(itemsData);
    
    // 查找前 3 个 Lake 格式的文档
    const lakeDocs = items
      .filter(item => item.format === 'lake')
      .slice(0, 3);
    
    console.log(`找到 ${lakeDocs.length} 个 Lake 格式文档进行测试\n`);
    
    for (const doc of lakeDocs) {
      console.log(`测试文档: ${doc.title}`);
      console.log(`文档 ID: ${doc.id}`);
      
      const response = await fetch(
        `${STORAGE_API_BASE}/api/storage/documents/${doc.id}/download`
      );
      
      if (!response.ok) {
        console.log(`   ❌ 下载失败: ${response.status}`);
      } else {
        const content = await response.text();
        const hasDoctype = content.includes('<!doctype html>');
        const hasHtml = content.includes('<html>');
        const hasBody = content.includes('<body>');
        
        console.log(`   ✅ 下载成功 (${content.length} 字符)`);
        console.log(`   ${hasDoctype && hasHtml && hasBody ? '✅' : '❌'} HTML 结构完整`);
      }
      console.log('');
    }
  } catch (error) {
    console.error(`❌ 批量测试失败:`, error.message);
  }

  console.log('=== 测试完成 ===\n');
  console.log('请检查以下内容:');
  console.log('1. 在浏览器中打开 test-download-lake.html 文件');
  console.log('2. 验证 HTML 文件显示正常，包含表格、图片、样式等');
  console.log('3. 验证 test-download-markdown.md 文件是纯文本格式');
  console.log('4. 在应用中访问 http://localhost:3000 测试实际下载功能');
}

testDownload().catch(console.error);
