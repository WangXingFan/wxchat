// UI 操作和渲染 - 精简版（仅文件列表展示）

const UI = {
    // DOM 元素缓存
    elements: {},

    // 初始化UI
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    // 缓存DOM元素
    cacheElements() {
        this.elements = {
            fileList: document.getElementById('fileList'),
            fileInput: document.getElementById('fileInput'),
            uploadStatus: document.getElementById('uploadStatus'),
            progressBar: document.getElementById('progressBar'),
            uploadButton: document.getElementById('uploadButton'),
            refreshButton: document.getElementById('refreshButton')
        };
    },

    // 绑定事件
    bindEvents() {
        // 刷新按钮点击
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                if (window.app && window.app.refreshFiles) {
                    window.app.refreshFiles();
                }
            });
        }
    },

    // 显示加载状态
    showLoading(message = '加载中...') {
        if (this.elements.fileList) {
            this.elements.fileList.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner">⏳</div>
                    <span>${message}</span>
                </div>
            `;
        }
    },

    // 显示空状态
    showEmpty(message = '暂无文件，上传一个吧！') {
        if (this.elements.fileList) {
            this.elements.fileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // 渲染文件列表
    renderFiles(files) {
        if (!files || files.length === 0) {
            this.showEmpty();
            return;
        }

        const html = files.map(file => this.renderFileItem(file)).join('');

        if (this.elements.fileList) {
            this.elements.fileList.innerHTML = html;
        }
    },

    // 渲染单个文件项
    renderFileItem(file) {
        const fileIcon = Utils.getFileIcon(file.mime_type, file.original_name);
        const fileSize = Utils.formatFileSize(file.file_size);
        const uploadTime = Utils.formatTime(file.upload_time);
        const isImage = Utils.isImageFile(file.mime_type);
        const safeId = this.createSafeId(file.r2_key);

        let imagePreview = '';
        if (isImage) {
            imagePreview = `
                <div class="image-preview" id="preview-${safeId}">
                    <div class="image-loading" id="loading-${safeId}">
                        <div class="loading-spinner">⏳</div>
                    </div>
                    <img id="img-${safeId}" alt="${this.escapeHtml(file.original_name)}"
                         style="display: none; max-width: 200px; max-height: 150px; border-radius: 8px; margin-top: 8px;"
                         onclick="UI.showImageModal('${file.r2_key}', '${this.escapeHtml(file.original_name)}')" />
                </div>
            `;

            // 延迟加载图片
            setTimeout(() => this.loadImageAsync(file.r2_key, safeId), 100);
        }

        return `
            <div class="file-item" data-r2key="${file.r2_key}">
                <div class="file-info">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-name">${this.escapeHtml(file.original_name)}</div>
                        <div class="file-meta">
                            <span class="file-size">${fileSize}</span>
                            <span class="file-time">${uploadTime}</span>
                        </div>
                    </div>
                </div>
                ${imagePreview}
                <div class="file-actions">
                    <button class="download-btn" onclick="API.downloadFile('${file.r2_key}', '${this.escapeHtml(file.original_name)}')">
                        ⬇️ 下载
                    </button>
                    <button class="delete-btn" onclick="UI.confirmDelete('${file.r2_key}', '${this.escapeHtml(file.original_name)}')">
                        🗑️ 删除
                    </button>
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
                    // 刷新文件列表
                    if (window.app && window.app.refreshFiles) {
                        window.app.refreshFiles();
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
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="image-modal-content">
                <div class="image-modal-header">
                    <span>${this.escapeHtml(fileName)}</span>
                    <button class="close-btn" onclick="this.closest('.image-modal').remove()">✕</button>
                </div>
                <div class="image-modal-body">
                    <img src="" alt="${this.escapeHtml(fileName)}" id="modal-img" />
                </div>
                <div class="image-modal-footer">
                    <button onclick="API.downloadFile('${r2Key}', '${this.escapeHtml(fileName)}')">⬇️ 下载</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 加载图片
        API.getImageBlobUrl(r2Key).then(blobUrl => {
            const img = modal.querySelector('#modal-img');
            if (img) {
                img.src = blobUrl;
            }
        });
    },

    // 创建安全的ID
    createSafeId(str) {
        return str.replace(/[^a-zA-Z0-9-_]/g, '');
    },

    // 异步加载图片
    async loadImageAsync(r2Key, safeId) {
        try {
            const loadingElement = document.getElementById(`loading-${safeId}`);
            const imageElement = document.getElementById(`img-${safeId}`);

            if (!loadingElement || !imageElement) return;

            loadingElement.style.display = 'flex';
            imageElement.style.display = 'none';

            const blobUrl = await API.getImageBlobUrl(r2Key);

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
            if (loadingElement) {
                loadingElement.innerHTML = '<span style="color: #999;">图片加载失败</span>';
            }
        }
    },

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 显示错误消息
    showError(message) {
        console.error('错误:', message);
        this.showToast(message, 'error');
    },

    // 显示成功消息
    showSuccess(message) {
        console.log('成功:', message);
        this.showToast(message, 'success');
    },

    // 显示Toast提示
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
            background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#07c160' : '#333'};
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // 显示上传状态
    showUploadStatus(show = true) {
        if (this.elements.uploadStatus) {
            this.elements.uploadStatus.style.display = show ? 'flex' : 'none';
        }
    },

    // 更新上传进度
    updateUploadProgress(percent) {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percent}%`;
        }
    },

    // 重置上传状态
    resetUploadStatus() {
        this.showUploadStatus(false);
        this.updateUploadProgress(0);
    }
};
