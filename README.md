<div align="center">

# 微信文件传输助手 Web 版

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-Framework-blue.svg)](https://hono.dev/)

一个仿微信「文件传输助手」的 Web 应用，基于 Cloudflare Workers 边缘计算，支持跨设备文本消息和文件传输。

[快速部署](#快速开始) · [使用指南](#使用指南) · [问题反馈](https://github.com/WangXingFan/wxchat/issues)

</div>

---

## 功能

- **文本消息** — 发送和接收文本消息，支持表情符号
- **文件传输** — 拖拽上传、剪贴板粘贴、多文件并发上传（最大 80MB）
- **图片预览** — 图片文件自动缩略图 + 全屏预览，支持下载
- **访问鉴权** — 密码保护 + JWT 会话管理 + 防暴力破解
- **PWA 支持** — 可安装到桌面/主屏幕，Service Worker 离线缓存静态资源
- **跨设备访问** — 不同设备访问同一 URL 即可共享消息和文件
- **数据清理** — 支持批量删除消息和文件，释放存储空间
- **赛博朋克 UI** — 霓虹暗色风格界面，响应式设计适配移动端

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML + CSS + JavaScript (ES6+) | 零框架依赖，模块化设计 |
| 后端 | Hono + Cloudflare Workers | 边缘计算，RESTful API |
| 数据库 | Cloudflare D1 (SQLite) | 结构化数据存储 |
| 文件存储 | Cloudflare R2 | 对象存储 |

## 项目结构

```
wxchat/
├── worker/
│   └── index.js           # Hono 后端 API（认证、消息、文件）
├── public/
│   ├── index.html          # 主页面
│   ├── login.html          # 登录页面
│   ├── manifest.json       # PWA 清单
│   ├── sw.js               # Service Worker
│   ├── css/                # 样式文件（reset/main/components/responsive/auth）
│   ├── js/                 # 前端模块
│   │   ├── app.js          # 应用入口
│   │   ├── config.js       # 配置中心
│   │   ├── api.js          # API 封装
│   │   ├── ui.js           # UI 渲染（消息、文件预览、图片模态框）
│   │   ├── auth.js         # 认证模块
│   │   ├── fileUpload.js   # 文件上传（拖拽/粘贴/并发）
│   │   ├── pwa.js          # PWA 注册与更新
│   │   └── utils.js        # 工具函数
│   └── icons/              # PWA 图标
├── database/
│   └── schema.sql          # 数据库结构定义
├── wrangler.toml           # Cloudflare Workers 配置
├── build.js                # 构建脚本
└── package.json
```

## 快速开始

### 前置要求

- [Node.js 18+](https://nodejs.org/)
- [Cloudflare 账户](https://dash.cloudflare.com/sign-up)

### 部署步骤

```bash
# 克隆项目
git clone https://github.com/WangXingFan/wxchat.git
cd wxchat

# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库和 R2 存储桶
npx wrangler d1 create wxchat
npx wrangler r2 bucket create wxchat

# 更新 wrangler.toml 中的 database_id 为实际值

# 初始化数据库
npx wrangler d1 execute wxchat --file=./database/schema.sql

# 配置密码（必须）
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put JWT_SECRET

# 部署
npm run deploy
```

### 本地开发

```bash
npm run dev
# 访问 http://localhost:8787
```

## 使用指南

### 基本操作

| 操作 | 方式 |
|------|------|
| 发送消息 | 输入框输入文本，按 Enter 或点击发送按钮 |
| 换行 | Shift + Enter |
| 上传文件 | 点击附件按钮 / 拖拽文件到聊天区 / Ctrl+V 粘贴图片 |
| 下载文件 | 点击文件消息中的下载按钮 |
| 预览图片 | 点击图片缩略图打开全屏预览 |

### 文本指令

| 指令 | 功能 |
|------|------|
| `/logout` 或 `/登出` | 登出当前会话 |
| `/pwa` 或 `/安装` | 检查并安装 PWA 应用 |

## API 接口

### 认证（无需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 密码登录，返回 JWT |
| GET | `/api/auth/verify` | 验证 Token |
| POST | `/api/auth/logout` | 登出 |

### 消息（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/messages` | 获取消息列表 |
| POST | `/api/messages` | 发送文本消息 |
| DELETE | `/api/messages` | 清空所有消息和文件 |
| DELETE | `/api/messages/:id` | 删除单条消息 |

### 文件（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/files` | 获取文件列表 |
| POST | `/api/files/upload` | 上传文件（multipart/form-data） |
| GET | `/api/files/download/:r2Key` | 下载文件 |
| GET | `/api/files/preview/:r2Key` | 预览文件（图片） |
| DELETE | `/api/files/:r2Key` | 删除单个文件 |

## 环境变量

在 Cloudflare Dashboard 或通过 `wrangler secret` 配置：

| 变量 | 说明 | 配置方式 |
|------|------|----------|
| `ACCESS_PASSWORD` | 访问密码 | `wrangler secret put` |
| `JWT_SECRET` | JWT 签名密钥（建议 32 位以上随机字符串） | `wrangler secret put` |
| `SESSION_EXPIRE_HOURS` | 会话过期时间，默认 24 小时 | `wrangler.toml [vars]` |
| `MAX_LOGIN_ATTEMPTS` | 最大登录尝试次数，默认 5 | `wrangler.toml [vars]` |

## 故障排除

**HTTP 500 错误**：通常是数据库未初始化，执行 `npx wrangler d1 execute wxchat --file=./database/schema.sql`。

**文件上传失败**：检查 R2 存储桶是否已创建（`npx wrangler r2 bucket list`），确认文件不超过 80MB。

**图片不能预览**：前端使用 MIME + 文件后缀双重识别，部署更新后强制刷新浏览器重试。

## 致谢

本项目基于 [xiyewuqiu](https://github.com/xiyewuqiu) 的原始工作开发。感谢上游项目的贡献。
