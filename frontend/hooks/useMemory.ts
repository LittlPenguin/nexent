import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { pageSize, shareLabels, MemoryGroup } from "@/types/memory"
import {
  loadMemoryConfig,
  setMemorySwitch,
  setMemoryAgentShare,
  fetchTenantSharedGroup,
  fetchAgentSharedGroups,
  fetchUserPersonalGroup,
  fetchUserAgentGroups,
  addDisabledAgentId,
  removeDisabledAgentId,
  addDisabledUserAgentId,
  removeDisabledUserAgentId,
  addMemory,
  clearMemory,
  deleteMemory,
} from "@/services/memoryService"


interface UseMemoryOptions {
  visible: boolean
  currentUserId: string
  currentTenantId: string
  message?: any
}

export function useMemory({ visible, currentUserId, currentTenantId, message }: UseMemoryOptions) {
  const { t } = useTranslation()
  /* ----------------------- 基础设置状态 ----------------------- */
  const [memoryEnabled, setMemoryEnabledState] = useState<boolean>(true)
  const [shareOption, setShareOptionState] = useState<"always" | "ask" | "never">("always")

  /* ------------------------- 原逻辑状态 ------------------------- */
  // 分组禁用状态（仅 Agent 共享、用户 Agent 页签生效）
  const [disabledGroups, setDisabledGroups] = useState<Record<string, boolean>>({})

  const disableAgentIdSet = useRef<Set<string>>(new Set())
  const disableUserAgentIdSet = useRef<Set<string>>(new Set())

  const [openKey, setOpenKey] = useState<string>()

  // 当前激活 Tab
  const [activeTabKey, setActiveTabKey] = useState<string>("base")

  // 分页状态
  const [pageMap, setPageMap] = useState<Record<string, number>>({ agentShared: 1, userAgent: 1 })

  /* ------------------------------ 数据分组 ------------------------------ */
  const [tenantSharedGroup, setTenantSharedGroup] = useState<MemoryGroup>({ title: "", key: "tenant", items: [] })
  const [agentSharedGroups, setAgentSharedGroups] = useState<MemoryGroup[]>([])
  const [userPersonalGroup, setUserPersonalGroup] = useState<MemoryGroup>({ title: "", key: "user-personal", items: [] })
  const [userAgentGroups, setUserAgentGroups] = useState<MemoryGroup[]>([])

  /* ------------------------------ 新增记忆状态 ------------------------------ */
  const [addingMemoryKey, setAddingMemoryKey] = useState<string | null>(null)
  const [newMemoryContent, setNewMemoryContent] = useState<string>("")
  const [isAddingMemory, setIsAddingMemory] = useState<boolean>(false)

  /* --------------------------- 初始化加载 --------------------------- */
  useEffect(() => {
    if (!visible) return

    // 1. 加载配置
    loadMemoryConfig().then((cfg) => {
      setMemoryEnabledState(cfg.memoryEnabled)
      setShareOptionState(cfg.shareOption)
      disableAgentIdSet.current = new Set(cfg.disableAgentIds)
      disableUserAgentIdSet.current = new Set(cfg.disableUserAgentIds)
    }).catch((e) => {
      console.error("Failed to load memory config:", e)
      message.error(t('useMemory.loadConfigError'))
    })
  }, [visible, message])

  /* --------------------------- 加载分组数据 --------------------------- */
  useEffect(() => {
    if (!visible || !memoryEnabled) return

    const loadGroupsForActiveTab = async () => {
      try {
        if (activeTabKey === "tenant") {
          const tenantGrp = await fetchTenantSharedGroup()
          setTenantSharedGroup(tenantGrp)
        } else if (activeTabKey === "agentShared") {
          const agentGrps = await fetchAgentSharedGroups()
          setAgentSharedGroups(agentGrps)

          // 同步禁用状态
          const newDisabled: Record<string, boolean> = {}
          agentGrps.forEach((g) => {
            const id = g.key.replace(/^agent-/, "")
            if (disableAgentIdSet.current.has(id)) newDisabled[g.key] = true
          })
          setDisabledGroups((prev) => ({ ...prev, ...newDisabled }))
        } else if (activeTabKey === "userPersonal") {
          const userGrp = await fetchUserPersonalGroup()
          setUserPersonalGroup(userGrp)
        } else if (activeTabKey === "userAgent") {
          const userAgentGrps = await fetchUserAgentGroups()
          setUserAgentGroups(userAgentGrps)

          // 同步禁用状态
          const newDisabled: Record<string, boolean> = {}
          userAgentGrps.forEach((g) => {
            const id = g.key.replace(/^user-agent-/, "")
            if (disableUserAgentIdSet.current.has(id)) newDisabled[g.key] = true
          })
          setDisabledGroups((prev) => ({ ...prev, ...newDisabled }))
        }
      } catch (e) {
        console.error("load groups error", e)
        const errorMessage = e instanceof Error ? e.message : "加载记忆数据失败"
        if (errorMessage.includes("Authentication") || errorMessage.includes("ElasticSearch") || errorMessage.includes("连接")) {
          message.error(t('useMemory.memoryServiceConnectionError'))
        } else {
          message.error(t('useMemory.loadDataError'))
        }
      }
    }

    loadGroupsForActiveTab()
  }, [visible, memoryEnabled, activeTabKey, currentTenantId, currentUserId])

  /* --------------------------- 工具方法 --------------------------- */
  const toggleGroup = useCallback((key: string, enabled: boolean) => {
    setDisabledGroups((prev) => ({ ...prev, [key]: !enabled }))

    const isAgentGroup = key.startsWith("agent-")
    const isUserAgentGroup = key.startsWith("user-agent-")
    const agentId = key.split("-").slice(-1)[0]

    if (!enabled) {
      // 关闭 -> 添加到禁用列表
      if (isAgentGroup) {
        addDisabledAgentId(agentId)
        disableAgentIdSet.current.add(agentId)
      } else if (isUserAgentGroup) {
        addDisabledUserAgentId(agentId)
        disableUserAgentIdSet.current.add(agentId)
      }
    } else {
      // 开启 -> 从禁用列表移除
      if (isAgentGroup) {
        removeDisabledAgentId(agentId)
        disableAgentIdSet.current.delete(agentId)
      } else if (isUserAgentGroup) {
        removeDisabledUserAgentId(agentId)
        disableUserAgentIdSet.current.delete(agentId)
      }
    }

    // 关闭时折叠该 panel
    if (!enabled) {
      setOpenKey((prev) => (prev === key ? undefined : prev))
    }
  }, [])

  const getGroupsForTab = (tabKey: string): MemoryGroup[] => {
    switch (tabKey) {
      case "tenant":
        return [tenantSharedGroup]
      case "agentShared":
        return agentSharedGroups
      case "userPersonal":
        return [userPersonalGroup]
      case "userAgent":
        return userAgentGroups
      default:
        return []
    }
  }

  /**
   * Compute memoryLevel and agentId according to current tab & group key.
   * Abstracted to avoid duplication.
   */
  const _computeMemoryParams = (tabKey: string, key: string): { memoryLevel: string; agentId?: string } => {
    switch (tabKey) {
      case "tenant":
        return { memoryLevel: "tenant" }
      case "agentShared":
        return { memoryLevel: "agent", agentId: key.replace(/^agent-/, "") }
      case "userPersonal":
        return { memoryLevel: "user" }
      case "userAgent":
        return { memoryLevel: "user_agent", agentId: key.replace(/^user-agent-/, "") }
      default:
        return { memoryLevel: "" }
    }
  }

  // 延迟工具：等待后端索引刷新后再重新拉取数据
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  /* ------------------------------ 新增记忆相关方法 ------------------------------ */
  const startAddingMemory = useCallback((groupKey: string) => {
    setAddingMemoryKey(groupKey)
    setNewMemoryContent("")
    setOpenKey(groupKey) // 确保分组展开
  }, [])

  const cancelAddingMemory = useCallback(() => {
    setAddingMemoryKey(null)
    setNewMemoryContent("")
  }, [])

  const confirmAddingMemory = useCallback(async () => {
    if (!addingMemoryKey || !newMemoryContent.trim()) return

    setIsAddingMemory(true)
    try {
      // 根据当前页签和分组确定memory_level和agent_id
      let memoryLevel = ""
      let agentId: string | undefined

      if (activeTabKey === "tenant") {
        memoryLevel = "tenant"
      } else if (activeTabKey === "agentShared") {
        memoryLevel = "agent"
        agentId = addingMemoryKey.replace(/^agent-/, "")
      } else if (activeTabKey === "userPersonal") {
        memoryLevel = "user"
      } else if (activeTabKey === "userAgent") {
        memoryLevel = "user_agent"
        agentId = addingMemoryKey.replace(/^user-agent-/, "")
      }

      const messages = [{ role: "user", content: newMemoryContent.trim() }]
      // 前端手动触发infer=False避免调用LLM
      await addMemory(messages, memoryLevel, agentId, false)

      await delay(600);
      message.success(t('useMemory.addMemorySuccess'))
      cancelAddingMemory()

      // 重新加载当前页签数据
      const loadGroupsForActiveTab = async () => {
        try {
          if (activeTabKey === "tenant") {
            const tenantGrp = await fetchTenantSharedGroup()
            setTenantSharedGroup(tenantGrp)
          } else if (activeTabKey === "agentShared") {
            const agentGrps = await fetchAgentSharedGroups()
            setAgentSharedGroups(agentGrps)
          } else if (activeTabKey === "userPersonal") {
            const userGrp = await fetchUserPersonalGroup()
            setUserPersonalGroup(userGrp)
          } else if (activeTabKey === "userAgent") {
            const userAgentGrps = await fetchUserAgentGroups()
            setUserAgentGroups(userAgentGrps)
          }
        } catch (e) {
          console.error("Reload groups error:", e)
        }
      }
      await loadGroupsForActiveTab()
    } catch (e) {
      console.error("Add memory error:", e)
      const errorMessage = e instanceof Error ? e.message : "添加记忆失败"
      if (errorMessage.includes("Authentication") || errorMessage.includes("ElasticSearch")) {
        message.error(t('useMemory.memoryServiceConnectionError'))
      } else {
        message.error(t('useMemory.addMemoryError'))
      }
    } finally {
      setIsAddingMemory(false)
    }
  }, [addingMemoryKey, newMemoryContent, activeTabKey, currentTenantId, currentUserId])

  /* ------------------------------ 清空记忆相关方法 ------------------------------ */
  const handleClearMemory = useCallback(async (groupKey: string, groupTitle: string) => {
    try {
      const { memoryLevel, agentId } = _computeMemoryParams(activeTabKey, groupKey)
      const result = await clearMemory(memoryLevel, agentId)
      await delay(300);
      message.success(t('useMemory.clearMemorySuccess', { groupTitle, count: result.deleted_count }))

      // 重新加载当前页签数据
      const loadGroupsForActiveTab = async () => {
        try {
          if (activeTabKey === "tenant") {
            const tenantGrp = await fetchTenantSharedGroup()
            setTenantSharedGroup(tenantGrp)
          } else if (activeTabKey === "agentShared") {
            const agentGrps = await fetchAgentSharedGroups()
            setAgentSharedGroups(agentGrps)
          } else if (activeTabKey === "userPersonal") {
            const userGrp = await fetchUserPersonalGroup()
            setUserPersonalGroup(userGrp)
          } else if (activeTabKey === "userAgent") {
            const userAgentGrps = await fetchUserAgentGroups()
            setUserAgentGroups(userAgentGrps)
          }
        } catch (e) {
          console.error("Reload groups error:", e)
        }
      }

      await loadGroupsForActiveTab()
    } catch (e) {
      console.error("Clear memory error:", e)
      const errorMessage = e instanceof Error ? e.message : "清空记忆失败"
      if (errorMessage.includes("Authentication") || errorMessage.includes("ElasticSearch")) {
        message.error(t('useMemory.memoryServiceConnectionError'))
      } else {
        message.error(t('useMemory.clearMemoryError'))
      }
    }
  }, [activeTabKey, currentTenantId, currentUserId])

  /* ------------------- Delete Memory With Optimistic Update ------------------- */
  const handleDeleteMemory = useCallback(async (memoryId: string, groupKey: string) => {
    const { memoryLevel, agentId } = _computeMemoryParams(activeTabKey, groupKey)

    // Local optimistic removal
    const { removedItem, removedIndex } = _optimisticRemoveItem(memoryId, groupKey)

    // Call the backend to delete, if failed, rollback
    try {
      await deleteMemory(memoryId, memoryLevel, agentId)
      message.success(t('useMemory.deleteMemorySuccess'))
    } catch (e) {
      _rollbackRemoveItem(removedItem, removedIndex, groupKey)

      console.error("Delete memory error:", e)
      const errorMessage = e instanceof Error ? e.message : "memory delete failed"
      if (errorMessage.includes("Authentication") || errorMessage.includes("ElasticSearch")) {
        message.error(t('useMemory.memoryServiceConnectionError'))
      } else {
        message.error(t('useMemory.deleteMemoryError'))
      }
    }
  }, [activeTabKey, currentTenantId, currentUserId])

  /* ---------------------- Tab 切换时展开第一个分组 ---------------------- */
  useEffect(() => {
    const groups = getGroupsForTab(activeTabKey).filter((g) => !disabledGroups[g.key])
    setOpenKey(groups.length ? groups[0].key : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabKey, disabledGroups])

  /* ----------------- 弹窗首次打开时展开当前 Tab 的首个分组 ---------------- */
  useEffect(() => {
    if (visible) {
      const groups = getGroupsForTab(activeTabKey).filter((g) => !disabledGroups[g.key])
      setOpenKey(groups.length ? groups[0].key : undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, disabledGroups])

  /* ----------------- memoryEnabled 或 shareOption 变动时处理 ---------------- */
  useEffect(() => {
    if (!memoryEnabled && activeTabKey !== "base") {
      setActiveTabKey("base")
    }
  }, [memoryEnabled])

  useEffect(() => {
    if (shareOption === "never" && activeTabKey === "agentShared") {
      setActiveTabKey("base")
    }
  }, [shareOption])

  // ----------------- 分页切换后保持 openKey 合法 -----------------
  useEffect(() => {
    if (activeTabKey === "agentShared" || activeTabKey === "userAgent") {
      const groups = getGroupsForTab(activeTabKey).filter((g) => !disabledGroups[g.key])
      const currentPage = pageMap[activeTabKey] || 1
      const startIdx = (currentPage - 1) * pageSize
      const visibleGroups = groups.slice(startIdx, startIdx + pageSize)
      if (visibleGroups.length && !visibleGroups.some((g) => g.key === openKey)) {
        setOpenKey(visibleGroups[0].key)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabKey, pageMap])

  /* ------------------- 包装后的 setter ------------------- */
  const setMemoryEnabled = useCallback((enabled: boolean) => {
    setMemoryEnabledState(enabled)
    setMemorySwitch(enabled).catch((e) => {
      console.error("setMemorySwitch error:", e)
      message.error(t('useMemory.setMemorySwitchError'))
    })
  }, [])

  const setShareOption = useCallback((option: "always" | "ask" | "never") => {
    setShareOptionState(option)
    setMemoryAgentShare(option).catch((e) => {
      console.error("setMemoryAgentShare error:", e)
      message.error(t('useMemory.setMemoryShareOptionError'))
    })
  }, [message])

  /**
   * Optimistically remove a memory item from local state.
   * Returns the removed item and its index for rollback.
   */
  const _optimisticRemoveItem = (
    id: string,
    groupKey: string,
  ): { removedItem?: any; removedIndex: number } => {
    let removedItem: any | undefined
    let removedIndex = -1

    const process = (items: any[]): any[] => {
      const idx = items.findIndex((it: any) => it.id === id)
      if (idx !== -1) {
        removedItem = items[idx]
        removedIndex = idx
        return items.filter((it: any) => it.id !== id)
      }
      return items
    }

    if (activeTabKey === "tenant") {
      setTenantSharedGroup((prev) => ({ ...prev, items: process(prev.items) }))
    } else if (activeTabKey === "agentShared") {
      setAgentSharedGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, items: process(g.items) } : g)))
    } else if (activeTabKey === "userPersonal") {
      setUserPersonalGroup((prev) => ({ ...prev, items: process(prev.items) }))
    } else if (activeTabKey === "userAgent") {
      setUserAgentGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, items: process(g.items) } : g)))
    }

    return { removedItem, removedIndex }
  }

  /**
   * Rollback by re-inserting item at original index when optimistic update fails.
   */
  const _rollbackRemoveItem = (
    item: any,
    index: number,
    groupKey: string,
  ) => {
    if (!item || index < 0) return

    const insert = (items: any[]): any[] => {
      return [...items.slice(0, index), item, ...items.slice(index)]
    }

    if (activeTabKey === "tenant") {
      setTenantSharedGroup((prev) => ({ ...prev, items: insert(prev.items) }))
    } else if (activeTabKey === "agentShared") {
      setAgentSharedGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, items: insert(g.items) } : g)))
    } else if (activeTabKey === "userPersonal") {
      setUserPersonalGroup((prev) => ({ ...prev, items: insert(prev.items) }))
    } else if (activeTabKey === "userAgent") {
      setUserAgentGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, items: insert(g.items) } : g)))
    }
  }

  return {
    // state & setter
    memoryEnabled,
    setMemoryEnabled,
    shareOption,
    setShareOption,
    disabledGroups,
    toggleGroup,
    openKey,
    setOpenKey,
    activeTabKey,
    setActiveTabKey,
    pageMap,
    setPageMap,
    // computed
    tenantSharedGroup,
    agentSharedGroups,
    userPersonalGroup,
    userAgentGroups,
    pageSize,
    shareLabels,
    getGroupsForTab,
    // 新增记忆相关
    addingMemoryKey,
    newMemoryContent,
    setNewMemoryContent,
    isAddingMemory,
    startAddingMemory,
    cancelAddingMemory,
    confirmAddingMemory,
    // 清空记忆相关
    handleClearMemory,
    // 删除记忆相关
    handleDeleteMemory,
  }
}
