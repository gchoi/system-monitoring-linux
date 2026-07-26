'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import styles from './SystemCharts.module.css';

export interface SystemHistoryItem {
  time: string;
  cpu: number;
  memory: number;
}

interface SystemChartsProps {
  cpuHistory: SystemHistoryItem[];
  memoryHistory: SystemHistoryItem[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>Time: {label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className={styles.tooltipItem} style={{ color: entry.color }}>
            <span>{entry.name}:</span>
            <span>{entry.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function SystemCharts({ cpuHistory, memoryHistory }: SystemChartsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={styles.chartsRow}>
        <div className={styles.chartContainer}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>CPU Usage</h3>
          </div>
          <div className={styles.chartWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</span>
          </div>
        </div>
        <div className={styles.chartContainer}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Memory Usage</h3>
          </div>
          <div className={styles.chartWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartsRow}>
      {/* CPU History */}
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>CPU Usage (30s)</h3>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendColor} ${styles.colorCpu}`} />
              <span>CPU %</span>
            </div>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cpuHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuHistGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                name="CPU"
                type="monotone"
                dataKey="cpu"
                stroke="var(--accent-cyan)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuHistGrad)"
                activeDot={{ r: 4, stroke: '#07090e', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Memory History */}
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Memory Usage (30s)</h3>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendColor} ${styles.colorMem}`} />
              <span>RAM %</span>
            </div>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={memoryHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="memHistGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                name="Memory"
                type="monotone"
                dataKey="memory"
                stroke="var(--accent-purple)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#memHistGrad)"
                activeDot={{ r: 4, stroke: '#07090e', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
