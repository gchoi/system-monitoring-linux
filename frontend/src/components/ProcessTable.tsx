'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { GpuProcess } from '../types/gpu';
import styles from './ProcessTable.module.css';

interface ProcessTableProps {
  processes: GpuProcess[];
}

type SortField = 'pid' | 'name' | 'type' | 'used_memory';
type SortOrder = 'asc' | 'desc';

export default function ProcessTable({ processes }: ProcessTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('used_memory');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter logic
  const filtered = processes.filter((proc) => {
    const term = searchTerm.toLowerCase();
    return (
      proc.name.toLowerCase().includes(term) ||
      proc.pid.toString().includes(term) ||
      proc.type.toLowerCase().includes(term)
    );
  });

  // Sort logic
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    }
    
    // Numbers
    return sortOrder === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' 
      ? <ChevronUp size={12} style={{ marginLeft: '4px', display: 'inline' }} /> 
      : <ChevronDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />;
  };

  const getBadgeClass = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('compute')) return styles.typeCompute;
    if (t.includes('graphics')) return styles.typeGraphics;
    return styles.typeUnknown;
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Filter processes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
          Showing {sorted.length} of {processes.length}
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} onClick={() => handleSort('pid')}>
                  PID {getSortIcon('pid')}
                </th>
                <th className={styles.th} onClick={() => handleSort('name')}>
                  Process Name {getSortIcon('name')}
                </th>
                <th className={styles.th} onClick={() => handleSort('type')}>
                  Type {getSortIcon('type')}
                </th>
                <th className={styles.th} onClick={() => handleSort('used_memory')} style={{ textAlign: 'right' }}>
                  GPU Memory {getSortIcon('used_memory')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((proc) => (
                <tr key={proc.pid} className={styles.tr}>
                  <td className={`${styles.td} ${styles.pid}`}>
                    {proc.pid}
                  </td>
                  <td className={`${styles.td} ${styles.name}`}>
                    {proc.name}
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.typeBadge} ${getBadgeClass(proc.type)}`}>
                      {proc.type}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.memory}`} style={{ textAlign: 'right' }}>
                    {proc.used_memory} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Terminal size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <div className={styles.emptyTitle}>No Active Processes</div>
          <p className={styles.emptyDesc}>
            {processes.length === 0
              ? 'No graphics or compute workloads are currently running on this GPU.'
              : 'Try checking your search term filter.'}
          </p>
        </div>
      )}
    </div>
  );
}
