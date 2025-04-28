const API_BASE_URL = '/api';
const UPLOAD_SERVICE_URL = '/api/file';

export const API_ENDPOINTS = {
  conversation: {
    list: `${API_BASE_URL}/conversation/list`,
    create: `${API_BASE_URL}/conversation/create`,
    save: `${API_BASE_URL}/conversation/save`,
    rename: `${API_BASE_URL}/conversation/rename`,
    detail: (id: number) => `${API_BASE_URL}/conversation/${id}`,
    delete: (id: number) => `${API_BASE_URL}/conversation/${id}`,
    generateTitle: `${API_BASE_URL}/conversation/generate_title`,
    sources: `${API_BASE_URL}/conversation/sources`,
    opinion: `${API_BASE_URL}/conversation/message/update_opinion`,
  },
  agent: {
    run: `${API_BASE_URL}/agent/run`,
  },
  stt: {
    ws: `/api/voice/stt/ws`,
  },
  tts: {
    ws: `/api/voice/tts/ws`,
  },
  storage: {
    upload: `${UPLOAD_SERVICE_URL}/storage`,
    files: `${UPLOAD_SERVICE_URL}/storage`,
    file: (objectName: string) => `${UPLOAD_SERVICE_URL}/storage/${objectName}`,
    delete: (objectName: string) => `${UPLOAD_SERVICE_URL}/storage/${objectName}`,
    preprocess: `${UPLOAD_SERVICE_URL}/preprocess`,
  },
  proxy: {
    image: (url: string) => `${API_BASE_URL}/proxy/image?url=${encodeURIComponent(url)}`,
  },
  modelEngine: {
    // 基本健康检查
    healthcheck: `${API_BASE_URL}/me/healthcheck`,
    
    // 官方模型服务
    officialModelList: `${API_BASE_URL}/me/model/list`,
    officialModelHealthcheck: (modelName: string, timeout: number = 2) => 
      `${API_BASE_URL}/me/model/healthcheck?model_name=${encodeURIComponent(modelName)}&timeout=${timeout}`,
      
    // 自定义模型服务
    customModelList: `${API_BASE_URL}/model/list`,
    customModelCreate: `${API_BASE_URL}/model/create`,
    customModelDelete: `${API_BASE_URL}/model/delete`,
    customModelHealthcheck: (modelName: string) => 
      `${API_BASE_URL}/model/healthcheck?model_name=${encodeURIComponent(modelName)}`,
    updateConnectStatus: `${API_BASE_URL}/model/update_connect_status`,
  },
  knowledgeBase: {
    // Elasticsearch 服务
    health: `${API_BASE_URL}/indices/health`,
    indices: `${API_BASE_URL}/indices`,
    indexInfo: (indexName: string) => `${API_BASE_URL}/indices/${indexName}/info`,
    indexDetail: (indexName: string) => `${API_BASE_URL}/indices/${indexName}`,
    
    // 文件上传服务
    upload: `${UPLOAD_SERVICE_URL}/upload`,
  },
  config: {
    save: `${API_BASE_URL}/config/save_config`,
    load: `${API_BASE_URL}/config/load_config`,
  }
};

// 通用错误处理
export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// 为TypeScript添加全局接口扩展
declare global {
  interface Window {
    __isHandlingSessionExpired?: boolean;
  }
}