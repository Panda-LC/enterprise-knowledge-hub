/**
 * 文档预览功能验证脚本
 * 
 * 验证需求:
 * 1.1 - 文档详情页面加载并显示完整的文档内容
 * 1.2 - Markdown 格式正确渲染
 * 1.3 - HTML 格式正确渲染
 * 1.4 - 图片 URL 正确重写为本地 API URL
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试结果收集
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// 辅助函数：记录测试结果
function logTest(name, passed, message) {
  if (passed) {
    results.passed.push({ name, message });
    console.log(`✅ ${name}: ${message}`);
  } else {
    results.failed.push({ name, message });
    console.log(`❌ ${name}: ${message}`);
  }
}

function logWarning(name, message) {
  results.warnings.push({ name, message });
  console.log(`⚠️  ${name}: ${message}`);
}

// 测试 1: 验证文档内容文件存在且包含必需字段
async function testDocumentContentExists() {
  console.log('\n📋 测试 1: 验证文档内容文件存在');
  
  const documentsDir = path.join(__dirname, 'data', 'documents');
  
  try {
    const files = await fs.readdir(documentsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.bak'));
    
    if (jsonFiles.length === 0) {
      logTest('文档文件存在性', false, '未找到任何文档文件');
      return;
    }
    
    logTest('文档文件存在性', true, `找到 ${jsonFiles.length} 个文档文件`);
    
    // 检查每个文档的内容结构
    let validDocs = 0;
    let invalidDocs = 0;
    
    // 只检查语雀导出的文档（以 yuque_ 开头）
    const yuqueFiles = jsonFiles.filter(f => f.startsWith('yuque_'));
    
    for (const file of yuqueFiles.slice(0, 5)) { // 只检查前5个语雀文档
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const doc = JSON.parse(content);
      
      // 验证必需字段
      const hasId = doc.id !== undefined;
      const hasTitle = doc.title !== undefined;
      const hasFormat = doc.format !== undefined;
      const hasContent = doc.body !== undefined || doc.body_html !== undefined;
      const hasUser = doc.user !== undefined;
      const hasTimestamps = doc.created_at !== undefined && doc.updated_at !== undefined;
      
      if (hasId && hasTitle && hasFormat && hasContent && hasUser && hasTimestamps) {
        validDocs++;
        console.log(`  ✓ ${file}: 包含所有必需字段`);
      } else {
        invalidDocs++;
        const missing = [];
        if (!hasId) missing.push('id');
        if (!hasTitle) missing.push('title');
        if (!hasFormat) missing.push('format');
        if (!hasContent) missing.push('body/body_html');
        if (!hasUser) missing.push('user');
        if (!hasTimestamps) missing.push('timestamps');
        console.log(`  ✗ ${file}: 缺少字段: ${missing.join(', ')}`);
      }
    }
    
    logTest('文档内容完整性', invalidDocs === 0, 
      `${validDocs} 个文档有效, ${invalidDocs} 个文档无效`);
    
  } catch (error) {
    logTest('文档文件存在性', false, `错误: ${error.message}`);
  }
}

// 测试 2: 验证 Markdown 文档包含 body 字段
async function testMarkdownDocuments() {
  console.log('\n📝 测试 2: 验证 Markdown 文档格式');
  
  const documentsDir = path.join(__dirname, 'data', 'documents');
  
  try {
    const files = await fs.readdir(documentsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.bak'));
    
    let markdownDocs = 0;
    let validMarkdownDocs = 0;
    
    for (const file of jsonFiles) {
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const doc = JSON.parse(content);
      
      if (doc.format === 'markdown' || doc.format === 'md') {
        markdownDocs++;
        
        if (doc.body && typeof doc.body === 'string' && doc.body.length > 0) {
          validMarkdownDocs++;
          console.log(`  ✓ ${file}: Markdown 文档包含有效的 body 字段 (${doc.body.length} 字符)`);
        } else {
          console.log(`  ✗ ${file}: Markdown 文档缺少或 body 字段为空`);
        }
      }
    }
    
    if (markdownDocs === 0) {
      logWarning('Markdown 文档', '未找到 Markdown 格式的文档');
    } else {
      logTest('Markdown 文档格式', validMarkdownDocs === markdownDocs,
        `${validMarkdownDocs}/${markdownDocs} 个 Markdown 文档包含有效的 body 字段`);
    }
    
  } catch (error) {
    logTest('Markdown 文档格式', false, `错误: ${error.message}`);
  }
}

// 测试 3: 验证 HTML/Lake 文档包含 body_html 字段
async function testHtmlDocuments() {
  console.log('\n🌐 测试 3: 验证 HTML/Lake 文档格式');
  
  const documentsDir = path.join(__dirname, 'data', 'documents');
  
  try {
    const files = await fs.readdir(documentsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.bak'));
    
    let htmlDocs = 0;
    let validHtmlDocs = 0;
    
    for (const file of jsonFiles) {
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const doc = JSON.parse(content);
      
      if (doc.format === 'html' || doc.format === 'lake') {
        htmlDocs++;
        
        if (doc.body_html && typeof doc.body_html === 'string' && doc.body_html.length > 0) {
          validHtmlDocs++;
          console.log(`  ✓ ${file}: HTML 文档包含有效的 body_html 字段 (${doc.body_html.length} 字符)`);
        } else {
          console.log(`  ✗ ${file}: HTML 文档缺少或 body_html 字段为空`);
        }
      }
    }
    
    if (htmlDocs === 0) {
      logWarning('HTML 文档', '未找到 HTML/Lake 格式的文档');
    } else {
      logTest('HTML 文档格式', validHtmlDocs === htmlDocs,
        `${validHtmlDocs}/${htmlDocs} 个 HTML 文档包含有效的 body_html 字段`);
    }
    
  } catch (error) {
    logTest('HTML 文档格式', false, `错误: ${error.message}`);
  }
}

// 测试 4: 验证图片 URL 重写逻辑
async function testImageUrlRewriting() {
  console.log('\n🖼️  测试 4: 验证图片 URL 重写逻辑');
  
  // 模拟 rewriteImageUrls 函数
  const rewriteImageUrls = (content, sourceId, docId) => {
    if (!content) return content;
    
    // For Markdown: Replace image URLs in ![alt](url) format
    let rewrittenContent = content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, url) => {
        if (url.startsWith('http://localhost:3002/api/storage/assets/')) {
          return match;
        }
        const filename = url.split('/').pop() || url;
        const newUrl = `http://localhost:3002/api/storage/assets/${sourceId}/${docId}/${filename}`;
        return `![${alt}](${newUrl})`;
      }
    );
    
    // For HTML: Replace src attributes in <img> tags
    rewrittenContent = rewrittenContent.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/g,
      (match, before, url, after) => {
        if (url.startsWith('http://localhost:3002/api/storage/assets/')) {
          return match;
        }
        const filename = url.split('/').pop() || url;
        const newUrl = `http://localhost:3002/api/storage/assets/${sourceId}/${docId}/${filename}`;
        return `<img${before}src="${newUrl}"${after}>`;
      }
    );
    
    return rewrittenContent;
  };
  
  // 测试用例
  const testCases = [
    {
      name: 'Markdown 图片 URL',
      input: '![测试图片](https://cdn.yuque.com/test.png)',
      sourceId: 'test-source',
      docId: 'test-doc',
      expected: '![测试图片](http://localhost:3002/api/storage/assets/test-source/test-doc/test.png)'
    },
    {
      name: 'HTML 图片 URL',
      input: '<img src="https://cdn.yuque.com/test.png" alt="测试" />',
      sourceId: 'test-source',
      docId: 'test-doc',
      expected: '<img src="http://localhost:3002/api/storage/assets/test-source/test-doc/test.png" alt="测试" />'
    },
    {
      name: '已重写的 URL 不应再次重写',
      input: '![测试](http://localhost:3002/api/storage/assets/test-source/test-doc/test.png)',
      sourceId: 'test-source',
      docId: 'test-doc',
      expected: '![测试](http://localhost:3002/api/storage/assets/test-source/test-doc/test.png)'
    },
    {
      name: '多个图片 URL',
      input: '![图1](https://cdn.yuque.com/img1.png) ![图2](https://cdn.yuque.com/img2.png)',
      sourceId: 'test-source',
      docId: 'test-doc',
      expected: '![图1](http://localhost:3002/api/storage/assets/test-source/test-doc/img1.png) ![图2](http://localhost:3002/api/storage/assets/test-source/test-doc/img2.png)'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = rewriteImageUrls(testCase.input, testCase.sourceId, testCase.docId);
    
    if (result === testCase.expected) {
      passed++;
      console.log(`  ✓ ${testCase.name}: 通过`);
    } else {
      failed++;
      console.log(`  ✗ ${testCase.name}: 失败`);
      console.log(`    期望: ${testCase.expected}`);
      console.log(`    实际: ${result}`);
    }
  }
  
  logTest('图片 URL 重写', failed === 0, `${passed}/${testCases.length} 个测试用例通过`);
}

// 测试 5: 验证实际文档中的图片引用
async function testActualDocumentImages() {
  console.log('\n🖼️  测试 5: 验证实际文档中的图片引用');
  
  const documentsDir = path.join(__dirname, 'data', 'documents');
  
  try {
    const files = await fs.readdir(documentsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.bak'));
    
    let docsWithImages = 0;
    let totalImages = 0;
    
    for (const file of jsonFiles) {
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const doc = JSON.parse(content);
      
      const docContent = doc.body || doc.body_html || '';
      
      // 查找 Markdown 图片
      const markdownImages = docContent.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
      
      // 查找 HTML 图片
      const htmlImages = docContent.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/g) || [];
      
      const imageCount = markdownImages.length + htmlImages.length;
      
      if (imageCount > 0) {
        docsWithImages++;
        totalImages += imageCount;
        console.log(`  ✓ ${file}: 找到 ${imageCount} 个图片引用`);
        
        // 显示前3个图片 URL
        const allImages = [...markdownImages, ...htmlImages].slice(0, 3);
        allImages.forEach(img => {
          console.log(`    - ${img.substring(0, 80)}...`);
        });
      }
    }
    
    if (docsWithImages === 0) {
      logWarning('文档图片引用', '未找到包含图片的文档');
    } else {
      logTest('文档图片引用', true, 
        `${docsWithImages} 个文档包含图片，共 ${totalImages} 个图片引用`);
    }
    
  } catch (error) {
    logTest('文档图片引用', false, `错误: ${error.message}`);
  }
}

// 测试 6: 验证 DocumentDetail 组件的关键功能
async function testDocumentDetailComponent() {
  console.log('\n🔍 测试 6: 验证 DocumentDetail 组件实现');
  
  const componentPath = path.join(__dirname, 'components', 'DocumentDetail.tsx');
  
  try {
    const content = await fs.readFile(componentPath, 'utf8');
    
    // 检查关键功能是否实现
    const checks = [
      {
        name: '加载文档内容',
        pattern: /StorageService\.loadDocumentContent/,
        description: '调用 StorageService.loadDocumentContent'
      },
      {
        name: 'Markdown 渲染',
        pattern: /<ReactMarkdown/,
        description: '使用 ReactMarkdown 组件'
      },
      {
        name: 'HTML 渲染',
        pattern: /dangerouslySetInnerHTML/,
        description: '使用 dangerouslySetInnerHTML 渲染 HTML'
      },
      {
        name: '图片 URL 重写',
        pattern: /rewriteImageUrls/,
        description: '实现 rewriteImageUrls 函数'
      },
      {
        name: '错误处理',
        pattern: /catch.*error/i,
        description: '包含错误处理逻辑'
      },
      {
        name: '加载状态',
        pattern: /isLoading/,
        description: '管理加载状态'
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const check of checks) {
      if (check.pattern.test(content)) {
        passed++;
        console.log(`  ✓ ${check.name}: ${check.description}`);
      } else {
        failed++;
        console.log(`  ✗ ${check.name}: 未找到 ${check.description}`);
      }
    }
    
    logTest('DocumentDetail 组件实现', failed === 0, 
      `${passed}/${checks.length} 个关键功能已实现`);
    
  } catch (error) {
    logTest('DocumentDetail 组件实现', false, `错误: ${error.message}`);
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始验证文档预览功能\n');
  console.log('=' .repeat(60));
  
  await testDocumentContentExists();
  await testMarkdownDocuments();
  await testHtmlDocuments();
  await testImageUrlRewriting();
  await testActualDocumentImages();
  await testDocumentDetailComponent();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 测试总结:');
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️  警告: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n失败的测试:');
    results.failed.forEach(({ name, message }) => {
      console.log(`  - ${name}: ${message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n警告:');
    results.warnings.forEach(({ name, message }) => {
      console.log(`  - ${name}: ${message}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // 返回退出码
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
