# System Monitor

A sleek, modern, glassmorphic real-time system monitoring dashboard.
Built with **Next.js (React/TypeScript)** for the frontend, **FastAPI (Python)** for the backend telemetry stream over WebSockets, and fully containerized with **Docker Compose**.

![Dashboard Mockup](https://raw.githubusercontent.com/username/project/main/mockup.png) *(UI placeholder - renders rich neon gauges, rolling time-series area charts, and filterable GPU process tables)*

---

## Features
- **System Overview**: Real-time CPU usage, temperature, load average, RAM usage/swap, disk usage per partition, and network I/O — all updated every second.
- **GPU Monitoring**: Core utilization, VRAM, temperature, fan speed, power draw, and active CUDA/Graphics processes.
- **Rolling Time-series Charts**: 30-second history graphs for CPU, memory, GPU utilization, and VRAM usage.
- **Multi-GPU support**: Automatically detects all system GPUs and renders summary switcher cards in the sidebar.
- **Active Process Monitor**: Lists all CUDA/Graphics processes utilizing the active GPU with interactive search filtering and column sorting.
- **Rich Dark-mode UI**: Sleek glassmorphic panels, glowing neon highlights (color-coded warning states), and animated charts.
- **Graceful Fallbacks**: Automatically falls back to high-fidelity mock data generators if Nvidia drivers/toolkit are missing, allowing easy development anywhere.

---

## Quick Start (Docker Compose)

### 1. Requirements (For Real GPU Telemetry)
To pass actual GPU details into the Docker containers:
1. Ensure **NVIDIA Drivers** are installed on the host.
2. Install the **[NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)**.
3. Configure docker to use the nvidia runtime.

### 2. Launch the Application
In the project root, run:
```bash
docker compose up --build
```
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Development / Running Without Nvidia GPUs (Mock Mode)

If you are developing on a machine without an Nvidia GPU (such as a MacBook or laptop), follow these steps to run the interactive dashboard with simulated telemetry:

### 1. Update `.env`
Set `MOCK_GPU` to `true`:
```ini
MOCK_GPU=true
```

### 2. Adjust `docker-compose.yml`
Because Docker will fail to build or run if you ask for `nvidia` resources on a non-GPU host, comment out the `deploy` configurations in `docker-compose.yml` as follows:

```yaml
  backend:
    # ...
    # Comment out or remove the deploy block below:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
```

### 3. Run
Spin up compose as normal:
```bash
docker compose up --build
```
The FastAPI backend will detect the mock settings and spin up simulated system metrics (CPU, RAM, disk, network) alongside two virtual GPUs (an RTX 4090 and an H100 PCIe) showing dynamically fluctuating workloads, temperatures, and shifting processes.

---

## Local Development (No Docker)

### Backend (Python FastAPI)
1. Navigate to `/backend`
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the API:
   ```bash
   python main.py
   ```

### Frontend (Next.js)
1. Navigate to `/frontend`
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
