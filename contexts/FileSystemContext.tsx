
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FileSystemItem, FileType } from '../types';
import { StorageService } from '../services/StorageService';

// 移除初始化 Mock 数据，避免每次启动注入

interface FileSystemContextType {
  items: FileSystemItem[];
  createFolder: (name: string, parentId: string | null) => void;
  addFolder: (folder: Omit<FileSystemItem, 'id'> & { id?: string }) => string;
  addDocument: (doc: Omit<FileSystemItem, 'id'> & { id?: string }) => string;
  updateItem: (id: string, updates: Partial<FileSystemItem>) => void;
  getPath: (itemId: string) => FileSystemItem[];
  getItem: (id: string) => FileSystemItem | undefined;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export const FileSystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load items from file system on mount
  useEffect(() => {
    const loadItems = async () => {
      const stored = await StorageService.loadFileSystemItems();
      setItems(stored);
      setLoaded(true);
    };
    loadItems();
  }, []);

  // Save to file system whenever items change
  useEffect(() => {
    const saveItems = async () => {
      if (!loaded) return;
      try {
        await StorageService.saveFileSystemItems(items);
      } catch (error) {
        console.error('Failed to save filesystem items:', error);
      }
    };
    saveItems();
  }, [items, loaded]);

  const createFolder = (name: string, parentId: string | null) => {
    const newFolder: FileSystemItem = {
      id: `new_${Date.now()}`,
      parentId,
      title: name,
      type: FileType.FOLDER,
      updated_at: new Date().toISOString().split('T')[0],
      owner_name: 'Me',
      itemCount: 0
    };
    setItems([...items, newFolder]);
  };

  const addFolder = (folder: Omit<FileSystemItem, 'id'> & { id?: string }): string => {
    const folderId = folder.id || `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newFolder: FileSystemItem = {
      ...folder,
      id: folderId,
      type: FileType.FOLDER,
      itemCount: folder.itemCount || 0
    };
    setItems(prev => [...prev, newFolder]);
    return folderId;
  };

  const addDocument = (doc: Omit<FileSystemItem, 'id'> & { id?: string }): string => {
    const docId = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDoc: FileSystemItem = {
      ...doc,
      id: docId
    };
    setItems(prev => [...prev, newDoc]);
    return docId;
  };

  const updateItem = (id: string, updates: Partial<FileSystemItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const getItem = (id: string) => items.find(i => i.id === id);

  const getPath = (itemId: string): FileSystemItem[] => {
    const path: FileSystemItem[] = [];
    let current = items.find(i => i.id === itemId);
    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = items.find(i => i.id === current?.parentId);
      } else {
        current = undefined;
      }
    }
    return path;
  };

  return (
    <FileSystemContext.Provider value={{ items, createFolder, addFolder, addDocument, updateItem, getPath, getItem }}>
      {children}
    </FileSystemContext.Provider>
  );
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
};
