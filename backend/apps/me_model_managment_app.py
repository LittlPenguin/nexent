import requests
from fastapi import Query, APIRouter

from consts.const import MODEL_ENGINE_APIKEY, MODEL_ENGINE_HOST
from consts.model import ModelConnectStatusEnum, ModelResponse
from services.model_health_service import check_me_model_connectivity

router = APIRouter(prefix="/me")


@router.get("/model/list", response_model=ModelResponse)
async def get_me_models(
        type: str = Query(default="", description="Model type: embed/chat/rerank"),
        timeout: int = Query(default=2, description="Request timeout in seconds")
):
    try:
        headers = {
            'Authorization': f'Bearer {MODEL_ENGINE_APIKEY}',
        }

        response = requests.get(
            f"{MODEL_ENGINE_HOST}/open/router/v1/models",
            headers=headers,
            verify=False,
            timeout=timeout
        )
        response.raise_for_status()
        result: list = response.json()['data']

        # Type filtering
        filtered_result = []
        if type:
            for data in result:
                if data['type'] == type:
                    filtered_result.append(data)
            if not filtered_result:
                result_types = set(data['type'] for data in result)
                return ModelResponse(
                    code=404,
                    message=f"No models found with type '{type}'. Available types: {result_types}",
                    data=[]
                )
        else:
            filtered_result = result

        return ModelResponse(
            code=200,
            message="Successfully retrieved",
            data=filtered_result
        )

    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Failed to get model list: {str(e)}",
            data=[]
        )


@router.get("/healthcheck", response_model=ModelResponse)
async def check_me_connectivity(timeout: int = Query(default=2, description="Timeout in seconds")):
    try:
        headers = {'Authorization': f'Bearer {MODEL_ENGINE_APIKEY}'}
        try:
            response = requests.get(
                f"{MODEL_ENGINE_HOST}/open/router/v1/models",
                headers=headers,
                verify=False,
                timeout=timeout
            )
        except requests.exceptions.Timeout:
            return ModelResponse(
                code=408,
                message="Connection timeout",
                data={"status": "Disconnected", "desc": "Connection timeout",
                      "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            )

        if response.status_code == 200:
            return ModelResponse(
                code=200,
                message="Connection successful",
                data={"status": "Connected", "desc": "Connection successful",
                      "connect_status": ModelConnectStatusEnum.AVAILABLE.value}
            )
        else:
            return ModelResponse(
                code=response.status_code,
                message=f"Connection failed, error code: {response.status_code}",
                data={"status": "Disconnected", "desc": f"Connection failed, error code: {response.status_code}",
                      "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            )

    except Exception as e:
        return ModelResponse(
            code=500,
            message=f"Unknown error occurred: {str(e)}",
            data={"status": "Disconnected", "desc": f"Unknown error occurred: {str(e)}",
                  "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
        )


@router.get("/model/healthcheck", response_model=ModelResponse)
async def check_me_model_healthcheck(
        model_name: str = Query(..., description="Model name to check")
):
    return await check_me_model_connectivity(model_name)
