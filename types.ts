
export enum FileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  MD = 'MD',
  HTML = 'HTML',
  FOLDER = 'FOLDER' // Added Folder type
}

export enum DocStatus {
  DRAFT = 'Draft',
  ACTIVE = 'Active',
  ARCHIVED = 'Archived'
}

export enum ChannelType {
  WEBHOOK = 'Webhook',
  REST_API = 'REST API',
  S3_BUCKET = 'S3 Bucket',
  YUQUE = 'Yuque Integration',
  NOTION = 'Notion Integration',
  CONFLUENCE = 'Confluence Sync',
  WEBSITE = 'Website Crawler'
}

export enum ChannelDirection {
  INBOUND = 'Inbound',   // Input Source (Ingestion)
  OUTBOUND = 'Outbound'  // Output Target (Distribution)
}

export enum TriggerType {
  MANUAL = 'Manual',
  SCHEDULE = 'Schedule',
  EVENT_BASED = 'Event Based'
}

export interface FileSystemItem {
  id: string;
  parentId: string | null; // null for root (Knowledge Base level)
  title: string;
  type: FileType;
  updated_at: string;
  owner_name: string;
  size?: string;
  // Specific to Files
  status?: DocStatus;
  current_version?: string;
  sync_status?: 'Synced' | 'Pending' | 'Failed' | 'Unsynced';
  tags?: string[];
  // Specific to Folders
  itemCount?: number;
  // Yuque-specific fields
  yuqueSourceId?: string;
  yuqueDocId?: number;
  yuqueSlug?: string;
}

// Re-export Document as FileSystemItem for backward compatibility in other components if needed
// or strictly separate them. For this refactor, we will mostly use FileSystemItem.
export type Document = FileSystemItem;

export interface DocVersion {
  id: string;
  doc_id: string;
  version_num: string;
  created_at: string;
  change_log: string;
  author: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  direction: ChannelDirection;
  icon: string; // Lucide icon name
  is_active: boolean;
  last_sync?: string;
  config?: Record<string, any>;
  // Yuque-specific config (when type is YUQUE)
  yuqueConfig?: YuqueSourceConfig;
}

export interface SyncTask {
  id: string;
  name: string;
  trigger_type: TriggerType;
  target_channel_name: string;
  status: 'Running' | 'Idle' | 'Paused';
  last_run: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  status: 'Success' | 'Error' | 'Info';
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar: string;
  language: 'en' | 'zh';
}

// ============ Yuque Integration Types ============

export interface YuqueSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  groupLogin: string;
  bookSlug: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  status: 'active' | 'error';
  errorMessage?: string;
}

export interface ExportTask {
  id: string;
  name: string;
  sourceId: string;
  sourceName: string;
  triggerType: 'manual' | 'schedule';
  scheduleConfig?: {
    interval: 'hourly' | 'daily' | 'weekly';
    time?: string;
  };
  status: 'idle' | 'running' | 'success' | 'error';
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'error';
  lastRunMessage?: string;
  createdAt: string;
}

export interface YuqueTocNode {
  uuid: string;
  type: 'DOC' | 'TITLE' | 'URL';
  title: string;
  slug?: string;
  doc_id?: number;
  parent_uuid?: string;
  child_uuid?: string;
  sibling_uuid?: string;
  depth: number;
}

export interface YuqueDocument {
  id: number;
  slug: string;
  title: string;
  format: 'markdown' | 'lake' | 'html';
  body?: string;
  body_html?: string;
  body_lake?: string; // Lake 格式的真正 HTML 内容
  created_at: string;
  updated_at: string;
  user: {
    name: string;
    login: string;
  };
}
