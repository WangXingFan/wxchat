// 应用主入口文件 - 支持文件和文本消息

class FileTransferApp {
    constructor() {
        this.isInitialized = false;
        this.deviceId = null;
    }

    // 初始化应用
    async init() {
        try {
            // 初始化鉴权模块
            Auth.init();

            // 检查认证状态
            const isAuthenticated = await Auth.checkAuthentication();
            if (!isAuthenticated) {
                window.location.href = '/login.html';
                return;
            }

            // 初始化设备ID
            this.deviceId = Utils.getDeviceId();

            // 初始化各个模块
            UI.init();
            FileUpload.init();

            // 加载消息列表
            await this.loadMessages();

            // 标记为已初始化
            this.isInitialized = true;

        } catch (error) {
            this.showInitError(error);
        }
    }

    // 加载消息列表（文本+文件混合）
    async loadMessages() {
        try {
            UI.showLoading('加载消息列表...');
            const response = await API.getMessages();
            if (response && response.success) {
                UI.renderMessages(response.data || []);
            } else {
                UI.showEmpty('暂无内容');
            }
        } catch (error) {
            console.error('加载消息列表失败:', error);
            UI.showEmpty('加载失败，请刷新重试');
        }
    }

    // 刷新消息列表
    async refreshMessages() {
        await this.loadMessages();
    }

    // 加载文件列表（保留兼容）
    async loadFiles() {
        await this.loadMessages();
    }

    // 刷新文件列表（保留兼容）
    async refreshFiles() {
        await this.loadMessages();
    }

    // 显示初始化错误
    showInitError(error) {
        const errorMessage = `
            <div style="text-align: center; padding: 2rem; color: #ff4757;">
                <h2>应用启动失败</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="
                    background: #07c160;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 1rem;
                ">
                    重新加载
                </button>
            </div>
        `;

        document.body.innerHTML = errorMessage;
    }

    // 获取应用状态
    getStatus() {
        return {
            initialized: this.isInitialized,
            deviceId: this.deviceId,
            online: navigator.onLine,
            timestamp: new Date().toISOString()
        };
    }
}

// 创建应用实例
const app = new FileTransferApp();

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

// 未处理的Promise错误
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise错误:', event.reason);
});

// 导出到全局作用域
window.app = app;
window.FileTransferApp = app;
window.CONFIG = CONFIG;
window.Utils = Utils;
window.API = API;
window.UI = UI;
window.FileUpload = FileUpload;
