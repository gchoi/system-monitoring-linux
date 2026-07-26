'use client';

import React from 'react';
import { Activity, Database, Thermometer, Zap, Wind } from 'lucide-react';
import { GpuData } from '../types/gpu';
import styles from './GpuDetailCard.module.css';

interface GpuDetailCardProps {
  gpu: GpuData;
}

export default function GpuDetailCard({ gpu }: GpuDetailCardProps) {
  // Format VRAM memory helper
  const formatMemory = (megabytes: number) => {
    if (megabytes >= 1024) {
      return `${(megabytes / 1024).toFixed(1)} GB`;
    }
    return `${megabytes} MB`;
  };

  // Determine percentage for power limit
  const powerPercent = gpu.power_limit > 0 
    ? Math.min(100, (gpu.power_draw / gpu.power_limit) * 100) 
    : 0;

  return (
    <section className={styles.detailCard}>
      <div className={styles.titleHeader}>
        <h2 className={styles.deviceTitle}>{gpu.name}</h2>
        <span className={styles.deviceUuid}>{gpu.uuid}</span>
      </div>

      <div className={styles.grid}>
        {/* GPU Core Utilization */}
        <div className={styles.metricBlock}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>GPU Utilization</span>
            <div className={styles.iconWrapper} style={{ color: 'var(--accent-cyan)' }}>
              <Activity size={18} />
            </div>
          </div>
          <div>
            <span className={styles.metricValue}>{gpu.gpu_util}</span>
            <span className={styles.metricUnit}>%</span>
          </div>
          <div className={styles.progressContainer}>
            <div 
              className={`${styles.progressBar} ${styles.barCyan}`} 
              style={{ width: `${gpu.gpu_util}%` }}
            />
          </div>
          <div className={styles.subText}>
            <span>Core Usage</span>
            <span>100% Max</span>
          </div>
        </div>

        {/* VRAM Memory */}
        <div className={styles.metricBlock}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>VRAM Memory</span>
            <div className={styles.iconWrapper} style={{ color: 'var(--accent-purple)' }}>
              <Database size={18} />
            </div>
          </div>
          <div>
            <span className={styles.metricValue}>{gpu.mem_util}</span>
            <span className={styles.metricUnit}>%</span>
          </div>
          <div className={styles.progressContainer}>
            <div 
              className={`${styles.progressBar} ${styles.barPurple}`} 
              style={{ width: `${gpu.mem_util}%` }}
            />
          </div>
          <div className={styles.subText}>
            <span>{formatMemory(gpu.mem_used)} used</span>
            <span>{formatMemory(gpu.mem_total)} total</span>
          </div>
        </div>

        {/* Temperature / Fan Speed */}
        <div className={styles.metricBlock}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Temperature</span>
            <div className={styles.iconWrapper} style={{ 
              color: gpu.temperature >= 75 ? 'var(--accent-orange)' : 'var(--accent-green)' 
            }}>
              <Thermometer size={18} />
            </div>
          </div>
          <div>
            <span className={styles.metricValue}>{gpu.temperature}</span>
            <span className={styles.metricUnit}>°C</span>
          </div>
          <div className={styles.progressContainer}>
            <div 
              className={`${styles.progressBar} ${
                gpu.temperature >= 80 ? styles.barOrange : styles.barGreen
              }`} 
              style={{ width: `${Math.min(100, (gpu.temperature / 100) * 100)}%` }}
            />
          </div>
          <div className={styles.subText}>
            <span>Fan Speed</span>
            {gpu.fan_speed > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Wind size={10} /> {gpu.fan_speed}%
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>PASSIVE</span>
            )}
          </div>
        </div>

        {/* Power Draw */}
        <div className={styles.metricBlock}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Power Draw</span>
            <div className={styles.iconWrapper} style={{ color: 'var(--accent-orange)' }}>
              <Zap size={18} />
            </div>
          </div>
          <div>
            <span className={styles.metricValue}>{gpu.power_draw}</span>
            <span className={styles.metricUnit}>W</span>
          </div>
          <div className={styles.progressContainer}>
            <div 
              className={`${styles.progressBar} ${styles.barOrange}`} 
              style={{ width: `${powerPercent}%` }}
            />
          </div>
          <div className={styles.subText}>
            <span>Active draw</span>
            <span>Limit: {gpu.power_limit} W</span>
          </div>
        </div>
      </div>
    </section>
  );
}
