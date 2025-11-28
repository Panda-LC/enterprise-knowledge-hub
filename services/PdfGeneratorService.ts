/**
 * PDF 生成服务
 * 
 * 负责将 HTML 文件转换为 PDF 文件
 * 复用 export-yuque.js 中的 HTML 转 PDF 逻辑
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { mkdir } from 'fs/promises';

export class PdfGeneratorService {
  /**
   * 生成 PDF 文件
   * @param docId 文档 ID
   * @param htmlPath HTML 文件路径
   * @returns 生成的 PDF 文件路径
   */
  static async generatePdf(docId: string, htmlPath: string): Promise<string> {
    try {
      console.log(`[PdfGenerator] 开始生成 PDF: ${docId}`);
      
      // 检查 HTML 文件是否存在
      if (!existsSync(htmlPath)) {
        throw new Error(`HTML 文件不存在: ${htmlPath}`);
      }

      // 构造 PDF 输出路径
      const pdfPath = htmlPath.replace(/\.html$/, '.pdf');
      
      // 确保输出目录存在
      await mkdir(dirname(pdfPath), { recursive: true });

      // 调用 HTML 转 PDF 工具
      await this.convertHtmlToPdf(htmlPath, pdfPath);

      console.log(`[PdfGenerator] PDF 生成成功: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PdfGenerator] PDF 生成失败: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 调用 HTML 转 PDF 工具
   * @param htmlPath HTML 文件路径
   * @param pdfPath PDF 输出路径
   */
  private static async convertHtmlToPdf(
    htmlPath: string,
    pdfPath: string
  ): Promise<void> {
    const inAbs = resolve(htmlPath);
    const outAbs = pdfPath ? resolve(pdfPath) : resolve(
      dirname(inAbs),
      `${basename(inAbs, extname(inAbs))}.pdf`
    );

    // 确保输出目录存在
    await mkdir(dirname(outAbs), { recursive: true });

    // 尝试使用 Chrome/Chromium
    const chrome = await this.findChrome();
    if (chrome) {
      console.log(`[PdfGenerator] 使用 Chrome: ${chrome}`);
      await this.convertWithChrome(chrome, inAbs, outAbs);
      return;
    }

    // 尝试使用 wkhtmltopdf
    if (await this.hasWkhtmltopdf()) {
      console.log(`[PdfGenerator] 使用 wkhtmltopdf`);
      await this.convertWithWkhtmltopdf(inAbs, outAbs);
      return;
    }

    throw new Error('未找到可用的 HTML 转 PDF 工具（Chrome 或 wkhtmltopdf）');
  }

  /**
   * 查找 Chrome/Chromium 可执行文件
   * @returns Chrome 路径或空字符串
   */
  private static async findChrome(): Promise<string> {
    // macOS 常见路径
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];

    // 检查常见路径
    for (const path of candidates) {
      if (existsSync(path)) {
        return path;
      }
    }

    // 尝试从 PATH 查找
    const chrome = await this.findInPath('google-chrome');
    if (chrome) return chrome;
    
    const chromium = await this.findInPath('chromium');
    if (chromium) return chromium;
    
    const edge = await this.findInPath('microsoft-edge');
    if (edge) return edge;
    
    return '';
  }

  /**
   * 在 PATH 中查找命令
   * @param command 命令名
   * @returns 命令路径或空字符串
   */
  private static findInPath(command: string): Promise<string> {
    return new Promise((resolve) => {
      try {
        const result = spawn('which', [command], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        let output = '';
        if (result.stdout) {
          result.stdout.on('data', (data) => {
            output += data.toString();
          });
        }

        result.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            resolve('');
          }
        });

        result.on('error', () => {
          resolve('');
        });
      } catch {
        resolve('');
      }
    });
  }

  /**
   * 使用 Chrome 转换 HTML 为 PDF
   * @param chromePath Chrome 可执行文件路径
   * @param inputPath HTML 文件路径
   * @param outputPath PDF 输出路径
   */
  private static async convertWithChrome(
    chromePath: string,
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    const args = [
      '--headless',
      '--disable-gpu',
      `--print-to-pdf=${outputPath}`,
      `file://${inputPath}`,
    ];

    return new Promise((resolve, reject) => {
      const process = spawn(chromePath, args, {
        stdio: 'inherit',
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Chrome headless 转换失败，退出码: ${code}`));
          return;
        }

        if (!existsSync(outputPath)) {
          reject(new Error('未生成 PDF 文件'));
          return;
        }

        resolve();
      });

      process.on('error', (error) => {
        reject(new Error(`Chrome 执行失败: ${error.message}`));
      });
    });
  }

  /**
   * 检查 wkhtmltopdf 是否可用
   * @returns 是否可用
   */
  private static async hasWkhtmltopdf(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const result = spawn('wkhtmltopdf', ['--version'], {
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        result.on('close', (code) => {
          resolve(code === 0);
        });

        result.on('error', () => {
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * 使用 wkhtmltopdf 转换 HTML 为 PDF
   * @param inputPath HTML 文件路径
   * @param outputPath PDF 输出路径
   */
  private static async convertWithWkhtmltopdf(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('wkhtmltopdf', [inputPath, outputPath], {
        stdio: 'inherit',
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`wkhtmltopdf 转换失败，退出码: ${code}`));
          return;
        }

        if (!existsSync(outputPath)) {
          reject(new Error('未生成 PDF 文件'));
          return;
        }

        resolve();
      });

      process.on('error', (error) => {
        reject(new Error(`wkhtmltopdf 执行失败: ${error.message}`));
      });
    });
  }
}
