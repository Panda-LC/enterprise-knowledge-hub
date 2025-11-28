import React, { useState } from 'react';
import { Play, Clock, Calendar, Terminal, CheckCircle2, XCircle, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { Button, Card, Badge, Label } from './Common';
import { LoadingSpinner } from './LoadingSpinner';
import { useLanguage } from '../i18n';
import { useYuqueConfig } from '../contexts/YuqueConfigContext';
import { useExportTask } from '../contexts/ExportTaskContext';

export const AutomationScheduler: React.FC = () => {
  const { t } = useLanguage();
  const { configs } = useYuqueConfig();
  const { tasks, logs, createTask, runTask } = useExportTask();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    sourceId: '',
    triggerType: 'manual' as 'manual' | 'schedule',
    interval: 'daily' as 'hourly' | 'daily' | 'weekly',
  });

  const handleCreateTask = () => {
    if (!formData.name || !formData.sourceId) {
      alert('请填写任务名称和选择语雀源');
      return;
    }

    const sourceConfig = configs.find(c => c.id === formData.sourceId);
    if (!sourceConfig) {
      alert('语雀源不存在');
      return;
    }

    if (sourceConfig.status === 'error') {
      alert(`语雀配置状态异常: ${sourceConfig.errorMessage || '未知错误'}。请先修复配置。`);
      return;
    }

    try {
      createTask({
        name: formData.name,
        sourceId: formData.sourceId,
        sourceName: sourceConfig.name,
        triggerType: formData.triggerType,
        scheduleConfig: formData.triggerType === 'schedule' ? {
          interval: formData.interval,
        } : undefined,
      });

      setIsFormOpen(false);
      setFormData({
        name: '',
        sourceId: '',
        triggerType: 'manual',
        interval: 'daily',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '创建任务失败';
      alert(errorMsg);
    }
  };

  const handleRunTask = async (taskId: string) => {
    setRunningTasks(prev => new Set(prev).add(taskId));
    try {
      await runTask(taskId);
    } catch (error) {
      console.error('Failed to run task:', error);
    } finally {
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getLogIcon = (status: string) => {
    switch(status) {
      case 'Success': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'Error': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('auto.title')}</h1>
          <p className="text-slate-500 mt-1">{t('auto.subtitle')}</p>
        </div>
        <Button onClick={() => setIsFormOpen(!isFormOpen)}>
          <Plus className="h-4 w-4 mr-2" /> {t('auto.btn.create')}
        </Button>
      </div>

      {isFormOpen && (
        <Card className="p-6 border-primary-200 bg-primary-50/30">
          <h3 className="font-semibold text-slate-900 mb-4">新建导出任务</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>任务名称</Label>
              <input
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="例如：每日同步产品文档"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>触发类型</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                value={formData.triggerType}
                onChange={(e) => setFormData({...formData, triggerType: e.target.value as 'manual' | 'schedule'})}
              >
                <option value="manual">手动触发</option>
                <option value="schedule">定时任务</option>
              </select>
            </div>
            {formData.triggerType === 'schedule' && (
              <div>
                <Label>执行频率</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={formData.interval}
                  onChange={(e) => setFormData({...formData, interval: e.target.value as 'hourly' | 'daily' | 'weekly'})}
                >
                  <option value="hourly">每小时</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                </select>
              </div>
            )}
            <div>
              <Label>语雀源</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                value={formData.sourceId}
                onChange={(e) => setFormData({...formData, sourceId: e.target.value})}
              >
                <option value="">请选择语雀源</option>
                {configs.map(config => (
                  <option key={config.id} value={config.id}>{config.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateTask}>{t('common.confirm')}</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task List */}
        <div className="lg:col-span-2 space-y-4">
          {tasks.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-slate-600">暂无导出任务</p>
                <p className="text-sm mt-1">点击"创建任务"按钮添加新的导出任务</p>
              </div>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="p-5 flex items-center justify-between group hover:border-primary-300 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg mt-1 ${task.status === 'running' ? 'bg-green-100' : 'bg-slate-100'}`}>
                     {task.triggerType === 'schedule' ? <Calendar className="h-5 w-5 text-slate-700" /> : <Clock className="h-5 w-5 text-slate-700" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{task.name}</h3>
                      <Badge variant={
                        task.status === 'running' ? 'success' : 
                        task.status === 'error' ? 'warning' : 
                        'outline'
                      }>
                        {task.status === 'running' ? '运行中' : 
                         task.status === 'success' ? '成功' : 
                         task.status === 'error' ? '失败' : 
                         '空闲'}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      <span>来源: {task.sourceName}</span>
                      <span className="mx-2">•</span>
                      <span>{task.triggerType === 'schedule' ? `定时 (${task.scheduleConfig?.interval})` : '手动'}</span>
                    </div>
                    {task.lastRunMessage && (
                      <div className="text-xs text-slate-400 mt-1">{task.lastRunMessage}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className="text-xs text-slate-400 font-mono">
                     {t('auto.col.last_run')}: {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString('zh-CN') : '从未运行'}
                   </span>
                   <Button 
                     size="sm" 
                     onClick={() => handleRunTask(task.id)}
                     disabled={task.status === 'running' || runningTasks.has(task.id)}
                   >
                     {(task.status === 'running' || runningTasks.has(task.id)) ? (
                       <>
                         <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                         运行中
                       </>
                     ) : (
                       <>
                         <Play className="h-4 w-4 mr-1" />
                         立即执行
                       </>
                     )}
                   </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Right: Console Logs */}
        <Card className="bg-slate-900 text-slate-300 p-0 overflow-hidden flex flex-col h-[600px]">
          <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950">
            <Terminal className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-mono font-semibold">{t('auto.logs.title')}</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-3 overflow-y-auto flex-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center mt-8">暂无日志</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                  <div className="flex gap-2 items-start">
                    <div className="mt-0.5">{getLogIcon(log.status)}</div>
                    <span className={log.status === 'Error' ? 'text-red-400' : 'text-slate-300'}>
                      {log.message}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div className="h-4" /> {/* Spacer */}
          </div>
        </Card>
      </div>
    </div>
  );
};
