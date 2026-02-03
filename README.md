# ComfyZKit 图生卡通

一个独立运行的桌面应用，用于将照片转换为动漫/卡通风格图像。基于 ComfyUI 后端，提供简洁易用的中文界面。

## ✨ 功能特性

- **🖼️ 多种图片输入方式**：支持本地文件上传和浏览器摄像头拍照
- **📐 自动图片缩放**：超过 2560px 的图片自动按比例压缩
- **🎲 随机种子控制**：支持手动输入、随机生成和锁定种子值
- **🎨 ComfyUI 集成**：调用 ComfyUI API 生成高质量卡通图
- **💧 自定义水印**：支持文字水印和二维码水印
- **📊 实时进度条**：显示生成过程的详细进度
- **🖨️ 打印功能**：一键打印生成的卡通图
- **⚙️ 可配置品牌**：管理员可自定义 Logo 和公司名称
- **📦 独立运行**：无需云服务，数据存储在本地 Excel 文件

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS
- **后端**：Express.js
- **数据存储**：Excel (xlsx)

## 📋 前置要求

1. **ComfyUI** 服务运行中（默认地址：`http://127.0.0.1:8188`）

### ComfyUI 配置要求

确保 ComfyUI 已安装以下模型：

- **模型**：`anything-v5.safetensors`（放置于 `models/checkpoints/` 目录）

## 🚀 快速开始

### 方式一：使用 exe 安装包（推荐）

1. 从 [Releases](https://github.com//Kelvin-LH/comfy-zkit-ui/releases) 下载最新的安装包
2. 运行安装程序，按提示完成安装
3. 启动 ComfyUI 服务
4. 运行 "ComfyZKit 图生卡通" 应用

### 方式二：从源码运行

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/comfy-zkit-ui.git
cd comfy-zkit-ui

# 安装依赖
npm install

# 开发模式运行
npm run dev

```

## 📖 使用说明

### 首次使用

1. 启动应用后，点击"登录"按钮
2. 使用默认用户名 `admin`
3. 首次登录时设置的密码将成为管理员密码

### 基本使用

1. **上传图片**：点击上传区域选择本地图片，或点击"使用摄像头拍照"
2. **调整设置**（可选）：展开"生成设置"面板，调整种子值、ComfyUI 地址或水印
3. **生成卡通图**：点击"开始生成"按钮，等待进度条完成
4. **下载/打印**：生成完成后，可下载图片或直接打印

### 管理员设置

1. 使用管理员账号登录
2. 点击"管理设置"按钮
3. 可配置网站 Logo、公司名称和默认 ComfyUI 地址

## 📁 数据存储

所有数据存储在 `data` 目录下的 Excel 文件中：

- `users.xlsx` - 用户账号信息
- `config.xlsx` - 网站配置
- `history.xlsx` - 生成历史记录

## 📁 项目结构

```
comfy-zkit-ui/
├── src/
│   ├── client/           # 前端代码
│   │   ├── components/   # React 组件
│   │   └── pages/        # 页面组件
│   └── server/           # 后端代码
│       ├── routes/       # API 路由
│       └── services/     # 服务模块
├── data/                 # 数据文件（Excel）
├── uploads/              # 上传的图片
└── public/               # 静态资源
```

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - 强大的 Stable Diffusion GUI
- [Anything V5](https://civitai.com/models/9409/anything-v5) - 优秀的动漫风格模型
