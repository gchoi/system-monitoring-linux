'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Monitor, RefreshCw, AlertTriangle, Layers, Terminal, Server } from 'lucide-react';
import styles from './Dashboard.module.css';
import SystemOverview from './SystemOverview';
import SystemCharts, { SystemHistoryItem } from './SystemCharts';
import GpuCard from './GpuCard';
import GpuDetailCard from './GpuDetailCard';
import RealtimeChart from './RealtimeChart';
import ProcessTable from './ProcessTable';
import { TelemetryData } from '../types/gpu';

export interface HistoryItem {
  time: string;
  gpuUtil: number;
  memUtil: number;
}

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [selectedGpuIndex, setSelectedGpuIndex] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const [errorCount, setErrorCount] = useState<number>(0);

  // Rolling history for GPU
  const [gpuHistory, setGpuHistory] = useState<Record<number, HistoryItem[]>>({});
  // Rolling history for system (CPU & Memory)
  const [systemHistory, setSystemHistory] = useState<SystemHistoryItem[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const getWsUrl = () => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${host}:8000/ws`;
  };

  const connect = () => {
    setConnectionStatus('connecting');
    if (ws.current) {
      ws.current.close();
    }

    const wsUrl = getWsUrl();
    console.log(`Connecting to WebSocket: ${wsUrl}`);

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      setErrorCount(0);
    };

    socket.onmessage = (event) => {
      try {
        const data: TelemetryData = JSON.parse(event.data);
        setTelemetry(data);

        const timeStr = new Date(data.timestamp * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        // Update GPU history for each GPU
        setGpuHistory((prevHistory) => {
          const updated = { ...prevHistory };
          data.gpus.forEach((gpu) => {
            const currentHistory = updated[gpu.index] || [];
            const newItem: HistoryItem = {
              time: timeStr,
              gpuUtil: gpu.gpu_util,
              memUtil: gpu.mem_util,
            };
            updated[gpu.index] = [...currentHistory, newItem].slice(-30);
          });
          return updated;
        });

        // Update system history
        setSystemHistory((prev) => {
          const newItem: SystemHistoryItem = {
            time: timeStr,
            cpu: data.system.cpu.percent,
            memory: data.system.memory.percent,
          };
          return [...prev, newItem].slice(-30);
        });
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket closed: ${event.reason} (code: ${event.code})`);
      setConnectionStatus('disconnected');

      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = setTimeout(() => {
        setErrorCount((c) => c + 1);
        connect();
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket error occurred:', err);
      setConnectionStatus('disconnected');
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, []);

  const handleRetry = () => {
    setErrorCount(0);
    connect();
  };

  const activeGpu = telemetry?.gpus.find((g) => g.index === selectedGpuIndex) || telemetry?.gpus[0];
  const activeHistory = activeGpu ? gpuHistory[activeGpu.index] || [] : [];

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className={styles.container}>
      {/* ── Header ───────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Monitor size={28} className="grad-cyan-blue" style={{ stroke: 'url(#cyan-blue-grad)' }} />
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <linearGradient id="cyan-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-cyan)" />
              <stop offset="100%" stopColor="var(--accent-blue)" />
            </linearGradient>
          </svg>
          <h1 className={styles.title}>
            SYSTEM <span style={{ color: 'var(--accent-cyan)' }}>MONITOR</span>
          </h1>
          {telemetry?.is_mock && <span className={styles.badge}>MOCK DATA</span>}
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {telemetry && (
            <div className={styles.systemInfo}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Host</span>
                <span className={styles.infoValueMono}>{telemetry.system.hostname}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Platform</span>
                <span className={styles.infoValueMono}>{telemetry.system.platform}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Uptime</span>
                <span className={styles.infoValueMono}>{formatUptime(telemetry.system.uptime)}</span>
              </div>
              {telemetry.driver_version !== 'N/A' && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Driver</span>
                    <span className={styles.infoValueMono}>{telemetry.driver_version}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>CUDA</span>
                    <span className={styles.infoValueMono}>{telemetry.cuda_version}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.connectionStatus}>
            <span className={`pulse-dot ${
              connectionStatus === 'connected' ? '' :
              connectionStatus === 'connecting' ? 'connecting' : 'disconnected'
            }`} />
            <span>{connectionStatus}</span>
          </div>
        </div>
      </header>

      {/* ── Connection Failure ───────────────────────────────── */}
      {connectionStatus === 'disconnected' && errorCount > 2 && !telemetry && (
        <div className={styles.errorPanel}>
          <AlertTriangle size={48} style={{ color: 'var(--accent-red)' }} />
          <h2 className={styles.errorTitle}>API Server Unreachable</h2>
          <p className={styles.errorDesc}>
            Failed to connect to the backend WebSocket stream. Ensure the python API server is running at{' '}
            <code>{getWsUrl()}</code> and is accessible.
          </p>
          <button className={styles.retryBtn} onClick={handleRetry}>
            <RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────── */}
      {telemetry && (
        <>
          {/* System Overview Cards */}
          <section>
            <h2 className={styles.sectionTitle}>
              <Server size={14} /> System Overview
            </h2>
            <SystemOverview system={telemetry.system} />
          </section>

          {/* System Charts */}
          <section>
            <SystemCharts cpuHistory={systemHistory} memoryHistory={systemHistory} />
          </section>

          {/* GPU Section */}
          <section>
            <h2 className={styles.sectionTitle}>
              <Layers size={14} /> GPU Devices ({telemetry.gpus.length})
            </h2>
            <div className={styles.grid}>
              {/* Sidebar - GPU List */}
              <aside className={styles.sidebar}>
                <div className={styles.gpuList}>
                  {telemetry.gpus.map((gpu) => (
                    <GpuCard
                      key={gpu.uuid}
                      gpu={gpu}
                      isActive={activeGpu?.index === gpu.index}
                      onClick={() => setSelectedGpuIndex(gpu.index)}
                    />
                  ))}
                </div>
              </aside>

              {/* Main Content Areas */}
              {activeGpu && (
                <div className={styles.mainContent}>
                  <GpuDetailCard gpu={activeGpu} />

                  <div className={styles.chartsGrid}>
                    <RealtimeChart history={activeHistory} gpuName={activeGpu.name} />
                  </div>

                  <div>
                    <h2 className={styles.sectionTitle} style={{ marginBottom: '12px' }}>
                      <Terminal size={14} /> Running Processes ({activeGpu.processes.length})
                    </h2>
                    <ProcessTable processes={activeGpu.processes} />
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
