'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Plus, FileText, Trash2, Upload, Globe } from 'lucide-react';
import { api } from '../../../lib/api';

interface KnowledgeBase {
  id: string;
  name: string;
  _count: { documents: number };
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.get('/api/kb')
      .then((res) => setBases(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createBase() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/kb', { name: newName });
      setBases((prev) => [res.data, ...prev]);
      setNewName('');
    } catch {}
    setCreating(false);
  }

  async function deleteBase(id: string) {
    try {
      await api.delete(`/api/kb/${id}`);
      setBases((prev) => prev.filter((b) => b.id !== id));
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conhecimento</h1>
          <p className="text-sm text-gray-500 mt-1">Treine sua IA com documentos e informações do seu negócio</p>
        </div>
      </div>

      {/* Create new */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Criar nova base</h3>
        <div className="flex gap-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da base de conhecimento..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={(e) => e.key === 'Enter' && createBase()} />
          <button onClick={createBase} disabled={creating || !newName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
            <Plus size={16} /> Criar
          </button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"><div className="h-5 bg-gray-200 rounded w-32" /></div>
        )) : bases.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-gray-100 p-12 text-center">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhuma base criada</h3>
            <p className="text-sm text-gray-500 mt-2">Crie uma base e faça upload de documentos para treinar a IA.</p>
          </div>
        ) : bases.map((base) => (
          <div key={base.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <BookOpen size={20} className="text-primary-600" />
              </div>
              <button onClick={() => deleteBase(base.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{base.name}</h3>
            <p className="text-xs text-gray-400 mb-3">{base._count.documents} documento(s) · {new Date(base.createdAt).toLocaleDateString('pt-BR')}</p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:underline">
                <Upload size={12} /> Upload
              </button>
              <button className="flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:underline">
                <Globe size={12} /> Indexar URL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
