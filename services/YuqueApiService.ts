import { YuqueSourceConfig, YuqueTocNode, YuqueDocument } from '../types';

export class YuqueApiService {
  private baseUrl: string;
  private token: string;
  private groupLogin: string;
  private bookSlug: string;

  constructor(config: YuqueSourceConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.groupLogin = config.groupLogin;
    this.bookSlug = config.bookSlug;
  }

  // ============ Validation ============

  async validateAccess(): Promise<{ valid: boolean; error?: string }> {
    try {
      console.log('[YuqueAPI] 开始验证访问权限...');
      console.log('[YuqueAPI] Base URL:', this.baseUrl);
      console.log('[YuqueAPI] Group Login:', this.groupLogin);
      console.log('[YuqueAPI] Book Slug:', this.bookSlug);
      
      // Test by getting current user info
      const endpoint = '/api/v2/user';
      console.log('[YuqueAPI] 测试用户信息:', `${this.baseUrl}${endpoint}`);
      await this.request<{ data: { id: number; name: string } }>(endpoint);
      console.log('[YuqueAPI] 用户信息验证成功');
      
      // Also test access to the specific repo
      const repoEndpoint = `/api/v2/repos/${this.groupLogin}/${this.bookSlug}`;
      console.log('[YuqueAPI] 测试知识库访问:', `${this.baseUrl}${repoEndpoint}`);
      await this.request<{ data: { id: number; name: string } }>(repoEndpoint);
      console.log('[YuqueAPI] 知识库访问验证成功');
      
      return { valid: true };
    } catch (error) {
      console.error('[YuqueAPI] 验证失败:', error);
      if (error instanceof Error) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: '未知错误' };
    }
  }

  // ============ TOC (Table of Contents) ============

  async getToc(): Promise<YuqueTocNode[]> {
    const endpoint = `/api/v2/repos/${this.groupLogin}/${this.bookSlug}/toc`;
    const response = await this.request<{ data: any[] }>(endpoint);
    
    // Parse and calculate depth for each node
    const nodes = response.data.map((node: any) => ({
      uuid: node.uuid,
      type: node.type,
      title: node.title,
      slug: node.slug,
      doc_id: node.doc_id,
      parent_uuid: node.parent_uuid,
      child_uuid: node.child_uuid,
      sibling_uuid: node.sibling_uuid,
      depth: 0, // Will be calculated
    }));

    // Calculate depth for each node
    this.calculateDepth(nodes);
    
    return nodes;
  }

  private calculateDepth(nodes: YuqueTocNode[]): void {
    const nodeMap = new Map<string, YuqueTocNode>();
    nodes.forEach(node => nodeMap.set(node.uuid, node));

    // Calculate depth by traversing parent chain
    nodes.forEach(node => {
      let depth = 0;
      let current = node;
      while (current.parent_uuid) {
        depth++;
        const parent = nodeMap.get(current.parent_uuid);
        if (!parent) break;
        current = parent;
      }
      node.depth = depth;
    });
  }

  // ============ Documents ============

  async getDoc(idOrSlug: string): Promise<YuqueDocument> {
    const endpoint = `/api/v2/repos/${this.groupLogin}/${this.bookSlug}/docs/${idOrSlug}`;
    const response = await this.request<{ data: any }>(endpoint);
    
    return {
      id: response.data.id,
      slug: response.data.slug,
      title: response.data.title,
      format: response.data.format || 'markdown',
      body: response.data.body,
      body_html: response.data.body_html,
      body_lake: response.data.body_lake, // Lake 格式的真正 HTML 内容
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      user: {
        name: response.data.user?.name || response.data.creator?.name || 'Unknown',
        login: response.data.user?.login || response.data.creator?.login || 'unknown',
      },
    };
  }

  // ============ Assets ============

  async downloadAsset(url: string): Promise<Blob> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error(`Error downloading asset from ${url}:`, error);
      throw error;
    }
  }

  // ============ Generic Request Method ============

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // 使用代理服务器
    const proxyUrl = `http://localhost:3001/api/yuque${endpoint}`;
    
    const headers: HeadersInit = {
      'X-Yuque-Token': this.token,
      'X-Yuque-Base-Url': this.baseUrl,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(proxyUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle different status codes
      if (response.status === 401) {
        throw new Error('令牌无效或已过期，请检查访问令牌配置');
      }

      if (response.status === 403) {
        throw new Error('无权限访问，请检查 User-Agent 配置或知识库权限');
      }

      if (response.status === 429) {
        // Rate limiting - retry with exponential backoff
        const waitTime = retryCount < 3 ? 500 : 1000;
        console.warn(`API 限流 (429)，等待 ${waitTime}ms 后重试...`);
        
        await this.sleep(waitTime);
        
        if (retryCount < 5) {
          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          throw new Error('API 限流次数过多，请稍后再试');
        }
      }

      if (response.status >= 500) {
        // Server error - retry up to 2 times
        if (retryCount < 2) {
          console.warn(`服务器错误 (${response.status})，重试中...`);
          await this.sleep(1000);
          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
        }
      }

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        if (retryCount < 3) {
          const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.warn(`请求超时，等待 ${waitTime}ms 后重试... (${retryCount + 1}/3)`);
          await this.sleep(waitTime);
          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          throw new Error('网络请求超时，请检查网络连接或语雀服务是否可访问');
        }
      }

      // Handle network errors
      if (error instanceof TypeError) {
        // CORS or network error - don't retry as it won't help
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('failed to fetch') || errorMsg.includes('network')) {
          throw new Error(
            'CORS 跨域错误：浏览器阻止了请求。\n' +
            '解决方案：\n' +
            '1. 使用浏览器扩展禁用 CORS（仅开发环境）\n' +
            '2. 配置代理服务器转发请求\n' +
            '3. 使用服务端 API 而非浏览器直接调用'
          );
        }
        throw new Error(`网络错误: ${error.message}`);
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
