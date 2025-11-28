
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitCommit, Globe, MessageSquare, Database, Download, RotateCcw, FileText, ChevronRight, Home, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Card, Badge } from './Common';
import { LoadingSpinner } from './LoadingSpinner';
import { useLanguage } from '../i18n';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useYuqueConfig } from '../contexts/YuqueConfigContext';
import { StorageService } from '../services/StorageService';
import { ImageEmbedderService } from '../services/ImageEmbedderService';
import { FileSystemItem, FileType } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

// Mocking detailed version data (kept separate from FileSystem for this prototype)
const DOC_DETAILS_MOCK = {
  current_version: 'v2.1',
  versions: [
    { id: 'v3', num: 'v2.1', date: 'Oct 24, 14:30', author: 'Alice Chen', note: 'Updated pricing section' },
    { id: 'v2', num: 'v2.0', date: 'Oct 20, 09:00', author: 'Bob Smith', note: 'Major overhaul for Q4 release' },
    { id: 'v1', num: 'v1.0', date: 'Sep 15, 11:20', author: 'Alice Chen', note: 'Initial draft' },
  ],
  channels: [
    { name: 'Zendesk Help Center', version: 'v2.1', status: 'Synced', icon: 'globe', last_sync: '10 mins ago' },
    { name: 'DingTalk Bot', version: 'v2.0', status: 'Pending Update', icon: 'message', last_sync: '4 days ago' },
    { name: 'Backup S3', version: 'v2.1', status: 'Synced', icon: 'database', last_sync: '1 hour ago' },
  ]
};

