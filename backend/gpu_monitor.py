import time
import os
import math
import random
import logging

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GPUMonitor")

# Try to import pynvml and psutil
try:
    import pynvml
    HAS_PYNVML = True
except ImportError:
    HAS_PYNVML = False
    logger.warning("pynvml package not found. Running in Mock Mode.")

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    logger.warning("psutil package not found. Process names may not be fully resolved.")

class GPUMonitor:
    def __init__(self):
        self.mock_mode = not HAS_PYNVML
        self.device_handles = []
        self.driver_version = "N/A"
        self.cuda_version = "N/A"
        self.mock_start_time = time.time()
        
        # Check environment override
        if os.environ.get("MOCK_GPU", "false").lower() == "true":
            self.mock_mode = True
            logger.info("MOCK_GPU environment variable is set to true. Force starting in Mock Mode.")

        if not self.mock_mode:
            try:
                pynvml.nvmlInit()
                device_count = pynvml.nvmlDeviceGetCount()
                logger.info(f"Successfully initialized NVML. Found {device_count} GPU(s).")
                for i in range(device_count):
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    self.device_handles.append(handle)
                
                try:
                    self.driver_version = pynvml.nvmlSystemGetDriverVersion().decode('utf-8')
                except Exception:
                    self.driver_version = pynvml.nvmlSystemGetDriverVersion()
                
                try:
                    cuda_v = pynvml.nvmlSystemGetCudaDriverVersion()
                    self.cuda_version = f"{(cuda_v // 1000)}.{((cuda_v % 1000) // 10)}"
                except Exception:
                    self.cuda_version = "Unknown"
            except Exception as e:
                logger.warning(f"Failed to initialize NVML: {e}. Falling back to Mock Mode.")
                self.mock_mode = True
                self._setup_mock_data()
        else:
            self._setup_mock_data()

    def _setup_mock_data(self):
        self.driver_version = "555.42.02"
        self.cuda_version = "12.5"
        # Setup static properties of mock devices
        self.mock_devices = [
            {
                "index": 0,
                "name": "NVIDIA GeForce RTX 4090",
                "memory_total": 24576,  # MB
                "power_limit": 450.0,   # W
                "uuid": "GPU-8c385b29-e85d-85fa-71f0-4fa815f949c8",
                "base_temp": 40.0,
                "base_fan": 30.0,
                "processes": [
                    {"pid": 12844, "name": "python train.py", "type": "Compute"},
                    {"pid": 9482, "name": "ollama run llama3", "type": "Compute"},
                    {"pid": 1102, "name": "xorg", "type": "Graphics"}
                ]
            },
            {
                "index": 1,
                "name": "NVIDIA H100 Tensor Core PCIe",
                "memory_total": 81920,  # MB
                "power_limit": 350.0,   # W
                "uuid": "GPU-ef3f37ab-7132-4d2c-8438-e69c47012984",
                "base_temp": 35.0,
                "base_fan": 45.0,
                "processes": [
                    {"pid": 20491, "name": "vllm-openai-server", "type": "Compute"},
                    {"pid": 20554, "name": "python evaluate.py", "type": "Compute"}
                ]
            }
        ]

    def _get_process_name(self, pid):
        if not HAS_PSUTIL:
            return "Unknown"
        try:
            return psutil.Process(pid).name()
        except Exception:
            return "Unknown"

    def get_gpu_data(self):
        if self.mock_mode:
            return self._get_mock_gpu_data()
        
        gpus = []
        for i, handle in enumerate(self.device_handles):
            try:
                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode('utf-8')
            except Exception:
                name = f"NVIDIA GPU {i}"

            try:
                uuid = pynvml.nvmlDeviceGetUUID(handle)
                if isinstance(uuid, bytes):
                    uuid = uuid.decode('utf-8')
            except Exception:
                uuid = f"GPU-MOCK-{i}"

            # Utilization
            try:
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                gpu_util = util.gpu
                mem_util_pct = util.memory
            except Exception:
                gpu_util = 0
                mem_util_pct = 0

            # Memory Info
            try:
                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                mem_total = mem.total / (1024 * 1024)  # to MB
                mem_used = mem.used / (1024 * 1024)    # to MB
                mem_free = mem.free / (1024 * 1024)    # to MB
                # Use nvml memory util if utilization rate fails, or recalculate
                if mem_util_pct == 0 and mem_total > 0:
                    mem_util_pct = int((mem_used / mem_total) * 100)
            except Exception:
                mem_total = 0
                mem_used = 0
                mem_free = 0
                mem_util_pct = 0

            # Temperature
            try:
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            except Exception:
                temp = 0

            # Fan Speed
            try:
                fan_speed = pynvml.nvmlDeviceGetFanSpeed(handle)
            except Exception:
                fan_speed = 0  # 0 indicates fan-less or failed read

            # Power usage
            try:
                power_draw = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0  # W
            except Exception:
                power_draw = 0.0

            try:
                power_limit = pynvml.nvmlDeviceGetPowerManagementLimit(handle) / 1000.0  # W
            except Exception:
                power_limit = 0.0

            # Processes
            processes = []
            try:
                # NVML separates graphics and compute processes
                procs = []
                try:
                    procs.extend([(p, "Graphics") for p in pynvml.nvmlDeviceGetGraphicsRunningProcesses(handle)])
                except Exception:
                    pass
                
                try:
                    procs.extend([(p, "Compute") for p in pynvml.nvmlDeviceGetComputeRunningProcesses(handle)])
                except Exception:
                    pass

                for p, proc_type in procs:
                    proc_name = self._get_process_name(p.pid)
                    # If proc_name is unknown, nvml sometimes provides a name
                    if proc_name == "Unknown" and hasattr(p, 'usedGpuMemory'):
                        # nvml doesn't directly store name in the process struct unless we query it,
                        # but some bindings might. Let's stick with psutil or basic.
                        pass
                    
                    processes.append({
                        "pid": p.pid,
                        "name": proc_name,
                        "type": proc_type,
                        "used_memory": int(p.usedGpuMemory / (1024 * 1024)) if p.usedGpuMemory else 0  # MB
                    })
            except Exception as e:
                logger.debug(f"Failed to fetch processes for GPU {i}: {e}")

            gpus.append({
                "index": i,
                "name": name,
                "uuid": uuid,
                "gpu_util": gpu_util,
                "mem_util": mem_util_pct,
                "mem_total": int(mem_total),
                "mem_used": int(mem_used),
                "mem_free": int(mem_free),
                "temperature": temp,
                "fan_speed": fan_speed,
                "power_draw": round(power_draw, 1),
                "power_limit": round(power_limit, 1),
                "processes": processes
            })

        return {
            "driver_version": self.driver_version,
            "cuda_version": self.cuda_version,
            "gpus": gpus,
            "timestamp": time.time(),
            "is_mock": False
        }

    def _get_mock_gpu_data(self):
        t = time.time() - self.mock_start_time
        gpus = []

        for mock in self.mock_devices:
            idx = mock["index"]
            # Generate fluctuating metrics using sine waves and noise
            if idx == 0:
                # RTX 4090: High volatility (gaming/training simulation)
                gpu_util = int(abs(math.sin(t * 0.1) * 60) + abs(math.cos(t * 0.05) * 30) + random.randint(-5, 5))
                gpu_util = max(0, min(100, gpu_util))
                
                mem_util = int(50 + math.sin(t * 0.02) * 20 + random.randint(-2, 2))
                mem_util = max(0, min(100, mem_util))
                
                power_draw = 150.0 + (gpu_util / 100.0) * 250.0 + random.uniform(-10.0, 10.0)
                power_draw = max(50.0, min(mock["power_limit"], power_draw))
                
                temp = mock["base_temp"] + (gpu_util / 100.0) * 35.0 + random.uniform(-1, 1)
                fan_speed = mock["base_fan"] + (temp - mock["base_temp"]) * 1.5
                fan_speed = max(0, min(100, int(fan_speed)))
            else:
                # H100: Heavy load simulation (LLM inference)
                # Stays highly active for 40 seconds, then drops, then rises
                cycle = int(t) % 120
                if cycle < 80:
                    target_util = 85.0
                    target_mem = 82.0
                else:
                    target_util = 15.0
                    target_mem = 40.0
                
                gpu_util = int(target_util + random.randint(-5, 5))
                gpu_util = max(0, min(100, gpu_util))
                
                mem_util = int(target_mem + random.randint(-1, 1))
                mem_util = max(0, min(100, mem_util))
                
                power_draw = 80.0 + (gpu_util / 100.0) * 250.0 + random.uniform(-5.0, 5.0)
                power_draw = max(40.0, min(mock["power_limit"], power_draw))
                
                temp = mock["base_temp"] + (gpu_util / 100.0) * 40.0 + random.uniform(-1, 1)
                fan_speed = mock["base_fan"] + (temp - mock["base_temp"]) * 1.2
                fan_speed = max(0, min(100, int(fan_speed)))

            mem_used = int((mem_util / 100.0) * mock["memory_total"])
            mem_free = mock["memory_total"] - mem_used

            # Update mock processes memory based on global usage
            processes = []
            remaining_mem = mem_used
            num_procs = len(mock["processes"])
            for j, proc in enumerate(mock["processes"]):
                if j == num_procs - 1:
                    # Last process takes the rest of the memory
                    proc_mem = max(50, remaining_mem)
                else:
                    # Proportional allocation with some jitter
                    base_ratio = 1.0 / num_procs
                    proc_mem = int(mem_used * (base_ratio + random.uniform(-0.05, 0.05)))
                    proc_mem = max(50, proc_mem)
                    remaining_mem -= proc_mem

                processes.append({
                    "pid": proc["pid"],
                    "name": proc["name"],
                    "type": proc["type"],
                    "used_memory": proc_mem
                })

            gpus.append({
                "index": idx,
                "name": mock["name"],
                "uuid": mock["uuid"],
                "gpu_util": gpu_util,
                "mem_util": mem_util,
                "mem_total": mock["memory_total"],
                "mem_used": mem_used,
                "mem_free": mem_free,
                "temperature": int(temp),
                "fan_speed": fan_speed,
                "power_draw": round(power_draw, 1),
                "power_limit": mock["power_limit"],
                "processes": processes
            })

        return {
            "driver_version": self.driver_version,
            "cuda_version": self.cuda_version,
            "gpus": gpus,
            "timestamp": time.time(),
            "is_mock": True
        }

    def __del__(self):
        if not self.mock_mode:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
