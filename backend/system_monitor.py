import time
import os
import platform
import random
import math
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SystemMonitor")

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    logger.warning("psutil package not found. System monitoring disabled.")


class SystemMonitor:
    def __init__(self, mock_mode=False):
        self.mock_mode = mock_mode or not HAS_PSUTIL
        self.mock_start_time = time.time()
        self.hostname = platform.node()
        self.platform_name = platform.system()
        self.platform_release = platform.release()
        self.platform_version = platform.version()

        if self.mock_mode:
            logger.info("SystemMonitor running in Mock Mode.")

    # ── CPU ────────────────────────────────────────────────────────

    def get_cpu_data(self):
        if self.mock_mode:
            return self._mock_cpu_data()

        try:
            # Call cpu_percent once with a short interval to prime the counter,
            # then read the real value.
            psutil.cpu_percent(interval=0)
            time.sleep(0.1)
            percent = psutil.cpu_percent(interval=0)
            per_core = psutil.cpu_percent(interval=0, percpu=True)
            freq = psutil.cpu_freq()

            load_avg = [0.0, 0.0, 0.0]
            try:
                load_avg = list(os.getloadavg())
            except (OSError, AttributeError):
                pass

            # Temperature (Linux-specific via psutil)
            temperature = None
            try:
                temps = psutil.sensors_temperatures()
                if temps:
                    for name in ["coretemp", "k10temp", "cpu_thermal", "acpitz", "cpu-pci-00"]:
                        if name in temps and temps[name]:
                            temperature = temps[name][0].current
                            break
                    if temperature is None:
                        first_key = list(temps.keys())[0]
                        if temps[first_key]:
                            temperature = temps[first_key][0].current
            except (AttributeError, Exception):
                pass

            return {
                "percent": round(percent, 1),
                "per_core": [round(c, 1) for c in per_core],
                "count_logical": psutil.cpu_count(logical=True) or 0,
                "count_physical": psutil.cpu_count(logical=False) or 0,
                "frequency_current": round(freq.current, 0) if freq else 0,
                "frequency_max": round(freq.max, 0) if freq and freq.max else 0,
                "temperature": round(temperature, 1) if temperature is not None else None,
                "load_avg": [round(l, 2) for l in load_avg],
            }
        except Exception as e:
            logger.error(f"Failed to get CPU data: {e}")
            return {
                "percent": 0,
                "per_core": [],
                "count_logical": 0,
                "count_physical": 0,
                "frequency_current": 0,
                "frequency_max": 0,
                "temperature": None,
                "load_avg": [0.0, 0.0, 0.0],
            }

    # ── Memory ─────────────────────────────────────────────────────

    def get_memory_data(self):
        if self.mock_mode:
            return self._mock_memory_data()

        try:
            mem = psutil.virtual_memory()
            swap = psutil.swap_memory()
            return {
                "total": round(mem.total / (1024 * 1024)),          # MB
                "used": round(mem.used / (1024 * 1024)),
                "available": round(mem.available / (1024 * 1024)),
                "percent": round(mem.percent, 1),
                "swap_total": round(swap.total / (1024 * 1024)),
                "swap_used": round(swap.used / (1024 * 1024)),
                "swap_percent": round(swap.percent, 1),
            }
        except Exception as e:
            logger.error(f"Failed to get memory data: {e}")
            return {
                "total": 0, "used": 0, "available": 0, "percent": 0,
                "swap_total": 0, "swap_used": 0, "swap_percent": 0,
            }

    # ── Disk ───────────────────────────────────────────────────────

    def get_disk_data(self):
        if self.mock_mode:
            return self._mock_disk_data()

        disks = []
        try:
            for part in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    disks.append({
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "fstype": part.fstype,
                        "total": round(usage.total / (1024 * 1024)),
                        "used": round(usage.used / (1024 * 1024)),
                        "free": round(usage.free / (1024 * 1024)),
                        "percent": round(usage.percent, 1),
                    })
                except PermissionError:
                    continue
        except Exception as e:
            logger.error(f"Failed to get disk data: {e}")

        io_data = {}
        try:
            io = psutil.disk_io_counters()
            if io:
                io_data = {
                    "read_bytes": io.read_bytes,
                    "write_bytes": io.write_bytes,
                    "read_count": io.read_count,
                    "write_count": io.write_count,
                }
        except Exception:
            pass

        return {"partitions": disks, "io": io_data}

    # ── Network ────────────────────────────────────────────────────

    def get_network_data(self):
        if self.mock_mode:
            return self._mock_network_data()

        try:
            net = psutil.net_io_counters()
            return {
                "bytes_sent": net.bytes_sent,
                "bytes_recv": net.bytes_recv,
                "packets_sent": net.packets_sent,
                "packets_recv": net.packets_recv,
            }
        except Exception as e:
            logger.error(f"Failed to get network data: {e}")
            return {}

    # ── Uptime ─────────────────────────────────────────────────────

    def get_uptime(self):
        try:
            boot_time = psutil.boot_time()
            return int(time.time() - boot_time)
        except Exception:
            return 0

    # ── Combined ───────────────────────────────────────────────────

    def get_full_system_data(self):
        return {
            "cpu": self.get_cpu_data(),
            "memory": self.get_memory_data(),
            "disk": self.get_disk_data(),
            "network": self.get_network_data(),
            "uptime": self.get_uptime(),
            "platform": self.platform_name,
            "platform_release": self.platform_release,
            "hostname": self.hostname,
        }

    # ═══════════════════════════════════════════════════════════════
    #  Mock data generators
    # ═══════════════════════════════════════════════════════════════

    def _mock_cpu_data(self):
        t = time.time() - self.mock_start_time
        base_load = 35 + math.sin(t * 0.1) * 20
        percent = max(0.0, min(100.0, base_load + random.uniform(-5, 5)))
        per_core = [
            max(0.0, min(100.0, base_load + random.uniform(-15, 15)))
            for _ in range(8)
        ]
        temp = 45.0 + (percent / 100.0) * 30.0 + random.uniform(-2, 2)

        return {
            "percent": round(percent, 1),
            "per_core": [round(c, 1) for c in per_core],
            "count_logical": 8,
            "count_physical": 4,
            "frequency_current": 3200 + int((percent / 100.0) * 1300),
            "frequency_max": 4500,
            "temperature": round(temp, 1),
            "load_avg": [
                round(base_load / 25 + random.uniform(-0.3, 0.3), 2),
                round(base_load / 30 + random.uniform(-0.2, 0.2), 2),
                round(base_load / 35 + random.uniform(-0.1, 0.1), 2),
            ],
        }

    def _mock_memory_data(self):
        t = time.time() - self.mock_start_time
        total = 32768  # 32 GB in MB
        percent = 55.0 + math.sin(t * 0.015) * 15 + random.uniform(-2, 2)
        percent = max(20.0, min(85.0, percent))
        used = int((percent / 100.0) * total)
        swap_total = 8192
        swap_percent = 10.0 + math.sin(t * 0.01) * 8
        swap_used = int((swap_percent / 100.0) * swap_total)

        return {
            "total": total,
            "used": used,
            "available": total - used,
            "percent": round(percent, 1),
            "swap_total": swap_total,
            "swap_used": swap_used,
            "swap_percent": round(swap_percent, 1),
        }

    def _mock_disk_data(self):
        t = time.time() - self.mock_start_time
        total = 1024000  # ~1 TB in MB
        base_used = 480000 + t * 0.5
        used = min(int(base_used), total - 100000)

        return {
            "partitions": [
                {
                    "device": "/dev/nvme0n1p2",
                    "mountpoint": "/",
                    "fstype": "ext4",
                    "total": total,
                    "used": used,
                    "free": total - used,
                    "percent": round((used / total) * 100, 1),
                },
                {
                    "device": "/dev/nvme0n1p1",
                    "mountpoint": "/boot/efi",
                    "fstype": "vfat",
                    "total": 512,
                    "used": 128,
                    "free": 384,
                    "percent": 25.0,
                },
            ],
            "io": {
                "read_bytes": int(1234567890 + t * 50000),
                "write_bytes": int(987654321 + t * 30000),
                "read_count": int(1234567 + t * 10),
                "write_count": int(987654 + t * 8),
            },
        }

    def _mock_network_data(self):
        t = time.time() - self.mock_start_time
        return {
            "bytes_sent": int(12345678 + t * 15000),
            "bytes_recv": int(98765432 + t * 45000),
            "packets_sent": int(123456 + t * 20),
            "packets_recv": int(98765 + t * 30),
        }
