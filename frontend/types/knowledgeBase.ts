// Knowledge base related type definitions

import { DOCUMENT_ACTION_TYPES, KNOWLEDGE_BASE_ACTION_TYPES, UI_ACTION_TYPES, NOTIFICATION_TYPES } from "@/const/knowledgeBase";

// Knowledge base basic type
export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  chunkCount: number
  documentCount: number
  createdAt: any
  embeddingModel: string
  avatar: string
  chunkNum: number
  language: string
  nickname: string
  parserId: string
  permission: string
  tokenNum: number
  source: string
}

// Create knowledge base parameter type
export interface KnowledgeBaseCreateParams {
  name: string;
  description: string;
  source?: string;
  embeddingModel?: string;
}

// Document type
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
  selected?: boolean // For UI selection status
  latest_task_id: string // For marking the latest celery task
}

// Document state interface
export interface DocumentState {
  documentsMap: Record<string, Document[]>;
  selectedIds: string[];
  uploadFiles: File[];
  isUploading: boolean;
  loadingKbIds: Set<string>;
  isLoadingDocuments: boolean;
  error: string | null;
}

// Document action type
export type DocumentAction = 
  | { type: typeof DOCUMENT_ACTION_TYPES.FETCH_SUCCESS, payload: { kbId: string, documents: Document[] } }
  | { type: typeof DOCUMENT_ACTION_TYPES.SELECT_DOCUMENT, payload: string }
  | { type: typeof DOCUMENT_ACTION_TYPES.SELECT_DOCUMENTS, payload: string[] }
  | { type: typeof DOCUMENT_ACTION_TYPES.SELECT_ALL, payload: { kbId: string, selected: boolean } }
  | { type: typeof DOCUMENT_ACTION_TYPES.SET_UPLOAD_FILES, payload: File[] }
  | { type: typeof DOCUMENT_ACTION_TYPES.SET_UPLOADING, payload: boolean }
  | { type: typeof DOCUMENT_ACTION_TYPES.SET_LOADING_DOCUMENTS, payload: boolean }
  | { type: typeof DOCUMENT_ACTION_TYPES.DELETE_DOCUMENT, payload: { kbId: string, docId: string } }
  | { type: typeof DOCUMENT_ACTION_TYPES.SET_LOADING_KB_ID, payload: { kbId: string, isLoading: boolean } }
  | { type: typeof DOCUMENT_ACTION_TYPES.CLEAR_DOCUMENTS, payload?: undefined }
  | { type: typeof DOCUMENT_ACTION_TYPES.ERROR, payload: string };

// Knowledge base state interface
export interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[];
  selectedIds: string[];
  activeKnowledgeBase: KnowledgeBase | null;
  currentEmbeddingModel: string | null;
  isLoading: boolean;
  error: string | null;
}

// Knowledge base action type
export type KnowledgeBaseAction = 
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.FETCH_SUCCESS, payload: KnowledgeBase[] }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.SELECT_KNOWLEDGE_BASE, payload: string[] }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.SET_ACTIVE, payload: KnowledgeBase | null }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.SET_MODEL, payload: string | null }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.DELETE_KNOWLEDGE_BASE, payload: string }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.ADD_KNOWLEDGE_BASE, payload: KnowledgeBase }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.LOADING, payload: boolean }
  | { type: typeof KNOWLEDGE_BASE_ACTION_TYPES.ERROR, payload: string };

// UI state interface
export interface UIState {
  isDragging: boolean;
  isCreateModalVisible: boolean;
  isDocModalVisible: boolean;
  notifications: {
    id: string;
    message: string;
    type: typeof NOTIFICATION_TYPES.SUCCESS | typeof NOTIFICATION_TYPES.ERROR | typeof NOTIFICATION_TYPES.INFO | typeof NOTIFICATION_TYPES.WARNING;
  }[];
}

// UI action type
export type UIAction = 
  | { type: typeof UI_ACTION_TYPES.SET_DRAGGING, payload: boolean }
  | { type: typeof UI_ACTION_TYPES.TOGGLE_CREATE_MODAL, payload: boolean }
  | { type: typeof UI_ACTION_TYPES.TOGGLE_DOC_MODAL, payload: boolean }
  | { type: typeof UI_ACTION_TYPES.ADD_NOTIFICATION, payload: { message: string; type: typeof NOTIFICATION_TYPES.SUCCESS | typeof NOTIFICATION_TYPES.ERROR | typeof NOTIFICATION_TYPES.INFO | typeof NOTIFICATION_TYPES.WARNING } }
  | { type: typeof UI_ACTION_TYPES.REMOVE_NOTIFICATION, payload: string };

// Abortable error type for upload operations
export interface AbortableError extends Error {
  name: string;
}

// User selected knowledge base configuration type
export interface UserKnowledgeConfig {
  selectedKbNames: string[];
  selectedKbModels: string[];
  selectedKbSources: string[];
}
