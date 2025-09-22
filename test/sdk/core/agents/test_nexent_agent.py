from threading import Event
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Prepare mocks for external dependencies that are not required for this test
# ---------------------------------------------------------------------------

# Mock for smolagents and its sub-modules
mock_smolagents = MagicMock()

# Define lightweight classes to support isinstance checks in source code


class _ActionStep:
    pass


class _TaskStep:
    pass


class _AgentText:
    def __init__(self, content: str = ""):
        self._content = content

    def to_string(self):
        return self._content


# Expose these classes on the mocked smolagents module
mock_smolagents.ActionStep = _ActionStep
mock_smolagents.TaskStep = _TaskStep
mock_smolagents.AgentText = _AgentText
mock_smolagents.handle_agent_output_types = MagicMock()

# Mock for smolagents.tools.Tool with a configurable from_langchain method
mock_tool_class = MagicMock()
mock_tool_class.from_langchain = MagicMock()
mock_smolagents_tools = MagicMock()
mock_smolagents_tools.Tool = mock_tool_class
mock_smolagents.tools = mock_smolagents_tools

# Create dummy smolagents sub-modules that may be imported indirectly
for sub_mod in ["agents", "memory", "models", "monitoring", "utils", "local_python_executor"]:
    mock_module = MagicMock()
    setattr(mock_smolagents, sub_mod, mock_module)

# Mock for langchain and langchain.tools
mock_langchain_tools = MagicMock()
mock_langchain_tools.StructuredTool = MagicMock()
mock_langchain = MagicMock()
mock_langchain.tools = mock_langchain_tools

# Mock for OpenAIModel
mock_openai_model = MagicMock()
mock_openai_model_class = MagicMock(return_value=mock_openai_model)

# Mock for CoreAgent


class _TestCoreAgent:
    pass


mock_core_agent_class = _TestCoreAgent

# Very lightweight mock for openai path required by internal OpenAIModel import
mock_openai_chat_completion_message = MagicMock()
module_mocks = {
    "smolagents": mock_smolagents,
    "smolagents.tools": mock_smolagents_tools,
    "smolagents.agents": MagicMock(),
    "smolagents.memory": MagicMock(),
    "smolagents.models": MagicMock(),
    "smolagents.monitoring": MagicMock(),
    "smolagents.utils": MagicMock(),
    "smolagents.local_python_executor": MagicMock(),
    "langchain": mock_langchain,
    "langchain.tools": mock_langchain_tools,
    "openai": MagicMock(),
    "openai.types": MagicMock(),
    "openai.types.chat": MagicMock(),
    "openai.types.chat.chat_completion_message": MagicMock(ChatCompletionMessage=mock_openai_chat_completion_message),
    "openai.types.chat.chat_completion_message_param": MagicMock(),
    # Mock exa_py to avoid importing the real package when sdk.nexent.core.tools imports it
    "exa_py": MagicMock(Exa=MagicMock()),
    # Mock the OpenAIModel import
    "sdk.nexent.core.models.openai_llm": MagicMock(OpenAIModel=mock_openai_model_class),
    # Mock CoreAgent import
    "sdk.nexent.core.agents.core_agent": MagicMock(
        CoreAgent=mock_core_agent_class,
        convert_code_format=lambda s: s if isinstance(s, str) else str(s),
    ),
}

