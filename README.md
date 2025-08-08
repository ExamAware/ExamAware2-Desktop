# examaware2-desktop

ExamAware 2 桌面版 - 基于 Electron + Vue + TypeScript 的考试管理应用

## 特性

- 考试档案管理
- 支持 `.exam.json` 文件格式
- 系统文件关联，双击 `.exam.json` 文件可直接打开编辑器
- 跨平台支持（Windows、macOS、Linux）

## 文件格式

应用使用 `.exam.json` 作为考试档案文件的默认扩展名。文件结构如下：

```json
{
  "examName": "考试名称",
  "message": "考试说明",
  "examInfos": [
    {
      "name": "科目名称",
      "start": "2025-07-15T08:00:00.000Z",
      "end": "2025-07-15T10:00:00.000Z",
      "description": "科目描述"
    }
  ]
}
```

## 推荐开发环境

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

## 项目设置

### 安装依赖

```bash
$ pnpm install
```

### 开发

```bash
$ pnpm dev
```

### 构建

```bash
# Windows
$ pnpm build:win

# macOS
$ pnpm build:mac

# Linux
$ pnpm build:linux
```

## 文件关联

应用构建后会自动注册 `.exam.json` 文件关联，用户可以：

1. 双击 `.exam.json` 文件直接打开编辑器
2. 右键选择"打开方式"使用 ExamAware 编辑器
3. 从编辑器中导出的文件默认使用 `.exam.json` 扩展名
