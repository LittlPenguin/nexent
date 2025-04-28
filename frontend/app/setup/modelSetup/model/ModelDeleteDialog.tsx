import { Modal, Button, message } from 'antd'
import { DeleteOutlined, ExclamationCircleFilled, RightOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ModelOption, ModelType } from '@/types/config'
import { modelService } from '@/services/modelService'
import { useConfig } from '@/hooks/useConfig'

interface ModelDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  customModels: ModelOption[]
}

export const ModelDeleteDialog = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  customModels 
}: ModelDeleteDialogProps) => {
  const { modelConfig, updateModelConfig } = useConfig()
  const [deletingModelType, setDeletingModelType] = useState<ModelType | null>(null)
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set())

  // 获取模型的颜色方案
  const getModelColorScheme = (type: ModelType): { bg: string; text: string; border: string } => {
    switch (type) {
      case "llm":
        return { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" }
      case "embedding":
        return { bg: "bg-green-50", text: "text-green-600", border: "border-green-100" }
      case "rerank":
        return { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" }
      case "stt":
        return { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-100" }
      case "tts":
        return { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" }
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-100" }
    }
  }

  // 获取模型的图标
  const getModelIcon = (type: ModelType) => {
    switch (type) {
      case "llm":
        return "🤖"
      case "embedding":
        return "🔢"
      case "rerank":
        return "🔍"
      case "stt":
        return "🎤"
      case "tts":
        return "🔊"
      default:
        return "⚙️"
    }
  }

  // 获取模型的显示名称
  const getModelTypeName = (type: ModelType): string => {
    switch (type) {
      case "llm":
        return "大语言模型"
      case "embedding":
        return "Embedding模型"
      case "rerank":
        return "Rerank模型"
      case "stt":
        return "语音识别模型"
      case "tts":
        return "语音合成模型"
      default:
        return "未知模型"
    }
  }

  // 处理删除模型
  const handleDeleteModel = async (modelName: string, displayName: string) => {
    setDeletingModels(prev => new Set(prev).add(modelName))
    try {
      await modelService.deleteCustomModel(modelName)
      let configUpdates: any = {}
      
      // 检查每个模型配置，如果当前使用的是被删除的模型，则清空配置
      if (modelConfig.llm.modelName === modelName) {
        configUpdates.llm = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.llmSecondary.modelName === modelName) {
        configUpdates.llmSecondary = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.embedding.modelName === modelName) {
        configUpdates.embedding = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.rerank.modelName === modelName) {
        configUpdates.rerank = { modelName: "", displayName: "" }
      }
      
      if (modelConfig.stt.modelName === modelName) {
        configUpdates.stt = { modelName: "", displayName: "" }
      }
      
      if (modelConfig.tts.modelName === modelName) {
        configUpdates.tts = { modelName: "", displayName: "" }
      }

      // 如果有配置需要更新，则更新localStorage
      if (Object.keys(configUpdates).length > 0) {
        updateModelConfig(configUpdates)
      }

      // 先显示成功消息
      message.success(`删除模型成功: ${displayName}`)
      
      // 同步模型列表并更新所有相关显示组件
      try {
        // 1. 调用模型同步接口
        await modelService.syncModels()
        
        // 2. 获取最新的模型列表
        const updatedModels = await modelService.getCustomModels()
        
        // 3. 更新当前组件中的customModels数据（通过父组件的onSuccess回调）
        await onSuccess()
        
        // 4. 如果当前类型没有模型了，则返回到模型类型选择界面
        const modelsOfCurrentType = updatedModels.filter(model => model.type === deletingModelType)
        if (updatedModels.length === 0 || modelsOfCurrentType.length === 0) {
          setDeletingModelType(null)
        }
      } catch (error) {
        console.error('同步模型列表失败:', error)
        message.error('同步模型列表失败')
      }
    } catch (error) {
      console.error('删除模型失败:', error)
      message.error(`删除模型失败: ${displayName}`)
    } finally {
      setDeletingModels(prev => {
        const next = new Set(prev)
        next.delete(modelName)
        return next
      })
    }
  }

  // 处理关闭对话框
  const handleClose = () => {
    setDeletingModelType(null)
    onClose()
  }

  return (
    // 重构：风格被嵌入在组件内
    <Modal
      title="删除自定义模型"
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>,
      ]}
      width={520}
      destroyOnClose
    >
      {!deletingModelType ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">请选择要删除的模型类型：</p>

          <div className="grid grid-cols-1 gap-2">
            {(["llm", "embedding", "rerank", "stt", "tts"] as ModelType[]).map((type) => {
              const customModelsByType = customModels.filter((model) => model.type === type)
              const colorScheme = getModelColorScheme(type)

              if (customModelsByType.length === 0) return null

              return (
                <button
                  key={type}
                  onClick={() => setDeletingModelType(type)}
                  className={`p-3 flex justify-between rounded-md border ${colorScheme.border} ${colorScheme.bg} hover:bg-opacity-80 transition-colors`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${colorScheme.text}`}>
                      {getModelIcon(type)}
                    </div>
                    <div className="flex flex-col text-left">
                      <div className="font-medium">{getModelTypeName(type)}</div>
                      <div className="text-xs text-gray-500">{customModelsByType.length} 个自定义模型</div>
                    </div>
                  </div>
                  <RightOutlined className="h-5 w-5" />
                </button>
              )
            })}
          </div>

          {customModels.length === 0 && (
            <div className="text-center py-8 text-gray-500">没有可删除的自定义模型</div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-4">
            <button
              onClick={() => setDeletingModelType(null)}
              className="text-blue-500 hover:text-blue-700 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              返回
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
            {customModels
              .filter((model) => model.type === deletingModelType)
              .map((model) => (
                <div key={model.name} className="p-2 flex justify-between items-center hover:bg-gray-50 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={model.name}>
                      {model.displayName || model.name} ({model.name})
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteModel(model.name, model.displayName || model.name)}
                    disabled={deletingModels.has(model.name)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="删除模型"
                  >
                    {deletingModels.has(model.name) ? (
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <DeleteOutlined className="h-5 w-5" />
                    )}
                  </button>
                </div>
              ))}

            {customModels.filter((model) => model.type === deletingModelType).length === 0 && (
              <div className="p-4 text-center text-gray-500">
                没有可删除的{getModelTypeName(deletingModelType)}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md text-xs text-yellow-700">
            <div>
              <div className="flex items-center mb-1">
                <ExclamationCircleFilled className="text-md text-yellow-500 mr-3" />
                <p className="font-bold text-medium">注意</p>
              </div>
              <p className="mt-0.5 ml-6">
                删除模型操作不可恢复。如果删除当前正在使用的模型，相关配置将被重置。
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}