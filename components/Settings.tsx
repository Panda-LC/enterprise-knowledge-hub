
import React, { useState } from 'react';
import { User, Globe, Lock, Bell, LogOut, Mail, Shield } from 'lucide-react';
import { Button, Card, Input, Label, Badge } from './Common';
import { useLanguage } from '../i18n';

export const Settings: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('settings.tab.profile'), icon: User },
    { id: 'preferences', label: t('settings.tab.preferences'), icon: Globe },
    { id: 'security', label: t('settings.tab.security'), icon: Lock },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="md:col-span-1 p-2 h-fit">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`mr-3 h-4 w-4 ${activeTab === tab.id ? 'text-primary-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <Card className="p-6 space-y-8">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{t('settings.profile.public')}</h3>
                <p className="text-sm text-slate-500">{t('settings.profile.desc')}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-primary-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  JD
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">Change Avatar</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>{t('settings.label.fullname')}</Label>
                  <Input defaultValue="John Doe" />
                </div>
                <div>
                  <Label>{t('settings.label.job')}</Label>
                  <Input defaultValue="Knowledge Manager" />
                </div>
                <div className="md:col-span-2">
                  <Label>{t('settings.label.bio')}</Label>
                  <Input defaultValue="Managing the enterprise knowledge base since 2022." />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end">
                <Button>{t('settings.btn.save')}</Button>
              </div>
            </Card>
          )}

          {activeTab === 'preferences' && (
            <Card className="p-6 space-y-8">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{t('settings.tab.preferences')}</h3>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">{t('settings.lang.label')}</div>
                    <div className="text-xs text-slate-500">{t('settings.lang.desc')}</div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setLanguage('en')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${language === 'en' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      English
                    </button>
                    <button 
                      onClick={() => setLanguage('zh')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${language === 'zh' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      中文 (Chinese)
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="p-6 space-y-8">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{t('settings.tab.security')}</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="p-2 bg-white rounded-md border border-slate-200">
                      <Mail className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Email Address</div>
                      <div className="text-xs text-slate-500 mt-1">john.doe@enterprise.com</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Update</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
