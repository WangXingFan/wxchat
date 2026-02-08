// PWA 管理模块 - Service Worker 注册与安装提示

const PWA = {
    _deferredPrompt: null,
    _registration: null,

    init() {
        if (!('serviceWorker' in navigator)) {
            console.log('[PWA] Service Worker 不受支持');
            return;
        }

        this._registerSW();
        this._listenInstallPrompt();
    },

    _registerSW() {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                this._registration = reg;
                console.log('[PWA] Service Worker 注册成功');

                reg.addEventListener('updatefound', () => this._onUpdateFound(reg));
            })
            .catch((err) => {
                console.error('[PWA] Service Worker 注册失败:', err);
            });
    },

    _listenInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredPrompt = e;
            console.log('[PWA] 应用可安装');
        });
    },

    _onUpdateFound(reg) {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast('应用已更新，刷新页面以使用新版本', 'info');
                }
            }
        });
    },

    promptInstall() {
        if (!this._deferredPrompt) {
            console.log('[PWA] 当前不可安装');
            return Promise.resolve(false);
        }

        this._deferredPrompt.prompt();
        return this._deferredPrompt.userChoice.then((result) => {
            this._deferredPrompt = null;
            return result.outcome === 'accepted';
        });
    },

    getStatus() {
        return {
            swSupported: 'serviceWorker' in navigator,
            swRegistered: !!this._registration,
            installable: !!this._deferredPrompt,
            standalone: window.matchMedia('(display-mode: standalone)').matches
        };
    }
};

Object.freeze(PWA);
