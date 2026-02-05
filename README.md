# ComfyZKit 图生卡通

一个网页应用，用于将照片转换为动漫/卡通风格图像。基于 ComfyUI 后端，提供简洁易用的中文界面。可在本地或服务器上运行，支持同一网络内的多用户访问。

## ✨ 功能特性

- **🖼️ 多种图片输入方式**：支持本地文件上传和浏览器摄像头拍照
- **📐 自动图片缩放**：超过 2560px 的图片自动按比例压缩
- **🎲 随机种子控制**：支持手动输入、随机生成和锁定种子值
- **🎨 ComfyUI 集成**：调用 ComfyUI API 生成高质量卡通图
- **💧 自定义水印**：支持文字水印和二维码水印
- **📊 实时进度条**：显示生成过程的详细进度
- **🖨️ 打印功能**：一键打印生成的卡通图
- **⚙️ 可配置品牌**：管理员可自定义 Logo 和公司名称
- **🌐 网络访问**：同一网络内的其他电脑可通过 IP 访问
- **📦 本地数据存储**：无需云服务，数据存储在本地 Excel 文件

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS
- **后端**：Express.js + Node.js
- **数据存储**：Excel (xlsx)
- **图片处理**：Sharp
- **二维码生成**：QRCode

## 📋 前置要求

1. **Node.js** 18+ 版本
2. **ComfyUI** 服务运行中（默认地址：`http://127.0.0.1:8188`）
3. **ComfyUI 模型**：`anything-v5.safetensors`（放置于 `models/checkpoints/` 目录）

## 🚀 快速开始

### 开发模式

```bash
# 克隆项目
git clone https://github.com/Kelvin-LH/comfy-zkit-ui.git
cd comfy-zkit-ui

# 安装依赖
npm install

# 开发模式运行（支持热重载）
npm run dev
```

开发模式下：
- 前端访问：`http://localhost:5173`
- 后端 API：`http://localhost:3001`

### 生产部署

#### 方式一：本地运行（推荐用于个人使用）

```bash
# 1. 克隆项目
git clone https://github.com/Kelvin-LH/comfy-zkit-ui.git
cd comfy-zkit-ui

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 启动应用
npm start
```

启动后会显示：
```
✓ 服务器运行在 http://0.0.0.0:3001
✓ 本地访问: http://localhost:3001
✓ 网络访问: http://192.168.x.x:3001
✓ ComfyUI 服务地址: http://127.0.0.1:8188 (仅本地)
```

#### 方式二：Docker 容器部署

```bash
# 创建 Dockerfile
cat > Dockerfile << 'EOF'
FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY dist ./dist
COPY public ./public

# 创建数据目录
RUN mkdir -p /app/data /app/uploads

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["npm", "start"]
EOF

# 构建镜像
docker build -t comfy-zkit-ui:latest .

# 运行容器
docker run -d \
  --name comfy-zkit \
  -p 3001:3001 \
  -v /path/to/data:/app/data \
  -v /path/to/uploads:/app/uploads \
  comfy-zkit-ui:latest
```

#### 方式三：使用 PM2 进程管理（推荐用于服务器）

```bash
# 1. 全局安装 PM2
npm install -g pm2

# 2. 构建项目
npm run build

# 3. 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'comfy-zkit-ui',
    script: './dist/server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# 4. 启动应用
pm2 start ecosystem.config.js

# 5. 设置开机自启
pm2 startup
pm2 save
```

#### 方式四：使用 Nginx 反向代理（推荐用于生产环境）

```bash
# 1. 构建项目
npm run build

# 2. 启动应用（后台运行）
nohup npm start > app.log 2>&1 &

# 3. 配置 Nginx
cat > /etc/nginx/sites-available/comfy-zkit << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # 重定向 HTTP 到 HTTPS（可选）
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 增加超时时间（生成图片可能需要较长时间）
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# 4. 启用站点
sudo ln -s /etc/nginx/sites-available/comfy-zkit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📖 使用说明

### 首次使用

1. 启动应用后，访问 `http://localhost:3001`（或网络 IP）
2. 点击"登录"按钮
3. 使用默认用户名 `admin`
4. 首次登录时设置的密码将成为管理员密码

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

上传的图片存储在 `uploads` 目录中。

## 📁 项目结构

```
comfy-zkit-ui/
├── src/
│   ├── client/           # 前端代码
│   │   ├── components/   # React 组件
│   │   ├── pages/        # 页面组件
│   │   └── index.css     # 全局样式
│   └── server/           # 后端代码
│       ├── routes/       # API 路由
│       ├── services/     # 服务模块
│       └── index.ts      # 服务器入口
├── dist/                 # 构建产物
├── data/                 # 数据文件（Excel）
├── uploads/              # 上传的图片
├── public/               # 静态资源（字体等）
├── package.json          # 项目配置
└── README.md             # 本文件
```

## 🔒 安全建议

1. **更改默认密码**：首次登录后立即修改管理员密码
2. **ComfyUI 隔离**：ComfyUI 只能通过 127.0.0.1 访问，确保本地安全
3. **HTTPS 部署**：生产环境建议使用 HTTPS（通过 Nginx 配置）
4. **防火墙配置**：限制访问 ComfyUI 端口（8188）
5. **定期备份**：定期备份 `data` 目录中的 Excel 文件

## 🐛 故障排除

### 问题：无法连接到 ComfyUI
- 确保 ComfyUI 服务已启动
- 检查 ComfyUI 地址是否为 `http://127.0.0.1:8188`
- 查看应用日志中的错误信息

### 问题：生成超时
- 增加 ComfyUI 的超时时间
- 检查服务器资源（CPU、内存、GPU）
- 尝试使用更小的图片或更低的质量设置

### 问题：摄像头无法使用
- 确保浏览器有摄像头权限
- 尝试使用其他浏览器
- 检查浏览器控制台是否有错误信息

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
- [Express.js](https://expressjs.com/) - Node.js Web 框架
- [React](https://react.dev/) - 前端框架
