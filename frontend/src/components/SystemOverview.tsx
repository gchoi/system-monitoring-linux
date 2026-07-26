'use client';

import React from 'react';
import { Cpu, MemoryStick, HardDrive, Wifi, Thermometer, ArrowUp, ArrowDown } from 'lucide-react';
import { SystemData } from '../types/gpu';
import styles from './SystemOverview.module.css';

interface SystemOverviewProps {
  system: SystemData;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatMB(mb: number): string {
  if (mb >= 1048576) return `${(mb / 1048576).toFixed(1)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default function SystemOverview({ system }: SystemOverviewProps) {
  const { cpu, memory, disk, network, uptime, hostname, platform } = system;
  const mainDisk = disk.partitions[0];

  const getPercentColor = (pct: number): string => {
    if (pct >= 90) return 'var(--accent-red)';
    if (pct >= 75) return 'var(--accent-orange)';
    return 'var(--accent-cyan)';
  };

  return (
    <div className={styles.overview}>
      {/* CPU Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Cpu size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>CPU</span>
          </div>
          {cpu.temperature !== null && (
            <div className={styles.tempBadge}>
              <Thermometer size={12} />
              {cpu.temperature}°C
            </div>
          )}
        </div>
        <div className={styles.cardValue} style={{ color: getPercentColor(cpu.percent) }}>
          {cpu.percent}<span className={styles.cardUnit}>%</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${cpu.percent}%`, background: `linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))` }}
          />
        </div>
        <div className={styles.cardMeta}>
          <span>{cpu.count_logical} threads</span>
          <span>{cpu.frequency_current} MHz</span>
        </div>
      </div>

      {/* Memory Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <MemoryStick size={16} style={{ color: 'var(--accent-purple)' }} />
            <span>Memory</span>
          </div>
        </div>
        <div className={styles.cardValue} style={{ color: getPercentColor(memory.percent) }}>
          {memory.percent}<span className={styles.cardUnit}>%</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressBar}
            style={{ width: `${memory.percent}%`, background: `linear-gradient(90deg, var(--accent-purple), var(--accent-pink))` }}
          />
        </div>
        <div className={styles.cardMeta}>
          <span>{formatMB(memory.used)} / {formatMB(memory.total)}</span>
        </div>
        {memory.swap_total > 0 && (
          <div className={styles.cardMeta}>
            <span>Swap: {formatMB(memory.swap_used)} / {formatMB(memory.swap_total)}</span>
          </div>
        )}
      </div>

      {/* Disk Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <HardDrive size={16} style={{ color: 'var(--accent-green)' }} />
            <span>Disk{mainDisk ? ` — ${mainDisk.mountpoint}` : ''}</span>
          </div>
        </div>
        {mainDisk ? (
          <>
            <div className={styles.cardValue} style={{ color: getPercentColor(mainDisk.percent) }}>
              {mainDisk.percent}<span className={styles.cardUnit}>%</span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${mainDisk.percent}%`, background: `linear-gradient(90deg, var(--accent-green), #00d2c4)` }}
              />
            </div>
            <div className={styles.cardMeta}>
              <span>{formatMB(mainDisk.used)} / {formatMB(mainDisk.total)}</span>
            </div>
          </>
        ) : (
          <div className={styles.cardMeta}><span>No partitions</span></div>
        )}
      </div>

      {/* Network & Uptime Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Wifi size={16} style={{ color: 'var(--accent-orange)' }} />
            <span>Network</span>
          </div>
        </div>
        <div className={styles.networkStats}>
          <div className={styles.netRow}>
            <ArrowUp size={12} style={{ color: 'var(--accent-green)' }} />
            <span className={styles.netLabel}>TX</span>
            <span className={styles.netValue}>{formatBytes(network.bytes_sent)}</span>
          </div>
          <div className={styles.netRow}>
            <ArrowDown size={12} style={{ color: 'var(--accent-cyan)' }} />
            <span className={styles.netLabel}>RX</span>
            <span className={styles.netValue}>{formatBytes(network.bytes_recv)}</span>
          </div>
        </div>
        <div className={styles.cardMeta} style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <span>⏱ {formatUptime(uptime)}</span>
          <span>{hostname}</span>
        </div>
      </div>
    </div>
  );
}
