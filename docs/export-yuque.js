/**
 * 语雀导出脚本（Node.js）
 *
 * 作用：
 * - 从语雀知识库导出目录（TOC）与文档详情正文（Markdown/HTML），可选下载图片/附件并重写链接
 * - 支持企业子域与主域 API，支持整库导出与单篇导出两种模式
 *
 * 用法示例：
 * - 单篇导出（推荐先验效果）：
 *   YUQUE_TOKEN=<TOKEN> node scripts/export-yuque.js \
 *     --group <group_login> --book <book_slug> \
 *     --base https://<org>.yuque.com \
 *     --doc <id_or_slug> --out ./export --assets
 *
 * - 整库导出：
 *   YUQUE_TOKEN=<TOKEN> node scripts/export-yuque.js \
 *     --group <group_login> --book <book_slug> \
 *     --base https://<org>.yuque.com \
 *     --out ./export --pageSize 50 --delayMs 200 --assets
 *
 * 参数说明：
 * - --token / YUQUE_TOKEN：语雀访问令牌（建议同时具备企业空间访问权限）
 * - --group / YUQUE_GROUP_LOGIN：团队 Login
 * - --book / YUQUE_BOOK_SLUG：知识库 Slug
 * - --base / YUQUE_BASE：API 基地址（企业子域优先，其次 https://www.yuque.com）
 * - --out / OUT_DIR：输出目录（默认 ./export）
 * - --pageSize / PAGE_SIZE：分页大小（整库模式使用）
 * - --delayMs / DELAY_MS：请求延时，用于限流与礼貌访问（整库模式使用）
 * - --assets / DOWNLOAD_ASSETS：是否下载图片/附件并重写链接
 * - --doc / YUQUE_DOC：单篇文档 ID 或路径（启用单篇模式）
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const child_process = require('child_process');

// 确保目录存在（递归创建）
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 写入 JSON 文件（自动创建父目录）
function writeJSON(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

// 写入纯文本文件（自动创建父目录）
function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text);
}

// 异步延时（用于限流与礼貌访问）
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// 构造 URL（附带查询参数）
function buildUrl(base, pathname, query) {
  const u = new URL(pathname, base);
  if (query) Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });
  return u;
}

// 发起 GET 请求并解析为 JSON（携带鉴权与必要请求头）
function requestJSON({ base, pathname, query, token }) {
  const url = buildUrl(base, pathname, query);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Auth-Token': token,
    'User-Agent': 'EnterpriseKnowledgeHubExport/1.0',
    'Accept': 'application/json'
  };
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 下载文件（自动跟随 3xx 重定向，保存到指定路径）
async function downloadFile(url, filePath) {
  ensureDir(path.dirname(filePath));
  const u = new URL(url);
  await new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, filePath).then(resolve).catch(reject);
        return;
      }
      if (!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300)) {
        reject(new Error(`HTTP ${res.statusCode} on ${url}`));
        return;
      }
      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

// 从 Markdown 或 HTML 文本中提取图片 URL（支持 ![]() 与 <img src>）
function extractAssetUrlsFromMarkdownOrHtml(text) {
  const urls = new Set();
  const mdImg = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImg = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = mdImg.exec(text)) !== null) urls.add(m[1]);
  while ((m = htmlImg.exec(text)) !== null) urls.add(m[1]);
  return Array.from(urls);
}

// 将正文中的远程资源链接替换为本地相对路径
function rewriteContentUrls(text, mapping) {
  let out = text;
  Object.entries(mapping).forEach(([remote, local]) => {
    const escaped = remote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), local);
  });
  return out;
}

// 判断时间是否在指定起始时间之后（包含边界），ISO 字符串比较
function isOnOrAfter(iso, sinceISO) {
  try {
    const a = new Date(iso).getTime();
    const b = new Date(sinceISO).getTime();
    return Number.isFinite(a) && Number.isFinite(b) && a >= b;
  } catch (_) {
    return false;
  }
}

function sanitizeSegment(name) {
  const s = String(name || '').trim().replace(/[\\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
  return s || 'untitled';
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  const which = (cmd) => {
    try {
      const r = child_process.spawnSync('which', [cmd], { encoding: 'utf8' });
      if (r.status === 0) return r.stdout.trim();
    } catch (_) {}
    return '';
  };
  const fromPath = which('google-chrome') || which('chromium') || which('microsoft-edge');
  return fromPath || '';
}

async function convertHtmlToPdf(inputPath, outputPath) {
  const inAbs = path.resolve(inputPath);
  const outAbs = outputPath ? path.resolve(outputPath) : path.resolve(path.dirname(inAbs), `${path.basename(inAbs, path.extname(inAbs))}.pdf`);
  ensureDir(path.dirname(outAbs));
  const chrome = findChrome();
  if (chrome) {
    const args = [
      '--headless',
      '--disable-gpu',
      `--print-to-pdf=${outAbs}`,
      `file://${inAbs}`
    ];
    const r = child_process.spawnSync(chrome, args, { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('Chrome headless 转换失败');
    if (!fs.existsSync(outAbs)) throw new Error('未生成PDF文件');
    return outAbs;
  }
  try {
    const ver = child_process.spawnSync('wkhtmltopdf', ['--version'], { encoding: 'utf8' });
    if (ver.status === 0) {
      const r = child_process.spawnSync('wkhtmltopdf', [inAbs, outAbs], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('wkhtmltopdf 转换失败');
      if (!fs.existsSync(outAbs)) throw new Error('未生成PDF文件');
      return outAbs;
    }
  } catch (_) {}
  throw new Error('未找到可用的HTML转PDF工具');
}

function buildTocPathMap(toc) {
  const items = Array.isArray(toc && toc.data) ? toc.data : Array.isArray(toc) ? toc : [];
  const byUuid = new Map();
  for (const it of items) {
    if (!it || !it.uuid) continue;
    byUuid.set(it.uuid, it);
  }
  const cache = new Map();
  function getPathSegments(uuid) {
    if (!uuid) return [];
    if (cache.has(uuid)) return cache.get(uuid);
    const node = byUuid.get(uuid);
    if (!node) { cache.set(uuid, []); return []; }
    const parent = node.parent_uuid ? getPathSegments(node.parent_uuid) : [];
    const segs = parent.slice();
    const t = String(node.type || '').toUpperCase();
    if (t === 'TITLE') {
      segs.push(sanitizeSegment(node.title || ''));
    }
    cache.set(uuid, segs);
    return segs;
  }
  const map = {};
  for (const it of items) {
    const t = String(it.type || '').toUpperCase();
    if (t === 'DOC') {
      const segs = getPathSegments(it.uuid);
      const key = it.slug || it.doc_id || it.id;
      if (key) map[String(key)] = segs;
    }
  }
  return map;
}

/**
 * 导出语雀数据
 * @param {string} token 访问令牌（建议具备企业空间权限）
 * @param {string} group 团队 Login
 * @param {string} book 知识库 Slug
 * @param {string} outDir 输出根目录
 * @param {number} pageSize 分页大小（整库模式）
 * @param {number} delayMs 请求延时（整库模式，限流）
 * @param {boolean} downloadAssets 是否下载图片/附件并重写链接
 * @param {string} base API 基地址（企业子域优先）
 * @param {string} doc 单篇文档 ID 或路径（启用单篇模式时必填）
 */
