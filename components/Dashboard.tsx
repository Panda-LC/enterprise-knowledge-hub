
import React from 'react';
import { BarChart3, ArrowUpRight, ArrowDownRight, Zap, Users, FileText, Search, Activity } from 'lucide-react';
import { Card } from './Common';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { useLanguage } from '../i18n';

// Mock Data for Charts (Keep numeric data as is)
const USAGE_DATA = [
  { name: 'Mon', requests: 1240, latency: 120 },
  { name: 'Tue', requests: 1560, latency: 135 },
  { name: 'Wed', requests: 2100, latency: 110 },
  { name: 'Thu', requests: 1850, latency: 125 },
  { name: 'Fri', requests: 2400, latency: 140 },
  { name: 'Sat', requests: 800, latency: 90 },
  { name: 'Sun', requests: 650, latency: 95 },
];

const CHANNEL_DISTRIBUTION = [
  { name: 'Customer Bot', value: 4500 },
  { name: 'Internal HR', value: 2100 },
  { name: 'Website Search', value: 3200 },
  { name: 'Sales Assist', value: 1100 },
];

const TOP_DOCS = [
  { id: 1, title: 'Product_Pricing_2024.docx', calls: 1245, relevance: '98%' },
  { id: 2, title: 'Troubleshooting_Guide_v2.md', calls: 892, relevance: '94%' },
  { id: 3, title: 'Refund_Policy_Global.docx', calls: 756, relevance: '91%' },
  { id: 4, title: 'API_Authentication_Spec.html', calls: 620, relevance: '88%' },
];

const StatCard: React.FC<{ title: string; value: string; change: string; trend: 'up' | 'down'; icon: React.ReactNode }> = ({ title, value, change, trend, icon }) => (
  <Card className="p-6 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      <div className={`flex items-center mt-2 text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
        {trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
        {change} vs last week
      </div>
    </div>
    <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
      {icon}
    </div>
  </Card>
);

export const Dashboard: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dash.title')}</h1>
        <p className="text-slate-500 mt-1">{t('dash.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t('dash.stat.retrievals')} 
          value="14,250" 
          change="12.5%" 
          trend="up" 
          icon={<Zap className="h-5 w-5" />} 
        />
        <StatCard 
          title={t('dash.stat.relevance')} 
          value="92.4%" 
          change="1.2%" 
          trend="up" 
          icon={<Activity className="h-5 w-5" />} 
        />
        <StatCard 
          title={t('dash.stat.assets')} 
          value="1,024" 
          change="3 new" 
          trend="up" 
          icon={<FileText className="h-5 w-5" />} 
        />
        <StatCard 
          title={t('dash.stat.latency')} 
          value="128ms" 
          change="5.4%" 
          trend="down" 
          icon={<Search className="h-5 w-5" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Retrieval Volume */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-semibold text-slate-900 mb-6">{t('dash.chart.volume')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={USAGE_DATA}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" name="Requests" />
                <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency (ms)" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Side Chart: Channel Distribution */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-6">{t('dash.chart.channels')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHANNEL_DISTRIBUTION} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Table: Top Knowledge */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">{t('dash.table.title')}</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">View All Report</button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">{t('dash.table.col.name')}</th>
              <th className="px-6 py-3 text-right">{t('dash.table.col.citations')}</th>
              <th className="px-6 py-3 text-right">{t('dash.table.col.relevance')}</th>
              <th className="px-6 py-3 text-right">{t('dash.table.col.trend')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {TOP_DOCS.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  {doc.title}
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-600">{doc.calls}</td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {doc.relevance}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex items-center justify-end text-green-600 text-xs">
                      <ArrowUpRight className="h-3 w-3 mr-1" /> 12%
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
