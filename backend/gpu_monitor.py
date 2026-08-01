import time
import os
import re
import math
import random
import json
import glob
import logging
import platform
import plistlib
import subprocess

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GPUMonitor")

# Try to import pynvml and psutil
try:
    import pynvml
    HAS_PYNVML = True
except ImportError:
    HAS_PYNVML = False
    logger.warning("pynvml package not found. NVIDIA GPU monitoring disabled.")

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    logger.warning("psutil package not found. Process names may not be fully resolved.")

# PCI vendor id -> vendor label (Linux sysfs DRM scan)
PCI_VENDORS = {
    "0x10de": "NVIDIA",
    "0x1002": "AMD",
    "0x8086": "Intel",
    "0x13b5": "ARM",
    "0x1a03": "ASPEED",
    "0x5143": "Qualcomm",
}

# Compute backend label per device type
COMPUTE_BACKENDS = {
    "nvidia": "CUDA",
    "apple": "MPS (Metal Performance Shaders)",
    "amd": "ROCm",
    "intel": "oneAPI / SYCL",
    "qualcomm": "OpenCL",
    "unknown": "",
}


class GPUMonitor:
    """Detects real GPU devices on the host and exposes live telemetry.

    Detection sources:
      - NVIDIA: NVML (works in containers with GPU passthrough, or natively).
      - Apple:  `system_profiler` on macOS (native runs only; not available
                inside a Linux container).
      - Other:  Linux sysfs DRM scan (/sys/class/drm/card*/device).

    No device is fabricated: if nothing is detected the device list is empty.
    Setting MOCK_GPU=true keeps the demo data generators available, clearly
    flagged with is_mock=true.
    """

    def __init__(self):
        force_mock = os.environ.get("MOCK_GPU", "false").lower() == "true"
        self.mock_mode = force_mock
        self.devices = []              # non-NVIDIA detected devices (apple/amd/intel/...)
        self.nvidia_handles = []       # [(index, nvml handle), ...]
        self.driver_version = "N/A"
        self.cuda_version = "N/A"
        self.mock_start_time = time.time()

        if self.mock_mode:
            logger.info("MOCK_GPU environment variable is set to true. Starting in Mock Mode.")
            self._setup_mock_data()
            return

        self._init_nvml()
        self._detect_apple_gpu()
        self._detect_linux_drm()
        logger.info(f"GPU detection complete: {self.device_count()} device(s) found.")

    # ── NVIDIA (NVML) ─────────────────────────────────────────────

    def _init_nvml(self):
        if not HAS_PYNVML:
            logger.info("pynvml not available - skipping NVIDIA detection.")
            return
        try:
            pynvml.nvmlInit()
            count = pynvml.nvmlDeviceGetCount()
            for i in range(count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                self.nvidia_handles.append((i, handle))

            try:
                self.driver_version = pynvml.nvmlSystemGetDriverVersion().decode('utf-8')
            except Exception:
                self.driver_version = pynvml.nvmlSystemGetDriverVersion()

            try:
                cuda_v = pynvml.nvmlSystemGetCudaDriverVersion()
                self.cuda_version = f"{(cuda_v // 1000)}.{((cuda_v % 1000) // 10)}"
            except Exception:
                self.cuda_version = "Unknown"

            logger.info(f"NVML initialized. Found {count} NVIDIA GPU(s).")
        except Exception as e:
            logger.info(f"No NVIDIA GPU detected (NVML init failed: {e}).")

    def _read_nvidia_gpu(self, index, handle):
        """Read live telemetry for a single NVIDIA GPU via NVML."""
        try:
            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode('utf-8')
        except Exception:
            name = f"NVIDIA GPU {index}"

        try:
            uuid = pynvml.nvmlDeviceGetUUID(handle)
            if isinstance(uuid, bytes):
                uuid = uuid.decode('utf-8')
        except Exception:
            uuid = f"GPU-{index}"

        gpu_util = 0
        mem_util_pct = 0
        try:
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_util = util.gpu
            mem_util_pct = util.memory
        except Exception:
            pass

        try:
            mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            mem_total = mem.total / (1024 * 1024)
            mem_used = mem.used / (1024 * 1024)
            mem_free = mem.free / (1024 * 1024)
            if mem_util_pct == 0 and mem_total > 0:
                mem_util_pct = int((mem_used / mem_total) * 100)
        except Exception:
            mem_total = 0
            mem_used = 0
            mem_free = 0
            mem_util_pct = 0

        try:
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        except Exception:
            temp = 0

        try:
            fan_speed = pynvml.nvmlDeviceGetFanSpeed(handle)
        except Exception:
            fan_speed = 0

        try:
            power_draw = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0
        except Exception:
            power_draw = 0.0

        try:
            power_limit = pynvml.nvmlDeviceGetPowerManagementLimit(handle) / 1000.0
        except Exception:
            power_limit = 0.0

        processes = []
        try:
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
                processes.append({
                    "pid": p.pid,
                    "name": proc_name,
                    "type": proc_type,
                    "used_memory": int(p.usedGpuMemory / (1024 * 1024)) if p.usedGpuMemory else 0,
                })
        except Exception as e:
            logger.debug(f"Failed to fetch processes for GPU {index}: {e}")

        return {
            "index": index,
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
            "processes": processes,
        }

    def _build_nvidia_device(self):
        gpus = [self._read_nvidia_gpu(i, h) for i, h in self.nvidia_handles]
        return {
            "type": "nvidia",
            "vendor": "NVIDIA",
            "name": gpus[0]["name"] if gpus else "NVIDIA GPU",
            "driver_version": self.driver_version,
            "cuda_version": self.cuda_version,
            "compute": COMPUTE_BACKENDS["nvidia"],
            "gpus": gpus,
        }

    # ── Apple GPU (macOS native) ──────────────────────────────────

    def _detect_apple_gpu(self):
        if platform.system() != "Darwin":
            return
        try:
            out = subprocess.run(
                ["system_profiler", "SPDisplaysDataType", "-json"],
                capture_output=True, text=True, timeout=15,
            )
            if out.returncode != 0:
                logger.info("system_profiler failed - skipping Apple GPU detection.")
                return
            data = json.loads(out.stdout)
            seen = set()
            for display in data.get("SPDisplaysDataType", []):
                name = display.get("sppci_model") or display.get("_name") or "Apple GPU"
                if name in seen:
                    continue
                seen.add(name)
                device = {
                    "type": "apple",
                    "vendor": "Apple",
                    "name": name,
                    "compute": COMPUTE_BACKENDS["apple"],
                }
                vram_mb = self._parse_vram(display.get("spdisplays_vram") or "")
                if vram_mb:
                    device["vram_mb"] = vram_mb
                cores = self._parse_int(display.get("sppci_cores"))
                if cores:
                    device["cores"] = cores
                metal = self._parse_metal(display.get("spdisplays_mtlgpufamilysupport") or "")
                if metal:
                    device["metal"] = metal
                self.devices.append(device)
                logger.info(f"Detected Apple GPU: {name}")
        except Exception as e:
            logger.info(f"Apple GPU detection skipped: {e}")

    @staticmethod
    def _parse_vram(s):
        try:
            m = re.match(r"([\d.]+)\s*(TB|GB|MB)", s, re.IGNORECASE)
            if not m:
                return None
            val = float(m.group(1))
            unit = m.group(2).upper()
            if unit == "TB":
                return int(val * 1024 * 1024)
            if unit == "GB":
                return int(val * 1024)
            return int(val)
        except Exception:
            return None

    @staticmethod
    def _parse_int(s):
        try:
            return int(str(s).strip())
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_metal(s):
        # system_profiler reports e.g. "spdisplays_metal4" -> "Metal 4"
        m = re.search(r"metal(\d+)", s, re.IGNORECASE)
        return f"Metal {m.group(1)}" if m else None

    # ── Apple GPU live stats (IORegistry, no sudo) ──────────────────

    def _read_apple_stats(self):
        """Read live GPU stats from the IORegistry (macOS only, no sudo).

        Apple Silicon exposes AGXAccelerator PerformanceStatistics:
          Device/Renderer/Tiler Utilization %, In use system memory (bytes).
        Intel Macs with discrete GPUs expose AppleMGPUPowerControl
        PerformanceStatistics: Temperature, Fan Speed, Core Utilization.
        """
        stats = []
        for cls in ("AGXAccelerator", "AppleMGPUPowerControl"):
            try:
                out = subprocess.run(
                    ["ioreg", "-r", "-c", cls, "-d", "2", "-a", "-w0"],
                    capture_output=True, text=True, timeout=5,
                )
                if out.returncode != 0 or not out.stdout.strip():
                    continue
                nodes = plistlib.loads(out.stdout.encode())
                if not isinstance(nodes, list):
                    nodes = [nodes]
                for node in nodes:
                    ps = node.get("PerformanceStatistics")
                    if not isinstance(ps, dict):
                        continue
                    entry = {}
                    model = node.get("model")
                    if model:
                        entry["model"] = model
                    util = ps.get("Device Utilization %")
                    if util is None:
                        util = ps.get("Renderer Utilization %")
                    if util is not None:
                        entry["gpu_util"] = int(util)
                    if "In use system memory" in ps:
                        entry["vram_used_bytes"] = int(ps["In use system memory"])
                    if "Alloc system memory" in ps:
                        entry["vram_allocated_bytes"] = int(ps["Alloc system memory"])
                    if "Temperature" in ps:
                        entry["temperature"] = int(ps["Temperature"])
                    if "Fan Speed" in ps:
                        entry["fan_speed"] = int(ps["Fan Speed"])
                    if len(entry) > 1:  # model alone is not a stat
                        stats.append(entry)
            except Exception as e:
                logger.debug(f"ioreg {cls} scan failed: {e}")
        return stats

    # ── Other GPUs (Linux sysfs DRM scan) ─────────────────────────

    def _detect_linux_drm(self):
        if platform.system() != "Linux":
            return
        seen = set()
        for card_dir in sorted(glob.glob("/sys/class/drm/card[0-9]*/device")):
            try:
                with open(os.path.join(card_dir, "vendor")) as f:
                    vendor_id = f.read().strip().lower()
                vendor = PCI_VENDORS.get(vendor_id)
                if not vendor:
                    continue

                if vendor_id == "0x10de" and self.nvidia_handles:
                    continue  # already reported via NVML

                name = None
                for key in ("product_name", "model", "device_name"):
                    p = os.path.join(card_dir, key)
                    if os.path.exists(p):
                        with open(p) as f:
                            name = f.read().strip()
                        if name:
                            break
                if not name:
                    card = os.path.basename(os.path.dirname(card_dir))
                    name = f"{vendor} GPU ({card})"
                if name in seen:
                    continue
                seen.add(name)

                dev_type = "nvidia" if vendor_id == "0x10de" else \
                           "amd" if vendor_id == "0x1002" else \
                           "intel" if vendor_id == "0x8086" else \
                           "qualcomm" if vendor_id == "0x5143" else "unknown"
                self.devices.append({
                    "type": dev_type,
                    "vendor": vendor,
                    "name": name,
                    "compute": COMPUTE_BACKENDS.get(dev_type, ""),
                })
                logger.info(f"Detected {vendor} GPU: {name}")
            except Exception:
                continue

    # ── Public API ────────────────────────────────────────────────

    def device_count(self):
        nvidia = 1 if self.nvidia_handles else 0
        return nvidia + len(self.devices)

    def get_gpu_data(self):
        if self.mock_mode:
            mock = self._get_mock_gpu_data()
            return {
                "devices": [{
                    "type": "nvidia",
                    "vendor": "NVIDIA",
                    "name": mock["gpus"][0]["name"] if mock["gpus"] else "NVIDIA GPU",
                    "driver_version": mock["driver_version"],
                    "cuda_version": mock["cuda_version"],
                    "compute": COMPUTE_BACKENDS["nvidia"],
                    "gpus": mock["gpus"],
                }],
                "timestamp": time.time(),
                "is_mock": True,
            }

        devices = []
        if self.nvidia_handles:
            devices.append(self._build_nvidia_device())
        devices.extend(self.devices)

        # Attach live IORegistry stats to Apple devices (macOS native runs).
        if any(d["type"] == "apple" for d in devices):
            apple_stats = self._read_apple_stats()
            if apple_stats:
                for dev in devices:
                    if dev["type"] != "apple":
                        continue
                    match = next(
                        (s for s in apple_stats
                         if s.get("model") and s["model"].lower() == dev["name"].lower()),
                        None,
                    )
                    dev["stats"] = match or apple_stats[0]

        return {"devices": devices, "timestamp": time.time(), "is_mock": False}

    # ── Mock data generators (demo only, MOCK_GPU=true) ───────────

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
        if self.nvidia_handles:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
