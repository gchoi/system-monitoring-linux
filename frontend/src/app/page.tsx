'use client';

import dynamic from 'next/dynamic';

// Dynamically import the main dashboard component to prevent SSR hydration errors
// since WebSockets are client-only.
const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#07090e',
      color: '#8b9bb4',
      fontFamily: 'var(--font-sans)',
      flexDirection: 'column',
      gap: '15px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(0, 242, 254, 0.1)',
        borderTopColor: '#00f2fe',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9', letterSpacing: '0.05em', fontFamily: 'Outfit, sans-serif' }}>
          INITIALIZING TELEMETRY
        </h2>
        <p style={{ fontSize: '0.875rem', marginTop: '4px', color: '#8b9bb4' }}>Setting up secure connection tunnel...</p>
      </div>
    </div>
  )
});

export default function Home() {
  return (
    <main>
      <Dashboard />
    </main>
  );
}
