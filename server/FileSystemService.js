import fs from 'fs/promises';
import path from 'path';
import lockfile from 'proper-lockfile';

/**
 * FileSystemService - 文件系统操作服务
 * 负责管理数据目录结构、文件读写、备份恢复等核心功能
 */
class FileSystemService {
  /**
   * 构造函数 - 初始化目录路径
   * @param {string} baseDir - 数据根目录路径，默认为项目根目录下的 data 文件夹
   */
  constructor(baseDir = path.join(process.cwd(), 'data')) {
    this.dataDir = baseDir;
    this.configsDir = path.join(this.dataDir, 'configs');
    this.documentsDir = path.join(this.dataDir, 'documents');
    this.assetsDir = path.join(this.dataDir, 'assets');
  }

  /**
   * 初始化目录结构
   * 创建 data、data/configs、data/documents、data/assets 目录
   * 如果目录已存在则跳过
   */
  async initializeDirectories() {
    try {
      // 创建主数据目录
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log(`[FileSystemService] 数据目录已创建: ${this.dataDir}`);

      // 创建 configs 子目录
      await fs.mkdir(this.configsDir, { recursive: true });
      console.log(`[FileSystemService] 配置目录已创建: ${this.configsDir}`);

      // 创建 documents 子目录
      await fs.mkdir(this.documentsDir, { recursive: true });
      console.log(`[FileSystemService] 文档目录已创建: ${this.documentsDir}`);

      // 创建 assets 子目录
      await fs.mkdir(this.assetsDir, { recursive: true });
      console.log(`[FileSystemService] 资源目录已创建: ${this.assetsDir}`);

      console.log('[FileSystemService] 目录结构初始化完成');
    } catch (error) {
      console.error('[FileSystemService] 初始化目录失败:', error);
      throw new Error(`目录初始化失败: ${error.message}`);
    }
  }

