import asyncio
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from gpu_monitor import GPUMonitor
from system_monitor import SystemMonitor

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SystemMonitorAPI")

app = FastAPI(title="Realtime System Monitor API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for easy docker-compose deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Monitors
gpu_monitor = GPUMonitor()
system_monitor = SystemMonitor(mock_mode=gpu_monitor.mock_mode)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "mock_mode": gpu_monitor.mock_mode,
        "driver_version": gpu_monitor.driver_version,
        "cuda_version": gpu_monitor.cuda_version,
        "platform": system_monitor.platform_name,
        "hostname": system_monitor.hostname,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info(f"Client connected from {websocket.client}")
    try:
        while True:
            # Gather GPU + System telemetry
            gpu_data = gpu_monitor.get_gpu_data()
            system_data = system_monitor.get_full_system_data()

            # Combine into a single payload
            payload = {
                **gpu_data,
                "system": system_data,
            }

            # Send to client
            await websocket.send_text(json.dumps(payload))

            # Rate of update (1 second)
            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {websocket.client}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
