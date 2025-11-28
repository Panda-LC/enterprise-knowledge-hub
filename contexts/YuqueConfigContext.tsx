import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { YuqueSourceConfig } from '../types';
import { StorageService } from '../services/StorageService';
import { YuqueApiService } from '../services/YuqueApiService';

interface YuqueConfigContextType {
  configs: YuqueSourceConfig[];
  addConfig: (config: Omit<YuqueSourceConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateConfig: (id: string, updates: Partial<YuqueSourceConfig>) => Promise<void>;
  deleteConfig: (id: string) => void;
  getConfig: (id: string) => YuqueSourceConfig | undefined;
  validateConfig: (config: Partial<YuqueSourceConfig>) => Promise<{ valid: boolean; error?: string }>;
}

const YuqueConfigContext = createContext<YuqueConfigContextType | undefined>(undefined);

export const YuqueConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [configs, setConfigs] = useState<YuqueSourceConfig[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load configs from file system on mount
  useEffect(() => {
    const loadConfigs = async () => {
      const loadedConfigs = await StorageService.loadYuqueConfigs();
      setConfigs(loadedConfigs);
      setLoaded(true);
    };
    loadConfigs();
  }, []);

  // Save configs to file system whenever they change
  useEffect(() => {
    const saveConfigs = async () => {
      if (!loaded) return;
      try {
        await StorageService.saveYuqueConfigs(configs);
      } catch (error) {
        console.error('Failed to save Yuque configs:', error);
      }
    };
    saveConfigs();
  }, [configs, loaded]);

  const addConfig = async (
    config: Omit<YuqueSourceConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    // Validate the config first
    const validation = await validateConfig(config);
    if (!validation.valid) {
      throw new Error(validation.error || '配置验证失败');
    }

    const now = new Date().toISOString();
    const newConfig: YuqueSourceConfig = {
      ...config,
      id: `yuque_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };

    setConfigs(prev => [...prev, newConfig]);
  };

  const updateConfig = async (
    id: string,
    updates: Partial<YuqueSourceConfig>
  ): Promise<void> => {
    const existingConfig = configs.find(c => c.id === id);
    if (!existingConfig) {
      throw new Error('配置不存在');
    }

    // Create updated config for validation
    const updatedConfig = { ...existingConfig, ...updates };
    
    // Re-validate if critical fields changed
    if (
      updates.baseUrl ||
      updates.groupLogin ||
      updates.bookSlug ||
      updates.token
    ) {
      const validation = await validateConfig(updatedConfig);
      if (!validation.valid) {
        throw new Error(validation.error || '配置验证失败');
      }
    }

    setConfigs(prev =>
      prev.map(config =>
        config.id === id
          ? { ...config, ...updates, updatedAt: new Date().toISOString() }
          : config
      )
    );
  };

  const deleteConfig = (id: string): void => {
    setConfigs(prev => prev.filter(config => config.id !== id));
  };

  const getConfig = (id: string): YuqueSourceConfig | undefined => {
    return configs.find(config => config.id === id);
  };

  const validateConfig = async (
    config: Partial<YuqueSourceConfig>
  ): Promise<{ valid: boolean; error?: string }> => {
    // Check required fields
    if (!config.name || !config.baseUrl || !config.groupLogin || !config.bookSlug || !config.token) {
      return {
        valid: false,
        error: '请填写所有必填字段',
      };
    }

    // Validate URL format
    try {
      new URL(config.baseUrl);
    } catch {
      return {
        valid: false,
        error: '企业域名格式不正确',
      };
    }

    // Test API access
    try {
      const apiService = new YuqueApiService(config as YuqueSourceConfig);
      const result = await apiService.validateAccess();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        return {
          valid: false,
          error: error.message,
        };
      }
      return {
        valid: false,
        error: '验证失败',
      };
    }
  };

  return (
    <YuqueConfigContext.Provider
      value={{
        configs,
        addConfig,
        updateConfig,
        deleteConfig,
        getConfig,
        validateConfig,
      }}
    >
      {children}
    </YuqueConfigContext.Provider>
  );
};

export const useYuqueConfig = () => {
  const context = useContext(YuqueConfigContext);
  if (!context) {
    throw new Error('useYuqueConfig must be used within a YuqueConfigProvider');
  }
  return context;
};
