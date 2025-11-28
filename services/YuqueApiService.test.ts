import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YuqueApiService } from './YuqueApiService';
import type { YuqueSourceConfig } from '../types';

describe('YuqueApiService', () => {
  let config: YuqueSourceConfig;
  let apiService: YuqueApiService;

  beforeEach(() => {
    config = {
      id: 'test-1',
      name: '测试知识库',
      baseUrl: 'https://test.yuque.com',
      groupLogin: 'test-group',
      bookSlug: 'test-book',
      token: 'test-token',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };
    apiService = new YuqueApiService(config);
  });

  describe('API 请求构造', () => {
    it('应该正确构造 API 服务实例', () => {
      expect(apiService).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理 401 未授权错误', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const result = await apiService.validateAccess();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('令牌无效');
    });

    it('应该处理 403 禁止访问错误', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });

      const result = await apiService.validateAccess();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('无权限访问');
    });

    it('应该处理 429 限流错误并重试', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({ message: 'Rate limit exceeded' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 1 } }),
        });
      });

      const result = await apiService.validateAccess();
      expect(callCount).toBeGreaterThan(1);
    });

    it('应该处理网络超时', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await apiService.validateAccess();
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('API 验证', () => {
    it('应该验证有效的配置', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 1, name: 'Test Book' } }),
      });

      const result = await apiService.validateAccess();
      expect(result.valid).toBe(true);
    });
  });
});
