import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import FileSystemService from './FileSystemService.js';

/**
 * 配置文件操作单元测试
 * 验证 saveConfig 和 loadConfig 方法的基本功能
 */
describe('FileSystemService - Config Operations', () => {
  let testBaseDir;
  let service;

  beforeEach(async () => {
    // 为每个测试创建唯一的临时目录
    testBaseDir = path.join(process.cwd(), 'test-data', `config-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    service = new FileSystemService(testBaseDir);
    
    // 初始化目录结构
    await service.initializeDirectories();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  it('应该能够保存和加载配置', async () => {
    const testConfig = {
      configs: [
        { id: '1', name: 'Test Config 1', value: 'test1' },
        { id: '2', name: 'Test Config 2', value: 'test2' }
      ]
    };

    // 保存配置
    await service.saveConfig('test', testConfig);

    // 加载配置
    const loadedConfig = await service.loadConfig('test');

    // 验证数据一致性
    expect(loadedConfig).toEqual(testConfig);
  });

  it('当配置文件不存在时应该返回空对象', async () => {
    // 加载不存在的配置
    const loadedConfig = await service.loadConfig('nonexistent');

    // 验证返回空对象
    expect(loadedConfig).toEqual({});
  });

  it('应该能够更新已存在的配置', async () => {
    const initialConfig = { value: 'initial' };
    const updatedConfig = { value: 'updated' };

    // 保存初始配置
    await service.saveConfig('update-test', initialConfig);

    // 更新配置
    await service.saveConfig('update-test', updatedConfig);

    // 加载配置
    const loadedConfig = await service.loadConfig('update-test');

    // 验证是更新后的数据
    expect(loadedConfig).toEqual(updatedConfig);
    expect(loadedConfig).not.toEqual(initialConfig);
  });

  it('应该正确处理复杂的嵌套对象', async () => {
    const complexConfig = {
      level1: {
        level2: {
          level3: {
            array: [1, 2, 3],
            string: 'test',
            boolean: true,
            null: null
          }
        }
      }
    };

    // 保存复杂配置
    await service.saveConfig('complex', complexConfig);

    // 加载配置
    const loadedConfig = await service.loadConfig('complex');

    // 验证数据一致性
    expect(loadedConfig).toEqual(complexConfig);
  });

  it('应该在保存成功后删除备份文件', async () => {
    const testConfig = { test: 'data' };
    const configPath = path.join(testBaseDir, 'configs', 'backup-test.json');
    const backupPath = `${configPath}.bak`;

    // 保存配置
    await service.saveConfig('backup-test', testConfig);

    // 验证备份文件不存在
    await expect(fs.access(backupPath)).rejects.toThrow();
  });

  it('应该能够处理空对象', async () => {
    const emptyConfig = {};

    // 保存空配置
    await service.saveConfig('empty', emptyConfig);

    // 加载配置
    const loadedConfig = await service.loadConfig('empty');

    // 验证数据一致性
    expect(loadedConfig).toEqual(emptyConfig);
  });

  it('应该能够处理数组数据', async () => {
    const arrayConfig = {
      items: ['item1', 'item2', 'item3']
    };

    // 保存数组配置
    await service.saveConfig('array', arrayConfig);

    // 加载配置
    const loadedConfig = await service.loadConfig('array');

    // 验证数据一致性
    expect(loadedConfig).toEqual(arrayConfig);
  });
});
