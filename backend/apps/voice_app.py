import logging
from typing import Optional

from nexent.core.models.stt_model import STTModel, STTConfig
from nexent.core.models.tts_model import TTSModel, TTSConfig
from fastapi import WebSocket, APIRouter

logging.getLogger("uvicorn").setLevel(logging.INFO)

class VoiceService:
    """Unified voice service that hosts both STT and TTS on a single FastAPI application"""

    def __init__(self,
                 stt_config: Optional[STTConfig] = None,
                 tts_config: Optional[TTSConfig] = None):
        """
        Initialize the voice service with STT and TTS configurations.
        
        Args:
            stt_config: STT configuration. If None, loads from environment.
            tts_config: TTS configuration. If None, loads from environment.
        """
        self.stt_config = stt_config or STTConfig.from_env()
        self.tts_config = tts_config or TTSConfig.from_env()

        # Initialize models
        self.stt_model = STTModel(self.stt_config)
        self.tts_model = TTSModel(self.tts_config)

        # Create FastAPI application
        self.router = APIRouter(prefix="/voice")

        # Set up routes
        self._setup_routes()

    def _setup_routes(self):
        """Configure API routes for voice services"""

        # STT WebSocket route
        @self.router.websocket("/stt/ws")
        async def stt_websocket(websocket: WebSocket):
            """WebSocket endpoint for real-time audio streaming and STT"""
            print("STT WebSocket connection attempt...")
            await websocket.accept()
            print("STT WebSocket connection accepted")
            try:
                # Start streaming session
                await self.stt_model.start_streaming_session(websocket)
            except Exception as e:
                print(f"STT WebSocket error: {str(e)}")
                import traceback
                traceback.print_exc()
                await websocket.send_json({"error": str(e)})
            finally:
                print("STT WebSocket connection closed")

        # TTS WebSocket route
        @self.router.websocket("/tts/ws")
        async def tts_websocket(websocket: WebSocket):
            """WebSocket endpoint for streaming TTS"""
            print("TTS WebSocket connection attempt...")
            await websocket.accept()
            print("TTS WebSocket connection accepted")
            try:
                while True:
                    # Receive text from client
                    data = await websocket.receive_json()
                    text = data.get("text")
                    if not text:
                        await websocket.send_json({"error": "No text provided"})
                        continue

                    # Generate and stream audio chunks
                    try:
                        # First try to use it as a coroutine that returns an async iterator
                        speech_result = await self.tts_model.generate_speech(text, stream=True)

                        # Check if it's an async iterator or a regular iterable
                        if hasattr(speech_result, '__aiter__'):
                            # It's an async iterator, use async for
                            async for chunk in speech_result:
                                await websocket.send_bytes(chunk)
                        elif hasattr(speech_result, '__iter__'):
                            # It's a regular iterator, use normal for
                            for chunk in speech_result:
                                await websocket.send_bytes(chunk)
                        else:
                            # It's a single chunk, send it directly
                            await websocket.send_bytes(speech_result)

                    except TypeError as te:
                        # If speech_result is still a coroutine, try calling it directly without stream=True
                        if "async for" in str(te) and "requires an object with __aiter__" in str(te):
                            print("Falling back to non-streaming TTS")
                            speech_data = await self.tts_model.generate_speech(text, stream=False)
                            await websocket.send_bytes(speech_data)
                        else:
                            raise

                    # Send end marker after successful TTS generation
                    await websocket.send_json({"status": "completed"})

            except Exception as e:
                print(f"TTS WebSocket error: {str(e)}")
                import traceback
                traceback.print_exc()
                await websocket.send_json({"error": str(e)})
            finally:
                print("TTS WebSocket connection closed")

    async def check_connectivity(self, model_type: str) -> bool:
        """
        Check the connectivity status of voice services (STT and TTS)

        Args:
            model_type: The type of model to check, options are 'stt', 'tts'
        
        Returns:
            bool: Returns True if all services are connected normally, False if any service connection fails
        """
        try:
            stt_connected = False
            tts_connected = False

            if model_type == 'stt':
                logging.info(f'STT Config: {self.stt_config}')
                stt_connected = await self.stt_model.check_connectivity()
                if not stt_connected:
                    logging.error("Speech Recognition (STT) service connection failed")

            if model_type == 'tts':
                logging.info(f'TTS Config: {self.tts_config}')
                tts_connected = await self.tts_model.check_connectivity()
                if not tts_connected:
                    logging.error("Text-to-Speech (TTS) service connection failed")

            # Return the corresponding connection status based on model_type
            if model_type == 'stt':
                return stt_connected
            elif model_type == 'tts':
                return tts_connected
            else:
                logging.error(f"Unknown model type: {model_type}")
                return False

        except Exception as e:
            logging.error(f"Voice service connectivity test encountered an exception: {str(e)}")
            return False


router = VoiceService().router
