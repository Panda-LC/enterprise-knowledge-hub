import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './StorageService';

/**
 * 网络超时和重试机制测试
 * 测试需求: 9.3, 9.4
 */
describe('StorageService - 网络超时和重试机制', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 fetch mock
    global.fetch = vi.fn();
  });

  describe('重试机制', () => {
    it('网络超时时应该自动重试最多 3 次', async () => {
      let attemptCount = 0;
      
      // Mock fetch 前 3 次失败，第 4 次成功
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 3) {
          return Promise.reject(new TypeError('Network request failed'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { configs: [] } }),
        });
      });

      const result = await StorageService.loadYuqueConfigs();
      
      // 应该调用了 4 次（初始 + 3 次重试）
      expect(attemptCount).toBe(4);
      expect(result).toEqual([]);
    }, 10000); // 增加超时时间到 10 秒

    it('所有重试都失败后应该抛出错误', async () => {
      // Mock fetch 始终失败
      (global.fetch as any).mockRejectedValue(new TypeError('Network request failed'));

      await expect(
        StorageService.saveYuqueConfigs([])
      ).rejects.toThrow();
      
      // 应该调用了 4 次（初始 + 3 次重试）
      expect(global.fetch).toHaveBeenCalledTimes(4);
    }, 10000); // 增加超时时间到 10 秒

    it('第一次成功时不应该重试', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { configs: [] } }),
      });

      await StorageService.loadYuqueConfigs();
      
      // 只应该调用 1 次
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('第二次重试成功时应该停止重试', async () => {
      let attemptCount = 0;
      
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new TypeError('Network request failed'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { tasks: [] } }),
        });
      });

      await StorageService.loadExportTasks();
      
      // 应该调用了 2 次（初始 + 1 次重试）
      expect(attemptCount).toBe(2);
    });
  });

  describe('指数退避延迟', () => {
    it('重试延迟应该呈指数增长', async () => {
      const delays: number[] = [];
      let attemptCount = 0;
      
      // Mock setTimeout 来捕获延迟时间
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
        if (delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0);
      }) as any);

      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 3) {
          return Promise.reject(new TypeError('Network request failed'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { configs: [] } }),
        });
      });

      await StorageService.loadYuqueConfigs();
      
      // 验证延迟时间：1000ms, 2000ms, 4000ms
      expect(delays).toHaveLength(3);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
      
      vi.restoreAllMocks();
    });
  });

  describe('HTTP 错误处理', () => {
    it('HTTP 4xx 错误不应该重试', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not found' }),
      });

      // loadDocumentContent 捕获错误并返回 null，不会抛出错误
      const result = await StorageService.loadDocumentContent('non-existent');
      expect(result).toBeNull();
      
      // 只应该调用 1 次，不重试
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('HTTP 5xx 错误不应该重试', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(
        StorageService.saveExportTasks([])
      ).rejects.toThrow();
      
      // 只应该调用 1 次，不重试
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误类型处理', () => {
    it('TypeError（网络错误）应该触发重试', async () => {
      let attemptCount = 0;
      
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { items: [] } }),
        });
      });

      await StorageService.loadFileSystemItems();
      
      expect(attemptCount).toBe(3);
    });

    it('包含 timeout 的错误应该触发重试', async () => {
      let attemptCount = 0;
      
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Request timeout'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      await StorageService.saveFileSystemItems([]);
      
      expect(attemptCount).toBe(3);
    });

    it('其他错误不应该触发重试', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Some other error'));

      await expect(
        StorageService.saveDocumentContent('doc-1', {})
      ).rejects.toThrow();
      
      // 只应该调用 1 次
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('并发请求重试', () => {
    it('多个并发请求应该独立重试', async () => {
      let config1Attempts = 0;
      let config2Attempts = 0;
      let config3Attempts = 0;
      
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('yuque')) {
          config1Attempts++;
          if (config1Attempts <= 2) {
            return Promise.reject(new TypeError('Network error'));
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { configs: [] } }),
          });
        } else if (url.includes('tasks')) {
          config2Attempts++;
          if (config2Attempts <= 1) {
            return Promise.reject(new TypeError('Network error'));
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { tasks: [] } }),
          });
        } else if (url.includes('items')) {
          config3Attempts++;
          // 第一次就成功
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { items: [] } }),
          });
        }
      });

      const results = await Promise.all([
        StorageService.loadYuqueConfigs(),
        StorageService.loadExportTasks(),
        StorageService.loadFileSystemItems(),
      ]);
      
      expect(config1Attempts).toBe(3); // 初始 + 2 次重试
      expect(config2Attempts).toBe(2); // 初始 + 1 次重试
      expect(config3Attempts).toBe(1); // 只有初始请求
      expect(results).toHaveLength(3);
    });
  });

  describe('资源上传重试', () => {
    it('资源上传失败不应该自动重试（因为使用 FormData）', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Network error'));

      const blob = new Blob(['test data'], { type: 'text/plain' });
      
      await expect(
        StorageService.saveAsset('source-1', 'doc-1', 'test.txt', blob)
      ).rejects.toThrow();
      
      // 资源上传使用不同的 fetch 调用，不经过 request 方法
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误日志记录', () => {
    it('重试时应该记录警告日志', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let attemptCount = 0;
      
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new TypeError('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { configs: [] } }),
        });
      });

      await StorageService.loadYuqueConfigs();
      
      // 应该记录了 2 次警告（2 次重试）
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request failed, retrying')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('最终失败时应该记录错误日志', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (global.fetch as any).mockRejectedValue(new TypeError('Network error'));

      await expect(
        StorageService.saveYuqueConfigs([])
      ).rejects.toThrow();
      
      // 应该记录了错误日志
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Storage API request failed:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    }, 10000); // 增加超时时间到 10 秒
  });

  describe('加载方法的错误处理', () => {
    it('loadYuqueConfigs 失败时应该返回空数组', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockRejectedValue(new Error('Fatal error'));

      const result = await StorageService.loadYuqueConfigs();
      
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('loadExportTasks 失败时应该返回空数组', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockRejectedValue(new Error('Fatal error'));

      const result = await StorageService.loadExportTasks();
      
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('loadFileSystemItems 失败时应该返回空数组', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockRejectedValue(new Error('Fatal error'));

      const result = await StorageService.loadFileSystemItems();
      
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('loadDocumentContent 失败时应该返回 null', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockRejectedValue(new Error('Fatal error'));

      const result = await StorageService.loadDocumentContent('doc-1');
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });
});
