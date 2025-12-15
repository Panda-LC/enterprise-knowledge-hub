# Word 导出功能 - 测试说明

## 概述

本目录包含 Word 导出功能的完整测试文档和工具。测试分为自动化测试和手动测试两部分。

## 文档结构

```
.kiro/specs/word-export-support/
├── TESTING_README.md           # 本文件 - 测试说明
├── MANUAL_TEST_GUIDE.md        # 详细的手动测试指南
├── TEST_CHECKLIST.md           # 可打印的测试检查清单
├── requirements.md             # 需求文档
├── design.md                   # 设计文档
└── tasks.md                    # 任务列表

tasks/tests/
├── manual-test-data-generator.js  # 测试数据生成器
├── manual-test-verifier.js        # 自动化验证脚本
└── manual-test-report.json        # 测试报告（生成后）
```

## 快速开始

### 步骤 1: 生成测试数据

```bash
npm run test:manual:setup
```

这将在 `data/documents/` 目录下生成 10 个测试文档：

1. `manual-test-plain-text` - 纯文本文档
2. `manual-test-rich-text` - 富文本文档（标题、列表、表格）
3. `manual-test-images` - 包含图片的文档
4. `manual-test-code` - 包含代码块的文档
5. `manual-test-lake` - Lake 格式文档
6. `manual-test-empty` - 空文档
7. `manual-test-large` - 超大文档（1000 段落）
8. `manual-test-special-chars` - 特殊字符文档
9. `manual-test-error-handling` - 错误处理测试文档
10. `manual-test-comprehensive` - 综合测试文档

### 步骤 2: 启动应用并生成 Word 文档

```bash
npm run dev
```

然后在浏览器中：

1. 访问 http://localhost:3000
2. 进入"知识资产库"
3. 找到测试文档（以 `manual-test-` 开头）
4. 点击每个文档，进入详情页
5. 点击"下载"按钮，选择"Word (.docx)"格式
6. 等待下载完成

**提示：** 你可以使用浏览器的开发者工具查看控制台日志，了解生成过程。

### 步骤 3: 运行自动化验证

```bash
npm run test:manual:verify
```

这将验证生成的 Word 文档的基本属性：
- 文件是否存在
- 文件格式是否有效（ZIP 格式）
- 文件大小是否合理

验证完成后会生成报告：`tasks/tests/manual-test-report.json`

### 步骤 4: 手动测试

参考以下文档进行详细的手动测试：

1. **详细指南：** `.kiro/specs/word-export-support/MANUAL_TEST_GUIDE.md`
   - 包含每个测试用例的详细步骤
   - 预期结果说明
   - 测试文档示例

2. **检查清单：** `.kiro/specs/word-export-support/TEST_CHECKLIST.md`
   - 可打印的检查清单
   - 逐项勾选
   - 记录测试结果

## 测试类别

### 1. 不同类型的文档
- 纯文本文档
- 富文本文档（标题、列表、表格）
- 包含图片的文档
- 包含代码块的文档
- Lake 格式文档

### 2. 不同的 Word 软件
- Microsoft Word (Windows/Mac)
- WPS Office
- LibreOffice Writer

### 3. 边缘情况
- 空文档
- 超大文档（>1000 段落）
- 特殊字符（中文、emoji、符号）
- 超大图片（>10MB）

### 4. 错误处理
- 网络错误（图片下载失败）
- 超时（30 秒）
- 磁盘空间不足

### 5. 缓存机制
- 缓存优先策略
- 动态生成回退

### 6. 批量导出
- 批量导出多个文档
- 部分失败容错

## 验证需求映射

本测试覆盖以下需求：

- **需求 1.1-1.5:** 基本 Word 导出功能
- **需求 2.1-2.4:** 图片处理和错误处理
- **需求 3.1-3.4:** 缓存和文件系统
- **需求 4.1-4.4:** Lake 格式支持
- **需求 5.1-5.4:** 批量导出
- **需求 6.1-6.4:** 跨平台兼容性
- **需求 7.1-7.10:** 格式保真度
- **需求 8.1-8.5:** 边缘情况处理

## 测试工具

### 测试数据生成器

**文件：** `tasks/tests/manual-test-data-generator.js`

**功能：**
- 自动生成 10 种不同类型的测试文档
- 包含各种 HTML 元素和格式
- 支持 Lake 格式

**使用：**
```bash
npm run test:manual:setup
```

### 自动化验证器

**文件：** `tasks/tests/manual-test-verifier.js`

**功能：**
- 验证 Word 文件格式
- 检查文件大小
- 生成测试报告

**使用：**
```bash
npm run test:manual:verify
```

**报告格式：**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "warnings": 2,
    "passRate": 90.0
  },
  "results": {
    "passed": [...],
    "failed": [...],
    "warnings": [...]
  }
}
```

## 测试最佳实践

### 1. 测试环境准备

- 确保安装了所有必需的 Word 软件
- 清理浏览器缓存
- 确保网络连接正常
- 准备足够的磁盘空间

### 2. 测试执行

- 按照测试类别顺序执行
- 记录每个测试的结果
- 截图保存重要发现
- 记录软件版本信息

### 3. 问题报告

发现问题时，请记录：
- 问题描述
- 重现步骤
- 预期结果 vs 实际结果
- 截图或错误日志
- 测试环境信息

### 4. 测试报告

完成测试后：
- 填写测试检查清单
- 统计通过率
- 总结主要发现
- 提出改进建议

## 常见问题

### Q: 测试数据生成失败？

**A:** 确保 `data/documents/` 目录存在且有写入权限。

### Q: Word 文件无法打开？

**A:** 检查文件是否完整下载，文件大小是否 > 0。

### Q: 图片不显示？

**A:** 检查网络连接，查看控制台日志中的图片下载错误。

### Q: 生成时间过长？

**A:** 超大文档或包含大量图片的文档可能需要更长时间。检查是否超过 30 秒超时限制。

### Q: 不同软件显示不一致？

**A:** 这是正常的，不同软件对 Office Open XML 的支持程度不同。记录差异但不一定是 bug。

## 性能基准

### 预期性能指标

| 文档类型 | 生成时间 | 文件大小 | 打开时间 |
|---------|---------|---------|---------|
| 纯文本 | < 1s | < 50KB | < 1s |
| 富文本 | < 2s | < 100KB | < 2s |
| 包含图片 | < 10s | < 5MB | < 3s |
| 超大文档 | < 30s | < 50MB | < 10s |

### 性能问题阈值

- 生成时间 > 30s → 超时错误
- 文件大小 > 100MB → 文件过大警告
- 打开时间 > 10s → 性能问题

## 下一步

完成手动测试后：

1. 填写测试报告
2. 提交发现的问题
3. 更新文档（如有需要）
4. 准备发布

## 联系方式

如有问题或建议，请联系开发团队。

---

**最后更新：** 2024-01-01
**版本：** 1.0.0