  /**
   * 创建备份文件
   * 在写入文件前创建 .bak 备份文件
   * @param {string} filePath - 要备份的文件路径
   * @private
   */
  async createBackup(filePath) {
    const backupPath = `${filePath}.bak`;
    
    try {
      // 检查原文件是否存在
      await fs.access(filePath);
      
      // 复制文件到备份路径
      await fs.copyFile(filePath, backupPath);
      console.log(`[FileSystemService] 备份文件已创建: ${backupPath}`);
    } catch (error) {
      // 如果原文件不存在（ENOENT），这是正常情况，不需要备份
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] 原文件不存在，跳过备份: ${filePath}`);
        return;
      }
      
      // 其他错误则抛出
      console.error('[FileSystemService] 创建备份失败:', error);
      throw new Error(`创建备份失败: ${error.message}`);
    }
  }

  /**
   * 删除备份文件
   * 在文件写入成功后删除备份文件
   * @param {string} filePath - 原文件路径（备份文件路径为 filePath.bak）
   * @private
   */
  async deleteBackup(filePath) {
    const backupPath = `${filePath}.bak`;
    
    try {
      // 检查备份文件是否存在
      await fs.access(backupPath);
      
      // 删除备份文件
      await fs.unlink(backupPath);
      console.log(`[FileSystemService] 备份文件已删除: ${backupPath}`);
    } catch (error) {
      // 如果备份文件不存在（ENOENT），这是正常情况
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] 备份文件不存在，无需删除: ${backupPath}`);
        return;
      }
      
      // 其他错误记录日志但不抛出，因为删除备份失败不应影响主流程
      console.warn('[FileSystemService] 删除备份文件失败:', error);
    }
  }

  /**
   * 从备份恢复文件
   * 当文件读取失败时，尝试从备份文件恢复
   * @param {string} filePath - 要恢复的文件路径
   * @private
   */
  async restoreFromBackup(filePath) {
    const backupPath = `${filePath}.bak`;
    
    try {
      // 检查备份文件是否存在
      await fs.access(backupPath);
      
      // 从备份恢复文件
      await fs.copyFile(backupPath, filePath);
      console.log(`[FileSystemService] 文件已从备份恢复: ${filePath}`);
      
      return true;
    } catch (error) {
      // 如果备份文件不存在
      if (error.code === 'ENOENT') {
        console.error(`[FileSystemService] 备份文件不存在，无法恢复: ${backupPath}`);
        return false;
      }
      
      // 其他错误
      console.error('[FileSystemService] 从备份恢复失败:', error);
      throw new Error(`从备份恢复失败: ${error.message}`);
    }
  }

  /**
   * 获取文件锁
   * 在写入文件前获取锁，防止并发写入冲突
   * @param {string} filePath - 要锁定的文件路径
   * @returns {Promise<Function>} 返回释放锁的函数
   * @private
   */
  async acquireLock(filePath) {
    try {
      console.log(`[FileSystemService] 尝试获取文件锁: ${filePath}`);
      
      // 确保文件所在目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // 如果文件不存在，创建一个空文件（lockfile 需要文件存在）
      try {
        await fs.access(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          await fs.writeFile(filePath, '', 'utf8');
          console.log(`[FileSystemService] 创建空文件用于锁定: ${filePath}`);
        }
      }
      
      // 获取文件锁，设置超时时间为 10 秒
      const release = await lockfile.lock(filePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 2000
        },
        stale: 10000, // 10 秒后锁自动过期
        realpath: false
      });
      
      console.log(`[FileSystemService] 文件锁已获取: ${filePath}`);
      return release;
    } catch (error) {
      console.error(`[FileSystemService] 获取文件锁失败: ${filePath}`, error);
      throw new Error(`获取文件锁失败: ${error.message}`);
    }
  }

  /**
   * 使用文件锁执行操作
   * 自动获取锁、执行操作、释放锁
   * @param {string} filePath - 要锁定的文件路径
   * @param {Function} operation - 要执行的操作（异步函数）
   * @returns {Promise<any>} 操作的返回值
   * @private
   */
  async withLock(filePath, operation) {
    let release = null;
    
    try {
      // 获取文件锁
      release = await this.acquireLock(filePath);
      
      // 执行操作
      const result = await operation();
      
      return result;
    } finally {
      // 确保释放锁
      if (release) {
        try {
          await release();
          console.log(`[FileSystemService] 文件锁已释放: ${filePath}`);
        } catch (error) {
          console.error(`[FileSystemService] 释放文件锁失败: ${filePath}`, error);
        }
      }
    }
  }

  /**
   * 保存配置文件
   * 将配置数据保存到 data/configs/{type}.json 文件
   * @param {string} type - 配置类型（如 'yuque', 'tasks', 'items'）
   * @param {any} data - 要保存的配置数据
   */
  async saveConfig(type, data) {
    const filePath = path.join(this.configsDir, `${type}.json`);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存配置: ${type}`);
        
        // 创建备份
        await this.createBackup(filePath);
        
        // 序列化数据为 JSON
        const jsonData = JSON.stringify(data, null, 2);
        
        // 写入文件
        await fs.writeFile(filePath, jsonData, 'utf8');
        console.log(`[FileSystemService] 配置保存成功: ${filePath}`);
        
        // 删除备份
        await this.deleteBackup(filePath);
      } catch (error) {
        console.error(`[FileSystemService] 保存配置失败 (${type}):`, error);
        
        // 尝试从备份恢复
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 已从备份恢复配置: ${type}`);
        }
        
        throw new Error(`保存配置失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载配置文件
   * 从 data/configs/{type}.json 文件加载配置数据
   * @param {string} type - 配置类型（如 'yuque', 'tasks', 'items'）
   * @returns {Promise<any>} 配置数据，如果文件不存在则返回空对象
   */
  async loadConfig(type) {
    const filePath = path.join(this.configsDir, `${type}.json`);
    
    try {
      console.log(`[FileSystemService] 开始加载配置: ${type}`);
      
      // 读取文件内容
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // 解析 JSON
      const data = JSON.parse(fileContent);
      console.log(`[FileSystemService] 配置加载成功: ${type}`);
      
      return data;
    } catch (error) {
      // 如果文件不存在，返回空对象
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] 配置文件不存在，返回空对象: ${type}`);
        return {};
      }
      
      // 如果是 JSON 解析错误，尝试从备份恢复
      if (error instanceof SyntaxError) {
        console.error(`[FileSystemService] JSON 解析失败 (${type}):`, error);
        
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 尝试从备份重新加载配置: ${type}`);
          // 递归调用自己重新加载
          return await this.loadConfig(type);
        }
        
        // 如果备份也失败，返回空对象
        console.error(`[FileSystemService] 无法从备份恢复，返回空对象: ${type}`);
        return {};
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载配置失败 (${type}):`, error);
      throw new Error(`加载配置失败: ${error.message}`);
    }
  }

  /**
   * 保存文档内容
   * 将文档内容保存到 data/documents/{docId}.json 文件
   * 支持 Markdown 格式（body 字段）和 HTML 格式（body_html 字段）
   * @param {string} docId - 文档 ID
   * @param {any} content - 文档内容对象
   */
  async saveDocument(docId, content) {
    const filePath = path.join(this.documentsDir, `${docId}.json`);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存文档: ${docId}`);
        
        // 创建备份
        await this.createBackup(filePath);
        
        // 序列化数据为 JSON
        const jsonData = JSON.stringify(content, null, 2);
        
        // 写入文件
        await fs.writeFile(filePath, jsonData, 'utf8');
        console.log(`[FileSystemService] 文档保存成功: ${filePath}`);
        
        // 删除备份
        await this.deleteBackup(filePath);
      } catch (error) {
        console.error(`[FileSystemService] 保存文档失败 (${docId}):`, error);
        
        // 尝试从备份恢复
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 已从备份恢复文档: ${docId}`);
        }
        
        throw new Error(`保存文档失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载文档内容
   * 从 data/documents/{docId}.json 文件加载文档内容
   * @param {string} docId - 文档 ID
   * @returns {Promise<any|null>} 文档内容对象，如果文件不存在则返回 null
   */
  async loadDocument(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.json`);
    
    try {
      console.log(`[FileSystemService] 开始加载文档: ${docId}`);
      
      // 读取文件内容
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // 解析 JSON
      const data = JSON.parse(fileContent);
      console.log(`[FileSystemService] 文档加载成功: ${docId}`);
      
      return data;
    } catch (error) {
      // 如果文件不存在，返回 null
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] 文档文件不存在: ${docId}`);
        return null;
      }
      
      // 如果是 JSON 解析错误，尝试从备份恢复
      if (error instanceof SyntaxError) {
        console.error(`[FileSystemService] JSON 解析失败 (${docId}):`, error);
        
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 尝试从备份重新加载文档: ${docId}`);
          // 递归调用自己重新加载
          return await this.loadDocument(docId);
        }
        
        // 如果备份也失败，返回 null
        console.error(`[FileSystemService] 无法从备份恢复，返回 null: ${docId}`);
        return null;
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载文档失败 (${docId}):`, error);
      throw new Error(`加载文档失败: ${error.message}`);
    }
  }

  /**
   * 保存资源文件
   * 将资源文件（图片、附件等）保存到 data/assets/{sourceId}/{docId}/ 目录
   * @param {string} sourceId - 数据源 ID
   * @param {string} docId - 文档 ID
   * @param {string} filename - 文件名
   * @param {Buffer} buffer - 文件内容（二进制数据）
   * @returns {Promise<string>} 资源文件的相对路径
   */
  async saveAsset(sourceId, docId, filename, buffer) {
    // 构建目录路径: data/assets/{sourceId}/{docId}/
    const assetDir = path.join(this.assetsDir, sourceId, docId);
    const filePath = path.join(assetDir, filename);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存资源: ${sourceId}/${docId}/${filename}`);
        
        // 创建必要的子目录结构（递归创建）
        await fs.mkdir(assetDir, { recursive: true });
        console.log(`[FileSystemService] 资源目录已创建: ${assetDir}`);
        
        // 写入文件（二进制数据）
        await fs.writeFile(filePath, buffer);
        console.log(`[FileSystemService] 资源保存成功: ${filePath}`);
        
        // 返回相对路径: assets/{sourceId}/{docId}/{filename}
        const relativePath = path.join('assets', sourceId, docId, filename);
        return relativePath;
      } catch (error) {
        console.error(`[FileSystemService] 保存资源失败 (${sourceId}/${docId}/${filename}):`, error);
        throw new Error(`保存资源失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载资源文件
   * 从 data/assets/{sourceId}/{docId}/{filename} 加载资源文件
   * @param {string} sourceId - 数据源 ID
   * @param {string} docId - 文档 ID
   * @param {string} filename - 文件名
   * @returns {Promise<Buffer>} 文件内容（二进制数据）
   */
  async loadAsset(sourceId, docId, filename) {
    const filePath = path.join(this.assetsDir, sourceId, docId, filename);
    
    try {
      console.log(`[FileSystemService] 开始加载资源: ${sourceId}/${docId}/${filename}`);
      
      // 读取文件内容（二进制数据）
      const buffer = await fs.readFile(filePath);
      console.log(`[FileSystemService] 资源加载成功: ${filePath}`);
      
      return buffer;
    } catch (error) {
      // 如果文件不存在
      if (error.code === 'ENOENT') {
        console.error(`[FileSystemService] 资源文件不存在: ${sourceId}/${docId}/${filename}`);
        throw new Error(`资源文件不存在: ${filename}`);
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载资源失败 (${sourceId}/${docId}/${filename}):`, error);
      throw new Error(`加载资源失败: ${error.message}`);
    }
  }

  /**
   * 保存 HTML 文件
   * 将 HTML 内容保存到 data/documents/{docId}.html 文件
   * @param {string} docId - 文档 ID
   * @param {string} htmlContent - HTML 内容
   */
  async saveHtmlFile(docId, htmlContent) {
    const filePath = path.join(this.documentsDir, `${docId}.html`);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存 HTML 文件: ${docId}`);
        
        // 创建备份
        await this.createBackup(filePath);
        
        // 写入文件
        await fs.writeFile(filePath, htmlContent, 'utf8');
        console.log(`[FileSystemService] HTML 文件保存成功: ${filePath}`);
        
        // 删除备份
        await this.deleteBackup(filePath);
        
        return filePath;
      } catch (error) {
        console.error(`[FileSystemService] 保存 HTML 文件失败 (${docId}):`, error);
        
        // 尝试从备份恢复
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 已从备份恢复 HTML 文件: ${docId}`);
        }
        
        throw new Error(`保存 HTML 文件失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载 HTML 文件
   * 从 data/documents/{docId}.html 文件加载 HTML 内容
   * @param {string} docId - 文档 ID
   * @returns {Promise<string|null>} HTML 内容，如果文件不存在则返回 null
   */
  async loadHtmlFile(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.html`);
    
    try {
      console.log(`[FileSystemService] 开始加载 HTML 文件: ${docId}`);
      
      // 读取文件内容
      const htmlContent = await fs.readFile(filePath, 'utf8');
      console.log(`[FileSystemService] HTML 文件加载成功: ${docId}`);
      
      return htmlContent;
    } catch (error) {
      // 如果文件不存在，返回 null
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] HTML 文件不存在: ${docId}`);
        return null;
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载 HTML 文件失败 (${docId}):`, error);
      throw new Error(`加载 HTML 文件失败: ${error.message}`);
    }
  }

  /**
   * 检查 HTML 文件是否存在
   * @param {string} docId - 文档 ID
   * @returns {Promise<boolean>} 文件是否存在
   */
  async htmlFileExists(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.html`);
    
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 保存 PDF 文件
   * 将 PDF 内容保存到 data/documents/{docId}.pdf 文件
   * @param {string} docId - 文档 ID
   * @param {Buffer} pdfBuffer - PDF 内容（二进制数据）
   */
  async savePdfFile(docId, pdfBuffer) {
    const filePath = path.join(this.documentsDir, `${docId}.pdf`);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存 PDF 文件: ${docId}`);
        
        // 创建备份
        await this.createBackup(filePath);
        
        // 写入文件（二进制数据）
        await fs.writeFile(filePath, pdfBuffer);
        console.log(`[FileSystemService] PDF 文件保存成功: ${filePath}`);
        
        // 删除备份
        await this.deleteBackup(filePath);
        
        return filePath;
      } catch (error) {
        console.error(`[FileSystemService] 保存 PDF 文件失败 (${docId}):`, error);
        
        // 尝试从备份恢复
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 已从备份恢复 PDF 文件: ${docId}`);
        }
        
        throw new Error(`保存 PDF 文件失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载 PDF 文件
   * 从 data/documents/{docId}.pdf 文件加载 PDF 内容
   * @param {string} docId - 文档 ID
   * @returns {Promise<Buffer|null>} PDF 内容（二进制数据），如果文件不存在则返回 null
   */
  async loadPdfFile(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.pdf`);
    
    try {
      console.log(`[FileSystemService] 开始加载 PDF 文件: ${docId}`);
      
      // 读取文件内容（二进制数据）
      const pdfBuffer = await fs.readFile(filePath);
      console.log(`[FileSystemService] PDF 文件加载成功: ${docId}`);
      
      return pdfBuffer;
    } catch (error) {
      // 如果文件不存在，返回 null
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] PDF 文件不存在: ${docId}`);
        return null;
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载 PDF 文件失败 (${docId}):`, error);
      throw new Error(`加载 PDF 文件失败: ${error.message}`);
    }
  }

  /**
   * 检查 PDF 文件是否存在
   * @param {string} docId - 文档 ID
   * @returns {Promise<boolean>} 文件是否存在
   */
  async pdfFileExists(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.pdf`);
    
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 保存 Word 文件
   * 将 Word 内容保存到 data/documents/{docId}.docx 文件
   * @param {string} docId - 文档 ID
   * @param {Buffer} docxBuffer - Word 内容（二进制数据）
   * @returns {Promise<string>} 文件路径
   */
  async saveDocxFile(docId, docxBuffer) {
    const filePath = path.join(this.documentsDir, `${docId}.docx`);
    
    // 使用文件锁保护写入操作
    return await this.withLock(filePath, async () => {
      try {
        console.log(`[FileSystemService] 开始保存 Word 文件: ${docId}`);
        
        // 创建备份
        await this.createBackup(filePath);
        
        // 写入文件（二进制数据）
        await fs.writeFile(filePath, docxBuffer);
        console.log(`[FileSystemService] Word 文件保存成功: ${filePath}`);
        
        // 删除备份
        await this.deleteBackup(filePath);
        
        return filePath;
      } catch (error) {
        console.error(`[FileSystemService] 保存 Word 文件失败 (${docId}):`, error);
        
        // 尝试从备份恢复
        const restored = await this.restoreFromBackup(filePath);
        if (restored) {
          console.log(`[FileSystemService] 已从备份恢复 Word 文件: ${docId}`);
        }
        
        throw new Error(`保存 Word 文件失败: ${error.message}`);
      }
    });
  }

  /**
   * 加载 Word 文件
   * 从 data/documents/{docId}.docx 文件加载 Word 内容
   * @param {string} docId - 文档 ID
   * @returns {Promise<Buffer|null>} Word 内容（二进制数据），如果文件不存在则返回 null
   */
  async loadDocxFile(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.docx`);
    
    try {
      console.log(`[FileSystemService] 开始加载 Word 文件: ${docId}`);
      
      // 读取文件内容（二进制数据）
      const docxBuffer = await fs.readFile(filePath);
      console.log(`[FileSystemService] Word 文件加载成功: ${docId}`);
      
      return docxBuffer;
    } catch (error) {
      // 如果文件不存在，返回 null
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] Word 文件不存在: ${docId}`);
        return null;
      }
      
      // 其他错误
      console.error(`[FileSystemService] 加载 Word 文件失败 (${docId}):`, error);
      throw new Error(`加载 Word 文件失败: ${error.message}`);
    }
  }

  /**
   * 检查 Word 文件是否存在
   * @param {string} docId - 文档 ID
   * @returns {Promise<boolean>} 文件是否存在
   */
  async docxFileExists(docId) {
    const filePath = path.join(this.documentsDir, `${docId}.docx`);
    
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 删除文件（用于更新时清理旧文件）
   * @param {string} docId - 文档 ID
   * @param {string} fileType - 文件类型（'html'、'pdf' 或 'docx'）
   */
  async deleteFile(docId, fileType) {
    let extension;
    switch (fileType) {
      case 'pdf':
        extension = '.pdf';
        break;
      case 'docx':
        extension = '.docx';
        break;
      default:
        extension = '.html';
    }
    
    const filePath = path.join(this.documentsDir, `${docId}${extension}`);
    
    try {
      console.log(`[FileSystemService] 开始删除文件: ${docId}${extension}`);
      
      // 检查文件是否存在
      await fs.access(filePath);
      
      // 删除文件
      await fs.unlink(filePath);
      console.log(`[FileSystemService] 文件删除成功: ${filePath}`);
    } catch (error) {
      // 如果文件不存在，这是正常情况
      if (error.code === 'ENOENT') {
        console.log(`[FileSystemService] 文件不存在，无需删除: ${filePath}`);
        return;
      }
      
      // 其他错误
      console.error(`[FileSystemService] 删除文件失败 (${docId}${extension}):`, error);
      throw new Error(`删除文件失败: ${error.message}`);
    }
  }

  /**
   * 将 HTML 内容片段包装成完整的 HTML 文档
   * @param {string} htmlContent - HTML 内容片段（body_html）
   * @param {string} title - 文档标题
   * @returns {string} 完整的 HTML 文档
   */
  wrapHtmlDocument(htmlContent, title) {
    console.log(`[FileSystemService] 开始包装 HTML 文档: ${title}`);
    
    // 使用字符串拼接生成完整的 HTML 文档
    // 不对 htmlContent 进行转义或修改，直接插入到 <body> 标签中
    const fullHtmlDocument = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
    
    console.log(`[FileSystemService] HTML 文档包装完成: ${title}`);
    
    return fullHtmlDocument;
  }

  /**
   * 获取格式化的文档内容
   * 根据文档格式提取 body 或 body_html 字段
   * 对于 HTML/Lake 格式，包装成完整的 HTML 文档
   * @param {string} docId - 文档 ID
   * @returns {Promise<{content: string, format: string, title: string}|null>} 格式化的文档数据，如果文档不存在则返回 null
   */
  async getFormattedDocument(docId) {
    try {
      console.log(`[FileSystemService] 开始获取格式化文档: ${docId}`);
      
      // 加载文档内容
      const document = await this.loadDocument(docId);
      
      // 如果文档不存在，返回 null
      if (document === null) {
        console.log(`[FileSystemService] 文档不存在: ${docId}`);
        return null;
      }
      
      // 提取文档标题
      const title = document.title || `document-${docId}`;
      
      // 确定文档格式和内容
      let content = '';
      let format = 'markdown'; // 默认格式
      
      // 根据文档格式提取内容
      if (document.format === 'markdown' || document.format === 'md') {
        // Markdown 格式，使用 body 字段，保持原样返回
        content = document.body || '';
        format = 'markdown';
        console.log(`[FileSystemService] 文档格式: Markdown, 不进行 HTML 包装`);
      } else if (document.format === 'lake' || document.format === 'html') {
        // HTML/Lake 格式，使用 body_html 字段，包装成完整 HTML 文档
        const htmlContent = document.body_html || '';
        content = this.wrapHtmlDocument(htmlContent, title);
        format = 'html';
        console.log(`[FileSystemService] 文档格式: ${document.format}, 已进行 HTML 包装`);
      } else {
        // 格式字段为空或未知，根据内容字段自动判断
        if (document.body_html) {
          // 存在 body_html 字段，识别为 HTML 格式
          const htmlContent = document.body_html;
          content = this.wrapHtmlDocument(htmlContent, title);
          format = 'html';
          console.log(`[FileSystemService] 文档格式未知，根据 body_html 字段判断为 HTML, 已进行 HTML 包装`);
        } else {
          // 不存在 body_html 字段，识别为 Markdown 格式
          content = document.body || '';
          format = 'markdown';
          console.log(`[FileSystemService] 文档格式未知，根据 body 字段判断为 Markdown, 不进行 HTML 包装`);
        }
      }
      
      console.log(`[FileSystemService] 格式化文档获取成功: ${docId}, 格式: ${format}, 标题: ${title}`);
      
      return {
        content,
        format,
        title
      };
    } catch (error) {
      console.error(`[FileSystemService] 获取格式化文档失败 (${docId}):`, error);
      throw new Error(`获取格式化文档失败: ${error.message}`);
    }
  }

  /**
   * 清理文件名，移除不安全字符
   * 将不安全字符替换为下划线，限制文件名长度，保留文件扩展名
   * @param {string} filename - 原始文件名
   * @param {string} extension - 文件扩展名（如 '.md', '.html'）
   * @returns {string} 清理后的安全文件名
   */
  sanitizeFilename(filename, extension = '') {
    // 移除文件扩展名（如果存在）
    let baseName = filename;
    if (extension && baseName.endsWith(extension)) {
      baseName = baseName.slice(0, -extension.length);
    }
    
    // 替换不安全字符为下划线
    // 不安全字符包括: / \ : * ? " < > |
    // 同时保留中文字符、字母、数字、点、下划线、连字符
    const safeBaseName = baseName.replace(/[\/\\:*?"<>|]/g, '_');
    
    // 限制文件名长度（最多 200 个字符，为扩展名留出空间）
    const maxLength = 200;
    const truncatedBaseName = safeBaseName.length > maxLength 
      ? safeBaseName.slice(0, maxLength) 
      : safeBaseName;
    
    // 组合文件名和扩展名
    const safeFilename = truncatedBaseName + extension;
    
    console.log(`[FileSystemService] 文件名清理: "${filename}" -> "${safeFilename}"`);
    
    return safeFilename;
  }
}

export default FileSystemService;
