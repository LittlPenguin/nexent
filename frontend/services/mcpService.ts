import i18n from 'i18next';

import { API_ENDPOINTS } from './api';
import { McpServer, McpTool } from '../types/agentConfig';

// Translation function
const t = (key: string, options?: any): string => {
  return i18n.t(key, options) as string;
};

// TODO: Use fetchWithAuth instead
// Get authorization headers helper function
const getAuthHeaders = () => {
  const session = typeof window !== "undefined" ? localStorage.getItem("session") : null;
  const sessionObj = session ? JSON.parse(session) : null;

  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
    ...(sessionObj?.access_token && { "Authorization": `Bearer ${sessionObj.access_token}` }),
  };
};

/**
 * Get MCP server list
 */
export const getMcpServerList = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.mcp.list, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      
      // Convert backend field names to frontend expected format
      const formattedData = (data.remote_mcp_server_list || []).map((server: any) => {
        return {
          service_name: server.remote_mcp_server_name,
          mcp_url: server.remote_mcp_server,
          status: server.status || false 
        };
      });
      
      return {
        success: true,
        data: formattedData,
        message: ''
      };
    } else {
      // Handle specific error information based on HTTP status code
      let errorMessage = data.message || t('mcpService.message.getServerListFailed');
      
      switch (response.status) {
        case 500:
          errorMessage = t('mcpService.message.getRemoteProxyFailed');
          break;
        case 503:
          errorMessage = t('mcpService.message.serviceUnavailable');
          break;
        default:
          errorMessage = data.message || t('mcpService.message.getServerListFailed');
      }
      
      return {
        success: false,
        data: [],
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.getServerListFailed'), error);
    return {
      success: false,
      data: [],
      message: t('mcpService.message.networkError')
    };
  }
};

/**
 * Add MCP server
 */
export const addMcpServer = async (mcpUrl: string, serviceName: string) => {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.mcp.add}?mcp_url=${encodeURIComponent(mcpUrl)}&service_name=${encodeURIComponent(serviceName)}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data,
        message: data.message || t('mcpService.message.addServerSuccess')
      };
    } else {
      // Handle specific error status codes and error information
      let errorMessage = data.message || t('mcpService.message.addServerFailed');
      
      if (response.status === 409) {
        errorMessage = t('mcpService.message.nameAlreadyUsed');
      } else if (response.status === 503) {
        errorMessage = t('mcpService.message.cannotConnectToServer');
      } else {
          errorMessage = t('mcpService.message.addProxyFailed');
      }
      
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.addServerFailed'), error);
    return {
      success: false,
      data: null,
      message: t('mcpService.message.networkError')
    };
  }
};

/**
 * Delete MCP server
 */
export const deleteMcpServer = async (mcpUrl: string, serviceName: string) => {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.mcp.delete}?mcp_url=${encodeURIComponent(mcpUrl)}&service_name=${encodeURIComponent(serviceName)}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data,
        message: data.message || t('mcpService.message.deleteServerSuccess')
      };
    } else {
      // Handle specific error information based on HTTP status code
      let errorMessage = data.message || t('mcpService.message.deleteServerFailed');
      
      switch (response.status) {
        case 500:
          errorMessage = t('mcpService.message.deleteProxyFailed');
          break;
        default:
          errorMessage = data.message || t('mcpService.message.deleteServerFailed');
      }
      
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.deleteServerFailed'), error);
    return {
      success: false,
      data: null,
      message: t('mcpService.message.networkError')
    };
  }
};

/**
 * Get tool list from remote MCP server
 */
export const getMcpTools = async (serviceName: string, mcpUrl: string) => {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.mcp.tools}?service_name=${encodeURIComponent(serviceName)}&mcp_url=${encodeURIComponent(mcpUrl)}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data.tools || [],
        message: ''
      };
    } else {
      // Handle specific error information based on HTTP status code
      let errorMessage = data.message || t('mcpService.message.getToolsFailed');
      
      switch (response.status) {
        case 500:
          errorMessage = t('mcpService.message.getToolsFromServerFailed');
          break;
        case 503:
          errorMessage = t('mcpService.message.cannotConnectToServer');
          break;
        default:
          errorMessage = data.message || t('mcpService.message.getToolsFailed');
      }
      
      return {
        success: false,
        data: [],
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.getToolsFailed'), error);
    return {
      success: false,
      data: [],
      message: t('mcpService.message.networkError')
    };
  }
};

/**
 * 更新工具列表及状态
 */
export const updateToolList = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.tool.updateTool, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data,
        message: data.message || t('mcpService.message.updateToolListSuccess')
      };
    } else {
      // Handle specific error information based on HTTP status code
      let errorMessage = data.message || t('mcpService.message.updateToolListFailed');
      
      switch (response.status) {
        case 500:
          errorMessage = t('mcpService.message.updateToolListBadRequest');
          break;
        case 503:
          errorMessage = t('mcpService.message.serviceUnavailable');
          break;
        default:
          errorMessage = data.message || t('mcpService.message.updateToolListFailed');
      }
      
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.updateToolListFailed'), error);
    return {
      success: false,
      data: null,
      message: t('mcpService.message.networkError')
    };
  }
};

/**
 * checkMcpServerHealth
 */
export const checkMcpServerHealth = async (mcpUrl: string, serviceName: string) => {
  try {
    const response = await fetch(
      `${API_ENDPOINTS.mcp.healthcheck}?mcp_url=${encodeURIComponent(mcpUrl)}&service_name=${encodeURIComponent(serviceName)}`,
      {
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data,
        message: data.message || t('mcpService.message.healthCheckSuccess')
      };
    } else {
      let errorMessage = data.message || t('mcpService.message.healthCheckFailed');
      if (response.status === 503) {
        errorMessage = t('mcpService.message.cannotConnectToServer');
      }
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  } catch (error) {
    console.error(t('mcpService.debug.healthCheckFailed'), error);
    return {
      success: false,
      data: null,
      message: t('mcpService.message.networkError')
    };
  }
};