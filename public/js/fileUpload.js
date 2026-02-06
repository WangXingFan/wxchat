// 文件上传处理

const FileUpload = {
    isDragging: false,
    dragCounter: 0,

    init() {
        this.bindEvents();
        this.createDragOverlay();
        this.setupClipboardListener();
    },

    bindEvents() {
        const fileInput = document.getElementById('fileInput');
        const fileButton = document.getElementById('fileButton');

        if (fileButton && fileInput) {
            fileButton.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
        }

        // Single set of drag/drop handlers (removed duplicate listeners)
        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter++;
            if (e.dataTransfer.types.includes('Files')) {
                this.showDragOverlay();
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.types.includes('Files')) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter--;
            if (this.dragCounter === 0) {
                this.hideDragOverlay();
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter = 0;
            this.hideDragOverlay();
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files);
            }
        });
    },

    createDragOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'dragOverlay';
        overlay.className = 'drag-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="drag-content">
                <div class="drag-icon">📁</div>
                <div class="drag-text">拖拽文件到此处上传</div>
                <div class="drag-hint">支持多文件同时上传</div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    setupClipboardListener() {
        document.addEventListener('paste', (e) => {
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
                this.uploadMultipleFiles(files);
            }
        });
    },

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        await this.uploadMultipleFiles(Array.from(files));
    },

    showDragOverlay() {
        const overlay = document.getElementById('dragOverlay');
        if (overlay) {
            overlay.classList.add('active');
            this.isDragging = true;
        }
    },

    hideDragOverlay() {
        const overlay = document.getElementById('dragOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            this.isDragging = false;
        }
    },

    async uploadMultipleFiles(files) {
        if (!files || files.length === 0) return;

        const validFiles = files.filter(file => Utils.validateFileSize(file.size));

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
            if (window.app) {
                await window.app.refreshMessages();
            }
        }

        if (failCount > 0) {
            UI.showError(`${failCount} 个文件上传失败`);
        }

        this.clearFileInput();
    },

    async uploadSingleFile(file, current, total) {
        const deviceId = Utils.getDeviceId();
        this.updateBatchProgress(file.name, current, total);

        return await API.uploadFile(file, deviceId, (progress) => {
            this.updateFileProgress(progress);
        });
    },

    showBatchUploadStatus(fileCount) {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.style.display = 'flex';
            statusElement.innerHTML = `
                <div class="upload-spinner" aria-hidden="true"></div>
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

    hideBatchUploadStatus() {
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    },

    updateBatchProgress(fileName, current, total) {
        const currentElement = document.getElementById('uploadCurrent');
        if (currentElement) {
            const fileIcon = Utils.getFileIconByName(fileName);
            const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
            currentElement.textContent = `正在上传: ${fileIcon} ${displayName} (${current}/${total})`;
        }
    },

    updateFileProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    },

    clearFileInput() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    }
};

// Drag overlay & upload progress styles
const uploadStyles = `
    .drag-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(7, 193, 96, 0.08);
        backdrop-filter: blur(3px);
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
        background: #fff;
        border: 2px dashed #07c160;
        border-radius: 20px;
        padding: 2.5rem 3rem;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .drag-icon {
        font-size: 3rem;
        margin-bottom: 0.75rem;
    }

    .drag-text {
        font-size: 1.25rem;
        font-weight: 600;
        color: #07c160;
        margin-bottom: 0.25rem;
    }

    .drag-hint {
        font-size: 0.875rem;
        color: #999;
    }

    #uploadStatus {
        background: #f7f7f7;
        border: 1px solid #e6e6e6;
        border-radius: 10px;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        align-items: center;
        gap: 0.75rem;
    }

    .upload-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e6e6e6;
        border-top-color: #07c160;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .upload-info {
        flex: 1;
        min-width: 0;
    }

    .upload-text {
        font-weight: 600;
        color: #1a1a1a;
        font-size: 13px;
        margin-bottom: 2px;
    }

    .upload-current {
        font-size: 12px;
        color: #666;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .upload-progress {
        width: 120px;
        flex-shrink: 0;
    }

    .progress-bar {
        width: 100%;
        height: 6px;
        background-color: #e6e6e6;
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #07c160, #06ad56);
        transition: width 0.3s ease;
        border-radius: 3px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = uploadStyles;
document.head.appendChild(styleSheet);
