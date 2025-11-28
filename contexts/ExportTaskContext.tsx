import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ExportTask, LogEntry } from '../types';
import { StorageService } from '../services/StorageService';
import { ExportService } from '../services/ExportService';
import { useYuqueConfig } from './YuqueConfigContext';
import { useFileSystem } from './FileSystemContext';

interface ExportTaskContextType {
  tasks: ExportTask[];
  logs: LogEntry[];
  createTask: (task: Omit<ExportTask, 'id' | 'createdAt' | 'status'>) => void;
  deleteTask: (id: string) => void;
  runTask: (id: string) => Promise<void>;
  getTask: (id: string) => ExportTask | undefined;
  addLog: (message: string, status: 'Success' | 'Error' | 'Info') => void;
  clearLogs: () => void;
}

const ExportTaskContext = createContext<ExportTaskContextType | undefined>(undefined);

export const ExportTaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<ExportTask[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { getConfig } = useYuqueConfig();
  const fileSystemContext = useFileSystem();

  // Load tasks from file system on mount
  useEffect(() => {
    const loadTasks = async () => {
      const loadedTasks = await StorageService.loadExportTasks();
      setTasks(loadedTasks);
      setLoaded(true);
    };
    loadTasks();
  }, []);

  // Save tasks to file system whenever they change
  useEffect(() => {
    const saveTasks = async () => {
      if (!loaded) return;
      try {
        await StorageService.saveExportTasks(tasks);
      } catch (error) {
        console.error('Failed to save export tasks:', error);
      }
    };
    saveTasks();
  }, [tasks, loaded]);

  const addLog = (message: string, status: 'Success' | 'Error' | 'Info'): void => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('zh-CN', { hour12: false });
    
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp,
      message,
      status,
    };

    setLogs(prev => [...prev, newLog].slice(-100)); // Keep last 100 logs
  };

  const runTask = async (id: string): Promise<void> => {
    const task = tasks.find(t => t.id === id);
    if (!task) {
      addLog(`任务不存在: ${id}`, 'Error');
      return;
    }

    // Get source config
    const config = getConfig(task.sourceId);
    if (!config) {
      addLog(`语雀配置不存在: ${task.sourceId}`, 'Error');
      updateTaskStatus(id, 'error', '配置不存在');
      return;
    }

    // Check if config is active
    if (config.status === 'error') {
      addLog(`语雀配置状态异常: ${config.errorMessage || '未知错误'}`, 'Error');
      updateTaskStatus(id, 'error', '配置状态异常');
      return;
    }

    // Update task status to running
    updateTaskStatus(id, 'running');
    addLog(`开始执行任务: ${task.name}`, 'Info');

    try {
      // Create export service
      const exportService = new ExportService(
        config,
        fileSystemContext,
        (message, status) => addLog(message, status)
      );

      // Run export
      const result = await exportService.export();

      if (result.success) {
        updateTaskStatus(id, 'success', result.message);
        addLog(`任务完成: ${task.name}`, 'Success');
      } else {
        updateTaskStatus(id, 'error', result.message);
        addLog(`任务失败: ${task.name} - ${result.message}`, 'Error');
      }
    } catch (error) {
      let errorMsg = '未知错误';
      
      if (error instanceof Error) {
        errorMsg = error.message;
        
        // Handle specific error types
        if (error.message.includes('CORS') || error.message.includes('跨域')) {
          addLog('网络请求被阻止，请检查 CORS 配置或使用代理服务器', 'Error');
        } else if (error.message.includes('令牌')) {
          addLog('访问令牌无效，请更新语雀配置', 'Error');
        } else if (error.message.includes('权限')) {
          addLog('无权限访问，请检查语雀配置和知识库权限', 'Error');
        }
      }
      
      updateTaskStatus(id, 'error', errorMsg);
      addLog(`任务异常: ${task.name} - ${errorMsg}`, 'Error');
    }
  };

  // Schedule tasks
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];

    tasks.forEach(task => {
      if (task.triggerType === 'schedule' && task.scheduleConfig) {
        const { interval } = task.scheduleConfig;
        let ms = 0;

        switch (interval) {
          case 'hourly':
            ms = 60 * 60 * 1000;
            break;
          case 'daily':
            ms = 24 * 60 * 60 * 1000;
            break;
          case 'weekly':
            ms = 7 * 24 * 60 * 60 * 1000;
            break;
        }

        if (ms > 0) {
          const intervalId = setInterval(() => {
            addLog(`定时任务触发: ${task.name}`, 'Info');
            runTask(task.id);
          }, ms);
          intervals.push(intervalId);
        }
      }
    });

    return () => {
      intervals.forEach(id => clearInterval(id));
    };
  }, [tasks]);

  const createTask = (
    task: Omit<ExportTask, 'id' | 'createdAt' | 'status'>
  ): void => {
    const now = new Date().toISOString();
    const newTask: ExportTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: now,
      status: 'idle',
    };

    setTasks(prev => [...prev, newTask]);
  };

  const deleteTask = (id: string): void => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const updateTaskStatus = (
    id: string,
    status: ExportTask['status'],
    message?: string
  ): void => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? {
              ...task,
              status,
              lastRunAt: new Date().toISOString(),
              lastRunStatus: status === 'success' ? 'success' : status === 'error' ? 'error' : task.lastRunStatus,
              lastRunMessage: message || task.lastRunMessage,
            }
          : task
      )
    );
  };

  const getTask = (id: string): ExportTask | undefined => {
    return tasks.find(task => task.id === id);
  };

  const clearLogs = (): void => {
    setLogs([]);
  };

  return (
    <ExportTaskContext.Provider
      value={{
        tasks,
        logs,
        createTask,
        deleteTask,
        runTask,
        getTask,
        addLog,
        clearLogs,
      }}
    >
      {children}
    </ExportTaskContext.Provider>
  );
};

export const useExportTask = () => {
  const context = useContext(ExportTaskContext);
  if (!context) {
    throw new Error('useExportTask must be used within an ExportTaskProvider');
  }
  return context;
};
