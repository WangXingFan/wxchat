// 文件上传处理 - 精简版

const FileUpload = {
    // 拖拽状态
    isDragging: false,
    dragCounter: 0,

    // 初始化文件上传
    init() {
        this.bindEvents();
        this.createDragOverlay();
        this.setupClipboardListener();
    },

    // 绑定事件
    bindEvents() {
        const fileInput = document.getElementById('fileInput');
        const fileButton = document.getElementById('fileButton');

        if (fileButton) {
            fileButton.addEventListener('click', () => {
                fileInput.click();
            });
        }

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // 全局拖拽事件
        document.addEventListener('dragenter', this.handleDragEnter.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    },

    // 创建拖拽覆盖层
    createDragOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'dragOverlay';
        overlay.className = 'drag-overlay';
        overlay.innerHTML = `
            <div class="drag-content">
                <div class="drag-icon">📁</div>
                <div class="drag-text">拖拽文件到此处上传</div>
                <div class="drag-hint">支持多文件同时上传</div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    // 设置剪贴板监听
    setupClipboardListener() {
        document.addEventListener('paste', this.handlePaste.bind(this));
    },

    // 处理文件选择
    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        await this.uploadMultipleFiles(Array.from(files));
    },

    // 处理拖拽进入
    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter++;
        if (e.dataTransfer.types.includes('Files')) {
            this.showDragOverlay();
        }
    },

    // 处理拖拽悬停
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    },

    // 处理拖拽离开
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter--;
        if (this.dragCounter === 0) {
            this.hideDragOverlay();
        }
    },

    // 处理文件拖拽放下
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dragCounter = 0;
        this.hideDragOverlay();

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect(files);
        }
    },

    // 处理剪贴板粘贴
    async handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            await this.uploadMultipleFiles(files);
        }
    },

    // 显示拖拽覆盖层
    showDragOverlay() {
        const overlay = document.getElementById('dragOverlay');
        if (overlay) {
            overlay.classList.add('active');
            this.isDragging = true;
        }
    },

    // 隐藏拖拽覆盖层
    hideDragOverlay() {
        const overlay = document.getElementById('dragOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            this.isDragging = false;
        }
    },

    // 批量上传文件
    async uploadMultipleFiles(files) {
        if (!files || files.length === 0) return;

        const validFiles = files.filter(file => this.validateFile(file));

        if (validFiles.length === 0) {
            UI.showError('文件过大或格式不支持');
            return;
        }

        this.showBatchUploadStatus(validFiles.length);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validFiles.length; i++) {
            try {
                await this.uploadSingleFile(validFiles[i], i + 1, validFiles.length);
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`文件 ${validFiles[i].name} 上传失败:`, error);
            }
        }

        this.hideBatchUploadStatus();

        if (successCount > 0) {
            UI.showSuccess(`成功上传 ${successCount} 个文件`);
            // 刷新文件列表
            setTimeout(async () => {
                if (window.app && window.app.refreshFiles) {
                    await window.app.refreshFiles();
                }
            }, 500);
        }

        if (failCount > 0) {
            UI.showError(`${failCount} 个文件上传失败`);
        }

        this.clearFileInput();
    },

    // 上传单个文件
    async uploadSingleFile(file, current, total) {
        const deviceId = Utils.getDeviceId();
        this.updateBatchProgress(file.name, current, total);

        const result = await API.uploadFile(file, deviceId, (progress) => {
            this.updateFileProgress(progress);
        });

        return result;
    },

    // 验证单个文件
    validateFile(file) {
        return Utils.validateFileSize(file.size);
    },

    // 显示批量上传状态
    showBatchUploadStatus(fileCount) {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.style.display = 'flex';
            statusElement.innerHTML = `
                <div class="upload-spinner">⏳</div>
                <div class="upload-info">
                    <div class="upload-text">正在上传 ${fileCount} 个文件...</div>
                    <div class="upload-current" id="uploadCurrent"></div>
                </div>
                <div class="upload-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                </div>
            `;
        }
    },

    // 隐藏批量上传状态
    hideBatchUploadStatus() {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    },

    // 更新批量上传进度
    updateBatchProgress(fileName, current, total) {
        const currentElement = document.getElementById('uploadCurrent');
        if (currentElement) {
            const fileIcon = Utils.getFileIconByName(fileName);
            const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
            currentElement.innerHTML = `正在上传: ${fileIcon} ${displayName} (${current}/${total})`;
        }
    },

    // 更新文件上传进度
    updateFileProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    },

    // 清空文件输入
    clearFileInput() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
            if (!fileInput.hasAttribute('multiple')) {
                fileInput.setAttribute('multiple', 'true');
            }
        }
    }
};

// 添加拖拽相关样式
const uploadStyles = `
    .drag-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(7, 193, 96, 0.1);
        backdrop-filter: blur(2px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        pointer-events: none;
    }

    .drag-overlay.active {
        opacity: 1;
        visibility: visible;
    }

    .drag-content {
        background: white;
        border: 3px dashed #07c160;
        border-radius: 20px;
        padding: 3rem;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }

    .drag-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
    }

    .drag-text {
        font-size: 1.5rem;
        font-weight: 600;
        color: #07c160;
        margin-bottom: 0.5rem;
    }

    .drag-hint {
        font-size: 1rem;
        color: #666;
    }

    .upload-status {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .upload-spinner {
        font-size: 1.2rem;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .upload-info {
        flex: 1;
    }

    .upload-text {
        font-weight: 600;
        color: #333;
        margin-bottom: 0.25rem;
    }

    .upload-current {
        font-size: 0.9rem;
        color: #666;
    }

    .upload-progress {
        width: 200px;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background-color: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #07c160, #06ad56);
        transition: width 0.3s ease;
        border-radius: 4px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = uploadStyles;
document.head.appendChild(styleSheet);
