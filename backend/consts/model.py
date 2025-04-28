from enum import Enum
from typing import Optional, Any, List, Dict

from pydantic import BaseModel, Field, EmailStr


class ModelConnectStatusEnum(Enum):
    """Enum class for model connection status"""
    NOT_DETECTED = "未检测"
    DETECTING = "检测中"
    AVAILABLE = "可用"
    UNAVAILABLE = "不可用"

    @classmethod
    def get_default(cls) -> str:
        """Get default value"""
        return cls.NOT_DETECTED.value

    @classmethod
    def get_value(cls, status: Optional[str]) -> str:
        """Get value based on status, return default value if empty"""
        if not status or status == "":
            return cls.NOT_DETECTED.value
        return status


# Request models for user authentication
class UserSignUpRequest(BaseModel):
    """User registration request model"""
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserSignInRequest(BaseModel):
    """User login request model"""
    email: EmailStr
    password: str

class UserUpdateRequest(BaseModel):
    """User information update request model"""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = None

# Response models for user management
class ServiceResponse(BaseModel):
    code: int
    message: str
    data: Optional[Any] = None

# Response models for model management
class ModelResponse(BaseModel):
    code: int = 200
    message: str = ""
    data: Any


# Request models
class ModelRequest(BaseModel):
    model_factory: Optional[str] = 'OpenAI-API-Compatible'
    model_name: str
    model_type: str
    api_key: Optional[str] = ''
    base_url: Optional[str] = ''
    max_tokens: Optional[int] = 0
    used_token: Optional[int] = 0
    display_name: Optional[str] = ''
    connect_status: Optional[str] = ''


# Configuration models
class ModelApiConfig(BaseModel):
    apiKey: str
    modelUrl: str


class SingleModelConfig(BaseModel):
    modelName: str
    displayName: str
    apiConfig: Optional[ModelApiConfig] = None


class ModelConfig(BaseModel):
    llm: SingleModelConfig
    llmSecondary: SingleModelConfig
    embedding: SingleModelConfig
    rerank: SingleModelConfig
    stt: SingleModelConfig
    tts: SingleModelConfig


class AppConfig(BaseModel):
    appName: str
    appDescription: str
    iconType: str
    customIconUrl: Optional[str] = None
    avatarUri: Optional[str] = None


class KnowledgeBaseConfig(BaseModel):
    selectedKbNames: List[str]
    selectedKbModels: List[str]
    selectedKbSources: List[str]


class GlobalConfig(BaseModel):
    app: AppConfig
    models: ModelConfig
    data: KnowledgeBaseConfig


# Request models
class AgentRequest(BaseModel):
    query: str
    conversation_id: Optional[int] = None
    is_set: Optional[bool] = False
    history: Optional[List[Dict]] = None
    minio_files: Optional[List[Dict[str, Any]]] = None  # Complete list of attachment information


# Request and response models
class MessageUnit(BaseModel):
    type: str
    content: str


class MessageRequest(BaseModel):
    conversation_id: int  # Modified to integer type to match database auto-increment ID
    message_idx: int  # Modified to integer type
    role: str
    message: List[MessageUnit]
    minio_files: Optional[List[Dict[str, Any]]] = None  # Complete list of attachment information


class ConversationRequest(BaseModel):
    title: str = "New Conversation"


class ConversationResponse(BaseModel):
    code: int = 0  # Modified default value to 0
    message: str = "success"
    data: Any


class RenameRequest(BaseModel):
    conversation_id: int
    name: str


class GenerateTitleRequest(BaseModel):
    conversation_id: int
    history: List[Dict[str, str]]


# Pydantic models for API
class TaskRequest(BaseModel):
    source: str
    source_type: str = "file"
    chunking_strategy: Optional[str] = None
    index_name: Optional[str] = None
    additional_params: Dict[str, Any] = Field(default_factory=dict)


class BatchTaskRequest(BaseModel):
    sources: List[Dict[str, Any]] = Field(..., description="List of source objects to process")


class TaskResponse(BaseModel):
    task_id: str


class BatchTaskResponse(BaseModel):
    task_ids: List[str]


class SimpleTaskStatusResponse(BaseModel):
    id: str
    status: str
    created_at: float
    updated_at: float
    error: Optional[str] = None


class SimpleTasksListResponse(BaseModel):
    tasks: List[SimpleTaskStatusResponse]


class FileInfo(BaseModel):
    path_or_url: str = Field(..., description="Document source path or URL")
    file: str = Field(..., description="File name or identifier")
    file_size: Optional[int] = Field(None, description="Size of the file in bytes")
    create_time: Optional[str] = Field(None, description="Creation time of the file")


class IndexInfo(BaseModel):
    base_info: Dict[str, Any]
    search_performance: Dict[str, Any]
    fields: List[str]
    doc_count: int
    chunk_count: int
    process_source: str
    embedding_model: Optional[str] = Field(None, description="Embedding model used")
    files: Optional[List[FileInfo]] = Field(None, description="List of files in the index")


class IndexingRequest(BaseModel):
    task_id: str
    index_name: str
    results: List[Dict[str, Any]]
    embedding_dim: Optional[int] = None


class IndexingResponse(BaseModel):
    success: bool
    message: str
    total_indexed: int
    total_submitted: int


class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    path_or_url: str
    language: Optional[str] = None
    author: Optional[str] = None
    date: Optional[str] = None
    content: str
    process_source: str
    embedding_model_name: Optional[str] = None
    file_size: Optional[int] = None
    create_time: Optional[str] = None
    score: Optional[float] = None


class SearchRequest(BaseModel):
    index_names: List[str] = Field(..., description="List of index names to search in")
    query: str = Field(..., description="Text query to search for")
    top_k: int = Field(5, description="Number of results to return")


class HybridSearchRequest(SearchRequest):
    weight_accurate: float = Field(0.3, description="Weight for accurate search score (0-1)", ge=0.0, le=1.0)


# Request models
class ProcessParams(BaseModel):
    chunking_strategy: Optional[str] = None
    index_name: str


class OpinionRequest(BaseModel):
    message_id: int
    opinion: Optional[str] = None
