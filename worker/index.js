import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

const app = new Hono()

// CORS配置
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 鉴权工具函数
const AuthUtils = {
  // 生成简单的JWT token
  async generateToken(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = btoa(JSON.stringify(header))
    const encodedPayload = btoa(JSON.stringify(payload))
    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret)
    return `${encodedHeader}.${encodedPayload}.${signature}`
  },

  // 验证JWT token
  async verifyToken(token, secret) {
    try {
      const [header, payload, signature] = token.split('.')
      const expectedSignature = await this.sign(`${header}.${payload}`, secret)

      if (signature !== expectedSignature) {
        return null
      }

      const decodedPayload = JSON.parse(atob(payload))

      // 检查过期时间
      if (decodedPayload.exp && Date.now() > decodedPayload.exp) {
        return null
      }

      return decodedPayload
    } catch (error) {
      return null
    }
  },

  // 生成签名
  async sign(data, secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
  }
}

const IMAGE_MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif'
}

const resolveMimeType = (mimeType, fileName = '') => {
  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType
  }

  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension && IMAGE_MIME_BY_EXTENSION[extension]) {
    return IMAGE_MIME_BY_EXTENSION[extension]
  }

  return mimeType || 'application/octet-stream'
}

const buildPreviewEtag = (object, fileInfo, r2Key) => {
  if (object?.httpEtag) {
    return object.httpEtag
  }

  if (object?.etag) {
    return `"${object.etag}"`
  }

  const version = fileInfo.updated_at || fileInfo.created_at || fileInfo.file_size || '0'
  return `"${r2Key}-${version}"`
}

const isEtagMatched = (ifNoneMatch, etag) => {
  if (!ifNoneMatch || !etag) {
    return false
  }

  const rawHeader = ifNoneMatch.trim()
  if (rawHeader === '*') {
    return true
  }

  const candidates = rawHeader.split(',').map((item) => item.trim())
  if (candidates.includes(etag)) {
    return true
  }

  const weakEtag = etag.startsWith('W/') ? etag : `W/${etag}`
  return candidates.includes(weakEtag)
}

// 鉴权中间件
const authMiddleware = async (c, next) => {
  // 跳过登录和静态资源
  const path = c.req.path
  if (path.startsWith('/api/auth/') || path.startsWith('/login.html') ||
      path.includes('.css') || path.includes('.js') || path.includes('.ico') ||
      path.includes('favicon')) {
    return next()
  }

  // 获取token
  let token = null
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else {
    token = c.req.query('token')
  }

  if (!token) {
    if (path.startsWith('/api/')) {
      return c.json({ success: false, message: '未授权访问' }, 401)
    }
    return c.redirect('/login.html')
  }

  const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET)

  if (!payload) {
    if (path.startsWith('/api/')) {
      return c.json({ success: false, message: 'Token无效或已过期' }, 401)
    }
    return c.redirect('/login.html')
  }

  c.set('user', payload)
  return next()
}

// API路由
const api = new Hono()

// 鉴权API路由
const authApi = new Hono()

// 登录接口
authApi.post('/login', async (c) => {
  try {
    const { password } = await c.req.json()

    if (!password) {
      return c.json({ success: false, message: '密码不能为空' }, 400)
    }

    const expectedPassword = c.env.ACCESS_PASSWORD

    if (password !== expectedPassword) {
      return c.json({ success: false, message: '密码错误' }, 401)
    }

    const expireHours = parseInt(c.env.SESSION_EXPIRE_HOURS || '24')
    const payload = {
      iat: Date.now(),
      exp: Date.now() + (expireHours * 60 * 60 * 1000),
      type: 'access'
    }

    const token = await AuthUtils.generateToken(payload, c.env.JWT_SECRET)

    return c.json({
      success: true,
      token,
      expiresIn: expireHours * 60 * 60
    })
  } catch (error) {
    console.error('登录错误:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 验证token接口
authApi.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ valid: false, message: '缺少认证信息' }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET)

    if (!payload) {
      return c.json({ valid: false, message: 'Token无效或已过期' }, 401)
    }

    return c.json({ valid: true, payload })
  } catch (error) {
    console.error('验证token错误:', error)
    return c.json({ valid: false, message: '服务器错误' }, 500)
  }
})

