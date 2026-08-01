export interface GpuProcess {
  pid: number;
  name: string;
  type: string;
  used_memory: number; // MB
}

export interface GpuData {
  index: number;
  name: string;
  uuid: string;
  gpu_util: number;
  mem_util: number;
  mem_total: number;
  mem_used: number;
  mem_free: number;
  temperature: number;
  fan_speed: number;
  power_draw: number;
  power_limit: number;
  processes: GpuProcess[];
}

export interface CpuData {
  percent: number;
  per_core: number[];
  count_logical: number;
  count_physical: number;
  frequency_current: number;
  frequency_max: number;
  temperature: number | null;
  load_avg: number[];
}

export interface MemoryData {
  total: number;      // MB
  used: number;       // MB
  available: number;  // MB
  percent: number;
  swap_total: number; // MB
  swap_used: number;  // MB
  swap_percent: number;
}

export interface DiskPartition {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;   // MB
  used: number;    // MB
  free: number;    // MB
  percent: number;
}

export interface DiskIo {
  read_bytes: number;
  write_bytes: number;
  read_count: number;
  write_count: number;
}

export interface DiskData {
  partitions: DiskPartition[];
  io: DiskIo;
}

export interface NetworkData {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

export interface SystemData {
  cpu: CpuData;
  memory: MemoryData;
  disk: DiskData;
  network: NetworkData;
  uptime: number;         // seconds
  platform: string;
  platform_release: string;
  hostname: string;
}

export interface GpuDeviceStats {
  /** GPU utilization percent (Apple IORegistry). */
  gpu_util?: number;
  /** GPU memory in use, bytes. */
  vram_used_bytes?: number;
  /** GPU memory allocated by the driver, bytes. */
  vram_allocated_bytes?: number;
  temperature?: number | null;
  fan_speed?: number | null;
}

export interface GpuDevice {
  /** Device type: nvidia | apple | amd | intel | qualcomm | unknown. */
  type: string;
  vendor: string;
  name: string;
  /** Compute backend label, e.g. 'CUDA' or 'MPS (Metal Performance Shaders)'. */
  compute?: string;
  vram_mb?: number;
  /** GPU core count (Apple Silicon). */
  cores?: number;
  /** Metal support version, e.g. 'Metal 4' (Apple). */
  metal?: string;
  driver_version?: string;
  cuda_version?: string;
  /** Live telemetry per GPU (NVIDIA only, when the container can see the GPU). */
  gpus?: GpuData[];
  /** Live stats for devices that expose them (Apple via IORegistry). */
  stats?: GpuDeviceStats;
}

export interface TelemetryData {
  devices: GpuDevice[];
  system: SystemData;
  timestamp: number;
  is_mock: boolean;
}
