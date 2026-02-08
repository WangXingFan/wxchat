// UI 操作和渲染 - 支持文件和文本消息

const UI = {
    // DOM 元素缓存
    elements: {},

    // Image blob URL cache to avoid re-fetching
    imageCache: new Map(),

    // Preview loading controls
    imageObserver: null,
    pendingImageTasks: [],
    activeImageLoads: 0,
    maxConcurrentImageLoads: 3,

    // 初始化UI
    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupImageObserver();
    },

    // 缓存DOM元素
    cacheElements() {
        this.elements = {
            messageList: document.getElementById('messageList'),
            fileInput: document.getElementById('fileInput'),
            uploadStatus: document.getElementById('uploadStatus'),
            refreshButton: document.getElementById('refreshButton'),
            clearAllButton: document.getElementById('clearAllButton'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton')
        };
    },

    // 绑定事件
    bindEvents() {
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                if (window.app) {
                    window.app.refreshMessages();
                }
            });
        }

        if (this.elements.clearAllButton) {
            this.elements.clearAllButton.addEventListener('click', () => {
                if (window.app && typeof window.app.clearAllMessages === 'function') {
                    window.app.clearAllMessages();
                }
            });
        }

        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => {
                this.handleSendMessage();
            });
        }

        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }

        // Event delegation for message/file action buttons
        const listEl = this.elements.messageList;
        if (listEl) {
            listEl.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                const action = btn.dataset.action;
                const item = btn.closest('[data-id]') || btn.closest('[data-r2key]');

                if (action === 'copy') {
                    const msgEl = btn.closest('[data-id]');
                    if (msgEl) {
                        const textEl = msgEl.querySelector('.message-text');
                        if (textEl) this.copyText(textEl.textContent);
                    }
                } else if (action === 'delete-message') {
                    const id = item?.dataset.id;
                    if (id) this.confirmDeleteMessage(Number(id));
                } else if (action === 'download') {
                    const r2Key = btn.dataset.r2key;
                    const fileName = btn.dataset.filename;
                    if (r2Key && fileName) API.downloadFile(r2Key, fileName);
                } else if (action === 'delete-file') {
                    const r2Key = btn.dataset.r2key;
                    const fileName = btn.dataset.filename;
                    if (r2Key) this.confirmDelete(r2Key, fileName || '');
                } else if (action === 'preview-image') {
                    const r2Key = btn.dataset.r2key;
                    const fileName = btn.dataset.filename;
                    if (r2Key) this.showImageModal(r2Key, fileName || '');
                }
            });
        }
    },

    // 处理发送消息
    async handleSendMessage() {
        const input = this.elements.messageInput;
        if (!input) return;

        const content = input.value.trim();
        if (!content) {
            this.showError('请输入消息内容');
            return;
        }

        try {
            const deviceId = Utils.getDeviceId();
            await API.sendMessage(content, deviceId);
            input.value = '';
            if (window.app) {
                await window.app.refreshMessages();
            }
        } catch (error) {
            this.showError('发送失败: ' + error.message);
        }
    },

    // 显示加载状态
    showLoading(message = '加载中...') {
        const listEl = this.elements.messageList;
        if (listEl) {
            listEl.innerHTML = `
                <div class="loading" role="status">
                    <div class="loading-spinner" aria-hidden="true"></div>
                    <span>${Utils.escapeHtml(message)}</span>
                </div>
            `;
        }
    },

    // 显示空状态
    showEmpty(message = '暂无内容，发送点什么吧') {
        const listEl = this.elements.messageList;
        if (listEl) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" aria-hidden="true">💬</div>
                    <p>${Utils.escapeHtml(message)}</p>
                </div>
            `;
        }
    },

    // 渲染消息列表（文本+文件混合）- 优化版
    renderMessages(messages) {
        if (!messages || messages.length === 0) {
            this.showEmpty();
            return;
        }

        const listEl = this.elements.messageList;
        if (!listEl) return;

        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        const tempContainer = document.createElement('div');

        // Build HTML string first (faster than individual createElement)
        const html = messages.map(msg => this.renderMessageItem(msg)).join('');
        tempContainer.innerHTML = html;

        // Move all children to fragment
        while (tempContainer.firstChild) {
            fragment.appendChild(tempContainer.firstChild);
        }

        // Single DOM update
        listEl.innerHTML = '';
        listEl.appendChild(fragment);
        this.registerImagePreviews();
    },

    // 渲染单条消息
    renderMessageItem(msg) {
        if (msg.type === 'text') {
            return this.renderTextMessage(msg);
        } else if (msg.type === 'file') {
            return this.renderFileMessage(msg);
        }
        return '';
    },

    // 渲染文本消息
    renderTextMessage(msg) {
        const time = Utils.formatDateTime(msg.timestamp);
        const content = Utils.escapeHtml(msg.content || '');
        const id = Number(msg.id);

        return `
            <div class="message-item text-message" data-id="${id}">
                <div class="message-content">
                    <div class="message-text">${content}</div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <button class="copy-btn" data-action="copy" aria-label="复制文本">复制</button>
                    <button class="delete-btn" data-action="delete-message" aria-label="删除消息">删除</button>
                </div>
            </div>
        `;
    },

    // 渲染文件消息
    renderFileMessage(msg) {
        const fileIcon = Utils.getFileIcon(msg.mime_type, msg.file_name);
        const fileSize = Utils.formatFileSize(msg.file_size);
        const time = Utils.formatDateTime(msg.timestamp);
        const isImage = Utils.isImageFile(msg.mime_type, msg.file_name);
        const safeId = this.createSafeId(msg.r2_key || '');
        const escapedName = Utils.escapeHtml(msg.file_name || '未知文件');
        const id = Number(msg.id);

        let imagePreview = '';
        if (isImage && msg.r2_key) {
            imagePreview = `
                <div class="image-preview" id="preview-${safeId}" data-r2key="${Utils.escapeHtml(msg.r2_key)}" data-safeid="${safeId}">
                    <div class="image-loading" id="loading-${safeId}">
                        <div class="loading-spinner" aria-hidden="true"></div>
                        <button class="download-btn" data-action="download" data-r2key="${Utils.escapeHtml(msg.r2_key)}" data-filename="${escapedName}" aria-label="下载原图">下载原图</button>
                    </div>
                    <img id="img-${safeId}" alt="${escapedName}"
                         style="display: none; max-width: 200px; max-height: 150px; border-radius: 10px; margin-top: 8px;"
                         data-action="preview-image" data-r2key="${Utils.escapeHtml(msg.r2_key)}" data-safeid="${safeId}" data-filename="${escapedName}"
                         loading="lazy" />
                </div>
            `;
        }

        return `
            <div class="message-item file-message" data-id="${id}">
                <div class="file-info">
                    <div class="file-icon" aria-hidden="true">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-name">${escapedName}</div>
                        <div class="file-meta">
                            <span class="file-size">${fileSize}</span>
                            <span class="file-time">${time}</span>
                        </div>
                    </div>
                </div>
                ${imagePreview}
                <div class="message-actions">
                    <button class="download-btn" data-action="download" data-r2key="${Utils.escapeHtml(msg.r2_key)}" data-filename="${escapedName}" aria-label="下载文件">下载</button>
                    <button class="delete-btn" data-action="delete-message" aria-label="删除消息">删除</button>
                </div>
            </div>
        `;
    },

    // 复制文本到剪贴板
    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('已复制到剪贴板');
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showSuccess('已复制到剪贴板');
        }
    },

    // 确认删除消息
    async confirmDeleteMessage(id) {
        if (confirm('确定要删除这条消息吗？此操作不可恢复。')) {
            try {
                const response = await API.deleteMessage(id);
                if (response.success) {
                    this.showSuccess('删除成功');
                    if (window.app) {
                        window.app.refreshMessages();
                    }
                } else {
                    this.showError(response.error || '删除失败');
                }
            } catch (error) {
                this.showError('删除失败: ' + error.message);
            }
        }
    },

    // 渲染文件列表 - 优化版
    renderFiles(files) {
        if (!files || files.length === 0) {
            this.showEmpty();
            return;
        }

        const listEl = this.elements.messageList;
        if (!listEl) return;

        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        const tempContainer = document.createElement('div');

        const html = files.map(file => this.renderFileItem(file)).join('');
        tempContainer.innerHTML = html;

        while (tempContainer.firstChild) {
            fragment.appendChild(tempContainer.firstChild);
        }

        listEl.innerHTML = '';
        listEl.appendChild(fragment);
        this.registerImagePreviews();
    },

    // 渲染单个文件项
    renderFileItem(file) {
        const fileIcon = Utils.getFileIcon(file.mime_type, file.original_name);
        const fileSize = Utils.formatFileSize(file.file_size);
        const uploadTime = Utils.formatDateTime(file.upload_time);
        const isImage = Utils.isImageFile(file.mime_type, file.original_name);
        const safeId = this.createSafeId(file.r2_key);
        const escapedName = Utils.escapeHtml(file.original_name);

        let imagePreview = '';
        if (isImage) {
            imagePreview = `
                <div class="image-preview" id="preview-${safeId}" data-r2key="${Utils.escapeHtml(file.r2_key)}" data-safeid="${safeId}">
                    <div class="image-loading" id="loading-${safeId}">
                        <div class="loading-spinner" aria-hidden="true"></div>
                        <button class="download-btn" data-action="download" data-r2key="${Utils.escapeHtml(file.r2_key)}" data-filename="${escapedName}" aria-label="下载原图">下载原图</button>
                    </div>
                    <img id="img-${safeId}" alt="${escapedName}"
                         style="display: none; max-width: 200px; max-height: 150px; border-radius: 10px; margin-top: 8px;"
                         data-action="preview-image" data-r2key="${Utils.escapeHtml(file.r2_key)}" data-safeid="${safeId}" data-filename="${escapedName}"
                         loading="lazy" />
                </div>
            `;
        }

        return `
            <div class="file-item" data-r2key="${Utils.escapeHtml(file.r2_key)}">
                <div class="file-info">
                    <div class="file-icon" aria-hidden="true">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-name">${escapedName}</div>
                        <div class="file-meta">
                            <span class="file-size">${fileSize}</span>
                            <span class="file-time">${uploadTime}</span>
                        </div>
                    </div>
                </div>
                ${imagePreview}
                <div class="file-actions">
                    <button class="download-btn" data-action="download" data-r2key="${Utils.escapeHtml(file.r2_key)}" data-filename="${escapedName}" aria-label="下载文件">下载</button>
                    <button class="delete-btn" data-action="delete-file" data-r2key="${Utils.escapeHtml(file.r2_key)}" data-filename="${escapedName}" aria-label="删除文件">删除</button>
                </div>
            </div>
        `;
    },

    // 确认删除文件
    async confirmDelete(r2Key, fileName) {
        if (confirm(`确定要删除文件 "${fileName}" 吗？此操作不可恢复。`)) {
            try {
                const response = await API.deleteFile(r2Key);
                if (response.success) {
                    this.showSuccess('文件删除成功');
                    if (window.app) {
                        window.app.refreshMessages();
                    }
                } else {
                    this.showError(response.error || '删除失败');
                }
            } catch (error) {
                this.showError('删除失败: ' + error.message);
            }
        }
    },

    // 显示图片模态框
    showImageModal(r2Key, fileName) {
        const escapedName = Utils.escapeHtml(fileName);
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', '图片预览');
        modal.innerHTML = `
            <div class="image-modal-content">
                <div class="image-modal-header">
                    <span>${escapedName}</span>
                    <button class="close-btn" aria-label="关闭预览">✕</button>
                </div>
                <div class="image-modal-body">
                    <div class="loading-spinner" aria-hidden="true" id="modal-loading"></div>
                    <img src="" alt="${escapedName}" id="modal-img" style="display:none" />
                </div>
                <div class="image-modal-footer">
                    <button class="modal-download-btn">下载</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Download handler
        const downloadBtn = modal.querySelector('.modal-download-btn');
        downloadBtn.addEventListener('click', () => {
            API.downloadFile(r2Key, fileName);
        });

        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Load image
        API.getImageBlobUrl(r2Key).then(blobUrl => {
            const img = modal.querySelector('#modal-img');
            const loading = modal.querySelector('#modal-loading');
            if (!img) return;

            img.onload = () => {
                if (loading) loading.style.display = 'none';
                img.style.display = 'block';
            };
            img.onerror = async () => {
                try {
                    const fallbackBlobUrl = await API.fetchImageBlobUrl(r2Key);
                    img.onerror = null;
                    img.src = fallbackBlobUrl;
                } catch (fallbackError) {
                    console.error('模态图预览失败:', fallbackError);
                    if (loading) {
                        loading.textContent = '图片预览失败';
                    }
                }
            };
            img.src = blobUrl;
        }).catch(async (error) => {
            console.error('获取模态预览地址失败:', error);
            const img = modal.querySelector('#modal-img');
            const loading = modal.querySelector('#modal-loading');
            if (!img) return;

            try {
                const fallbackBlobUrl = await API.fetchImageBlobUrl(r2Key);
                img.onload = () => {
                    if (loading) loading.style.display = 'none';
                    img.style.display = 'block';
                };
                img.src = fallbackBlobUrl;
            } catch (fallbackError) {
                console.error('模态图降级加载失败:', fallbackError);
                if (loading) {
                    loading.textContent = '图片预览失败';
                }
            }
        });
    },

    // 创建安全的ID
    createSafeId(str) {
        return str.replace(/[^a-zA-Z0-9-_]/g, '');
    },

    // 异步加载图片 - 带缓存优化
    setupImageObserver() {
        if (typeof IntersectionObserver === 'undefined') {
            this.imageObserver = null;
            return;
        }

        this.imageObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;

                const target = entry.target;
                const r2Key = target.dataset.r2key;
                const safeId = target.dataset.safeid;
                this.imageObserver.unobserve(target);

                if (r2Key && safeId) {
                    this.enqueueImageLoad(r2Key, safeId);
                }
            }
        }, {
            root: this.elements.messageList || null,
            rootMargin: '200px 0px',
            threshold: 0.01
        });
    },

    registerImagePreviews() {
        const listEl = this.elements.messageList;
        if (!listEl) return;

        this.pendingImageTasks = [];

        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }

        const previews = listEl.querySelectorAll('.image-preview[data-r2key][data-safeid]');
        previews.forEach((previewEl) => {
            if (this.imageObserver) {
                this.imageObserver.observe(previewEl);
                return;
            }

            const r2Key = previewEl.dataset.r2key;
            const safeId = previewEl.dataset.safeid;
            if (r2Key && safeId) {
                this.enqueueImageLoad(r2Key, safeId);
            }
        });
    },

    enqueueImageLoad(r2Key, safeId) {
        if (!r2Key || !safeId) return;

        this.pendingImageTasks.push({ r2Key, safeId });
        this.processImageLoadQueue();
    },

    processImageLoadQueue() {
        while (this.activeImageLoads < this.maxConcurrentImageLoads && this.pendingImageTasks.length > 0) {
            const task = this.pendingImageTasks.shift();
            if (!task) break;

            this.activeImageLoads += 1;
            this.loadImageAsync(task.r2Key, task.safeId)
                .catch(() => {})
                .finally(() => {
                    this.activeImageLoads = Math.max(0, this.activeImageLoads - 1);
                    this.processImageLoadQueue();
                });
        }
    },

    async loadImageAsync(r2Key, safeId) {
        try {
            const loadingElement = document.getElementById(`loading-${safeId}`);
            const imageElement = document.getElementById(`img-${safeId}`);

            if (!loadingElement || !imageElement) return;

            loadingElement.style.display = 'flex';
            imageElement.style.display = 'none';

            let blobUrl = this.imageCache.get(r2Key);
            if (!blobUrl) {
                blobUrl = await API.getImageBlobUrl(r2Key);
                if (this.imageCache.size > 50) {
                    const firstKey = this.imageCache.keys().next().value;
                    this.imageCache.delete(firstKey);
                }
                this.imageCache.set(r2Key, blobUrl);
            }

            await new Promise((resolve, reject) => {
                imageElement.onload = resolve;
                imageElement.onerror = reject;
                imageElement.src = blobUrl;
            });

            loadingElement.style.display = 'none';
            imageElement.style.display = 'block';
        } catch (error) {
            console.error('图片加载失败:', error);
            const loadingElement = document.getElementById(`loading-${safeId}`);
            const imageElement = document.getElementById(`img-${safeId}`);

            if (imageElement) {
                imageElement.style.display = 'none';
                imageElement.removeAttribute('src');
            }

            try {
                const fallbackBlobUrl = await API.fetchImageBlobUrl(r2Key);
                if (imageElement) {
                    imageElement.src = fallbackBlobUrl;
                    imageElement.style.display = 'block';
                }
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                return;
            } catch (fallbackError) {
                console.error('图片加载降级失败:', fallbackError);
            }

            if (loadingElement) {
                loadingElement.innerHTML = '<span style="color: #999; font-size: 13px;">图片预览失败</span>' +
                    `<button class="download-btn" data-action="download" data-r2key="${r2Key}" data-filename="image" aria-label="下载原图">下载原图</button>`;
            }
        }
    },
    // 显示错误消息
    showError(message) {
        console.error('错误:', message);
        this.showToast(message, 'error');
    },

    // 显示成功消息
    showSuccess(message) {
        this.showToast(message, 'success');
    },

    // 显示Toast提示（支持堆叠）
    showToast(message, type = 'info') {
        // Remove existing toasts of same type to avoid stacking
        const existing = document.querySelectorAll(`.toast-${type}`);
        existing.forEach(el => el.remove());

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.textContent = message;

        const bgMap = { error: '#fa5151', success: '#07c160', info: '#333' };
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            z-index: 10001;
            animation: fadeIn 0.2s ease-out;
            background: ${bgMap[type] || bgMap.info};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 90%;
            text-align: center;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    // 显示上传状态
    showUploadStatus(show = true) {
        if (this.elements.uploadStatus) {
            this.elements.uploadStatus.style.display = show ? 'flex' : 'none';
        }
    },

    // 更新上传进度
    updateUploadProgress(percent) {
        const progressBar = document.getElementById('progressFill');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    },

    // 重置上传状态
    resetUploadStatus() {
        this.showUploadStatus(false);
        this.updateUploadProgress(0);
    }
};


