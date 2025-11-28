/**
 * 手动测试脚本 - 测试完整数据流
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import { Buffer } from 'buffer';

const BASE_URL = 'http://localhost:3002/api/storage';

async function testDataFlow() {
  console.log('开始测试完整数据流...\n');

  try {
    // 1. 测试配置保存和加载
    console.log('1. 测试语雀配置...');
    const yuqueConfig = {
      configs: [{
        id: 'manual-test-source',
        name: '手动测试源',
        domain: 'test.yuque.com',
        token: 'test-token',
        namespace: 'test-namespace',
        type: 'yuque',
        createdAt: new Date().toISOString(),
        lastSyncAt: null,
        status: 'active'
      }]
    };

    const saveConfigRes = await fetch(`${BASE_URL}/configs/yuque`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: yuqueConfig })
    });
    console.log('  保存配置:', saveConfigRes.ok ? '✓' : '✗');

    const loadConfigRes = await fetch(`${BASE_URL}/configs/yuque`);
    const loadedConfig = await loadConfigRes.json();
    console.log('  加载配置:', loadedConfig.data?.configs?.length > 0 ? '✓' : '✗');

    // 2. 测试文档内容保存和加载
    console.log('\n2. 测试文档内容...');
    const docContent = {
      id: 'manual-test-doc',
      title: '手动测试文档',
      body: '# 测试文档\n\n这是一个测试文档。',
      format: 'markdown'
    };

    const saveDocRes = await fetch(`${BASE_URL}/documents/manual-test-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: docContent })
    });
    console.log('  保存文档:', saveDocRes.ok ? '✓' : '✗');

    const loadDocRes = await fetch(`${BASE_URL}/documents/manual-test-doc`);
    const loadedDoc = await loadDocRes.json();
    console.log('  加载文档:', loadedDoc.content?.id === 'manual-test-doc' ? '✓' : '✗');

    // 3. 测试资源文件保存和访问
    console.log('\n3. 测试资源文件...');
    const formData = new FormData();
    const testBuffer = Buffer.from('这是测试图片数据');
    formData.append('file', testBuffer, {
      filename: 'test-image.png',
      contentType: 'image/png'
    });

    const saveAssetRes = await fetch(
      `${BASE_URL}/assets/manual-test-source/manual-test-doc/test-image.png`,
      {
        method: 'POST',
        body: formData
      }
    );
    const saveAssetData = await saveAssetRes.json();
    console.log('  保存资源:', saveAssetRes.ok ? '✓' : '✗');
    console.log('  资源路径:', saveAssetData.path);

    const loadAssetRes = await fetch(
      `${BASE_URL}/assets/manual-test-source/manual-test-doc/test-image.png`
    );
    console.log('  访问资源:', loadAssetRes.ok ? '✓' : '✗');
    console.log('  资源类型:', loadAssetRes.headers.get('content-type'));

    // 4. 测试文档下载
    console.log('\n4. 测试文档下载...');
    const downloadRes = await fetch(`${BASE_URL}/documents/manual-test-doc/download`);
    console.log('  下载文档:', downloadRes.ok ? '✓' : '✗');
    console.log('  Content-Disposition:', downloadRes.headers.get('content-disposition'));

    // 5. 验证数据持久化
    console.log('\n5. 验证数据持久化...');
    const reloadConfigRes = await fetch(`${BASE_URL}/configs/yuque`);
    const reloadedConfig = await reloadConfigRes.json();
    console.log('  配置持久化:', reloadedConfig.data?.configs?.length > 0 ? '✓' : '✗');

    const reloadDocRes = await fetch(`${BASE_URL}/documents/manual-test-doc`);
    const reloadedDoc = await reloadDocRes.json();
    console.log('  文档持久化:', reloadedDoc.content?.id === 'manual-test-doc' ? '✓' : '✗');

    console.log('\n✅ 所有测试完成！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
  }
}

testDataFlow();