export const DocumentDetail: React.FC = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { getItem, getPath } = useFileSystem();
  const { getConfig } = useYuqueConfig();
  
  const [selectedVersion, setSelectedVersion] = useState(DOC_DETAILS_MOCK.versions[0]);
  const [fileItem, setFileItem] = useState<FileSystemItem | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<FileSystemItem[]>([]);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [isYuqueDoc, setIsYuqueDoc] = useState(false);
  const [yuqueSourceName, setYuqueSourceName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Helper function to rewrite image URLs to point to backend API
  const rewriteImageUrls = (content: string, sourceId: string, docId: string): string => {
    if (!content) return content;
    
    // For Markdown: Replace image URLs in ![alt](url) format
    let rewrittenContent = content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, url) => {
        // If URL is already pointing to our API, don't rewrite
        if (url.startsWith('http://localhost:3002/api/storage/assets/')) {
          return match;
        }
        
        // Extract filename from URL
        const filename = url.split('/').pop() || url;
        const newUrl = StorageService.getAssetUrl(sourceId, docId, filename);
        return `![${alt}](${newUrl})`;
      }
    );
    
    // For HTML: Replace src attributes in <img> tags
    rewrittenContent = rewrittenContent.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/g,
      (match, before, url, after) => {
        // If URL is already pointing to our API, don't rewrite
        if (url.startsWith('http://localhost:3002/api/storage/assets/')) {
          return match;
        }
        
        // Extract filename from URL
        const filename = url.split('/').pop() || url;
        const newUrl = StorageService.getAssetUrl(sourceId, docId, filename);
        return `<img${before}src="${newUrl}"${after}>`;
      }
    );
    
    return rewrittenContent;
  };

  const convertLakeCardsToImages = (content: string): string => {
    if (!content) return content;
    return content.replace(/<card[^>]*>(?:[\s\S]*?<\/card>)?|<card[^>]*\/>/gi, (match) => {
      const valueMatch = match.match(/value=["']([^"']+)["']/i);
      if (!valueMatch) return match;
      let raw = valueMatch[1];
      try {
        let decoded = raw;
        try { decoded = decodeURIComponent(decoded); } catch {}
        if (decoded.startsWith('data:')) decoded = decoded.slice(5);
        decoded = decoded.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const obj = JSON.parse(decoded);
        const src = obj?.src || obj?.data?.src;
        if (!src || typeof src !== 'string') return match;
        const width = obj?.width || obj?.data?.width;
        const height = obj?.height || obj?.data?.height;
        const wAttr = typeof width === 'number' ? ` width="${Math.round(width)}"` : '';
        const hAttr = typeof height === 'number' ? ` height="${Math.round(height)}"` : '';
        return `<img src="${src}"${wAttr}${hAttr}>`;
      } catch {
        return match;
      }
    });
  };

  const rewriteExternalImagesToProxy = (content: string): string => {
    if (!content) return content;
    const isLocalAsset = (url: string) => url.startsWith('http://localhost:3002/api/storage/assets/') || url.startsWith('http://localhost:3001/api/yuque/proxy-image');

    // HTML <img>
    let out = content.replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/g, (m, before, url, after) => {
      if (isLocalAsset(url)) return m;
      if (!/^https?:\/\//i.test(url)) return m;
      const proxied = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(url)}`;
      return `<img${before}src="${proxied}"${after}>`;
    });

    // Markdown ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
      if (isLocalAsset(url)) return m;
      if (!/^https?:\/\//i.test(url)) return m;
      const proxied = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(url)}`;
      return `![${alt}](${proxied})`;
    });

    return out;
  };

  const extractImageUrls = (content: string): string[] => {
    const urls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = imgRegex.exec(content)) !== null) {
      const url = m[1];
      if (/^https?:\/\//i.test(url)) urls.push(url);
    }
    const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    while ((m = mdRegex.exec(content)) !== null) {
      const url = m[1];
      if (/^https?:\/\//i.test(url)) urls.push(url);
    }
    return Array.from(new Set(urls));
  };

  const extractFilename = (url: string): string => {
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop() || 'image.png';
      return decodeURIComponent(name);
    } catch {
      let candidate = url;
      try { candidate = decodeURIComponent(candidate); } catch {}
      if (/^https?:\/\//i.test(candidate)) {
        try {
          const u2 = new URL(candidate);
          const name2 = u2.pathname.split('/').pop() || 'image.png';
          return decodeURIComponent(name2);
        } catch {}
      }
      const parts = candidate.split('?')[0].split('/');
      return decodeURIComponent(parts[parts.length - 1] || 'image.png');
    }
  };

  const ensureLocalAssets = async (content: string, sourceId: string, docId: string): Promise<string> => {
    const urls = extractImageUrls(content);
    if (urls.length === 0) return content;
    let out = content;
    const getOriginalFromProxy = (u: string): string => {
      try {
        const parsed = new URL(u);
        if (parsed.hostname === 'localhost' && parsed.port === '3001' && parsed.pathname.includes('/api/yuque/proxy-image')) {
          const q = parsed.searchParams.get('url');
          if (q) {
            try { return decodeURIComponent(q); } catch { return q; }
          }
        }
      } catch {}
      return u;
    };
    for (const url of urls) {
      if (url.startsWith('http://localhost:3002/api/storage/assets/')) continue;
      const originalUrl = getOriginalFromProxy(url);
      const filename = extractFilename(originalUrl);
      try {
        const proxyUrl = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(originalUrl)}`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        await StorageService.saveAsset(sourceId, docId, filename, blob);
        const local = StorageService.getAssetUrl(sourceId, docId, filename);
        const escapedOrig = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedProxy = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escapedOrig, 'g'), local);
        out = out.replace(new RegExp(escapedProxy, 'g'), local);
      } catch {}
    }
    return out;
  };

  const blobToDataUrl = (blob: Blob, filename?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (blob.type && blob.type.startsWith('image/')) {
          resolve(result);
          return;
        }
        const ext = (filename || '').toLowerCase().split('.').pop() || '';
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
          bmp: 'image/bmp',
          ico: 'image/x-icon',
        };
        const mime = mimeMap[ext] || 'image/png';
        const base64Data = result.split(',')[1];
        resolve(`data:${mime};base64,${base64Data}`);
      };
      reader.onerror = () => reject(new Error('base64 转换失败'));
      reader.readAsDataURL(blob);
    });
  };

  const embedMarkdownImagesToBase64 = async (md: string, sourceId: string, docId: string): Promise<string> => {
    if (!md) return md;
    const urls = Array.from(new Set(
      (md.match(/!\[[^\]]*\]\(([^)]+)\)/g) || [])
        .map(m => {
          const match = m.match(/!\[[^\]]*\]\(([^)]+)\)/);
          return match ? match[1] : '';
        })
        .filter(u => /^https?:\/\//i.test(u) || u.startsWith('data:'))
    ));
    if (urls.length === 0) return md;

    let out = md;
    for (const url of urls) {
      if (url.startsWith('data:')) continue;
      const originalUrl = url;
      const filename = extractFilename(originalUrl);
      try {
        const localUrl = StorageService.getAssetUrl(sourceId, docId, filename);
        let blob: Blob | null = null;
        try {
          const r = await fetch(localUrl);
          if (r.ok) blob = await r.blob();
        } catch {}
        if (!blob) {
          const proxyUrl = `http://localhost:3001/api/yuque/proxy-image?url=${encodeURIComponent(originalUrl)}`;
          const r2 = await fetch(proxyUrl);
          if (!r2.ok) continue;
          blob = await r2.blob();
        }
        const dataUrl = await blobToDataUrl(blob!, filename);
        const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escaped, 'g'), dataUrl);
      } catch {}
    }
    return out;
  };

  useEffect(() => {
    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (!id) {
          throw new Error('文档 ID 不存在');
        }

        const item = getItem(id);
        if (!item) {
          throw new Error('文档不存在');
        }

        setFileItem(item);
        setBreadcrumbs(getPath(id));
        
        // Check if this is a Yuque document
        if (item.yuqueSourceId) {
          setIsYuqueDoc(true);
          
          // Load document content from StorageService
          try {
            const docData = await StorageService.loadDocumentContent(id);
            if (docData) {
              // Extract content based on format (需求 4.2, 4.3)
              // For Lake format (HTML), use body_html; for Markdown, use body
              const format = docData.format || item.type;
              const content = format === 'markdown' || format === 'MD'
                ? (docData.body || '')
                : (docData.body_html || docData.body || '');

              if (format === 'markdown' || format === 'MD') {
                const embedded = await embedMarkdownImagesToBase64(content, item.yuqueSourceId, id);
                setDocumentContent(embedded);
              } else {
                const converted = convertLakeCardsToImages(content);
                const embedded = await ImageEmbedderService.embedImages(converted, item.yuqueSourceId, id);
                setDocumentContent(embedded);
              }
            } else {
              setDocumentContent('文档内容未找到');
            }
          } catch (storageError) {
            console.error('Failed to load document content:', storageError);
            setDocumentContent('加载文档内容失败');
          }
          
          // Get Yuque source name
          const config = getConfig(item.yuqueSourceId);
          if (config) {
            setYuqueSourceName(config.name);
          } else {
            setYuqueSourceName('未知来源');
          }
        } else {
          setIsYuqueDoc(false);
          setDocumentContent('');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '加载文档失败';
        setError(errorMsg);
        console.error('Error loading document:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [id, getItem, getPath, getConfig]);

  // 简化的下载处理函数
  const handleDownload = async () => {
    if (!fileItem || !id) return;
    
    setIsDownloading(true);
    setDownloadError(null);
    
    try {
      // 根据文档类型自动选择格式（MD 或 HTML）
      const format = fileItem.type === FileType.MD ? 'md' : 'html';
      await StorageService.downloadDocumentFile(id, fileItem.title, format);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '下载失败';
      setDownloadError(errorMsg);
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };


  // Helper for icons
  const getChannelIcon = (name: string) => {
    if (name.includes('Zendesk')) return <Globe className="h-4 w-4" />;
    if (name.includes('Bot')) return <MessageSquare className="h-4 w-4" />;
    return <Database className="h-4 w-4" />;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="加载文档中..." />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">加载失败</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate('/documents')}>
              返回资产库
            </Button>
            <Button onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show not found state
  if (!fileItem) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-slate-100 rounded-full">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">文档不存在</h2>
          <p className="text-slate-600 mb-4">找不到您要查看的文档</p>
          <Button onClick={() => navigate('/documents')}>
            返回资产库
          </Button>
        </Card>
      </div>
    );
  }

  // Use file title from context, or fallback
  const title = fileItem?.title || 'Unknown Document';
  const owner = fileItem?.owner_name || 'Unknown';

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Top Bar / Breadcrumbs */}
      <div className="mb-4 flex flex-col gap-2">
         {/* Breadcrumb Navigation */}
         <nav className="flex items-center text-sm text-slate-500 mb-2">
            <Link to="/documents" className="hover:text-primary-600 transition-colors flex items-center gap-1">
               <Home className="h-3 w-3" />
               {t('assets.root')}
            </Link>
            {breadcrumbs.map((item, index) => {
               // Don't link the file itself (last item)
               if (item.id === fileItem?.id) return null;
               
               return (
                 <React.Fragment key={item.id}>
                    <ChevronRight className="h-3 w-3 mx-1 text-slate-300" />
                    <Link 
                      to="/documents" 
                      state={{ folderId: item.id }} 
                      className="hover:text-primary-600 transition-colors flex items-center gap-1"
                    >
                      {item.title}
                    </Link>
                 </React.Fragment>
               );
            })}
            <ChevronRight className="h-3 w-3 mx-1 text-slate-300" />
            <span className="font-medium text-slate-800">{title}</span>
         </nav>

         <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="pl-0 hover:bg-transparent hover:text-primary-600" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('doc.back')}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                {title}
                <Badge>{fileItem?.current_version || DOC_DETAILS_MOCK.current_version}</Badge>
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-1">UUID: {id} • {t('doc.created_by')} {owner}</p>
            </div>
            <div className="ml-auto flex gap-2 items-center">
              {isYuqueDoc && (
                <>
                  <Button 
                    variant="outline"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-2"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        下载中...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        {t('doc.download')}
                      </>
                    )}
                  </Button>
                  
                  {downloadError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{downloadError}</span>
                    </div>
                  )}
                </>
              )}
              {!isYuqueDoc && (
                <Button variant="primary">
                  {t('doc.upload_version')}
                </Button>
              )}
            </div>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: Previewer */}
        <Card className="flex-1 bg-slate-100 border-slate-200 flex flex-col overflow-hidden">
           <div className="bg-white border-b border-slate-200 p-3 flex justify-between items-center text-sm text-slate-600">
              <span className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> {t('doc.preview')}: {isYuqueDoc ? fileItem?.current_version || 'v1.0' : selectedVersion.num}
              </span>
              {isYuqueDoc && yuqueSourceName && (
                <span className="flex items-center gap-2 text-xs">
                  <BookOpen className="h-3 w-3 text-primary-600" />
                  <span className="text-primary-600 font-medium">{yuqueSourceName}</span>
                </span>
              )}
              <span className="text-xs text-slate-400">{t('doc.readonly')}</span>
           </div>
           <div className="flex-1 p-12 overflow-y-auto">
              <div className="bg-white shadow-lg w-full max-w-4xl mx-auto min-h-[800px] p-12 rounded border border-slate-200">
                 {isYuqueDoc && documentContent ? (
                   // Render Yuque document content
                   fileItem?.type === FileType.MD ? (
                     // Render Markdown with HTML support
                     <div className="prose prose-slate max-w-none">
                       <ReactMarkdown
                         remarkPlugins={[remarkGfm]}
                         rehypePlugins={[rehypeRaw]}
                       >
                         {documentContent}
                       </ReactMarkdown>
                     </div>
                   ) : (
                     // Render HTML directly (Lake format) - use dangerouslySetInnerHTML for rich formatting
                     <div 
                       className="prose prose-slate max-w-none yuque-lake-content"
                       dangerouslySetInnerHTML={{ __html: documentContent }} 
                     />
                   )
                 ) : isYuqueDoc && !documentContent ? (
                   // Yuque document but no content loaded
                   <div className="text-center text-slate-400">
                     <div className="mb-4 text-slate-200 mx-auto w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                       <FileText className="h-10 w-10" />
                     </div>
                     <p className="text-sm">文档内容加载失败或为空</p>
                   </div>
                 ) : (
                   // Mock document preview (non-Yuque)
                   <div className="text-slate-300 text-center">
                     <div className="mb-4 text-slate-200 mx-auto w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                       <FileText className="h-10 w-10" />
                     </div>
                     <h3 className="text-slate-800 font-serif text-3xl mb-6">{title}</h3>
                     <div className="space-y-4">
                       <div className="h-4 bg-slate-100 rounded w-3/4 mx-auto"></div>
                       <div className="h-4 bg-slate-100 rounded w-full mx-auto"></div>
                       <div className="h-4 bg-slate-100 rounded w-5/6 mx-auto"></div>
                       <div className="h-4 bg-slate-100 rounded w-full mx-auto"></div>
                       <br />
                       <div className="h-4 bg-slate-100 rounded w-2/3 mx-auto"></div>
                       <div className="h-4 bg-slate-100 rounded w-full mx-auto"></div>
                     </div>
                     <p className="mt-20 text-sm text-slate-400">
                       {t('doc.simulation')}<br />
                       {t('doc.showing_ver')} <strong>{selectedVersion.num}</strong> {t('doc.created_by')} {selectedVersion.author}.
                     </p>
                   </div>
                 )}
              </div>
           </div>
        </Card>

        {/* Right: Sidebar (History & Channels) */}
        <div className="w-full lg:w-96 space-y-6 overflow-y-auto pr-1">
          {/* Document Metadata (for Yuque docs) */}
          {isYuqueDoc && fileItem && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-500">文档信息</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="mt-1 p-1.5 rounded-md bg-primary-50 text-primary-600">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">数据源</div>
                    <div className="text-sm font-medium text-slate-800">{yuqueSourceName || '语雀知识库'}</div>
                  </div>
                </div>
                
                <div className="pb-3 border-b border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">作者</div>
                  <div className="text-sm font-medium text-slate-800">{fileItem.owner_name}</div>
                </div>
                
                <div className="pb-3 border-b border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">更新时间</div>
                  <div className="text-sm font-medium text-slate-800">
                    {new Date(fileItem.updated_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div className="pb-3 border-b border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">文档格式</div>
                  <div className="text-sm font-medium text-slate-800">
                    {fileItem.type === FileType.MD ? 'Markdown' : 'HTML'}
                  </div>
                </div>
                
                {fileItem.yuqueSlug && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">语雀路径</div>
                    <div className="text-sm font-mono text-slate-600 break-all">{fileItem.yuqueSlug}</div>
                  </div>
                )}
                
                {fileItem.tags && fileItem.tags.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2">标签</div>
                    <div className="flex flex-wrap gap-1">
                      {fileItem.tags.map((tag, idx) => (
                        <Badge key={idx} className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
          
          {/* Channel Status (for non-Yuque docs) */}
          {!isYuqueDoc && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-500">{t('doc.channel_dist')}</h3>
              <div className="space-y-4">
                {DOC_DETAILS_MOCK.channels.map((chan, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className={`mt-1 p-1.5 rounded-md ${chan.status === 'Synced' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                       {getChannelIcon(chan.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-800">{chan.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chan.status === 'Synced' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {chan.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                         <span className="text-xs text-slate-500">{t('doc.current')}: {chan.version}</span>
                         <span className="text-[10px] text-slate-400">{chan.last_sync}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Version Timeline (only for non-Yuque docs) */}
          {!isYuqueDoc && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-500">{t('doc.version_history')}</h3>
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 py-2">
                {DOC_DETAILS_MOCK.versions.map((ver) => (
                  <div key={ver.id} className="relative pl-6 group">
                    {/* Dot */}
                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 bg-white ${selectedVersion.id === ver.id ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-300 group-hover:border-primary-400'} transition-all`} />
                    
                    <div 
                      className={`cursor-pointer transition-all ${selectedVersion.id === ver.id ? '' : 'opacity-70 hover:opacity-100'}`}
                      onClick={() => setSelectedVersion(ver)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${selectedVersion.id === ver.id ? 'text-primary-700' : 'text-slate-700'}`}>{ver.num}</span>
                        <span className="text-xs text-slate-400">{ver.date}</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{ver.note}</p>
                      
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><GitCommit className="h-3 w-3" /> {ver.id.substring(0,6)}</span>
                        <span>•</span>
                        <span>{ver.author}</span>
                      </div>

                      {selectedVersion.id !== ver.id && (
                         <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs w-full justify-start">
                           <RotateCcw className="h-3 w-3 mr-2" /> {t('doc.rollback')}
                         </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
