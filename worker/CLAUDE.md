# Worker 模块文档

[根目录](../CLAUDE.md) > **worker**

---

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-05 | 1.0.0 | 初始文档生成 |

---

## 模块职责

`worker/` 目录包含 Cloudflare Workers 后端服务，基于 Hono 框架实现 RESTful API。负责：

- 用户认证与 JWT 会话管理
- 消息的增删改查
- 文件上传到 R2 和下载
- SSE 实时推送与长轮询
- 数据清理与设备同步

---

## 入口与启动

### 主入口

`index.js` - 单文件 Hono 应用

### 依赖

```javascript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
```

### 启动流程

1. 创建 Hono 应用实例
2. 配置 CORS 中间件
3. 挂载认证 API 路由（无需认证）
4. 应用认证中间件
5. 挂载业务 API 路由（需认证）
6. 配置静态文件服务

---

## 对外接口

### 认证接口 `/api/auth/*`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/auth/login` | 密码登录，返回 JWT | 否 |
| GET | `/api/auth/verify` | 验证 Token 有效性 | 否 |
| POST | `/api/auth/logout` | 登出（前端清理 Token） | 否 |

#### 登录请求示例

```http
POST /api/auth/login
Content-Type: application/json

{
  "password": "your-password"
}
```

#### 登录响应示例

```json
{
  "success": true,
  "token": "eyJ...",
  "expiresIn": 86400
}
```

---

### 消息接口 `/api/messages`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/api/messages` | 获取消息列表 | 是 |
| POST | `/api/messages` | 发送文本消息 | 是 |

#### 获取消息响应

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "text",
      "content": "Hello",
      "device_id": "web-123",
      "timestamp": "2026-02-05T12:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 文件接口 `/api/files/*`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/files/upload` | 上传文件到 R2 | 是 |
| GET | `/api/files/download/:r2Key` | 从 R2 下载文件 | 是 |

#### 上传限制

- 最大文件大小：10MB
- 支持所有文件类型

#### 上传请求

```http
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary>
deviceId: web-123456
```

---

### AI 接口 `/api/ai/*`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/ai/message` | 存储 AI 消息 | 是 |

---

### 搜索接口 `/api/search`

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/api/search` | 多条件搜索消息 | 是 |
| GET | `/api/search/suggestions` | 搜索建议 | 是 |

#### 搜索参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `q` | string | 搜索关键词（必填） |
| `type` | string | 消息类型：all/text/file |
| `timeRange` | string | 时间范围：all/today/yesterday/week/month |
| `deviceId` | string | 设备筛选 |
| `fileType` | string | 文件类型：image/video/audio/document/archive |
| `limit` | number | 返回数量限制 |
| `offset` | number | 分页偏移 |

---

### 实时通信接口

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| GET | `/api/events` | SSE 实时推送 | 是（URL参数） |
| GET | `/api/poll` | 长轮询备用方案 | 是 |

#### SSE 事件类型

- `connection` - 连接建立
- `message` - 新消息通知
- `heartbeat` - 心跳保活

---

### 其他接口

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/sync` | 设备同步 | 是 |
| POST | `/api/clear-all` | 清空所有数据 | 是 |
| GET | `/api/debug/upload-status` | 调试：检查上传状态 | 是 |

---

## 关键依赖与配置

### 环境绑定

在 `wrangler.toml` 中配置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "wxchat"
database_id = "your-database-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "wxchat"

[vars]
ACCESS_PASSWORD = "your-password"
JWT_SECRET = "your-jwt-secret"
SESSION_EXPIRE_HOURS = "24"
```

### 环境变量访问

```javascript
const { DB, R2 } = c.env
const password = c.env.ACCESS_PASSWORD
const jwtSecret = c.env.JWT_SECRET
```

---

## 内部实现

### 认证工具 AuthUtils

```javascript
const AuthUtils = {
  generateToken(payload, secret),  // 生成 JWT
  verifyToken(token, secret),      // 验证 JWT
  sign(data, secret)               // HMAC-SHA256 签名
}
```

### 认证中间件

```javascript
const authMiddleware = async (c, next) => {
  // 跳过静态资源和登录接口
  // 从 Header 或 URL 参数获取 Token
  // 验证 Token 有效性
  // 将用户信息添加到上下文
}
```

---

## 数据模型

### 数据库表

Worker 操作以下 D1 表：

- `messages` - 消息记录
- `files` - 文件元数据
- `devices` - 设备信息

详见 [根目录 CLAUDE.md](../CLAUDE.md) 数据模型章节。

---

## 测试与质量

### 本地测试

```bash
# 启动本地开发服务器
npm run dev

# 测试 API（需先登录获取 token）
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'
```

### 调试接口

```bash
# 检查服务状态
curl http://localhost:8787/api/debug/upload-status \
  -H "Authorization: Bearer <token>"
```

---

## 常见问题 (FAQ)

### Q: 如何添加新的 API 路由？

```javascript
// 在 api 路由组中添加
api.get('/your-endpoint', async (c) => {
  // 实现逻辑
  return c.json({ success: true })
})
```

### Q: 如何跳过某个路由的认证？

将路由添加到 `authMiddleware` 的跳过列表：

```javascript
if (path.startsWith('/api/public/')) {
  return next()
}
```

### Q: SSE 连接断开如何处理？

Worker 实现了自动心跳和超时清理：

- 心跳间隔：30秒
- 连接超时：5分钟
- 客户端应监听错误并自动重连

---

## 相关文件清单

| 文件 | 说明 |
|------|------|
| `index.js` | 主入口，包含所有 API 实现 |
| `../wrangler.toml` | Cloudflare Workers 配置 |
| `../database/schema.sql` | 数据库结构定义 |

---

*文档生成时间：2026-02-05 20:24:13*
