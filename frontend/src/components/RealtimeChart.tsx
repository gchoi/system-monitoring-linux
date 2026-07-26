'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { HistoryItem } from './Dashboard';
import styles from './RealtimeChart.module.css';

interface RealtimeChartProps {
  history: HistoryItem[];
  gpuName: string;
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

export default function RealtimeChart({ history, gpuName }: RealtimeChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Activity Trends</h3>
        </div>
        <div className={styles.chartWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading Telemetry Chart...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Activity History (30s)</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.colorGpu}`} />
            <span>GPU Util</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.colorMem}`} />
            <span>VRAM Util</span>
          </div>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={history}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gpuUtilGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="memUtilGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-purple)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-purple)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="var(--text-muted)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              dy={10}
            />
            <YAxis 
              domain={[0, 100]} 
              stroke="var(--text-muted)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              name="GPU Util"
              type="monotone"
              dataKey="gpuUtil"
              stroke="var(--accent-cyan)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#gpuUtilGrad)"
              activeDot={{ r: 4, stroke: '#07090e', strokeWidth: 2 }}
            />
            <Area
              name="VRAM Util"
              type="monotone"
              dataKey="memUtil"
              stroke="var(--accent-purple)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#memUtilGrad)"
              activeDot={{ r: 4, stroke: '#07090e', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
