'use client';

import { useEffect, useState } from 'react';

type ConnectionStatus = 'online' | 'unstable' | 'offline';

interface Connection {
  id: string;
  name: string;
  status: ConnectionStatus;
  details: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse-fast';
      case 'unstable': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse';
      case 'offline': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-sans">
      <div className="max-w-2xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-8 text-white tracking-tight flex items-center gap-3">
          <span className="text-xl">📡</span> Estado del Sistema
        </h1>
        
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
          {loading && connections.length === 0 ? (
            <div className="text-neutral-500 animate-pulse flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin" />
              Estableciendo enlace de telemetría...
            </div>
          ) : (
            <div className="space-y-6">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-5 bg-black/40 rounded-xl border border-neutral-800/80 transition-all hover:border-neutral-700">
                  <div className="flex items-center space-x-5">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      {/* Lucecita animada */}
                      <div className={`absolute w-3.5 h-3.5 rounded-full ${getStatusColor(conn.status)}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-200 text-lg">{conn.name}</h3>
                      <p className="text-sm text-neutral-500 font-mono mt-1">{conn.details}</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800">
                    {conn.status === 'online' && <span className="text-green-400">Operativo</span>}
                    {conn.status === 'unstable' && <span className="text-yellow-400">Inestable</span>}
                    {conn.status === 'offline' && <span className="text-red-400">Desconectado</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.90); }
        }
        .animate-pulse-fast {
          animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
