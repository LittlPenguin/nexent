// 知识库相关类型定义

// 文档状态常量
export const TERMINAL_STATUSES = ["COMPLETED", "PROCESS_FAILED", "FORWARD_FAILED"];
export const NON_TERMINAL_STATUSES = ["WAIT_FOR_PROCESSING", "PROCESSING", "WAIT_FOR_FORWARDING", "FORWARDING"];

// 知识库基本类型
export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  chunkCount: number
  documentCount: number
  createdAt: string
  embeddingModel: string
  avatar: string
  chunkNum: number
  language: string
  nickname: string
  parserId: string
  permission: string
  tokenNum: number
  source: string // 来自deepdoc还是modelengine
}

// 创建知识库的参数类型
export interface KnowledgeBaseCreateParams {
  name: string;
  description: string;
  source?: string;
  embeddingModel?: string;
}

// 文档类型
export interface Document {
  id: string
  kb_id: string
  name: string
  type: string
  size: number
  create_time: string
  chunk_num: number
  token_num: number
  status: string
  selected?: boolean // 用于UI选择状态
  latest_task_id: string //用于标记对应的最新celery任务
}

// 索引信息响应接口
export interface IndexInfoResponse {
  success?: boolean;
  message?: string;
  base_info: {
    doc_count: number;
    unique_sources_count: number;
    store_size: string;
    process_source: string;
    embedding_model: string;
    creation_date: string;
    update_date: string;
  };
  search_performance?: {
    total_search_count: number;
    hit_count: number;
  };
  fields?: string[];
  files?: Array<{
    path_or_url: string;
    file: string;
    file_size: number;
    create_time: string;
    id?: string;
    status?: string;
    chunk_count?: number;
    chunks?: Array<{
      id: string;
      title: string;
      content: string;
      create_time: string;
    }>;
  }>;
} 