async function exportYuque({ token, group, book, outDir, pageSize, delayMs, downloadAssets, base, doc}) {
  base = base || 'https://www.yuque.com';
  const repoPath = `/api/v2/repos/${group}/${book}`;
  const targetRoot = path.resolve(outDir, 'yuque', group, book);
  ensureDir(targetRoot);
  let tocPathMap = {};

  if (!doc) {
    // 单篇模式跳过 TOC；整库模式先拉取 TOC 以便后续映射
    const toc = await requestJSON({ base, pathname: `${repoPath}/toc`, token });
    writeJSON(path.join(targetRoot, 'toc.json'), toc);
    try {
      const arr = Array.isArray(toc && toc.data) ? toc.data : Array.isArray(toc) ? toc : [];
      console.log(`目录已加载: ${arr.length} 条目`);
    } catch (_) {}
    try { tocPathMap = buildTocPathMap(toc); } catch (_) {}
  }

  if (doc) {
    // 单篇导出：直接拉文档详情，保存 JSON 与正文
    console.log(`开始导出单篇: ${doc}`);
    const detail = await requestJSON({ base, pathname: `${repoPath}/docs/${doc}`, token });
    const data = detail.data || detail;
    const title = data.title || String(doc);
    const slug = data.slug || String(doc);
    const format = data.format || 'markdown';
    const body = format === 'markdown' ? (data.body || '') : (data.body_html || data.body || '');
    const ext = format === 'markdown' ? 'md' : 'html';
    const segments = tocPathMap[slug] || [];
    const docDir = path.join(targetRoot, 'docs', ...segments);
    const metaPath = path.join(docDir, `${slug}.json`);
    writeJSON(metaPath, { meta: { slug }, detail: data });
    let finalBody = body;
    if (downloadAssets) {
      // 下载正文中的图片/附件，并将链接重写为相对路径
      const urls = extractAssetUrlsFromMarkdownOrHtml(body);
      const mapping = {};
      for (const u of urls) {
        try {
          const urlObj = new URL(u, base);
          const filename = path.basename(urlObj.pathname) || `asset-${Date.now()}`;
          const localDir = path.join(targetRoot, 'assets', slug);
          const localPath = path.join(localDir, filename);
          const relPath = path.relative(docDir, localPath).split(path.sep).join('/');
          await downloadFile(urlObj.href, localPath);
          mapping[u] = relPath.startsWith('..') ? relPath : `./${relPath}`;
        } catch (e) {}
        if (delayMs) await sleep(delayMs);
      }
      finalBody = rewriteContentUrls(body, mapping);
    }
    const bodyPath = path.join(docDir, `${slug}.${ext}`);
    console.log(`写入: ${path.relative(targetRoot, bodyPath)}`);
    writeText(bodyPath, finalBody);
    return;
  } else {
    // 整库导出：分页拉取文档列表，逐篇获取详情并保存
    let page = 1;
    const docsMeta = [];
    const seen = new Set();
    for (;;) {
      console.log(`拉取列表: 第 ${page} 页, 每页 ${pageSize}`);
      const list = await requestJSON({ base, pathname: `${repoPath}/docs`, query: { page, page_size: pageSize }, token });
      const items = Array.isArray(list.data) ? list.data : [];
      console.log(`获取到 ${items.length} 条`);
      const unique = [];
      let dupCount = 0;
      for (const it of items) {
        const key = String(it.id || it.doc_id || it.slug || it.uuid || Math.random());
        if (seen.has(key)) { dupCount += 1; continue; }
        seen.add(key);
        unique.push(it);
      }
      if (dupCount) console.log(`去重后新增 ${unique.length} 条，重复 ${dupCount} 条`);
      try {
        const summaries = unique.map((it, i) => {
          const rid = it.id || it.doc_id || it.slug || it.uuid;
          const slug = it.slug || '';
          const title = it.title || '';
          const fmt = it.format || '';
          const updated = it.updated_at || it.updated || it.update_time || '';
          const seq = seen.size - unique.length + i + 1;
          return `  #${seq} id=${rid} slug=${slug} title=${title} format=${fmt} updated=${updated}`;
        });
        if (summaries.length) console.log(summaries.join('\n'));
      } catch (_) {}
      if (!items.length) break;
      if (!unique.length) {
        console.log('当前页全部重复，分页可能无效，结束遍历');
        break;
      }
      docsMeta.push(...unique);
      if (items.length < pageSize) break;
      page += 1;
      if (delayMs) await sleep(delayMs);
    }
    console.log(`总文档数: ${docsMeta.length}`);
    writeJSON(path.join(targetRoot, 'docs-list.json'), { count: docsMeta.length, data: docsMeta });
    let idx = 0;
    for (const item of docsMeta) {
      idx += 1;
      const id = item.id || item.doc_id || item.slug || item.uuid;
      if (!id) continue;
      console.log(`[${idx}/${docsMeta.length}] 导出: ${id}`);
      const detail = await requestJSON({ base, pathname: `${repoPath}/docs/${id}`, token });
      const data = detail.data || detail;
      const title = data.title || item.title || String(id);
      const slug = data.slug || item.slug || String(id);
      const format = data.format || 'markdown';
      const body = format === 'markdown' ? (data.body || '') : (data.body_html || data.body || '');
      const ext = format === 'markdown' ? 'md' : 'html';
      const keyCandidates = [slug, data.slug, item.slug, data.doc_id, item.doc_id, data.id, item.id].filter(Boolean).map(String);
      let segments = [];
      for (const k of keyCandidates) { if (tocPathMap[k]) { segments = tocPathMap[k]; break; } }
      const docDir = path.join(targetRoot, 'docs', ...segments);
      const metaPath = path.join(docDir, `${slug}.json`);
      writeJSON(metaPath, { meta: item, detail: data });
      let finalBody = body;
      if (downloadAssets) {
        const urls = extractAssetUrlsFromMarkdownOrHtml(body);
        const mapping = {};
        for (const u of urls) {
          try {
            const urlObj = new URL(u, base);
            const filename = path.basename(urlObj.pathname) || `asset-${Date.now()}`;
            const localDir = path.join(targetRoot, 'assets', slug);
            const localPath = path.join(localDir, filename);
            const relPath = path.relative(docDir, localPath).split(path.sep).join('/');
            await downloadFile(urlObj.href, localPath);
            mapping[u] = relPath.startsWith('..') ? relPath : `./${relPath}`;
          } catch (e) {}
          if (delayMs) await sleep(delayMs);
        }
        finalBody = rewriteContentUrls(body, mapping);
      }
      const bodyPath = path.join(docDir, `${slug}.${ext}`);
      console.log(`[${idx}/${docsMeta.length}] 写入: ${path.relative(targetRoot, bodyPath)}`);
      writeText(bodyPath, finalBody);
      if (delayMs) await sleep(delayMs);
    }
  }
}