# ---------------------------------------------------------------------------
# Import the classes under test with patched dependencies in place
# ---------------------------------------------------------------------------
with patch.dict("sys.modules", module_mocks):
    from sdk.nexent.core.utils.observer import MessageObserver, ProcessType
    from sdk.nexent.core.agents.nexent_agent import NexentAgent, ActionStep, TaskStep
    from sdk.nexent.core.agents.agent_model import ToolConfig, ModelConfig, AgentConfig


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocks before each test to ensure clean state."""
    mock_openai_model_class.reset_mock()
    return None


@pytest.fixture(autouse=True)
def patch_convert_code_format():
    """Ensure convert_code_format returns a plain string for downstream re.sub."""
    import sys
    module = sys.modules.get("sdk.nexent.core.agents.nexent_agent")
    if module is None:
        # If the module is not imported yet, skip patching to avoid triggering imports
        yield
        return
    with patch.object(
        module,
        "convert_code_format",
        new=lambda s: s if isinstance(s, str) else str(s),
    ):
        yield


@pytest.fixture
def mock_observer():
    """Return a mocked MessageObserver instance."""
    observer = MagicMock(spec=MessageObserver)
    return observer


@pytest.fixture
def nexent_agent_instance(mock_observer):
    """Create a NexentAgent instance with minimal initialisation."""
    agent = NexentAgent(observer=mock_observer,
                        model_config_list=[], stop_event=Event())
    return agent


@pytest.fixture
def mock_model_config():
    """Create a mock ModelConfig instance for testing."""
    return ModelConfig(
        cite_name="test_model",
        api_key="test_api_key",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.7,
        top_p=0.9
    )


@pytest.fixture
def mock_deep_thinking_model_config():
    """Create a mock ModelConfig instance for deep thinking model testing."""
    return ModelConfig(
        cite_name="deep_thinking_model",
        api_key="test_api_key",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.5,
        top_p=0.8
    )


@pytest.fixture
def nexent_agent_with_models(mock_observer, mock_model_config, mock_deep_thinking_model_config):
    """Create a NexentAgent instance with model configurations."""
    model_config_list = [mock_model_config, mock_deep_thinking_model_config]
    agent = NexentAgent(observer=mock_observer,
                        model_config_list=model_config_list, stop_event=Event())
    return agent


@pytest.fixture
def mock_agent_config():
    """Create a mock AgentConfig instance for testing."""
    return AgentConfig(
        name="test_agent",
        description="A test agent",
        prompt_templates={"system": "You are a test agent"},
        tools=[],
        max_steps=5,
        model_name="test_model",
        provide_run_summary=False,
        managed_agents=[]
    )


@pytest.fixture
def mock_core_agent():
    """Create a mock CoreAgent instance for testing."""
    agent = mock_core_agent_class()
    agent.agent_name = "test_agent"
    agent.memory = MagicMock()
    agent.memory.steps = []
    agent.memory.reset = MagicMock()
    agent.observer = MagicMock()
    agent.stop_event = MagicMock()
    agent.run = MagicMock()  # Ensure .run exists and is mockable
    return agent


# ----------------------------------------------------------------------------
# Tests for __init__ method
# ----------------------------------------------------------------------------

def test_nexent_agent_initialization_success(mock_observer):
    """Test successful NexentAgent initialization."""
    stop_event = Event()
    agent = NexentAgent(observer=mock_observer,
                        model_config_list=[], stop_event=stop_event)

    assert agent.observer == mock_observer
    assert agent.model_config_list == []
    assert agent.stop_event == stop_event
    assert agent.agent is None
    assert agent.mcp_tool_collection is None


def test_nexent_agent_initialization_with_mcp_tools(mock_observer):
    """Test NexentAgent initialization with MCP tool collection."""
    stop_event = Event()
    mcp_tools = MagicMock()
    agent = NexentAgent(observer=mock_observer, model_config_list=[], stop_event=stop_event,
                        mcp_tool_collection=mcp_tools)

    assert agent.mcp_tool_collection == mcp_tools


def test_nexent_agent_initialization_invalid_observer():
    """Test NexentAgent initialization with invalid observer type."""
    stop_event = Event()
    invalid_observer = "not_a_message_observer"

    with pytest.raises(TypeError, match="Create Observer Object with MessageObserver"):
        NexentAgent(observer=invalid_observer,
                    model_config_list=[], stop_event=stop_event)


# ----------------------------------------------------------------------------
# Tests for create_model function
# ----------------------------------------------------------------------------

def test_create_model_success(nexent_agent_with_models, mock_model_config):
    """Test successful model creation with regular model."""
    # Use the existing mock that was set up at the top of the file
    mock_model_instance = MagicMock()
    mock_openai_model_class.return_value = mock_model_instance

    # Call the method under test
    result = nexent_agent_with_models.create_model("test_model")

    # Verify the result
    assert result == mock_model_instance

    # Verify OpenAIModel was constructed with correct parameters
    mock_openai_model_class.assert_called_once_with(
        observer=nexent_agent_with_models.observer,
        model_id=mock_model_config.model_name,
        api_key=mock_model_config.api_key,
        api_base=mock_model_config.url,
        temperature=mock_model_config.temperature,
        top_p=mock_model_config.top_p
    )

    # Verify stop_event was set
    assert result.stop_event == nexent_agent_with_models.stop_event


def test_create_model_deep_thinking_success(nexent_agent_with_models, mock_deep_thinking_model_config):
    """Test successful model creation with deep thinking model."""
    # Use the existing mock that was set up at the top of the file
    mock_model_instance = MagicMock()
    mock_openai_model_class.return_value = mock_model_instance

    # Call the method under test
    result = nexent_agent_with_models.create_model("deep_thinking_model")

    # Verify the result
    assert result == mock_model_instance

    # Verify OpenAIModel was constructed with correct parameters
    mock_openai_model_class.assert_called_once_with(
        observer=nexent_agent_with_models.observer,
        model_id=mock_deep_thinking_model_config.model_name,
        api_key=mock_deep_thinking_model_config.api_key,
        api_base=mock_deep_thinking_model_config.url,
        temperature=mock_deep_thinking_model_config.temperature,
        top_p=mock_deep_thinking_model_config.top_p
    )

    # Verify stop_event was set
    assert result.stop_event == nexent_agent_with_models.stop_event


def test_create_model_not_found(nexent_agent_with_models):
    """Test create_model raises ValueError when model cite_name is not found."""
    with pytest.raises(ValueError, match="Model nonexistent_model not found"):
        nexent_agent_with_models.create_model("nonexistent_model")


def test_create_model_empty_config_list(mock_observer):
    """Test create_model raises ValueError when model_config_list is empty."""
    agent = NexentAgent(observer=mock_observer,
                        model_config_list=[], stop_event=Event())

    with pytest.raises(ValueError, match="Model test_model not found"):
        agent.create_model("test_model")


def test_create_model_with_none_config_list(mock_observer):
    """Test create_model raises ValueError when model_config_list contains None."""
    agent = NexentAgent(observer=mock_observer, model_config_list=[
                        None], stop_event=Event())

    with pytest.raises(ValueError, match="Model test_model not found"):
        agent.create_model("test_model")


def test_create_model_with_multiple_configs(mock_observer):
    """Test create_model works correctly with multiple model configurations."""
    config1 = ModelConfig(
        cite_name="model1",
        api_key="key1",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.1,
        top_p=0.9
    )
    config2 = ModelConfig(
        cite_name="model2",
        api_key="key2",
        model_name="gpt-3.5-turbo",
        url="https://api.openai.com/v1",
        temperature=0.5,
        top_p=0.8
    )

    stop_event = Event()
    agent = NexentAgent(observer=mock_observer, model_config_list=[
                        config1, config2], stop_event=stop_event)

    # Use the existing mock that was set up at the top of the file
    mock_model = MagicMock()
    mock_openai_model_class.return_value = mock_model

    # Test creating first model
    result1 = agent.create_model("model1")
    assert result1 == mock_model

    # Test creating second model
    result2 = agent.create_model("model2")
    assert result2 == mock_model


# ----------------------------------------------------------------------------
# Tests for tool creation functions
# ----------------------------------------------------------------------------

def test_create_langchain_tool_success(nexent_agent_instance):
    """Verify that create_langchain_tool converts a LangChain tool via Tool.from_langchain."""
    mock_langchain_tool_obj = MagicMock(name="LangChainToolObject")

    tool_config = ToolConfig(
        class_name="MockLangChainTool",
        name="mock_tool",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="langchain",
        metadata={"inner_tool": mock_langchain_tool_obj},
    )

    with patch.object(
            mock_tool_class,
            "from_langchain",
            return_value="converted_tool",
    ) as mock_from_langchain:
        # Execute
        result = nexent_agent_instance.create_langchain_tool(tool_config)

    # Assertions
    mock_from_langchain.assert_called_once_with(
        {"inner_tool": mock_langchain_tool_obj})
    assert result == "converted_tool"


def test_create_tool_with_langchain_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_langchain_tool when source is 'langchain'."""
    mock_langchain_tool_obj = MagicMock()

    tool_config = ToolConfig(
        class_name="MockLangChainTool",
        name="mock_tool",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="langchain",
        metadata={},
    )

    with patch.object(
            nexent_agent_instance,
            "create_langchain_tool",
            return_value="converted_tool",
    ) as mock_create_langchain_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_langchain_tool.assert_called_once_with(tool_config)
    assert result == "converted_tool"


