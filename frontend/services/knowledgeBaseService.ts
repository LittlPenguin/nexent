// Unified encapsulation of knowledge base related API calls

import { Document, KnowledgeBase, KnowledgeBaseCreateParams, IndexInfoResponse } from '@/types/knowledgeBase';
import { API_ENDPOINTS } from './api';
import { getAuthHeaders } from './conversationService';

// Knowledge base service class
class KnowledgeBaseService {
  // 添加一个记录空列表请求的时间戳
  private emptyListTimestamp: number | null = null;
  // 空列表缓存有效期（毫秒）
  private emptyListCacheDuration = 30000; // 30秒
  // 健康检查缓存
  private healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
  // 健康检查缓存有效期（毫秒）
  private healthCheckCacheDuration = 60000; // 60秒

  // Check Elasticsearch health (with caching)
  async checkHealth(): Promise<boolean> {
    try {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.healthCheckCache && (now - this.healthCheckCache.timestamp < this.healthCheckCacheDuration)) {
        console.log("使用健康检查缓存");
        return this.healthCheckCache.isHealthy;
      }

      const response = await fetch(API_ENDPOINTS.knowledgeBase.health);
      const data = await response.json();
      
      const isHealthy = data.status === "healthy" && data.elasticsearch === "connected";
      
      // 更新缓存
      this.healthCheckCache = {
        isHealthy,
        timestamp: now
      };
      
      return isHealthy;
    } catch (error) {
      console.error("Elasticsearch健康检查失败:", error);
      this.healthCheckCache = {
        isHealthy: false,
        timestamp: Date.now()
      };
      return false;
    }
  }

  // Get knowledge bases
  async getKnowledgeBases(skipHealthCheck = false): Promise<KnowledgeBase[]> {
    try {
      // First check Elasticsearch health (unless skipped)
      if (!skipHealthCheck) {
        const isElasticsearchHealthy = await this.checkHealth();
        if (!isElasticsearchHealthy) {
          console.warn("Elasticsearch service unavailable");
          return [];
        }
      }

      // New: Check if empty list cache is valid
      if (this.emptyListTimestamp !== null) {
        const now = Date.now();
        if (now - this.emptyListTimestamp < this.emptyListCacheDuration) {
          return [];
        }
      }

      let knowledgeBases: KnowledgeBase[] = [];

      // Get knowledge bases from Elasticsearch
      try {
        const response = await fetch(`${API_ENDPOINTS.knowledgeBase.indices}?include_stats=true`);
        const data = await response.json();
        
        if (data.indices && data.indices_info) {
          // Convert Elasticsearch indices to knowledge base format
          knowledgeBases = data.indices_info.map((indexInfo: any) => {
            const stats = indexInfo.stats?.base_info || {};
            
            return {
              id: indexInfo.name,
              name: indexInfo.name,
              description: "Elasticsearch index",
              documentCount: stats.doc_count || 0,
              chunkCount: stats.chunk_count || 0,
              createdAt: stats.creation_date || new Date().toISOString().split("T")[0],
              embeddingModel: stats.embedding_model || "unknown",
              avatar: "",
              chunkNum: 0,
              language: "",
              nickname: "",
              parserId: "",
              permission: "",
              tokenNum: 0,
              source: "elasticsearch",
            };
          });
        }
      } catch (error) {
        console.error("Failed to get Elasticsearch indices:", error);
      }
      
      // New: If list is empty, set empty list cache timestamp
      if (knowledgeBases.length === 0) {
        this.emptyListTimestamp = Date.now();
      } else {
        // If list is not empty, clear cache
        this.emptyListTimestamp = null;
      }
      
      return knowledgeBases;
    } catch (error) {
      console.error("Failed to get knowledge base list:", error);
      throw error;
    }
  }

  // 检查知识库是否存在（不获取详细统计信息，更轻量）
  async checkKnowledgeBaseExists(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_ENDPOINTS.knowledgeBase.indices}?include_stats=false`);
      const data = await response.json();
      
      if (data.indices && Array.isArray(data.indices)) {
        return data.indices.includes(name);
      }
      return false;
    } catch (error) {
      console.error("检查知识库存在性失败:", error);
      return false;
    }
  }

  // 检查知识库名称是否已存在
  async checkKnowledgeBaseNameExists(name: string): Promise<boolean> {
    try {
      const knowledgeBases = await this.getKnowledgeBases(true);
      return knowledgeBases.some(kb => kb.name === name);
    } catch (error) {
      console.error("Failed to check knowledge base name existence:", error);
      throw error;
    }
  }

  // Create a new knowledge base
  async createKnowledgeBase(params: KnowledgeBaseCreateParams): Promise<KnowledgeBase> {
    try {
      // First check Elasticsearch health status to avoid subsequent operation failures
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        throw new Error("Elasticsearch service unavailable, cannot create knowledge base");
      }
      
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(params.name), {
        method: "POST",
        headers: getAuthHeaders(), // Add user authentication information to obtain the user id
        body: JSON.stringify({
          name: params.name,
          description: params.description || "",
          embeddingModel: params.embeddingModel || "",
        }),
      });

      const result = await response.json();
      // 修改判断逻辑，后端返回status字段而不是success字段
      if (result.status !== "success") {
        throw new Error(result.message || "创建知识库失败");
      }

      // Clear empty list cache after creating knowledge base
      this.emptyListTimestamp = null;

      // Create a full KnowledgeBase object with default values
      return {
        id: result.id || params.name, // Use returned ID or name as ID
        name: params.name,
        description: params.description || null,
        documentCount: 0,
        chunkCount: 0,
        createdAt: new Date().toISOString(),
        embeddingModel: params.embeddingModel || "",
        avatar: "",
        chunkNum: 0,
        language: "",
        nickname: "",
        parserId: "",
        permission: "",
        tokenNum: 0,
        source: params.source || "elasticsearch",
      };
    } catch (error) {
      console.error("Failed to create knowledge base:", error);
      throw error;
    }
  }

  // Delete a knowledge base
  async deleteKnowledgeBase(id: string): Promise<void> {
    try {
      // Use REST-style DELETE request to delete index
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "Failed to delete knowledge base");
      }
      
      // Clear empty list cache after deleting knowledge base as state may have changed
      this.emptyListTimestamp = null;
    } catch (error) {
      console.error("Failed to delete knowledge base:", error);
      throw error;
    }
  }

  // Get documents from a knowledge base
  async getDocuments(kbId: string, forceRefresh: boolean = false): Promise<Document[]> {
    try {
      // Add random query parameter to bypass browser cache (only when force refresh)
      const cacheParam = forceRefresh ? `&_t=${Date.now()}` : '';
      
      // Use new interface /indices/{index_name}/info to get knowledge base details, including file list
      const response = await fetch(
        `${API_ENDPOINTS.knowledgeBase.indexInfo(kbId)}?include_files=true${cacheParam}`
      );
      const result = await response.json() as IndexInfoResponse;

      // Handle different response formats, some APIs return success field, some return data directly
      if (result.success === false) {
        throw new Error(result.message || "Failed to get document list");
      }

      // Standard API response format processing
      if (result.base_info && result.files && Array.isArray(result.files)) {
        return result.files.map((file) => ({
          id: file.path_or_url, // Use path or URL as ID
          kb_id: kbId,
          name: file.file || file.path_or_url.split('/').pop() || 'Unknown',
          type: this.getFileTypeFromName(file.file || file.path_or_url),
          size: file.file_size || 0,
          create_time: file.create_time || new Date().toISOString(),
          chunk_num: file.chunk_count || 0,
          token_num: 0, // Not provided by API, use default value
          status: file.status || "UNKNOWN" // Get status from API
        }));
      }

      // If no document information is obtained, return empty array
      return [];
    } catch (error) {
      console.error("Failed to get document list:", error);
      throw error;
    }
  }
  
  // Get file type from filename
  private getFileTypeFromName(filename: string): string {
    if (!filename) return "Unknown";
    
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF';
      case 'doc':
      case 'docx':
        return 'Word';
      case 'xls':
      case 'xlsx':
        return 'Excel';
      case 'ppt':
      case 'pptx':
        return 'PowerPoint';
      case 'txt':
        return 'Text';
      case 'md':
        return 'Markdown';
      default:
        return 'Unknown';
    }
  }

  // Upload documents to a knowledge base
  async uploadDocuments(kbId: string, files: File[], chunkingStrategy?: string): Promise<void> {
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append("index_name", kbId);

      // Add files
      for (let i = 0; i < files.length; i++) {
        formData.append("file", files[i]);
      }

      // If chunking strategy is provided, add it to the request
      if (chunkingStrategy) {
        formData.append("chunking_strategy", chunkingStrategy);
      }

      // Send request
      const response = await fetch(API_ENDPOINTS.knowledgeBase.upload, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      // Check response status code
      if (!response.ok) {
        const result = await response.json();
        
        // Handle 400 error (no files or invalid files)
        if (response.status === 400) {
          if (result.error === "No files in the request") {
            throw new Error("No files in the request");
          } else if (result.error === "No valid files uploaded") {
            throw new Error(`Invalid file upload: ${result.errors.join(", ")}`);
          }
          throw new Error(result.error || "File upload validation failed");
        }
        
        // Handle 500 error (data processing service failure)
        if (response.status === 500) {
          const errorMessage = `Data processing service failed: ${result.error}. Uploaded files: ${result.files.join(", ")}`;
          throw new Error(errorMessage);
        }
        
        throw new Error("File upload failed");
      }

      // Handle successful response (201)
      const result = await response.json();
      if (response.status === 201) {
        return;
      }

      throw new Error("Unknown response status");
    } catch (error) {
      console.error("Failed to upload files:", error);
      throw error;
    }
  }

  // Delete a document from a knowledge base
  async deleteDocument(docId: string, kbId: string): Promise<void> {
    try {
      // Use REST-style DELETE request to delete document, requires knowledge base ID and document path
      const response = await fetch(
        `${API_ENDPOINTS.knowledgeBase.indexDetail(kbId)}/documents?path_or_url=${encodeURIComponent(docId)}`, 
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "Failed to delete document");
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
      throw error;
    }
  }
}

// Export a singleton instance
const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService; 