// 解析命令行参数与环境变量，生成配置对象
function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--group') cfg.group = args[++i];
    else if (a === '--book') cfg.book = args[++i];
    else if (a === '--out') cfg.outDir = args[++i];
    else if (a === '--pageSize') cfg.pageSize = Number(args[++i]);
    else if (a === '--delayMs') cfg.delayMs = Number(args[++i]);
    else if (a === '--assets') cfg.downloadAssets = true;
    else if (a === '--token') cfg.token = args[++i];
    else if (a === '--base') cfg.base = args[++i];
    else if (a === '--doc') cfg.doc = args[++i];
    else if (a === '--htmlFile') cfg.htmlFile = args[++i];
    else if (a === '--pdfOut') cfg.pdfOut = args[++i];
  }
  cfg.group = cfg.group || process.env.YUQUE_GROUP_LOGIN;
  cfg.book = cfg.book || process.env.YUQUE_BOOK_SLUG;
  cfg.token = cfg.token || process.env.YUQUE_TOKEN;
  cfg.outDir = cfg.outDir || process.env.OUT_DIR || path.resolve(process.cwd(), 'export');
  cfg.pageSize = cfg.pageSize || Number(process.env.PAGE_SIZE || 5);
  cfg.delayMs = cfg.delayMs || Number(process.env.DELAY_MS || 200);
  cfg.downloadAssets = cfg.downloadAssets || Boolean(process.env.DOWNLOAD_ASSETS === 'true');
  cfg.base = cfg.base || process.env.YUQUE_BASE;
  cfg.doc = cfg.doc || process.env.YUQUE_DOC;
  cfg.htmlFile = cfg.htmlFile || process.env.HTML_FILE;
  cfg.pdfOut = cfg.pdfOut || process.env.PDF_OUT;
  return cfg;
}

