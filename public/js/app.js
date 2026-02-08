// 应用主入口文件 - 支持文件和文本消息

class FileTransferApp {
    constructor() {
        this.isInitialized = false;
        this.deviceId = null;
    }

    async init() {
        try {
            Auth.init();

            const isAuthenticated = await Auth.checkAuthentication();
            if (!isAuthenticated) {
                window.location.href = '/login.html';
                return;
            }

            this.deviceId = Utils.getDeviceId();

            UI.init();
            FileUpload.init();

            await this.loadMessages();

            this.isInitialized = true;
        } catch (error) {
            this.showInitError(error);
        }
    }

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

    async refreshMessages() {
        await this.loadMessages();
    }

    async clearAllMessages() {
        const confirmed = confirm('确定要清空所有消息和文件吗？该操作不可恢复。');
        if (!confirmed) return;

        try {
            UI.showLoading('正在清空全部内容...');
            const response = await API.clearAllMessages();

            if (response && response.success) {
                UI.showSuccess('已清空所有消息和文件');
                await this.loadMessages();
                return;
            }

            throw new Error(response?.error || '清空失败');
        } catch (error) {
            UI.showError('清空失败: ' + error.message);
            await this.loadMessages();
        }
    }

    // Alias for backward compatibility
    async refreshFiles() {
        await this.loadMessages();
    }

    showInitError(error) {
        const container = document.querySelector('.app') || document.body;
        const errorDiv = document.createElement('div');
        errorDiv.setAttribute('role', 'alert');
        errorDiv.style.cssText = 'text-align:center;padding:3rem 1.5rem;color:#fa5151;';

        const h2 = document.createElement('h2');
        h2.textContent = '应用启动失败';
        errorDiv.appendChild(h2);

        const p = document.createElement('p');
        p.textContent = error.message;
        p.style.margin = '1rem 0';
        errorDiv.appendChild(p);

        const btn = document.createElement('button');
        btn.textContent = '重新加载';
        btn.style.cssText = 'background:linear-gradient(135deg,#00f0ff,#bf5af2);color:#000;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;';
        btn.addEventListener('click', () => location.reload());
        errorDiv.appendChild(btn);

        container.innerHTML = '';
        container.appendChild(errorDiv);
    }
}

const app = new FileTransferApp();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise错误:', event.reason);
});

window.app = app;
