import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 图片代理端点（用于避免 CORS 问题）
app.get('/api/yuque/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).json({ error: '缺少 url 参数' });
    }

    console.log(`[Proxy] 下载图片: ${imageUrl}`);

    // 下载图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.yuque.com/',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] 图片下载失败: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: '图片下载失败', 
        status: response.status 
      });
    }

    // 获取图片数据
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // 设置响应头
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年

    // 返回图片数据
    res.send(buffer);
    
    console.log(`[Proxy] 图片下载成功: ${buffer.length} bytes`);
  } catch (error) {
    console.error('[Proxy] 图片代理错误:', error.message);
    res.status(500).json({ 
      error: '图片代理失败', 
      message: error.message 
    });
  }
});

// 语雀 API 代理
app.all('/api/yuque/*', async (req, res) => {
  try {
    // 从请求头获取配置
    const baseUrl = req.headers['x-yuque-base-url'] || 'https://www.yuque.com';
    const token = req.headers['x-yuque-token'];
    
    if (!token) {
      return res.status(400).json({ error: '缺少 X-Yuque-Token 请求头' });
    }

    // 构建目标 URL
    const targetPath = req.path.replace('/api/yuque', '');
    const targetUrl = `${baseUrl}${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    console.log(`[Proxy] 转发请求到: ${targetUrl}`);

    // 转发请求到语雀
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'X-Auth-Token': token,
        'User-Agent': 'EKH-Export/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // 获取响应数据
    const data = await response.json();
    
    // 返回响应
    res.status(response.status).json(data);
    
    console.log(`[Proxy] 响应状态: ${response.status}`);
  } catch (error) {
    console.error('[Proxy] 错误:', error.message);
    res.status(500).json({ 
      error: '代理请求失败', 
      message: error.message 
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 语雀 API 代理服务器已启动`);
  console.log(`📡 监听端口: http://localhost:${PORT}`);
  console.log(`✅ CORS 已启用`);
  console.log(`\n使用方法:`);
  console.log(`  - 前端请求: http://localhost:${PORT}/api/yuque/api/v2/user`);
  console.log(`  - 请求头: X-Yuque-Token, X-Yuque-Base-Url\n`);
});