// 程序入口：校验参数、调用导出逻辑并输出结果路径
async function main() {
  const cfg = parseArgs();
  if (cfg.htmlFile) {
    try {
      const out = await convertHtmlToPdf(cfg.htmlFile, cfg.pdfOut);
      console.log(`PDF生成: ${out}`);
      process.exit(0);
    } catch (e) {
      console.error('HTML转PDF失败', e.message);
      process.exit(3);
    }
  }
  if (!cfg.token || !cfg.group || !cfg.book) {
    console.error('缺少必要参数');
    console.error('需要提供 --token、--group、--book 或设置环境变量 YUQUE_TOKEN、YUQUE_GROUP_LOGIN、YUQUE_BOOK_SLUG');
    console.error('示例:');
    console.error('YUQUE_TOKEN=xxx node scripts/export-yuque.js --group your_team --book your_repo --assets');
    process.exit(1);
  }
  try {
    await exportYuque(cfg);
    console.log('导出完成');
    console.log(`输出目录: ${path.resolve(cfg.outDir, 'yuque', cfg.group, cfg.book)}`);
  } catch (e) {
    console.error('导出失败', e.message);
    process.exit(2);
  }
}

// 仅在直接执行该文件时运行 main（作为模块引入时不执行）
if (require.main === module) {
  main();
}
