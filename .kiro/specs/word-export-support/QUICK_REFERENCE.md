# Word 导出功能 - 快速参考指南

## 🚀 快速开始（5 分钟）

### 1. 生成测试数据
```bash
npm run test:manual:setup
```
✅ 生成 10 个测试文档

### 2. 启动应用
```bash
npm run dev
```
🌐 访问 http://localhost:3000

### 3. 下载 Word 文档
1. 进入"知识资产库"
2. 找到 `manual-test-*` 文档
3. 点击文档 → 下载 → Word (.docx)

### 4. 验证结果
```bash
npm run test:manual:verify
```
📊 查看自动化验证报告

---

## 📋 测试文档列表

| 文档 ID | 用途 | 重点测试 |
|---------|------|---------|
| `manual-test-plain-text` | 纯文本 | 基本功能 |
| `manual-test-rich-text` | 富文本 | 格式保留 |
| `manual-test-images` | 图片 | 图片内嵌 |
| `manual-test-code` | 代码块 | 代码格式 |
| `manual-test-lake` | Lake 格式 | 格式解析 |
| `manual-test-empty` | 空文档 | 边缘情况 |
| `manual-test-large` | 超大文档 | 性能 |
| `manual-test-special-chars` | 特殊字符 | 字符编码 |
| `manual-test-error-handling` | 错误处理 | 容错性 |
| `manual-test-comprehensive` | 综合 | 全面测试 |

---

## ✅ 核心测试检查点

### 基本功能
- [ ] 文件可以生成
- [ ] 文件可以下载
- [ ] 文件可以打开

### 格式保留
- [ ] 标题层级正确
- [ ] 文本样式保留
- [ ] 列表格式正确
- [ ] 表格结构完整

### 图片处理
- [ ] 图片正确显示
- [ ] 图片已内嵌（离线可查看）
- [ ] 图片尺寸合理

### 兼容性
- [ ] Microsoft Word 正常
- [ ] WPS Office 正常
- [ ] LibreOffice 正常

### 性能
- [ ] 生成时间 < 30s
- [ ] 文件大小合理
- [ ] 没有崩溃或错误

---

## 🔍 常用命令

```bash
# 生成测试数据
npm run test:manual:setup

# 运行自动化验证
npm run test:manual:verify

# 启动应用
npm run dev

# 查看测试文档
ls -lh data/documents/manual-test-*.json

# 查看生成的 Word 文件
ls -lh data/documents/manual-test-*.docx

# 查看测试报告
cat tasks/tests/manual-test-report.json
```

---

## 📁 重要文件位置

```
测试文档:
  data/documents/manual-test-*.json

生成的 Word 文件:
  data/documents/manual-test-*.docx

测试指南:
  .kiro/specs/word-export-support/MANUAL_TEST_GUIDE.md

测试检查清单:
  .kiro/specs/word-export-support/TEST_CHECKLIST.md

测试报告:
  tasks/tests/manual-test-report.json
```

---

## 🐛 常见问题速查

### 问题：测试数据生成失败
**解决：** 检查 `data/documents/` 目录权限

### 问题：Word 文件无法打开
**解决：** 检查文件大小是否 > 0，重新生成

### 问题：图片不显示
**解决：** 检查网络连接，查看控制台日志

### 问题：生成时间过长
**解决：** 正常，超大文档需要更长时间

### 问题：不同软件显示不一致
**解决：** 正常现象，记录差异即可

---

## 📊 预期性能指标

| 指标 | 预期值 |
|------|--------|
| 纯文本生成 | < 1s |
| 富文本生成 | < 2s |
| 图片文档生成 | < 10s |
| 超大文档生成 | < 30s |
| 纯文本大小 | < 50KB |
| 富文本大小 | < 100KB |
| 图片文档大小 | < 5MB |
| 超大文档大小 | < 50MB |

---

## 🎯 测试优先级

### P0 - 必须测试
1. 基本 Word 导出功能
2. Microsoft Word 兼容性
3. 格式保留（标题、段落、列表）

### P1 - 重要测试
4. 图片内嵌
5. 代码块格式
6. WPS Office 兼容性
7. 缓存机制

### P2 - 建议测试
8. LibreOffice 兼容性
9. 特殊字符
10. 错误处理

### P3 - 可选测试
11. 超大文档性能
12. Lake 格式
13. 批量导出

---

## 📞 需要帮助？

查看详细文档：
- [测试说明](TESTING_README.md)
- [手动测试指南](MANUAL_TEST_GUIDE.md)
- [测试检查清单](TEST_CHECKLIST.md)

---

**提示：** 打印此页面作为快速参考！
