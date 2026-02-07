// 应用配置文件 - 精简版（仅文件上传下载）

const CONFIG = {
    // API 配置
    API: {
        BASE_URL: '',
        ENDPOINTS: {
            MESSAGES: '/api/messages',
            FILES: '/api/files',
            FILES_UPLOAD: '/api/files/upload',
            FILES_DOWNLOAD: '/api/files/download',
            FILES_PREVIEW: '/api/files/preview',
            AUTH_LOGIN: '/api/auth/login',
            AUTH_VERIFY: '/api/auth/verify',
            AUTH_LOGOUT: '/api/auth/logout'
        }
    },

    // 文件上传配置
    FILE: {
        MAX_SIZE: 80 * 1024 * 1024, // 80MB
        ALLOWED_TYPES: '*',
        CHUNK_SIZE: 1024 * 1024
    },

    // UI 配置
    UI: {
        FILE_LOAD_LIMIT: 50,
        ANIMATION_DURATION: 100
    },

    // 设备配置
    DEVICE: {
        ID_PREFIX: 'web-',
        NAME_MOBILE: '移动设备',
        NAME_DESKTOP: 'Web浏览器',
        STORAGE_KEY: 'deviceId'
    },

    // 文件类型图标映射
    FILE_ICONS: {
        'image/': '🖼️',
        'video/': '🎥',
        'audio/': '🎵',
        'application/pdf': '📕',
        'application/msword': '📘',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
        'application/vnd.ms-excel': '📗',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
        'application/vnd.ms-powerpoint': '📙',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📙',
        'application/zip': '📦',
        'application/x-rar-compressed': '📦',
        'application/x-7z-compressed': '📦',
        'text/': '📄',
        'application/json': '📋',
        'default': '📄'
    },

    // 文件扩展名图标映射
    FILE_EXTENSION_ICONS: {
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🎞️', 'bmp': '🖼️',
        'svg': '🎨', 'webp': '🖼️',
        'mp4': '🎥', 'avi': '🎥', 'mov': '🎥', 'mkv': '🎥',
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
        'pdf': '📕', 'doc': '📘', 'docx': '📘', 'xls': '📗', 'xlsx': '📗',
        'ppt': '📙', 'pptx': '📙',
        'zip': '📦', 'rar': '📦', '7z': '📦',
        'txt': '📄', 'md': '📝', 'json': '📋',
        'js': '⚡', 'ts': '⚡', 'py': '🐍', 'java': '☕'
    },

    // 错误消息
    ERRORS: {
        NETWORK: '网络连接失败，请检查网络',
        FILE_TOO_LARGE: '文件大小不能超过80MB',
        FILE_UPLOAD_FAILED: '文件上传失败',
        LOAD_FILES_FAILED: '加载文件列表失败',
        MESSAGE_EMPTY: '消息内容不能为空',
        MESSAGE_SEND_FAILED: '消息发送失败'
    },

    // 成功消息
    SUCCESS: {
        FILE_UPLOADED: '文件上传成功',
        FILE_DELETED: '文件删除成功',
        MESSAGE_SENT: '消息发送成功'
    }
};

// 冻结配置对象
Object.freeze(CONFIG);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.API.ENDPOINTS);
Object.freeze(CONFIG.FILE);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.DEVICE);
Object.freeze(CONFIG.FILE_ICONS);
Object.freeze(CONFIG.FILE_EXTENSION_ICONS);
Object.freeze(CONFIG.ERRORS);
Object.freeze(CONFIG.SUCCESS);

if (typeof window !== 'undefined' && typeof window.MessageHandler === 'undefined') {
    window.MessageHandler = {
        init() {},
        async clearAllMessages() {
            return { success: false, error: 'MessageHandler unavailable' };
        }
    };
}
