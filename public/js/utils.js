// 工具函数库 - 精简版

const Utils = {
    // 生成设备ID
    generateDeviceId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return `${CONFIG.DEVICE.ID_PREFIX}${timestamp}-${random}`;
    },

    // 获取或创建设备ID
    getDeviceId() {
        let deviceId = localStorage.getItem(CONFIG.DEVICE.STORAGE_KEY);
        if (!deviceId) {
            deviceId = this.generateDeviceId();
            localStorage.setItem(CONFIG.DEVICE.STORAGE_KEY, deviceId);
        }
        return deviceId;
    },

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate()) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 获取文件图标
    getFileIcon(mimeType, fileName = null) {
        if (mimeType) {
            if (CONFIG.FILE_ICONS[mimeType]) {
                return CONFIG.FILE_ICONS[mimeType];
            }

            for (const [prefix, icon] of Object.entries(CONFIG.FILE_ICONS)) {
                if (prefix !== 'default' && mimeType.startsWith(prefix)) {
                    return icon;
                }
            }
        }

        if (fileName) {
            const extension = this.getFileExtension(fileName);
            if (extension && CONFIG.FILE_EXTENSION_ICONS[extension]) {
                return CONFIG.FILE_EXTENSION_ICONS[extension];
            }
        }

        return CONFIG.FILE_ICONS.default;
    },

    // 获取文件扩展名
    getFileExtension(fileName) {
        if (!fileName || typeof fileName !== 'string') return null;
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot === -1 || lastDot === fileName.length - 1) return null;
        return fileName.substring(lastDot + 1).toLowerCase();
    },

    // 通过文件名获取图标
    getFileIconByName(fileName) {
        return this.getFileIcon(null, fileName);
    },

    // 检查是否为图片文件
    isImageFile(mimeType) {
        return mimeType && mimeType.startsWith('image/');
    },

    // 检查文件大小
    validateFileSize(size) {
        return size <= CONFIG.FILE.MAX_SIZE;
    },

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 检测设备类型
    getDeviceType() {
        const userAgent = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
            return CONFIG.DEVICE.NAME_MOBILE;
        }
        return CONFIG.DEVICE.NAME_DESKTOP;
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

Object.freeze(Utils);
