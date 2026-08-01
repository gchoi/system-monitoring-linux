'use client';

import React from 'react';
import { Cpu, Layers, Zap } from 'lucide-react';
import { GpuDeviceStats } from '../types/gpu';
import styles from './DeviceInfoPanel.module.css';

export interface DeviceInfoPanelDevice {
  type: string;
  vendor: string;
  name: string;
  compute?: string;
  vram_mb?: number;
  cores?: number;
  metal?: string;
  driver_version?: string;
  cuda_version?: string;
  gpus?: unknown[];
  stats?: GpuDeviceStats;
}

interface DeviceInfoPanelProps {
  device: DeviceInfoPanelDevice;
}

const VENDOR_COLORS: Record<string, string> = {
  nvidia: 'var(--accent-green)',
  apple: 'var(--accent-cyan)',
  amd: 'var(--accent-red)',
  intel: 'var(--accent-blue)',
  qualcomm: 'var(--accent-orange)',
};

function formatVRAM(mb?: number): string | null {
  if (!mb) return null;
  if (mb >= 1048576) return `${(mb / 1048576).toFixed(1)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatBytes(bytes?: number): string | null {
  if (bytes === undefined || bytes === null) return null;
  if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(1)} TB`;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.round(bytes)} B`;
}

export default function DeviceInfoPanel({ device }: DeviceInfoPanelProps) {
  const accent = VENDOR_COLORS[device.type] || 'var(--text-muted)';
  const vram = formatVRAM(device.vram_mb);
  const hasLiveTelemetry = Array.isArray(device.gpus) && device.gpus.length > 0;
  const stats = device.stats;
  const hasStats =
    !!stats && (stats.gpu_util !== undefined || stats.vram_used_bytes !== undefined);

  return (
    <div className={styles.panel}>
      <div className={styles.iconBox} style={{ color: accent, borderColor: accent }}>
        <Cpu size={22} />
      </div>

      <div className={styles.body}>
        <div className={styles.headerRow}>
          <h3 className={styles.name}>{device.name}</h3>
          <span className={styles.vendor}>{device.vendor}</span>
        </div>

        <div className={styles.meta}>
          {device.compute && (
            <span className={styles.chip} title="Compute backend">
              <Zap size={11} /> {device.compute}
            </span>
          )}
          {vram && <span className={styles.chip}>VRAM {vram}</span>}
          {device.cores && <span className={styles.chip}>{device.cores} cores</span>}
          {device.metal && <span className={styles.chip}>{device.metal}</span>}
          {device.driver_version && device.driver_version !== 'N/A' && (
            <span className={styles.chip}>Driver {device.driver_version}</span>
          )}
          {device.cuda_version && device.cuda_version !== 'N/A' && (
            <span className={styles.chip}>CUDA {device.cuda_version}</span>
          )}
        </div>

        {hasStats && (
          <div className={styles.stats}>
            {stats!.gpu_util !== undefined && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>GPU</span>
                <div className={styles.statTrack}>
                  <div
                    className={styles.statBar}
                    style={{ width: `${Math.min(100, Math.max(0, stats!.gpu_util!))}%` }}
                  />
                </div>
                <span className={styles.statValue}>{stats!.gpu_util}%</span>
              </div>
            )}
            <div className={styles.statChips}>
              {stats!.vram_used_bytes !== undefined && (
                <span className={styles.chip}>GPU memory {formatBytes(stats!.vram_used_bytes)} in use</span>
              )}
              {stats!.temperature !== undefined && stats!.temperature !== null && (
                <span className={styles.chip}>{stats!.temperature}°C</span>
              )}
              {stats!.fan_speed !== undefined && stats!.fan_speed !== null && (
                <span className={styles.chip}>Fan {stats!.fan_speed}%</span>
              )}
            </div>
          </div>
        )}

        {!hasLiveTelemetry && !hasStats && (
          <p className={styles.note}>
            <Layers size={11} /> Device detected — live utilization telemetry is not
            available in this environment.
          </p>
        )}
      </div>
    </div>
  );
}
