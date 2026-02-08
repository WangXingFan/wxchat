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

        // Parallel upload with concurrency limit
        const CONCURRENCY = 3;
        let successCount = 0;
        let failCount = 0;
        let completed = 0;

        const uploadWithProgress = async (file, index) => {
            try {
                this.updateBatchProgress(file.name, index + 1, validFiles.length);
                const deviceId = Utils.getDeviceId();
                await API.uploadFile(file, deviceId, (progress) => {
                    this.updateFileProgress(progress);
                });
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`文件 ${file.name} 上传失败:`, error);
            } finally {
                completed++;
                this.updateBatchProgress(
                    validFiles[Math.min(completed, validFiles.length - 1)]?.name || '',
                    completed,
                    validFiles.length
                );
            }
        };

        // Process files in batches for controlled parallelism
        for (let i = 0; i < validFiles.length; i += CONCURRENCY) {
            const batch = validFiles.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map((file, idx) => uploadWithProgress(file, i + idx)));
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

// Drag overlay & upload progress styles - Glassmorphism
const uploadStyles = `
    .drag-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 184, 148, 0.15);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
    }

    .drag-overlay.active {
        opacity: 1;
        visibility: visible;
    }

    .drag-content {
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 2px dashed rgba(0, 184, 148, 0.6);
        border-radius: 24px;
        padding: 3rem 4rem;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0, 184, 148, 0.15), 0 0 40px rgba(0, 184, 148, 0.2);
        animation: dragPulse 2s ease-in-out infinite;
    }

    @keyframes dragPulse {
        0%, 100% { transform: scale(1); border-color: rgba(0, 184, 148, 0.6); }
        50% { transform: scale(1.02); border-color: rgba(0, 206, 201, 0.8); }
    }

    .drag-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        animation: bounce 2s ease-in-out infinite;
    }

    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    .drag-text {
        font-size: 1.4rem;
        font-weight: 700;
        background: linear-gradient(135deg, #00b894, #00cec9);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
    }

    .drag-hint {
        font-size: 0.9rem;
        color: #636e72;
    }

    #uploadStatus {
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 16px;
        padding: 1rem;
        margin-bottom: 0.75rem;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 4px 16px rgba(0, 184, 148, 0.1);
        box-sizing: border-box;
        overflow: hidden;
        max-width: 100%;
    }

    .upload-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(0, 184, 148, 0.2);
        border-top-color: #00b894;
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
        color: #2d3436;
        font-size: 14px;
        margin-bottom: 4px;
    }

    .upload-current {
        font-size: 12px;
        color: #636e72;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .upload-progress {
        width: 140px;
        flex-shrink: 1;
        min-width: 60px;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(0, 184, 148, 0.15);
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #00b894, #00cec9);
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 4px;
        box-shadow: 0 0 10px rgba(0, 184, 148, 0.5);
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = uploadStyles;
document.head.appendChild(styleSheet);
