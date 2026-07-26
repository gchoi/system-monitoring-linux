'use client';

import React from 'react';
import { GpuData } from '../types/gpu';
import styles from './GpuCard.module.css';

interface GpuCardProps {
  gpu: GpuData;
  isActive: boolean;
  onClick: () => void;
}

export default function GpuCard({ gpu, isActive, onClick }: GpuCardProps) {
  // Determine temperature styling based on threshold limits
  const getTempClass = (temp: number) => {
    if (temp >= 82) return styles.tempDanger;
    if (temp >= 72) return styles.tempWarning;
    return '';
  };

  return (
    <div
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.gpuHeader}>
        <div style={{ maxWidth: '80%' }}>
          <span className={styles.gpuIndex}>GPU {gpu.index}</span>
          <div className={styles.gpuName} title={gpu.name}>
            {gpu.name}
          </div>
        </div>
      </div>
      
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>UTIL</span>
          <span className={styles.metricValue}>{gpu.gpu_util}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>VRAM</span>
          <span className={styles.metricValue}>{gpu.mem_util}%</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>TEMP</span>
          <span className={`${styles.metricValue} ${getTempClass(gpu.temperature)}`}>
            {gpu.temperature}°C
          </span>
        </div>
      </div>
    </div>
  );
}
