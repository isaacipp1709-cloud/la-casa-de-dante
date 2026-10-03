'use client';

import React, { useState, useEffect } from 'react';

interface Conversation {
  id: string;
  external_id?: string;
  updated_at: string;
}

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  averageLatencyMs: number;
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  
  useEffect(() => {
    fetch('/api/conversations')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(console.error);

    fetch('/api/analytics')
      .then(r => r.json())
      .then(setAnalytics)
      .catch(console.error);
  }, []);
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboard de Control</h1>
      
      {analytics && (
        <div className="mb-8 p-6 bg-gray-100 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Métricas Globales</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded shadow text-center">
              <p className="text-sm text-gray-500">Conversaciones</p>
              <p className="text-2xl font-bold">{analytics.totalConversations || 0}</p>
            </div>
            <div className="p-4 bg-white rounded shadow text-center">
              <p className="text-sm text-gray-500">Mensajes</p>
              <p className="text-2xl font-bold">{analytics.totalMessages || 0}</p>
            </div>
            <div className="p-4 bg-white rounded shadow text-center">
              <p className="text-sm text-gray-500">Latencia Promedio</p>
              <p className="text-2xl font-bold">{analytics.averageLatencyMs || 0}ms</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Últimas Conversaciones</h2>
        <ul className="space-y-2">
          {conversations.map(c => (
            <li key={c.id} className="p-4 bg-white border rounded shadow flex justify-between">
              <span className="font-mono">{c.external_id || c.id}</span>
              <span className="text-gray-500 text-sm">
                {new Date(c.updated_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        {conversations.length === 0 && <p className="text-gray-500">No hay conversaciones registradas.</p>}
      </div>
      
      <div className="mt-8">
        <a href="/dashboard/providers" className="text-blue-500 hover:underline">
          → Gestionar Proveedores de IA
        </a>
      </div>
    </div>
  );
}
