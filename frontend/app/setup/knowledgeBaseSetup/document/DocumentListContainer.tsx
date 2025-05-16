import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Document } from '@/types/knowledgeBase'
import { sortByStatusAndDate } from '@/lib/utils'
import knowledgeBasePollingService from '@/services/knowledgeBasePollingService'
import DocumentListLayout, { UI_CONFIG } from './DocumentListLayout'

interface DocumentListProps {
  documents: Document[]
  onDelete: (id: string) => void
  knowledgeBaseName?: string // 当前知识库名称，用于显示标题
  loading?: boolean // 是否正在加载
  modelMismatch?: boolean // 模型不匹配标志
  currentModel?: string // 当前使用的模型
  knowledgeBaseModel?: string // 知识库使用的模型
  embeddingModelInfo?: string // 嵌入模型信息
  containerHeight?: string // 容器总高度
  isCreatingMode?: boolean // 是否处于创建模式
  onNameChange?: (name: string) => void // 知识库名称变更
  hasDocuments?: boolean // 是否已经有文档上传
  
  // 上传相关的props
  isDragging?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  selectedFiles?: File[]
  onUpload?: () => void
  isUploading?: boolean
  uploadUrl?: string
}

export interface DocumentListRef {
  uppy: any;
}

const DocumentListContainer = forwardRef<DocumentListRef, DocumentListProps>(({
  documents,
  onDelete,
  knowledgeBaseName = '',
  loading = false,
  modelMismatch = false,
  currentModel = '',
  knowledgeBaseModel = '',
  embeddingModelInfo = '',
  containerHeight = '57vh', // 默认整体容器高度
  isCreatingMode = false,
  onNameChange,
  hasDocuments = false,
  
  // 上传相关props
  isDragging = false,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  selectedFiles = [],
  onUpload,
  isUploading = false,
  uploadUrl = '/api/upload'
}, ref) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [localDocuments, setLocalDocuments] = useState<Document[]>(documents);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const uploadAreaRef = useRef<any>(null);
  const activeKbIdRef = useRef<string | null>(null);
  
  // 文档状态映射，用于增量更新
  const [documentStatusMap, setDocumentStatusMap] = useState<Map<string, string>>(new Map());
  
  // 添加等待文档加载状态
  const [waitingForDocuments, setWaitingForDocuments] = useState<boolean>(false);

  // 暴露 uppy 实例给父组件
  useImperativeHandle(ref, () => ({
    uppy: uploadAreaRef.current?.uppy
  }));

  // 使用固定高度而不是百分比
  const titleBarHeight = UI_CONFIG.TITLE_BAR_HEIGHT;
  const uploadHeight = UI_CONFIG.UPLOAD_COMPONENT_HEIGHT;
  
  // 计算文档列表区域高度 = 总高度 - 标题栏高度 - 上传区域高度
  const contentHeight = `calc(${containerHeight} - ${titleBarHeight} - ${uploadHeight})`;

  // 按状态和日期排序的文档列表
  const sortedDocuments = sortByStatusAndDate(localDocuments);

  // 当外部documents更新时，更新本地状态和状态映射
  useEffect(() => {
    // 只有当文档数量或ID变化时才完全替换本地文档
    // 否则仅更新状态映射
    if (shouldReplaceDocuments(documents, localDocuments)) {
      console.log('文档列表发生变化，完全替换');
      setLocalDocuments(documents);
      
      // 更新文档状态映射
      const newStatusMap = new Map<string, string>();
      documents.forEach((doc: Document) => {
        newStatusMap.set(doc.id, doc.status);
      });
      setDocumentStatusMap(newStatusMap);
      
      // 如果收到文档，取消等待状态
      if (documents.length > 0) {
        setWaitingForDocuments(false);
      }
    } else {
      // 仅更新文档状态
      updateDocumentStatuses(documents);
    }
    
    // 文档更新时检查是否需要启动文档状态轮询
    checkIfPollingNeeded(documents);
    
    // 设置活动知识库ID到轮询服务
    if (documents.length > 0 && documents[0].kb_id) {
      activeKbIdRef.current = documents[0].kb_id;
      knowledgeBasePollingService.setActiveKnowledgeBase(documents[0].kb_id);
    } else if (knowledgeBaseName) {
      // 如果没有文档但有知识库名称，也设置
      knowledgeBasePollingService.setActiveKnowledgeBase(knowledgeBaseName);
    }
  }, [documents, knowledgeBaseName]);
  
  // 判断是否需要完全替换文档列表
  const shouldReplaceDocuments = (newDocs: Document[], oldDocs: Document[]): boolean => {
    if (newDocs.length !== oldDocs.length) return true;
    
    // 创建旧文档ID集合
    const oldDocIds = new Set<string>();
    oldDocs.forEach((doc: Document) => {
      oldDocIds.add(doc.id);
    });
    
    // 检查新文档中是否有ID不在旧文档中的
    for (let i = 0; i < newDocs.length; i++) {
      if (!oldDocIds.has(newDocs[i].id)) {
        return true;
      }
    }
    return false;
  };
  
  // 仅更新文档状态，而不替换整个文档列表
  const updateDocumentStatuses = (newDocs: Document[]): void => {
    // 从新文档创建状态映射和大小映射
    const newStatusMap = new Map<string, string>();
    const newSizeMap = new Map<string, number>();
    newDocs.forEach((doc: Document) => {
      newStatusMap.set(doc.id, doc.status);
      newSizeMap.set(doc.id, doc.size);
    });
    
    // 检查是否有状态或大小变化
    let hasChanges = false;
    newStatusMap.forEach((status: string, id: string) => {
      if (!documentStatusMap.has(id) || 
          documentStatusMap.get(id) !== status || 
          newSizeMap.get(id) !== localDocuments.find(doc => doc.id === id)?.size) {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      console.log('文档状态或大小发生变化，增量更新');
      // 更新状态映射
      setDocumentStatusMap(newStatusMap);
      
      // 增量更新本地文档状态和大小
      setLocalDocuments(prevDocs => 
        prevDocs.map((doc: Document) => {
          const newStatus = newStatusMap.get(doc.id);
          const newSize = newSizeMap.get(doc.id);
          if ((newStatus && newStatus !== doc.status) || 
              (typeof newSize !== 'undefined' && newSize !== doc.size)) {
            return { 
              ...doc, 
              status: newStatus || doc.status,
              size: typeof newSize !== 'undefined' ? newSize : doc.size
            };
          }
          return doc;
        })
      );
      
      // 检查是否需要继续轮询
      const hasProcessingDocs = newDocs.some(doc => 
        doc.status === "PROCESSING" || doc.status === "FORWARDING" || doc.status === "WAITING"
      );
      
      const hasIncompleteCompletedDocs = newDocs.some(doc => 
        doc.status === "COMPLETED" && doc.size === 0
      );
      
      // 如果有处理中的文档或不完整的文档，确保轮询服务在运行
      if ((hasProcessingDocs || hasIncompleteCompletedDocs) && activeKbIdRef.current) {
        knowledgeBasePollingService.startDocumentStatusPolling(
          activeKbIdRef.current,
          (updatedDocs) => {
            if (shouldReplaceDocuments(updatedDocs, localDocuments)) {
              setLocalDocuments(updatedDocs);
              
              // 更新文档状态映射
              const newStatusMap = new Map<string, string>();
              updatedDocs.forEach((doc: Document) => {
                newStatusMap.set(doc.id, doc.status);
              });
              setDocumentStatusMap(newStatusMap);
            } else {
              updateDocumentStatuses(updatedDocs);
            }
          }
        );
      }
    }
  };
  
  // 监听文档更新事件
  useEffect(() => {
    const handleDocumentsUpdated = (event: CustomEvent) => {
      if (event.detail && event.detail.kbId && event.detail.documents) {
        const { kbId, documents: updatedDocs } = event.detail;
        
        // 如果更新的知识库与当前活动知识库匹配，则更新文档
        if (kbId === activeKbIdRef.current || 
            (knowledgeBaseName && kbId === knowledgeBaseName)) {
          
          // 使用增量更新逻辑
          if (shouldReplaceDocuments(updatedDocs, localDocuments)) {
            setLocalDocuments(updatedDocs);
            
            // 更新文档状态映射
            const newStatusMap = new Map<string, string>();
            updatedDocs.forEach((doc: Document) => {
              newStatusMap.set(doc.id, doc.status);
            });
            setDocumentStatusMap(newStatusMap);
            
            // 如果收到文档，取消等待状态
            if (updatedDocs.length > 0) {
              setWaitingForDocuments(false);
            }
          } else {
            updateDocumentStatuses(updatedDocs);
          }
        }
      }
    };
    
    window.addEventListener('documentsUpdated', handleDocumentsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdated as EventListener);
      
      // 组件卸载时停止所有轮询
      if (activeKbIdRef.current) {
        knowledgeBasePollingService.stopPolling(activeKbIdRef.current);
      }
      
      // 清除活动知识库引用
      knowledgeBasePollingService.setActiveKnowledgeBase(null);
    };
  }, [localDocuments, knowledgeBaseName]);

  // 添加检查是否需要轮询的函数 - 简化为只启动轮询
  const checkIfPollingNeeded = (docs: Document[]) => {
    // 若没有文档，不需要轮询
    if (!docs.length || !knowledgeBaseName) return;
    
    // 更新当前活动知识库ID
    activeKbIdRef.current = docs[0].kb_id;
    knowledgeBasePollingService.setActiveKnowledgeBase(docs[0].kb_id);
    
    // 检查是否有文档正在处理中，增加 WAITING 状态的检查
    const hasProcessingDocs = docs.some((doc: Document) => 
      doc.status === "PROCESSING" || 
      doc.status === "FORWARDING" || 
      doc.status === "WAITING"
    );
    
    // 检查是否有文档状态为"已完成"但文件大小为0的情况
    const hasIncompleteCompletedDocs = docs.some((doc: Document) => 
      doc.status === "COMPLETED" && doc.size === 0
    );
    
    // 检查是否有新上传的文档（通常文件大小为0表示刚上传）
    const hasNewUploadedDocs = docs.some((doc: Document) => 
      doc.size === 0
    );
    
    // 如果有正在处理的文档或有不完整的已完成文档或有新上传的文档，启动轮询
    if (hasProcessingDocs || hasIncompleteCompletedDocs || hasNewUploadedDocs) {
      console.log('检测到需要监控的文档状态，启动轮询');
      // 启动文档状态轮询
      knowledgeBasePollingService.startDocumentStatusPolling(
        docs[0].kb_id,
        (updatedDocs) => {
          console.log('轮询获取到更新的文档:', updatedDocs.length);
          // 使用增量更新而不是完全替换
          if (shouldReplaceDocuments(updatedDocs, localDocuments)) {
            setLocalDocuments(updatedDocs);
            
            // 更新文档状态映射
            const newStatusMap = new Map<string, string>();
            updatedDocs.forEach((doc: Document) => {
              newStatusMap.set(doc.id, doc.status);
            });
            setDocumentStatusMap(newStatusMap);
          } else {
            updateDocumentStatuses(updatedDocs);
          }
        }
      );
    }
  };

  // 当知识库名称改变时，清除上传文件
  useEffect(() => {
    if (onFileSelect) {
      const emptyFileList = new DataTransfer();
      onFileSelect({ target: { files: emptyFileList.files } } as React.ChangeEvent<HTMLInputElement>);
    }
    
    // 设置活动知识库ID
    knowledgeBasePollingService.setActiveKnowledgeBase(knowledgeBaseName || null);
  }, [knowledgeBaseName, onFileSelect]);

  // 当创建模式改变时，重置名称锁定状态
  useEffect(() => {
    if (isCreatingMode) {
      setNameLockedAfterUpload(false);
    }
  }, [isCreatingMode]);

  // 当上传按钮被点击时，需要锁定知识库名称
  const [nameLockedAfterUpload, setNameLockedAfterUpload] = useState(false);
  
  // 修改上传处理函数，确保一旦上传开始，就锁定知识库名称并进行通知
  const handleUpload = () => {
    if (isCreatingMode && knowledgeBaseName) {
      setNameLockedAfterUpload(true);
      setWaitingForDocuments(true);
    }
    
    if (onUpload) {
      onUpload();
      
      // 通知更新知识库列表
      knowledgeBasePollingService.triggerKnowledgeBaseListUpdate();
    }
  };

  // 获取文件图标
  const getFileIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return '📄'
      case 'word':
        return '📝'
      case 'excel':
        return '📊'
      case 'powerpoint':
        return '📑'
      default:
        return '📃'
    }
  }

  // 构建模型不匹配提示信息
  const getMismatchInfo = (): string => {
    if (embeddingModelInfo) return embeddingModelInfo;
    if (currentModel && knowledgeBaseModel) {
      return `当前模型${currentModel}与知识库模型${knowledgeBaseModel}不匹配，无法使用`;
    }
    return "当前模型不匹配，无法使用";
  }

  // 计算实际的加载状态 - 如果正在等待文档，也显示加载中
  const effectiveLoading = loading || waitingForDocuments;

  return (
    <DocumentListLayout
      sortedDocuments={sortedDocuments}
      knowledgeBaseName={knowledgeBaseName}
      loading={effectiveLoading}
      isInitialLoad={isInitialLoad}
      modelMismatch={modelMismatch}
      isCreatingMode={isCreatingMode}
      isUploading={isUploading}
      nameLockedAfterUpload={nameLockedAfterUpload}
      hasDocuments={hasDocuments}
      containerHeight={containerHeight}
      contentHeight={contentHeight}
      titleBarHeight={titleBarHeight}
      uploadHeight={uploadHeight}
      
      // 函数
      getFileIcon={getFileIcon}
      getMismatchInfo={getMismatchInfo}
      onNameChange={onNameChange}
      onDelete={onDelete}
      
      // 上传相关props
      uploadAreaRef={uploadAreaRef}
      isDragging={isDragging}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onFileSelect={onFileSelect}
      selectedFiles={selectedFiles || []}
      handleUpload={handleUpload}
      uploadUrl={uploadUrl}
    />
  )
});

export default DocumentListContainer 