def test_create_tool_with_local_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_local_tool for local source."""
    tool_config = ToolConfig(
        class_name="DummyTool",
        name="dummy",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="local",
        metadata={},
    )

    with patch.object(
            nexent_agent_instance,
            "create_local_tool",
            return_value="local_tool",
    ) as mock_create_local_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_local_tool.assert_called_once_with(tool_config)
    assert result == "local_tool"


def test_create_tool_with_mcp_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_mcp_tool for mcp source."""
    tool_config = ToolConfig(
        class_name="DummyTool",
        name="dummy",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="mcp",
        metadata={},
    )

    with patch.object(
            nexent_agent_instance,
            "create_mcp_tool",
            return_value="mcp_tool",
    ) as mock_create_mcp_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_mcp_tool.assert_called_once_with("DummyTool")
    assert result == "mcp_tool"


def test_create_tool_invalid_source(nexent_agent_instance):
    """create_tool should raise ValueError for unsupported source."""
    tool_config = ToolConfig(
        class_name="DummyTool",
        name="dummy",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="unknown",
        metadata={},
    )
    with pytest.raises(ValueError, match="unsupported tool source: unknown"):
        nexent_agent_instance.create_tool(tool_config)


def test_create_tool_invalid_config_type(nexent_agent_instance):
    """create_tool should raise TypeError when passed a non-ToolConfig object."""
    with pytest.raises(TypeError, match="tool_config must be a ToolConfig object"):
        nexent_agent_instance.create_tool({})


