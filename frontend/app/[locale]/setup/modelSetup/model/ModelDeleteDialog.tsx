import { Modal, Button,Switch, App } from 'antd'
import { DeleteOutlined, ExclamationCircleFilled, RightOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ModelOption, ModelType, ModelSource } from '@/types/config'
import { modelService } from '@/services/modelService'
import { ModelEditDialog } from './ModelEditDialog'
import { useConfig } from '@/hooks/useConfig'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { modelConfig, updateModelConfig } = useConfig()
  const [deletingModelType, setDeletingModelType] = useState<ModelType | null>(null)
  const [selectedSource, setSelectedSource] = useState<ModelSource | null>(null)
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set())
  const [editModel, setEditModel] = useState<ModelOption | null>(null)
  const [providerModels, setProviderModels] = useState<any[]>([])
  const [pendingSelectedProviderIds, setPendingSelectedProviderIds] = useState<Set<string>>(new Set())
  const [loadingSource, setLoadingSource] = useState<ModelSource | null>(null)

  // 获取模型的颜色方案
  const getModelColorScheme = (type: ModelType): { bg: string; text: string; border: string } => {
    switch (type) {
      case "llm":
        return { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" }
      case "embedding":
        return { bg: "bg-green-50", text: "text-green-600", border: "border-green-100" }
      case "multi_embedding":
        return { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-100" }
      case "rerank":
        return { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" }
      case "vlm":
        return { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-100" }
      case "stt":
        return { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" }
      case "tts":
        return { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-100" }
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
      case "multi_embedding":
        return "🖼️🔢"
      case "rerank":
        return "🔍"
      case "stt":
        return "🎤"
      case "tts":
        return "🔊"
      case "vlm":
        return "👁️"
      default:
        return "⚙️"
    }
  }

  // 获取模型的显示名称
  const getModelTypeName = (type: ModelType | null): string => {
    if (!type) return t('model.type.unknown')
    switch (type) {
      case "llm":
        return t('model.type.llm')
      case "embedding":
        return t('model.type.embedding')
      case "multi_embedding":
        return t('model.type.multiEmbedding')
      case "rerank":
        return t('model.type.rerank')
      case "stt":
        return t('model.type.stt')
      case "tts":
        return t('model.type.tts')
      case "vlm":
        return t('model.type.vlm')
      default:
        return t('model.type.unknown')
    }
  }

  // 获取来源的显示名称
  const getSourceName = (source: ModelSource): string => {
    switch (source) {
      case 'openai':
        return t('model.source.openai')
      case 'silicon':
        return t('model.source.silicon')
      case 'OpenAI-API-Compatible':
        return t('model.source.custom')
      default:
        return t('model.source.unknown')
    }
  }

  // 获取来源的颜色方案
  const getSourceColorScheme = (source: ModelSource): { bg: string; text: string; border: string } => {
    switch (source) {
      case 'silicon':
        return { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' }
      case 'openai':
        return { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' }
      case 'OpenAI-API-Compatible':
        return { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' }
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' }
    }
  }

  // 获取来源图标
  const getSourceIcon = (source: ModelSource): JSX.Element => {
    switch (source) {
      case 'silicon':
        return <img src="/siliconcloud-color.png" alt="Silicon" className="w-5 h-5" />
      case 'openai':
        return <span role="img" aria-label="openai">🏷️</span>
      case 'OpenAI-API-Compatible':
        return <span role="img" aria-label="custom">🛠️</span>
      default:
        return <span role="img" aria-label="box">📦</span>
    }
  }

  // 从 customModels 中获取 Silicon 的 API Key，优先匹配当前类型
  const getApiKeyByType = (type: ModelType | null): string => {
    if (!type) return ''
    // 先找与当前类型匹配的 silicon 模型
    const byType = customModels.find((m) => m.source === 'silicon' && m.type === type && m.apiKey)
    if (byType?.apiKey) return byType.apiKey
    // 回退到任意 silicon 模型
    const anySilicon = customModels.find((m) => m.source === 'silicon' && m.apiKey)
    return anySilicon?.apiKey || ''
  }

  // 预取 SiliconCloud 提供商的模型列表
  const prefetchSiliconProviderModels = async (modelType: ModelType | null): Promise<void> => {
    if (!modelType) return
    try {
      const apiKey = getApiKeyByType(modelType)
      const result = await modelService.addProviderModel({
        provider: 'silicon',
        type: modelType,
        apiKey: apiKey && apiKey.trim() !== '' ? apiKey : 'sk-no-api-key'
      })
      setProviderModels(result || [])
      // 初始化待选中的开关状态（根据 customModels 现状）
      const currentIds = new Set(
        customModels
          .filter(m => m.type === modelType && m.source === 'silicon')
          .map(m => m.name)
      )
      setPendingSelectedProviderIds(new Set((result || []).map((pm: any) => pm.id).filter((id: string) => currentIds.has(id))))
      if (!result || result.length === 0) {
        message.error(t('model.dialog.error.noModelsFetched'))
      }
    } catch (e) {
      message.error(t('model.dialog.error.noModelsFetched'))
      console.error('Failed to prefetch Silicon provider models', e)
    }
  }

  const handleEditModel = (model: ModelOption) => {
    setEditModel(model)
  }

  // 处理删除模型
  const handleDeleteModel = async (displayName: string) => {
    setDeletingModels(prev => new Set(prev).add(displayName))
    try {
      await modelService.deleteCustomModel(displayName)
      let configUpdates: any = {}
      
      // 检查每个模型配置，如果当前使用的是被删除的模型，则清空配置
      if (modelConfig.llm.displayName === displayName) {
        configUpdates.llm = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.llmSecondary.displayName === displayName) {
        configUpdates.llmSecondary = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.embedding.displayName === displayName) {
        configUpdates.embedding = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.multiEmbedding.displayName === displayName) {
        configUpdates.multiEmbedding = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.rerank.displayName === displayName) {
        configUpdates.rerank = { modelName: "", displayName: "" }
      }
      
      if (modelConfig.vlm.displayName === displayName) {
        configUpdates.vlm = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (modelConfig.stt.displayName === displayName) {
        configUpdates.stt = { modelName: "", displayName: "" }
      }
      
      if (modelConfig.tts.displayName === displayName) {
        configUpdates.tts = { modelName: "", displayName: "" }
      }

      // 如果有配置需要更新，则更新localStorage
      if (Object.keys(configUpdates).length > 0) {
        updateModelConfig(configUpdates)
      }

      // 显示成功消息
      message.success(t('model.message.deleteSuccess', { name: displayName }))
      
      // 直接调用父组件的onSuccess回调刷新模型列表
      // 这会触发一次modelService.getCustomModels()调用，避免重复请求
      await onSuccess()
      
      // 删除后根据剩余数量调整层级导航
      if (deletingModelType) {
        const remainingByTypeAndSource = customModels.filter(model =>
          model.type === deletingModelType && (!selectedSource || model.source === selectedSource) && model.displayName !== displayName
        )
        if (selectedSource && remainingByTypeAndSource.length === 0) {
          // 当前来源下已无模型，退回到来源选择
          setSelectedSource(null)
        }
        const remainingByType = customModels.filter(model =>
          model.type === deletingModelType && model.displayName !== displayName
        )
        if (remainingByType.length === 0) {
          setDeletingModelType(null)
        }
      }
    } catch (error) {
      console.error(t('model.error.deleteError'), error)
      message.error(t('model.message.deleteFailed', { name: displayName }))
    } finally {
      setDeletingModels(prev => {
        const next = new Set(prev)
        next.delete(displayName)
        return next
      })
    }
  }

  // 处理关闭对话框
  const handleClose = () => {
    setDeletingModelType(null)
    setSelectedSource(null)
    setProviderModels([])
    setPendingSelectedProviderIds(new Set())
    onClose()
  }

  return (
    // 重构：风格被嵌入在组件内
    <Modal
      title={t('model.dialog.edit.title')}
      open={isOpen}
      onCancel={handleClose}
      footer={[
        <Button key="close" onClick={handleClose}>
          {t('common.button.close')}
        </Button>,
        <Button key="confirm" type="primary" onClick={async () => {
          // 仅当 silicon 来源时应用更改
          if (selectedSource === 'silicon' && deletingModelType) {
            try {
              // 获取当前所有开启的模型（包括原本已开启的和新开启的）
              const allEnabledModels = providerModels.filter((pm: any) =>
                pendingSelectedProviderIds.has(pm.id)
              )

              if (allEnabledModels.length > 0) {
                const apiKey = getApiKeyByType(deletingModelType)
                // 传入所有当前开启的模型
                await modelService.addBatchCustomModel({
                  api_key: apiKey && apiKey.trim() !== '' ? apiKey : 'sk-no-api-key',
                  provider: 'silicon',
                  type: deletingModelType,
                  max_tokens: 0,
                  models: allEnabledModels
                })
              }

              // 刷新列表
              await onSuccess()
              // 重新获取提供商模型并同步开关状态
              await prefetchSiliconProviderModels(deletingModelType)
              message.success('更新成功')
              // 关闭弹窗
              handleClose()
            } catch (e) {
              console.error('Failed to apply model updates', e)
              message.error(t('model.dialog.error.addFailed', { error: e as any }))
            }
          }
        }} disabled={selectedSource !== 'silicon'}>
          确定
        </Button>,
      ]}
      width={520}
      destroyOnClose
    >
      {!deletingModelType ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">{t('model.dialog.edit.selectType')}</p>

          <div className="grid grid-cols-1 gap-2">
            {(["llm", "embedding", "multi_embedding", "rerank", "vlm", "stt", "tts"] as ModelType[]).map((type) => {
              const customModelsByType = customModels.filter((model) => model.type === type)
              const colorScheme = getModelColorScheme(type)

              if (customModelsByType.length === 0) return null

              return (
                <button
                  key={type}
                  onClick={() => { setDeletingModelType(type); setSelectedSource(null) }}
                  disabled={type === "stt" || type === "tts"}
                  className={`p-3 flex justify-between rounded-md border transition-colors ${
                    type === "stt" || type === "tts"
                      ? `${colorScheme.border} bg-gray-100 cursor-not-allowed opacity-60`
                      : `${colorScheme.border} ${colorScheme.bg} hover:bg-opacity-80`
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${colorScheme.text}`}>
                      {getModelIcon(type)}
                    </div>
                    <div className="flex flex-col text-left">
                      <div className="font-medium">{getModelTypeName(type)}</div>
                      <div className="text-xs text-gray-500">
                        {t('model.dialog.delete.customModelCount', { count: customModelsByType.length })}
                        {(type === "stt" || type === "tts") && t('model.dialog.delete.unsupportedType')}
                      </div>
                    </div>
                  </div>
                  <RightOutlined className="h-5 w-5" />
                </button>
              )
            })}
          </div>

          {customModels.length === 0 && (
            <div className="text-center py-8 text-gray-500">{t('model.dialog.delete.noModels')}</div>
          )}
        </div>
      ) : selectedSource === null ? (
        <div className="space-y-4">
          <div className="flex items-center mb-2">
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
              {t('common.back')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(["openai", "silicon", "OpenAI-API-Compatible"] as ModelSource[]).map((source) => {
              const modelsOfSource = customModels.filter((model) => model.type === deletingModelType && model.source === source)
              if (modelsOfSource.length === 0) return null
              const colorScheme = getSourceColorScheme(source)
              const isLoading = loadingSource === source
              return (
                <button
                  key={source}
                  onClick={async () => {
                    if (source === 'silicon') {
                      setLoadingSource(source)
                      try {
                        await prefetchSiliconProviderModels(deletingModelType)
                      } finally {
                        setLoadingSource(null)
                      }
                    }
                    setSelectedSource(source)
                  }}
                  disabled={isLoading}
                  className={`p-3 flex justify-between rounded-md border transition-colors ${colorScheme.border} ${colorScheme.bg} hover:bg-opacity-80 ${
                    isLoading ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${colorScheme.text}`}>
                      {isLoading ? (
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
                        getSourceIcon(source)
                      )}
                    </div>
                    <div className="flex flex-col text-left">
                      <div className="font-medium">{getSourceName(source)}</div>
                      <div className="text-xs text-gray-500">
                        {t('model.dialog.delete.customModelCount', { count: modelsOfSource.length })}
                      </div>
                    </div>
                  </div>
                  <RightOutlined className="h-5 w-5" />
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-4">
            <button
              onClick={() => { setSelectedSource(null); setProviderModels([]) }}
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
              {t('common.back')}
            </button>
          </div>

          {selectedSource === 'silicon' && providerModels.length > 0 ? (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
              {providerModels.map((providerModel: any) => {
                const checked = pendingSelectedProviderIds.has(providerModel.id)
                return (
                  <div key={providerModel.id} className="p-2 flex justify-between items-center hover:bg-gray-50 text-sm">
                    <div className="flex items-center min-w-0">
                      <span className="truncate" title={providerModel.id}>
                        {providerModel.id}
                      </span>
                      {providerModel.model_type && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600 uppercase">
                          {String(providerModel.model_tag)}
                        </span>
                      )}
                    </div>
                    <Switch
                      size="small"
                      checked={checked}
                      onChange={(value) => {
                        setPendingSelectedProviderIds(prev => {
                          const next = new Set(prev)
                          if (value) {
                            next.add(providerModel.id)
                          } else {
                            next.delete(providerModel.id)
                          }
                          return next
                        })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
              {customModels
                .filter((model) => model.type === deletingModelType && model.source === selectedSource)
                .map((model) => (
                  <div key={model.name}
                  onClick={() => handleEditModel(model)}
                  className="p-2 flex justify-between items-center hover:bg-gray-50 text-sm cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" title={model.name}>
                        {model.displayName || model.name} ({model.name})
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteModel(model.displayName || model.name);
                      }}
                      disabled={deletingModels.has(model.displayName || model.name) || model.type === "stt" || model.type === "tts"}
                      className={`p-1 ${
                        model.type === "stt" || model.type === "tts"
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-red-500 hover:text-red-700"
                      }`}
                      title={model.type === "stt" || model.type === "tts" ? t('model.dialog.delete.unsupportedTypeHint') : t('model.dialog.delete.deleteHint')}
                    >
                      {deletingModels.has(model.displayName || model.name) ? (
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

              {customModels.filter((model) => model.type === deletingModelType && model.source === selectedSource).length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  {t('model.dialog.delete.noModelsOfType', { type: getModelTypeName(deletingModelType) })}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md text-xs text-yellow-700">
            <div>
              <div className="flex items-center mb-1">
                <ExclamationCircleFilled className="text-md text-yellow-500 mr-3" />
                <p className="font-bold text-medium">{t('common.notice')}</p>
              </div>
              <p className="mt-0.5 ml-6">
                {t('model.dialog.delete.warning')}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 编辑模型弹窗 */}
      <ModelEditDialog
        isOpen={!!editModel}
        model={editModel}
        onClose={() => setEditModel(null)}
        onSuccess={async () => {
          await onSuccess()
          // 关闭后如果当前列表类型为空，则返回上一层
          if (editModel && deletingModelType && editModel.type !== deletingModelType) {
            setDeletingModelType(null)
          }
        }}
      />
    </Modal>
  )
}