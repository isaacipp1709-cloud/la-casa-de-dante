'use client';

import React, { useState, useEffect } from 'react';

interface Provider {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  usageToday: number;
  dailyLimit: number;
  is_public: boolean;
}

export default function ProvidersPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  
  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = () => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(console.error);
  };
  
  const addProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      category: formData.get('category'),
      apiKey: formData.get('apiKey')
    };

    await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    e.currentTarget.reset();
    fetchProviders();
  };

  const deleteProvider = async (id: string) => {
    await fetch(`/api/providers?id=${id}`, { method: 'DELETE' });
    fetchProviders();
  };
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">APIs Conectadas</h1>
      
      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left border-b">Nombre</th>
              <th className="p-4 text-left border-b">Categoría</th>
              <th className="p-4 text-left border-b">Estado</th>
              <th className="p-4 text-left border-b">Consumo</th>
              <th className="p-4 text-left border-b">Tipo</th>
              <th className="p-4 text-left border-b">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4 text-gray-500">{p.category}</td>
                <td className="p-4">{p.is_active ? '✅' : '❌'}</td>
                <td className="p-4">{p.usageToday}/{p.dailyLimit}</td>
                <td className="p-4">{p.is_public ? '🟢' : '🔒'}</td>
                <td className="p-4">
                  <button onClick={() => deleteProvider(p.id)} className="text-red-500 hover:underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gray-100 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Agregar Proveedor</h2>
        <form onSubmit={addProvider} className="flex gap-4">
          <input name="name" placeholder="Nombre" required className="flex-1 p-2 border rounded" />
          <input name="category" placeholder="Categoría" required className="flex-1 p-2 border rounded" />
          <input name="apiKey" type="password" placeholder="API Key" className="flex-1 p-2 border rounded" />
          <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition">
            Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