def test_create_tool_exception_handling(nexent_agent_instance):
    """create_tool should handle exceptions and raise ValueError with error message."""
    tool_config = ToolConfig(
        class_name="DummyTool",
        name="dummy",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="local",
        metadata={},
    )

    with patch.object(
            nexent_agent_instance,
            "create_local_tool",
            side_effect=Exception("Tool creation failed"),
    ):
        with pytest.raises(ValueError, match="Error in creating tool: Tool creation failed"):
            nexent_agent_instance.create_tool(tool_config)


def test_create_single_agent_invalid_config_type(nexent_agent_instance):
    """Test create_single_agent raises TypeError with invalid config type."""
    with pytest.raises(TypeError, match="agent_config must be a AgentConfig object"):
        nexent_agent_instance.create_single_agent({})


def test_create_single_agent_tool_creation_error(nexent_agent_instance, mock_agent_config):
    """Test create_single_agent handles tool creation errors."""
    mock_agent_config.tools = [ToolConfig(
        class_name="TestTool",
        name="test",
        description="test",
        inputs="{}",
        output_type="string",
        params={},
        source="local",
        metadata={}
    )]

    with patch.object(nexent_agent_instance, 'create_model') as mock_create_model, \
            patch.object(nexent_agent_instance, 'create_tool', side_effect=Exception("Tool error")):
        mock_model = MagicMock()
        mock_create_model.return_value = mock_model

        with pytest.raises(ValueError, match="Error in creating tool: Tool error"):
            nexent_agent_instance.create_single_agent(mock_agent_config)


def test_create_single_agent_general_error(nexent_agent_instance, mock_agent_config):
    """Test create_single_agent handles general errors."""
    with patch.object(nexent_agent_instance, 'create_model', side_effect=Exception("General error")):
        with pytest.raises(ValueError, match="Error in creating agent, agent name: test_agent, Error: General error"):
            nexent_agent_instance.create_single_agent(mock_agent_config)


def test_add_history_to_agent_none_history(nexent_agent_instance, mock_core_agent):
    """Test add_history_to_agent handles None history gracefully."""
    nexent_agent_instance.agent = mock_core_agent

    # Should not raise any exception
    nexent_agent_instance.add_history_to_agent(None)

    # Memory should not be modified
    mock_core_agent.memory.reset.assert_not_called()
    assert len(mock_core_agent.memory.steps) == 0


