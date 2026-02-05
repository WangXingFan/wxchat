// API 接口封装 - 精简版（仅文件上传下载）

const API = {
    // 通用请求方法
    async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const authHeaders = Auth ? Auth.addAuthHeader(defaultOptions.headers) : defaultOptions.headers;

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...authHeaders,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return response;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },

    // GET 请求
    async get(url, params = {}) {
        const urlParams = new URLSearchParams(params);
        const fullUrl = urlParams.toString() ? `${url}?${urlParams}` : url;

        return this.request(fullUrl, {
            method: 'GET',
        });
    },

    // POST 请求
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // DELETE 请求
    async delete(url) {
        return this.request(url, {
            method: 'DELETE',
        });
    },

    // 文件上传请求
    async upload(url, formData) {
        const authHeaders = Auth ? Auth.addAuthHeader({}) : {};

        const config = {
            method: 'POST',
            headers: {
                ...authHeaders,
            },
            body: formData,
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return response;
        } catch (error) {
            console.error('文件上传请求失败:', error);
            throw error;
        }
    },

    // 获取文件列表
    async getFiles(limit = CONFIG.UI.FILE_LOAD_LIMIT, offset = 0) {
        try {
            const response = await this.get(CONFIG.API.ENDPOINTS.FILES, {
                limit,
                offset
            });
            return response;
        } catch (error) {
            console.error('获取文件列表失败:', error);
            return { success: false, data: [] };
        }
    },

    // 上传文件
    async uploadFile(file, deviceId, onProgress = null) {
        try {
            if (!Utils.validateFileSize(file.size)) {
                throw new Error(CONFIG.ERRORS.FILE_TOO_LARGE);
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('deviceId', deviceId);

            if (onProgress) {
                return this.uploadWithProgress(CONFIG.API.ENDPOINTS.FILES_UPLOAD, formData, onProgress);
            }

            const response = await this.upload(CONFIG.API.ENDPOINTS.FILES_UPLOAD, formData);

            if (response.success) {
                return response.data;
            } else {
                throw new Error(response.error || CONFIG.ERRORS.FILE_UPLOAD_FAILED);
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            throw error;
        }
    },

    // 带进度的文件上传
    uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error('响应解析失败'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('网络错误'));
            });

            xhr.open('POST', url);

            if (Auth && Auth.getToken()) {
                xhr.setRequestHeader('Authorization', `Bearer ${Auth.getToken()}`);
            }

            xhr.send(formData);
        });
    },

    // 下载文件
    async downloadFile(r2Key, fileName) {
        try {
            const url = `${CONFIG.API.ENDPOINTS.FILES_DOWNLOAD}/${r2Key}`;

            const authHeaders = Auth ? Auth.addAuthHeader({}) : {};

            const response = await fetch(url, {
                method: 'GET',
                headers: authHeaders
            });

            if (!response.ok) {
                throw new Error(`下载失败: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(downloadUrl);

            return true;
        } catch (error) {
            console.error('文件下载失败:', error);
            return false;
        }
    },

    // 删除文件
    async deleteFile(r2Key) {
        try {
            const response = await this.delete(`${CONFIG.API.ENDPOINTS.FILES}/${r2Key}`);
            return response;
        } catch (error) {
            console.error('文件删除失败:', error);
            throw error;
        }
    },

    // 图片blob URL缓存
    imageBlobCache: new Map(),

    // 获取图片blob URL（用于预览）
    async getImageBlobUrl(r2Key) {
        if (this.imageBlobCache.has(r2Key)) {
            return this.imageBlobCache.get(r2Key);
        }

        try {
            const url = `${CONFIG.API.ENDPOINTS.FILES_DOWNLOAD}/${r2Key}`;
            const authHeaders = Auth ? Auth.addAuthHeader({}) : {};

            const response = await fetch(url, {
                method: 'GET',
                headers: authHeaders
            });

            if (!response.ok) {
                throw new Error(`获取图片失败: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            this.imageBlobCache.set(r2Key, blobUrl);

            return blobUrl;
        } catch (error) {
            console.error('获取图片blob URL失败:', error);
            throw error;
        }
    },

    // 清理图片blob URL缓存
    clearImageBlobCache() {
        for (const [key, blobUrl] of this.imageBlobCache) {
            window.URL.revokeObjectURL(blobUrl);
        }
        this.imageBlobCache.clear();
    }
};

Object.freeze(API);
