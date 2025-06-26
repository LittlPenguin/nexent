"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { message, Modal } from "antd"
import { ExclamationCircleOutlined } from '@ant-design/icons'
import AppModelConfig from "./modelSetup/config"
import DataConfig from "./knowledgeBaseSetup/KnowledgeBaseManager"
import AgentConfig from "./agentSetup/AgentConfig"
import { configStore } from "@/lib/config"
import { configService } from "@/services/configService"
import modelEngineService, { ConnectionStatus } from "@/services/modelEngineService"
import { useAuth } from "@/hooks/useAuth"
import Layout from "./layout"
import { useTranslation } from 'react-i18next'
import { userConfigService } from "@/services/userConfigService"
import { useKnowledgeBaseContext } from "./knowledgeBaseSetup/knowledgeBase/KnowledgeBaseContext"
import { KnowledgeBase } from "@/types/knowledgeBase"
import { API_ENDPOINTS } from "@/services/api"
import { getAuthHeaders } from '@/lib/auth'

export default function CreatePage() {
  const [selectedKey, setSelectedKey] = useState("1")
  const router = useRouter()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("processing")
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isFromSecondPage, setIsFromSecondPage] = useState(false)
  const { user, isLoading: userLoading, openLoginModal } = useAuth()
  const { confirm } = Modal
  const { state: { knowledgeBases, selectedIds }, saveUserSelectedKnowledgeBases } = useKnowledgeBaseContext()
  const { t } = useTranslation()


  // Check login status and permission
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        // user not logged in, show login prompt
        confirm({
          title: t('login.expired.title'),
          icon: <ExclamationCircleOutlined />,
          content: t('login.expired.content'),
          okText: t('login.expired.okText'),
          cancelText: t('login.expired.cancelText'),
          closable: false,
          onOk() {
            openLoginModal();
          },
          onCancel() {
            router.push('/');
          }
        });
        return
      }

      // If the user is not an admin and currently on the first page, automatically jump to the second page
      if (user.role !== "admin" && selectedKey === "1") {
        setSelectedKey("2")
      }

      // If the user is not an admin and currently on the third page, force jump to the second page
      if (user.role !== "admin" && selectedKey === "3") {
        setSelectedKey("2")
      }
    }
  }, [user, userLoading, selectedKey, confirm, openLoginModal, router])

  // Check the connection status when the page is initialized
  useEffect(() => {
    // Trigger knowledge base data acquisition only when the page is initialized
    window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
      detail: { forceRefresh: true }
    }))

    // Load config for normal user
    const loadConfigForNormalUser = async () => {
      if (user && user.role !== "admin") {
        try {
          await configService.loadConfigToFrontend()
          await configStore.reloadFromStorage()
        } catch (error) {
          console.error("加载配置失败:", error)
        }
      }
    }

    loadConfigForNormalUser()

    // Check if the knowledge base configuration option card needs to be displayed
    const showPageConfig = localStorage.getItem('show_page')
    if (showPageConfig) {
      setSelectedKey(showPageConfig)
      localStorage.removeItem('show_page')
    }
  }, [user])

  // Listen for changes in selectedKey, refresh knowledge base data when entering the second page
  useEffect(() => {
    if (selectedKey === "2") {
      // When entering the second page, reset the flag
      setIsFromSecondPage(false)
      // Clear all possible caches
      localStorage.removeItem('preloaded_kb_data');
      localStorage.removeItem('kb_cache');
      // When entering the second page, get the latest knowledge base data
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
        detail: { forceRefresh: true }
      }))
    }
    checkModelEngineConnection()
  }, [selectedKey])

  // Function to check the ModelEngine connection status
  const checkModelEngineConnection = async () => {
    setIsCheckingConnection(true)

    try {
      const result = await modelEngineService.checkConnection()
      setConnectionStatus(result.status)
      setLastChecked(result.lastChecked)
    } catch (error) {
      console.error(t('setup.page.error.checkConnection'), error)
      setConnectionStatus("error")
    } finally {
      setIsCheckingConnection(false)
    }
  }

  // Add a function to display the number of selected knowledge bases
  const getSelectedKnowledgeBasesInfo = () => {
    const selectedKbs = knowledgeBases.filter(kb => selectedIds.includes(kb.id));
    console.log('💾 selectedKbs:', selectedKbs);
    return `已选择 ${selectedKbs.length} 个知识库`;
  };

  // Calculate the effective selectedKey, ensure that non-admin users get the correct page status
  const getEffectiveSelectedKey = () => {
    if (!user) return selectedKey;

    if (user.role !== "admin") {
      // If the current page is the first or third page, return the second page
      if (selectedKey === "1" || selectedKey === "3") {
        return "2";
      }
    }

    return selectedKey;
  };

  const renderContent = () => {
    // If the user is not an admin and attempts to access the first page, force display the second page content
    if (user?.role !== "admin" && selectedKey === "1") {
      return <DataConfig />
    }

    // If the user is not an admin and attempts to access the third page, force display the second page content
    if (user?.role !== "admin" && selectedKey === "3") {
      return <DataConfig />
    }

    switch (selectedKey) {
      case "1":
        return <AppModelConfig skipModelVerification={isFromSecondPage} />
      case "2":
        return <DataConfig isActive={selectedKey === "2"} />
      case "3":
        return <AgentConfig />
      default:
        return null
    }
  }

  // Handle completed configuration
  const handleCompleteConfig = async () => {
    if (selectedKey === "3") {
      // when finish the config in the third step, check if the necessary steps are completed
      try {
        // trigger a custom event to get the Agent configuration status
        const agentConfigData = await new Promise<{businessLogic: string, systemPrompt: string}>((resolve) => {
          const handleAgentConfigResponse = (event: Event) => {
            const customEvent = event as CustomEvent;
            resolve(customEvent.detail);
            window.removeEventListener('agentConfigDataResponse', handleAgentConfigResponse);
          };
          
          window.addEventListener('agentConfigDataResponse', handleAgentConfigResponse);
          window.dispatchEvent(new CustomEvent('getAgentConfigData'));
          
          // set a timeout to prevent infinite waiting
          setTimeout(() => {
            window.removeEventListener('agentConfigDataResponse', handleAgentConfigResponse);
            resolve({businessLogic: '', systemPrompt: ''});
          }, 1000);
        });

        // check if the business description is filled
        if (!agentConfigData.businessLogic || agentConfigData.businessLogic.trim() === '') {
          message.error(t('agent.message.businessDescriptionRequired'));
          return; // prevent continue
        }

        // check if the system prompt is generated
        if (!agentConfigData.systemPrompt || agentConfigData.systemPrompt.trim() === '') {
          message.error(t('systemPrompt.message.empty'));
          return; // prevent continue
        }

        // if the check is passed, continue to execute the save configuration logic
        setIsSavingConfig(true)
        // Get the current global configuration
        const currentConfig = configStore.getConfig()
        
        // Call the backend save configuration API
        const saveResult = await configService.saveConfigToBackend(currentConfig)
        
        if (saveResult) {
          message.success(t('setup.page.success.configSaved'))
          // After saving successfully, redirect to the chat page
          router.push("/chat")
        } else {
          message.error(t('setup.page.error.saveConfig'))
        }
      } catch (error) {
        console.error(t('setup.page.error.systemError'), error)
        message.error(t('setup.page.error.systemError'))
      } finally {
        setIsSavingConfig(false)
      }
    } else if (selectedKey === "2") {
      // If the user is an admin, jump to the third page; if the user is a normal user, complete the configuration directly and jump to the chat page
      if (user?.role === "admin") {
        setSelectedKey("3")
      } else {
        // Normal users complete the configuration directly on the second page
        try {
          setIsSavingConfig(true)

          // Reload the config for normal user before saving, ensure the latest model config
          await configService.loadConfigToFrontend()
          await configStore.reloadFromStorage()

          // Get the current global configuration
          const currentConfig = configStore.getConfig()

          // Check if the main model is configured
          if (!currentConfig.models.llm.modelName) {
            message.error("未找到模型配置，请联系管理员先完成模型配置")
            return
          }

          router.push("/chat")

        } catch (error) {
          console.error("保存配置异常:", error)
          message.error("系统异常，请稍后重试")
        } finally {
          setIsSavingConfig(false)
        }
      }
    } else if (selectedKey === "1") {
      // Validate required fields when jumping from the first page to the second page
      try {
        // Get the current configuration
        const currentConfig = configStore.getConfig()
        
        // Check the application name
        if (!currentConfig.app.appName.trim()) {
          message.error(t('setup.page.error.fillAppName'))
          
          // Trigger a custom event to notify the AppConfigSection to mark the application name input box as an error
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: t('setup.page.error.highlightField.appName') }
          }))
          
          return // Interrupt the jump
        }
        
        // Check the main model
        if (!currentConfig.models.llm.modelName) {
          message.error(t('setup.page.error.selectMainModel'))
          
          // Trigger a custom event to notify the ModelConfigSection to mark the main model dropdown as an error
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: t('setup.page.error.highlightField.llmMain') }
          }))
          
          return
        }
        
        // All required fields have been filled, allow the jump to the second page
        setSelectedKey("2")

        // Call the backend save configuration API
        await configService.saveConfigToBackend(currentConfig)
      } catch (error) {
        console.error(t('setup.page.error.systemError'), error)
        message.error(t('setup.page.error.systemError'))
      }
    }
  }

  // Handle the logic of the user switching to the first page
  const handleBackToFirstPage = () => {
    if (selectedKey === "3") {
      setSelectedKey("2")
    } else if (selectedKey === "2") {
      // Only admins can return to the first page
      if (user?.role !== "admin") {
        message.error(t('setup.page.error.adminOnly'))
        return
      }
      setSelectedKey("1")
      // Set the flag to indicate that the user is returning from the second page to the first page
      setIsFromSecondPage(true)
    }
  }

  return (
    <>
      <Layout
        connectionStatus={connectionStatus}
        lastChecked={lastChecked}
        isCheckingConnection={isCheckingConnection}
        onCheckConnection={checkModelEngineConnection}
        selectedKey={getEffectiveSelectedKey()}
        onBackToFirstPage={handleBackToFirstPage}
        onCompleteConfig={handleCompleteConfig}
        isSavingConfig={isSavingConfig}
        userRole={user?.role}
        showDebugButton={selectedKey === "3"}
      >
        {renderContent()}
      </Layout>
    </>
  )
}