// 登出接口
authApi.post('/logout', async (c) => {
  return c.json({ success: true, message: '已登出' })
})

// 获取文件列表
api.get('/files', async (c) => {
  try {
    const { DB } = c.env
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    const stmt = DB.prepare(`
      SELECT
        id,
        original_name,
        file_size,
        mime_type,
        r2_key,
        upload_device_id,
        CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS upload_time,
        download_count
      FROM files
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const countStmt = DB.prepare('SELECT COUNT(*) as total FROM files')

    const [result, countResult] = await Promise.all([
      stmt.bind(limit, offset).all(),
      countStmt.first()
    ])

    return c.json({
      success: true,
      data: result.results,
      total: countResult.total,
      limit,
      offset
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 文件上传
api.post('/files/upload', async (c) => {
  try {
    const { DB, R2 } = c.env
    const formData = await c.req.formData()
    const file = formData.get('file')
    const deviceId = formData.get('deviceId')

    if (!file || !deviceId) {
      return c.json({
        success: false,
        error: '文件和设备ID不能为空'
      }, 400)
    }

    // 检查文件大小限制（80MB）
    if (file.size > 80 * 1024 * 1024) {
      return c.json({
        success: false,
        error: '文件大小不能超过80MB'
      }, 400)
    }

    // 生成唯一的文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2)
    const fileExtension = file.name.split('.').pop() || 'bin'
    const r2Key = `${timestamp}-${randomStr}.${fileExtension}`
    const normalizedMimeType = resolveMimeType(file.type, file.name)

    // 上传到R2
    try {
      const safeUploadName = encodeURIComponent(file.name).replace(/%20/g, '+')
      await R2.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: normalizedMimeType,
          contentDisposition: `attachment; filename*=UTF-8''${safeUploadName}`
        }
      })
    } catch (r2Error) {
      console.error('R2上传失败:', r2Error)
      return c.json({
        success: false,
        error: `文件上传到存储失败: ${r2Error.message}`
      }, 500)
    }

    // 保存文件信息到数据库
    try {
      const fileStmt = DB.prepare(`
        INSERT INTO files (original_name, file_name, file_size, mime_type, r2_key, upload_device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      const fileResult = await fileStmt.bind(
        file.name,
        r2Key,
        file.size,
        normalizedMimeType,
        r2Key,
        deviceId
      ).run()

      const fileId = fileResult.meta.last_row_id

      // 同时创建一条 file 类型的消息记录
      const msgStmt = DB.prepare(`
        INSERT INTO messages (type, file_id, device_id, status)
        VALUES ('file', ?, ?, 'sent')
      `)
      await msgStmt.bind(fileId, deviceId).run()

      return c.json({
        success: true,
        data: {
          fileId: fileId,
          fileName: file.name,
          fileSize: file.size,
          r2Key: r2Key
        }
      })
    } catch (dbError) {
      console.error('数据库操作失败:', dbError)
      // 如果数据库操作失败，尝试删除已上传的R2文件
      try {
        await R2.delete(r2Key)
      } catch (deleteError) {
        console.error('清理R2文件失败:', deleteError)
      }

      return c.json({
        success: false,
        error: `数据库操作失败: ${dbError.message}`
      }, 500)
    }
  } catch (error) {
    console.error('文件上传总体失败:', error)
    return c.json({
      success: false,
      error: `文件上传失败: ${error.message}`
    }, 500)
  }
})

// 文件下载
api.get('/files/download/:r2Key', async (c) => {
  try {
    const { DB, R2 } = c.env
    const r2Key = c.req.param('r2Key')

    // 获取文件信息
    const stmt = DB.prepare(`
      SELECT * FROM files WHERE r2_key = ?
    `)
    const fileInfo = await stmt.bind(r2Key).first()

    if (!fileInfo) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    // 从R2获取文件
    const object = await R2.get(r2Key)

    if (!object) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    // 更新下载次数
    const updateStmt = DB.prepare(`
      UPDATE files SET download_count = download_count + 1 WHERE r2_key = ?
    `)
    await updateStmt.bind(r2Key).run()

    const downloadMimeType = resolveMimeType(fileInfo.mime_type, fileInfo.original_name || r2Key)

    const safeDownloadName = encodeURIComponent(fileInfo.original_name || r2Key).replace(/%20/g, '+')
    return new Response(object.body, {
      headers: {
        'Content-Type': downloadMimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${safeDownloadName}`,
        'Content-Length': fileInfo.file_size.toString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 获取消息列表（文本+文件混合）
api.get('/messages', async (c) => {
  try {
    const { DB } = c.env
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    // 查询消息，关联文件信息
    const stmt = DB.prepare(`
      SELECT
        m.id,
        m.type,
        m.content,
        m.device_id,
        m.status,
        CAST(strftime('%s', m.timestamp) AS INTEGER) * 1000 AS timestamp,
        f.id AS file_id,
        f.original_name AS file_name,
        f.file_size,
        f.mime_type,
        f.r2_key,
        f.download_count
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `)

    const countStmt = DB.prepare('SELECT COUNT(*) as total FROM messages')

    const [result, countResult] = await Promise.all([
      stmt.bind(limit, offset).all(),
      countStmt.first()
    ])

    return c.json({
      success: true,
      data: result.results,
      total: countResult.total,
      limit,
      offset
    })
  } catch (error) {
    console.error('获取消息失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 发送文本消息
api.post('/messages', async (c) => {
  try {
    const { DB } = c.env
    const { content, deviceId } = await c.req.json()

    if (!content || !content.trim()) {
      return c.json({
        success: false,
        error: '消息内容不能为空'
      }, 400)
    }

    if (!deviceId) {
      return c.json({
        success: false,
        error: '设备ID不能为空'
      }, 400)
    }

    const stmt = DB.prepare(`
      INSERT INTO messages (type, content, device_id, status)
      VALUES ('text', ?, ?, 'sent')
    `)

    const result = await stmt.bind(content.trim(), deviceId).run()

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        type: 'text',
        content: content.trim(),
        device_id: deviceId,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    console.error('发送消息失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 文件预览（用于图片内联展示）
api.get('/files/preview/:r2Key', async (c) => {
  try {
    const { DB, R2 } = c.env
    const r2Key = c.req.param('r2Key')

    const stmt = DB.prepare(`
      SELECT * FROM files WHERE r2_key = ?
    `)
    const fileInfo = await stmt.bind(r2Key).first()

    if (!fileInfo) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    const object = await R2.get(r2Key)

    if (!object) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    const previewMimeType = resolveMimeType(fileInfo.mime_type, fileInfo.original_name || r2Key)
    const etag = buildPreviewEtag(object, fileInfo, r2Key)
    const ifNoneMatch = c.req.header('If-None-Match')

    if (isEtagMatched(ifNoneMatch, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'private, max-age=3600',
          ETag: etag,
          Vary: 'Authorization'
        }
      })
    }

    const safeFileName = encodeURIComponent(fileInfo.original_name || r2Key).replace(/%20/g, '+')
    return new Response(object.body, {
      headers: {
        'Content-Type': previewMimeType,
        'Content-Disposition': `inline; filename*=UTF-8''${safeFileName}`,
        'Content-Length': fileInfo.file_size.toString(),
        'Cache-Control': 'private, max-age=3600',
        ETag: etag,
        Vary: 'Authorization'
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 清空全部消息与文件
api.delete('/messages', async (c) => {
  try {
    const { DB, R2 } = c.env

    const [fileResult, messageCountResult] = await Promise.all([
      DB.prepare('SELECT r2_key FROM files').all(),
      DB.prepare('SELECT COUNT(*) as total FROM messages').first()
    ])

    const fileKeys = (fileResult.results || [])
      .map((item) => item.r2_key)
      .filter(Boolean)

    for (const fileKey of fileKeys) {
      try {
        await R2.delete(fileKey)
      } catch (r2Error) {
        console.error('R2删除文件失败:', r2Error)
      }
    }

    await DB.prepare('DELETE FROM messages').run()
    await DB.prepare('DELETE FROM files').run()

    return c.json({
      success: true,
      message: '已清空全部消息和文件',
      data: {
        deletedMessages: messageCountResult?.total || 0,
        deletedFiles: fileKeys.length
      }
    })
  } catch (error) {
    console.error('清空全部消息失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 删除消息
api.delete('/messages/:id', async (c) => {
  try {
    const { DB, R2 } = c.env
    const id = c.req.param('id')

    // 获取消息信息
    const stmt = DB.prepare('SELECT * FROM messages WHERE id = ?')
    const message = await stmt.bind(id).first()

    if (!message) {
      return c.json({
        success: false,
        error: '消息不存在'
      }, 404)
    }

    const fileId = message.file_id
    const isFileMessage = message.type === 'file' && !!fileId
    let file = null

    if (isFileMessage) {
      const fileStmt = DB.prepare('SELECT id, r2_key FROM files WHERE id = ?')
      file = await fileStmt.bind(fileId).first()
    }

    // 先删消息，避免外键约束导致500
    const deleteStmt = DB.prepare('DELETE FROM messages WHERE id = ?')
    await deleteStmt.bind(id).run()

    if (isFileMessage && file) {
      const refCountStmt = DB.prepare('SELECT COUNT(*) as total FROM messages WHERE file_id = ?')
      const refCount = await refCountStmt.bind(fileId).first()

      if ((refCount?.total || 0) === 0) {
        const deleteFileStmt = DB.prepare('DELETE FROM files WHERE id = ?')
        await deleteFileStmt.bind(fileId).run()

        try {
          await R2.delete(file.r2_key)
        } catch (r2Error) {
          console.error('R2删除失败:', r2Error)
        }
      }
    }

    return c.json({
      success: true,
      message: '消息已删除'
    })
  } catch (error) {
    console.error('删除消息失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 删除文件
api.delete('/files/:r2Key', async (c) => {
  try {
    const { DB, R2 } = c.env
    const r2Key = c.req.param('r2Key')

    // 获取文件信息
    const stmt = DB.prepare('SELECT * FROM files WHERE r2_key = ?')
    const fileInfo = await stmt.bind(r2Key).first()

    if (!fileInfo) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    // 先删引用该文件的消息，避免外键约束导致500
    const deleteMessagesStmt = DB.prepare('DELETE FROM messages WHERE file_id = ?')
    await deleteMessagesStmt.bind(fileInfo.id).run()

    // 再删文件记录
    const deleteFileStmt = DB.prepare('DELETE FROM files WHERE r2_key = ?')
    await deleteFileStmt.bind(r2Key).run()

    // 最后删R2对象（失败不阻断）
    try {
      await R2.delete(r2Key)
    } catch (r2Error) {
      console.error('R2删除失败:', r2Error)
    }

    return c.json({
      success: true,
      message: '文件已删除'
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 挂载鉴权API路由（无需认证）
app.route('/api/auth', authApi)

// 应用鉴权中间件到所有路由
api.use('*', authMiddleware)

// 挂载API路由（需要认证）
app.route('/api', api)

app.get('/app.js', (c) => {
  return c.redirect('/js/app.js', 302)
})

// 静态文件服务 - 使用getAssetFromKV
app.get('*', async (c) => {
  if (c.env.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
    const response = await c.env.ASSETS.fetch(c.req.raw)
    if (response.status !== 404) {
      return response
    }

    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url).toString(), c.req.raw))
  }

  try {
    return await getAssetFromKV({
      request: c.req.raw,
      waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
    })
  } catch (e) {
    // 如果找不到文件，返回index.html
    try {
      return await getAssetFromKV({
        request: new Request(new URL('/index.html', c.req.url).toString()),
        waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
      })
    } catch {
      return c.text('Not Found', 404)
    }
  }
})

export default app
