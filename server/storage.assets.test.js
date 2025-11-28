import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'http://localhost:3002';
const TEST_SOURCE_ID = 'test-source';
const TEST_DOC_ID = 'test-doc';
const TEST_FILENAME = 'test-image.png';

describe('资源 API 端点集成测试', () => {
  // 创建测试用的图片数据（1x1 PNG）
  const testImageBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);

  it('应该成功上传资源文件', async () => {
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', testImageBuffer, {
      filename: TEST_FILENAME,
      contentType: 'image/png'
    });

    // 发送 POST 请求
    const response = await fetch(
      `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/${TEST_FILENAME}`,
      {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('path');
    expect(data.path).toContain(TEST_SOURCE_ID);
    expect(data.path).toContain(TEST_DOC_ID);
    expect(data.path).toContain(TEST_FILENAME);
    expect(data).toHaveProperty('size');
    expect(data.size).toBe(testImageBuffer.length);
  });

  it('应该成功获取已上传的资源文件', async () => {
    // 发送 GET 请求
    const response = await fetch(
      `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/${TEST_FILENAME}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');

    const buffer = await response.buffer();
    expect(buffer.length).toBe(testImageBuffer.length);
    expect(buffer.equals(testImageBuffer)).toBe(true);
  });

  it('应该在资源不存在时返回 404', async () => {
    const response = await fetch(
      `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/non-existent.png`
    );

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('资源文件不存在');
  });

  it('应该在未上传文件时返回 400', async () => {
    // 发送一个没有 multipart/form-data 的 POST 请求
    const response = await fetch(
      `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/test.png`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('未上传文件');
  });

  it('应该正确设置不同文件类型的 Content-Type', async () => {
    const testCases = [
      { filename: 'test.jpg', contentType: 'image/jpeg' },
      { filename: 'test.pdf', contentType: 'application/pdf' },
      { filename: 'test.txt', contentType: 'text/plain' },
      { filename: 'test.json', contentType: 'application/json' }
    ];

    for (const testCase of testCases) {
      // 上传文件
      const formData = new FormData();
      formData.append('file', Buffer.from('test content'), {
        filename: testCase.filename,
        contentType: testCase.contentType
      });

      await fetch(
        `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/${testCase.filename}`,
        {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders()
        }
      );

      // 获取文件并验证 Content-Type
      const response = await fetch(
        `${BASE_URL}/api/storage/assets/${TEST_SOURCE_ID}/${TEST_DOC_ID}/${testCase.filename}`
      );

      expect(response.headers.get('content-type')).toBe(testCase.contentType);
    }
  });

  // 清理测试数据
  afterAll(async () => {
    try {
      const testDir = path.join(process.cwd(), 'data', 'assets', TEST_SOURCE_ID);
      await fs.rm(testDir, { recursive: true, force: true });
      console.log('测试数据已清理');
    } catch (error) {
      console.error('清理测试数据失败:', error);
    }
  });
});
