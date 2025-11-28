
import React, { useState, useEffect } from 'react';
import { Search, Filter, Upload, MoreHorizontal, FileText, File, Eye, FileCode, CloudDownload, Folder, FolderOpen, ChevronRight, ChevronDown, Home, FolderPlus, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Card, Input, Badge, Modal, Label } from './Common';
import { FileSystemItem, DocStatus, FileType } from '../types';
import { useLanguage } from '../i18n';
import { useFileSystem } from '../contexts/FileSystemContext';
import { StorageService } from '../services/StorageService';

// Recursive Tree Item Component
const FolderTreeItem = ({ 
  item, 
  level, 
  activeId, 
  onSelect, 
  files 
}: { 
  item: FileSystemItem, 
  level: number, 
  activeId: string | null, 
  onSelect: (id: string) => void,
  files: FileSystemItem[]
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isActive = activeId === item.id;
  const children = files.filter(f => f.parentId === item.id && f.type === FileType.FOLDER);
  const hasChildren = children.length > 0;
  const isYuqueFolder = !!item.yuqueSourceId;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm ${isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          onSelect(item.id);
        }}
      >
        <div 
          className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {hasChildren ? (
             isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : <div className="w-3" />}
        </div>
        
        {isActive ? <FolderOpen className="h-4 w-4 text-primary-500 fill-primary-500" /> : <Folder className="h-4 w-4 text-yellow-400 fill-yellow-400" />}
        <span className="truncate flex items-center gap-1">
          {item.title}
          {isYuqueFolder && <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">Y</span>}
        </span>
      </div>
      
      {isExpanded && children.map(child => (
        <FolderTreeItem 
          key={child.id} 
          item={child} 
          level={level + 1} 
          activeId={activeId} 
          onSelect={onSelect}
          files={files}
        />
      ))}
    </div>
  );
};

export const AssetsLibrary: React.FC = () => {
  const { t } = useLanguage();
  const { items, createFolder } = useFileSystem();
  const location = useLocation();

  // Helper function to check if an item is from Yuque
  const isYuqueItem = (item: FileSystemItem): boolean => {
    return !!item.yuqueSourceId;
  };

  // Initialize active folder, check if coming from DocumentDetail breadcrumb
  const [activeFolderId, setActiveFolderId] = useState<string | null>(() => {
    return location.state?.folderId || null;
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [downloadErrors, setDownloadErrors] = useState<Map<string, string>>(new Map());

  // Update active folder if location state changes (e.g. back navigation)
  useEffect(() => {
    if (location.state?.folderId) {
      setActiveFolderId(location.state.folderId);
    }
  }, [location.state]);

  useEffect(() => {
    if (activeFolderId === null) {
      const firstRoot = items.find(f => f.parentId === null && f.type === FileType.FOLDER);
      if (firstRoot) {
        setActiveFolderId(firstRoot.id);
      }
    }
  }, [items, activeFolderId]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      try {
        createFolder(newFolderName, activeFolderId);
        setNewFolderName('');
        setIsNewFolderModalOpen(false);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '创建文件夹失败';
        alert(errorMsg);
      }
    }
  };

  const handleDownload = async (file: FileSystemItem, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // 标记为下载中
    setDownloadingFiles(prev => new Set(prev).add(file.id));
    setDownloadErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(file.id);
      return newMap;
    });
    
    try {
      const format = file.type === FileType.MD ? 'markdown' : 'lake';
      await StorageService.downloadDocument(file.id, file.title, format);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '下载失败';
      setDownloadErrors(prev => {
        const newMap = new Map(prev);
        newMap.set(file.id, errorMsg);
        return newMap;
      });
      console.error('Download error:', error);
      
      // 3秒后自动清除错误提示
      setTimeout(() => {
        setDownloadErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(file.id);
          return newMap;
        });
      }, 3000);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  // Derived state from Context Items
  const rootFolders = items.filter(f => f.parentId === null && f.type === FileType.FOLDER);
  const currentFolderFiles = items.filter(f => 
    f.parentId === activeFolderId && 
    f.type !== FileType.FOLDER &&
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const currentFolder = items.find(f => f.id === activeFolderId);
  const subFolders = items.filter(f => f.parentId === activeFolderId && f.type === FileType.FOLDER);

  const getFileIcon = (type: FileType) => {
    switch(type) {
      case FileType.PDF: return <FileText className="h-5 w-5 text-red-500" />;
      case FileType.DOCX: return <FileText className="h-5 w-5 text-blue-500" />;
      case FileType.MD: return <FileCode className="h-5 w-5 text-slate-800" />;
      case FileType.HTML: return <Globe className="h-5 w-5 text-orange-500" />;
      default: return <File className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status?: DocStatus) => {
    switch(status) {
      case DocStatus.ACTIVE: return <Badge variant="success">Active</Badge>;
      case DocStatus.DRAFT: return <Badge variant="warning">Draft</Badge>;
      case DocStatus.ARCHIVED: return <Badge variant="outline">Archived</Badge>;
      default: return null;
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
       <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('assets.title')}</h1>
          <p className="text-slate-500 mt-1">{t('assets.subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => setIsNewFolderModalOpen(true)}>
             <FolderPlus className="h-4 w-4 mr-2" /> {t('assets.btn.new_folder')}
           </Button>
           <Button onClick={() => setIsUploadModalOpen(true)}>
             <Upload className="h-4 w-4 mr-2" /> {t('assets.btn.import')}
           </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Sidebar Tree */}
        <Card className="w-64 flex flex-col p-2 overflow-y-auto shrink-0">
           <div className="pb-2 mb-2 border-b border-slate-100">
             <div 
               className={`flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer text-sm font-medium ${activeFolderId === null ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'}`}
               onClick={() => setActiveFolderId(null)}
             >
                <Home className="h-4 w-4" /> {t('assets.root')}
             </div>
           </div>
           <div className="space-y-0.5">
             <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('assets.knowledge_bases')}</div>
             {rootFolders.map(folder => (
               <FolderTreeItem 
                 key={folder.id} 
                 item={folder} 
                 level={0} 
                 activeId={activeFolderId} 
                 onSelect={setActiveFolderId}
                 files={items}
               />
             ))}
           </div>
        </Card>

        {/* Main Content Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
           {/* Toolbar */}
           <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white z-10">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                 <FolderOpen className="h-5 w-5 text-slate-400" />
                 <span className="font-medium text-slate-900">{currentFolder ? currentFolder.title : t('assets.root')}</span>
                 <span className="text-slate-300">/</span>
                 <span className="text-xs">{currentFolderFiles.length} files, {subFolders.length} folders</span>
              </div>
              
              <div className="flex items-center gap-2 w-full max-w-md">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                   <Input 
                     className="pl-9" 
                     placeholder={t('assets.search.placeholder')} 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                 </div>
                 <Button variant="outline" className="px-3">
                   <Filter className="h-4 w-4" />
                 </Button>
              </div>
           </div>

           {/* File List */}
           <div className="flex-1 overflow-auto p-0">
             {currentFolderFiles.length === 0 && subFolders.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <div className="bg-slate-50 p-4 rounded-full mb-3">
                   <FolderOpen className="h-8 w-8 text-slate-300" />
                 </div>
                 <p className="font-medium text-slate-600">{t('assets.empty.title')}</p>
                 <p className="text-sm">{t('assets.empty.desc')}</p>
               </div>
             ) : (
               <table className="w-full text-left text-sm">
                 <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
                   <tr>
                     <th className="px-6 py-3 w-8"></th>
                     <th className="px-6 py-3">{t('assets.col.name')}</th>
                     <th className="px-6 py-3">{t('assets.col.owner')}</th>
                     <th className="px-6 py-3">{t('assets.col.updated')}</th>
                     <th className="px-6 py-3">{t('assets.col.size')}</th>
                     <th className="px-6 py-3">{t('assets.col.status')}</th>
                     <th className="px-6 py-3 text-right">{t('assets.col.actions')}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {/* Render Subfolders first */}
                   {subFolders.map(folder => (
                     <tr 
                       key={folder.id} 
                       className="hover:bg-slate-50 transition-colors cursor-pointer group"
                       onClick={() => setActiveFolderId(folder.id)}
                     >
                       <td className="px-6 py-3"><Folder className="h-5 w-5 text-yellow-400 fill-yellow-400" /></td>
                       <td className="px-6 py-3">
                         <div className="font-medium text-slate-900">{folder.title}</div>
                         {isYuqueItem(folder) && (
                           <div className="flex gap-1 mt-1">
                             <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                               yuque:{folder.yuqueSourceId}
                             </span>
                           </div>
                         )}
                       </td>
                       <td className="px-6 py-3 text-slate-500">{folder.owner_name}</td>
                       <td className="px-6 py-3 text-slate-500">{folder.updated_at}</td>
                       <td className="px-6 py-3 text-slate-500">-</td>
                       <td className="px-6 py-3"></td>
                       <td className="px-6 py-3 text-right">
                         <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                       </td>
                     </tr>
                   ))}

                   {/* Render Files */}
                   {currentFolderFiles.map(file => (
                     <tr key={file.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-6 py-3">{getFileIcon(file.type)}</td>
                       <td className="px-6 py-3">
                         <Link to={`/documents/${file.id}`} className="font-medium text-slate-900 hover:text-primary-600 flex items-center gap-2">
                            {file.title}
                            {file.current_version && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">{file.current_version}</span>}
                         </Link>
                         <div className="flex gap-1 mt-1 flex-wrap">
                           {/* Display Yuque source tag if present */}
                           {file.yuqueSourceId && (
                             <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                               yuque:{file.yuqueSourceId}
                             </span>
                           )}
                           {/* Display other tags */}
                           {file.tags && file.tags.length > 0 && file.tags.map(tag => (
                             <span key={tag} className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded">
                               {tag}
                             </span>
                           ))}
                         </div>
                       </td>
                       <td className="px-6 py-3 text-slate-500">{file.owner_name}</td>
                       <td className="px-6 py-3 text-slate-500">{file.updated_at}</td>
                       <td className="px-6 py-3 text-slate-500">{file.size}</td>
                       <td className="px-6 py-3">{getStatusBadge(file.status)}</td>
                       <td className="px-6 py-3 text-right">
                         <div className="flex justify-end gap-2 items-center">
                           {/* 显示下载错误 */}
                           {downloadErrors.has(file.id) && (
                             <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                               <AlertCircle className="h-3 w-3" />
                               {downloadErrors.get(file.id)}
                             </div>
                           )}
                           
                           {/* 下载按钮 */}
                           {isYuqueItem(file) && (
                             <button 
                               className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity opacity-0 group-hover:opacity-100" 
                               title="Download"
                               onClick={(e) => handleDownload(file, e)}
                               disabled={downloadingFiles.has(file.id)}
                             >
                               {downloadingFiles.has(file.id) ? (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                               ) : (
                                 <CloudDownload className="h-4 w-4" />
                               )}
                             </button>
                           )}
                           
                           <Link to={`/documents/${file.id}`} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-opacity opacity-0 group-hover:opacity-100" title="View Details">
                             <Eye className="h-4 w-4" />
                           </Link>
                           <button className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-opacity opacity-0 group-hover:opacity-100">
                             <MoreHorizontal className="h-4 w-4" />
                           </button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
           </div>
        </Card>
      </div>

      {/* Upload Modal */}
      <Modal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        title={t('assets.modal.upload.title')}
        footer={
           <>
             <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>{t('common.cancel')}</Button>
             <Button onClick={() => setIsUploadModalOpen(false)}>{t('common.confirm')}</Button>
           </>
        }
      >
         <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="bg-primary-50 p-4 rounded-full mb-4">
              <Upload className="h-8 w-8 text-primary-600" />
            </div>
            <p className="font-medium text-slate-900">{t('assets.modal.upload.drag')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('assets.modal.upload.browse')}</p>
         </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={isNewFolderModalOpen}
        onClose={() => { setIsNewFolderModalOpen(false); setNewFolderName(''); }}
        title={t('assets.modal.folder.title')}
        footer={
           <>
             <Button variant="ghost" onClick={() => setIsNewFolderModalOpen(false)}>{t('common.cancel')}</Button>
             <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>{t('common.create')}</Button>
           </>
        }
      >
         <div>
            <Label>{t('assets.label.folder_name')}</Label>
            <Input 
              placeholder="e.g. Q4 Reports" 
              autoFocus 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            />
            {activeFolderId && (
               <p className="text-xs text-slate-400 mt-2">Creating inside: {currentFolder?.title}</p>
            )}
            {!activeFolderId && (
               <p className="text-xs text-slate-400 mt-2">Creating in: {t('assets.root')}</p>
            )}
         </div>
      </Modal>
    </div>
  );
};
