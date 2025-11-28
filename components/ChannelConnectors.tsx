import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, Server, Globe, MessageSquare, Database, ArrowRight, ArrowDownToLine, ArrowUpFromLine, FileText, Cloud, AlertCircle } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Label } from './Common';
import { LoadingSpinner } from './LoadingSpinner';
import { Channel, ChannelType, ChannelDirection } from '../types';
import { useLanguage } from '../i18n';
import { useYuqueConfig } from '../contexts/YuqueConfigContext';

const MOCK_OUTBOUND_CHANNELS: Channel[] = [
  { id: '1', name: 'Zendesk Help Center', type: ChannelType.REST_API, direction: ChannelDirection.OUTBOUND, icon: 'globe', is_active: true, last_sync: '10 mins ago' },
  { id: '2', name: 'DingTalk Bot', type: ChannelType.WEBHOOK, direction: ChannelDirection.OUTBOUND, icon: 'message', is_active: true, last_sync: '2 hours ago' },
];

export const ChannelConnectors: React.FC = () => {
  const { t } = useLanguage();
  const { configs, addConfig, updateConfig, deleteConfig } = useYuqueConfig();
  
  const [activeTab, setActiveTab] = useState<ChannelDirection>(ChannelDirection.OUTBOUND);
  const [outboundChannels] = useState<Channel[]>(MOCK_OUTBOUND_CHANNELS);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  
  // Yuque config form state
  const [yuqueForm, setYuqueForm] = useState({
    name: '',
    baseUrl: '',
    groupLogin: '',
    bookSlug: '',
    token: '',
  });

  // Convert Yuque configs to Channel format for display
  const yuqueChannels: Channel[] = configs.map(config => ({
    id: config.id,
    name: config.name,
    type: ChannelType.YUQUE,
    direction: ChannelDirection.INBOUND,
    icon: 'cloud',
    is_active: config.status === 'active',
    last_sync: config.lastSyncAt || 'Never',
    yuqueConfig: config,
  }));

  // All channels for display
  const displayedChannels = activeTab === ChannelDirection.OUTBOUND 
    ? outboundChannels 
    : yuqueChannels;

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'globe': return <Globe className="h-6 w-6" />;
      case 'message': return <MessageSquare className="h-6 w-6" />;
      case 'database': return <Database className="h-6 w-6" />;
      case 'file-text': return <FileText className="h-6 w-6" />;
      case 'cloud': return <Cloud className="h-6 w-6" />;
      default: return <Server className="h-6 w-6" />;
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setYuqueForm({
      name: '',
      baseUrl: '',
      groupLogin: '',
      bookSlug: '',
      token: '',
    });
    setValidationError('');
    setIsValidating(false);
    setEditingConfigId(null);
  };

  const handleEditChannel = (channel: Channel) => {
    if (channel.yuqueConfig) {
      setEditingConfigId(channel.yuqueConfig.id);
      setYuqueForm({
        name: channel.yuqueConfig.name,
        baseUrl: channel.yuqueConfig.baseUrl,
        groupLogin: channel.yuqueConfig.groupLogin,
        bookSlug: channel.yuqueConfig.bookSlug,
        token: channel.yuqueConfig.token,
      });
      setWizardStep(2);
      setIsWizardOpen(true);
    }
  };

  const handleSaveYuqueConfig = async () => {
    setIsValidating(true);
    setValidationError('');

    try {
      if (editingConfigId) {
        // Update existing config
        await updateConfig(editingConfigId, {
          name: yuqueForm.name,
          baseUrl: yuqueForm.baseUrl,
          groupLogin: yuqueForm.groupLogin,
          bookSlug: yuqueForm.bookSlug,
          token: yuqueForm.token,
        });
      } else {
        // Add new config
        await addConfig({
          name: yuqueForm.name,
          baseUrl: yuqueForm.baseUrl,
          groupLogin: yuqueForm.groupLogin,
          bookSlug: yuqueForm.bookSlug,
          token: yuqueForm.token,
          status: 'active',
        });
      }

      // Success - move to step 3
      setWizardStep(3);
      setIsValidating(false);
    } catch (error) {
      setIsValidating(false);
      if (error instanceof Error) {
        // Provide more user-friendly error messages
        let errorMessage = error.message;
        
        if (errorMessage.includes('CORS') || errorMessage.includes('跨域')) {
          errorMessage = 'CORS 跨域错误：无法直接访问语雀 API。请确保已启动代理服务器（npm run proxy）';
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('网络')) {
          errorMessage = '网络连接失败，请检查网络连接或代理服务器是否运行';
        } else if (errorMessage.includes('存储空间')) {
          errorMessage = '存储空间不足，请清理旧数据后重试';
        }
        
        setValidationError(errorMessage);
      } else {
        setValidationError('配置保存失败，请重试');
      }
    }
  };

  const handleDeleteChannel = (id: string) => {
    if (window.confirm('确定要删除这个语雀配置吗？已导出的文档将保留，但数据源将标记为"已断开"。')) {
      deleteConfig(id);
    }
  };

  const renderWizardContent = () => {
    switch(wizardStep) {
      case 1:
        return (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">配置语雀知识库源，从语雀导出文档到资产库。</p>
            
            <div>
              <Label>集成类型</Label>
              <div className="mt-2 p-4 border-2 border-primary-500 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                    <Cloud className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">语雀集成 (Yuque Integration)</div>
                    <div className="text-xs text-slate-500">从语雀知识库导出文档和目录结构</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">填写语雀知识库的访问信息。</p>
            
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div className="text-sm text-red-700">{validationError}</div>
              </div>
            )}

            <div>
              <Label>配置名称 *</Label>
              <Input 
                value={yuqueForm.name} 
                onChange={(e) => setYuqueForm({...yuqueForm, name: e.target.value})} 
                placeholder="例如：产品文档知识库" 
              />
            </div>

            <div>
              <Label>企业域名 *</Label>
              <Input 
                value={yuqueForm.baseUrl} 
                onChange={(e) => setYuqueForm({...yuqueForm, baseUrl: e.target.value})} 
                placeholder="https://your-org.yuque.com"
              />
              <p className="text-xs text-slate-400 mt-1">企业子域（推荐）或主域 https://www.yuque.com</p>
            </div>

            <div>
              <Label>团队 Login *</Label>
              <Input 
                value={yuqueForm.groupLogin} 
                onChange={(e) => setYuqueForm({...yuqueForm, groupLogin: e.target.value})} 
                placeholder="例如：nbklz3"
              />
              <p className="text-xs text-slate-400 mt-1">可在语雀团队 URL 中找到</p>
            </div>

            <div>
              <Label>知识库 Slug *</Label>
              <Input 
                value={yuqueForm.bookSlug} 
                onChange={(e) => setYuqueForm({...yuqueForm, bookSlug: e.target.value})} 
                placeholder="例如：dn5ehb"
              />
              <p className="text-xs text-slate-400 mt-1">可在知识库 URL 中找到</p>
            </div>

            <div>
              <Label>访问令牌 *</Label>
              <Input 
                type="password" 
                value={yuqueForm.token} 
                onChange={(e) => setYuqueForm({...yuqueForm, token: e.target.value})} 
                placeholder="在语雀个人设置中生成 Token"
              />
              <p className="text-xs text-slate-400 mt-1">需要有访问目标知识库的权限</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center py-8">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">
              {editingConfigId ? '更新成功！' : '配置成功！'}
            </h3>
            <p className="text-slate-500 mt-2 max-w-xs mx-auto">
              {editingConfigId 
                ? <>已成功更新语雀知识库配置 <strong>{yuqueForm.name}</strong>。</>
                : <>已成功连接到语雀知识库 <strong>{yuqueForm.name}</strong>。现在可以在自动化任务中创建导出任务。</>
              }
            </p>
          </div>
        );

      default: 
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('channel.title')}</h1>
          <p className="text-slate-500 mt-1">{t('channel.subtitle')}</p>
        </div>
        {activeTab === ChannelDirection.INBOUND && (
          <Button onClick={() => { resetWizard(); setIsWizardOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> {t('channel.btn.add')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab(ChannelDirection.OUTBOUND)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === ChannelDirection.OUTBOUND
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            {t('channel.tab.outbound')}
            <Badge variant="outline" className="ml-2">{outboundChannels.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab(ChannelDirection.INBOUND)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === ChannelDirection.INBOUND
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" />
            {t('channel.tab.inbound')}
            <Badge variant="outline" className="ml-2">{yuqueChannels.length}</Badge>
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedChannels.map((channel) => (
          <Card key={channel.id} className="p-6 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${channel.direction === ChannelDirection.INBOUND ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
                {getIcon(channel.icon)}
              </div>
              <Badge variant={channel.is_active ? 'success' : 'outline'}>
                {channel.is_active ? t('channel.card.active') : t('channel.card.disabled')}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{channel.name}</h3>
            <p className="text-xs text-slate-500 font-mono mb-6 flex items-center gap-1">
              {channel.type}
            </p>
            
            {channel.yuqueConfig && (
              <div className="text-xs text-slate-400 mb-4 space-y-1">
                <div>团队: {channel.yuqueConfig.groupLogin}</div>
                <div>知识库: {channel.yuqueConfig.bookSlug}</div>
              </div>
            )}
            
            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                {channel.direction === ChannelDirection.INBOUND ? t('channel.card.last_fetch') : t('channel.card.last_sync')}: 
                <span className="font-medium text-slate-700 ml-1">{channel.last_sync}</span>
              </span>
              {channel.type === ChannelType.YUQUE && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditChannel(channel)}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    编辑
                  </button>
                  <button 
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="text-red-600 hover:text-red-700 font-medium"
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}
        
        {/* Add New Placeholder - only for inbound */}
        {activeTab === ChannelDirection.INBOUND && (
          <button 
            onClick={() => { resetWizard(); setIsWizardOpen(true); }}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 hover:border-primary-400 hover:text-primary-500 hover:bg-slate-50 transition-all min-h-[200px]"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span className="font-medium text-sm">{t('channel.btn.add')}</span>
          </button>
        )}
      </div>

      {/* Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => { 
          if (wizardStep === 3) {
            setIsWizardOpen(false); 
            resetWizard();
          } else {
            setIsWizardOpen(false);
            resetWizard();
          }
        }}
        title={wizardStep === 3 ? (editingConfigId ? '更新成功' : '配置完成') : (editingConfigId ? `编辑语雀配置 (步骤 ${wizardStep}/2)` : `语雀集成配置 (步骤 ${wizardStep}/2)`)}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-between w-full">
            {wizardStep < 3 && (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => setWizardStep(prev => Math.max(1, prev - 1))}
                  disabled={wizardStep === 1}
                >
                  {t('common.back')}
                </Button>
                <div className="flex gap-2">
                  {wizardStep === 1 && (
                    <Button onClick={() => setWizardStep(2)}>
                      {t('common.next')} <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  {wizardStep === 2 && (
                    <Button 
                      onClick={handleSaveYuqueConfig}
                      disabled={isValidating || !yuqueForm.name || !yuqueForm.baseUrl || !yuqueForm.groupLogin || !yuqueForm.bookSlug || !yuqueForm.token}
                    >
                      {isValidating ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span className="ml-2">验证中...</span>
                        </>
                      ) : (
                        editingConfigId ? '更新并验证' : '保存并验证'
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
            {wizardStep === 3 && (
              <Button onClick={() => { setIsWizardOpen(false); resetWizard(); }} className="ml-auto">
                {t('common.finish')}
              </Button>
            )}
          </div>
        }
      >
        <div className="py-2 min-h-[300px]">
          {renderWizardContent()}
        </div>
      </Modal>
    </div>
  );
};