def test_agent_run_with_observer_success_with_agent_text(nexent_agent_instance, mock_core_agent):
    """Test successful agent_run_with_observer with AgentText final answer."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = False

    # Mock step logs
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 1.5
    mock_action_step.error = None

    # Use an instance of our _AgentText so isinstance(..., AgentText) is valid
    mock_final_answer = _AgentText(
        "Final answer with <think>thinking</think> content")

    mock_core_agent.run.return_value = [mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = mock_final_answer

    # Execute
    nexent_agent_instance.agent_run_with_observer("test query")

    # Verify
    mock_core_agent.run.assert_called_once_with(
        "test query", stream=True, reset=True)
    mock_core_agent.observer.add_message.assert_any_call(
        "", ProcessType.TOKEN_COUNT, "1.5")
    mock_core_agent.observer.add_message.assert_any_call(
        "test_agent", ProcessType.FINAL_ANSWER, "Final answer with  content")


def test_agent_run_with_observer_success_with_string_final_answer(nexent_agent_instance, mock_core_agent):
    """Test successful agent_run_with_observer with string final answer."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = False

    # Mock step logs
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 2.0
    mock_action_step.error = None

    mock_core_agent.run.return_value = [mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = "String final answer with <think>thinking</think>"

    # Execute
    nexent_agent_instance.agent_run_with_observer("test query")

    # Verify
    mock_core_agent.observer.add_message.assert_any_call(
        "", ProcessType.TOKEN_COUNT, "2.0")
    mock_core_agent.observer.add_message.assert_any_call(
        "test_agent", ProcessType.FINAL_ANSWER, "String final answer with ")


def test_agent_run_with_observer_with_error_in_step(nexent_agent_instance, mock_core_agent):
    """Test agent_run_with_observer handles error in step log."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = False

    # Mock step logs with error
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 1.0
    mock_action_step.error = "Test error occurred"

    mock_core_agent.run.return_value = [mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = "Final answer"

    # Execute
    nexent_agent_instance.agent_run_with_observer("test query")

    # Verify error message was added
    mock_core_agent.observer.add_message.assert_any_call(
        "", ProcessType.ERROR, "Test error occurred")


def test_agent_run_with_observer_skips_non_action_step(nexent_agent_instance, mock_core_agent):
    """Test agent_run_with_observer skips non-ActionStep logs."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = False

    # Mock step logs with non-ActionStep
    mock_task_step = MagicMock(spec=TaskStep)
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 1.0
    mock_action_step.error = None

    mock_core_agent.run.return_value = [mock_task_step, mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = "Final answer"

    # Execute
    nexent_agent_instance.agent_run_with_observer("test query")

    # Verify only ActionStep was processed
    mock_core_agent.observer.add_message.assert_any_call(
        "", ProcessType.TOKEN_COUNT, "1.0")
    # Should not process TaskStep


def test_agent_run_with_observer_with_stop_event_set(nexent_agent_instance, mock_core_agent):
    """Test agent_run_with_observer handles stop event being set."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = True

    # Mock step logs
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 1.0
    mock_action_step.error = None

    mock_core_agent.run.return_value = [mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = "Final answer"

    # Execute
    nexent_agent_instance.agent_run_with_observer("test query")

    # Verify stop event message was added
    mock_core_agent.observer.add_message.assert_any_call(
        "test_agent", ProcessType.ERROR, "Agent execution interrupted by external stop signal"
    )


def test_agent_run_with_observer_with_exception(nexent_agent_instance, mock_core_agent):
    """Test agent_run_with_observer handles exceptions during execution."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.run.side_effect = Exception("Test execution error")

    # Execute and verify exception is raised
    with pytest.raises(ValueError, match="Error in interaction: Test execution error"):
        nexent_agent_instance.agent_run_with_observer("test query")

    # Verify error message was added to observer
    mock_core_agent.observer.add_message.assert_called_once_with(
        agent_name="test_agent", process_type=ProcessType.ERROR, content="Error in interaction: Test execution error"
    )


def test_agent_run_with_observer_with_reset_false(nexent_agent_instance, mock_core_agent):
    """Test agent_run_with_observer with reset=False parameter."""
    # Setup
    nexent_agent_instance.agent = mock_core_agent
    mock_core_agent.stop_event.is_set.return_value = False

    # Mock step logs
    mock_action_step = MagicMock(spec=ActionStep)
    mock_action_step.duration = 1.0
    mock_action_step.error = None

    mock_core_agent.run.return_value = [mock_action_step]
    mock_core_agent.run.return_value[-1].final_answer = "Final answer"

    # Execute with reset=False
    nexent_agent_instance.agent_run_with_observer("test query", reset=False)

    # Verify run was called with reset=False
    mock_core_agent.run.assert_called_once_with(
        "test query", stream=True, reset=False)


if __name__ == "__main__":
    pytest.main([__file__])
