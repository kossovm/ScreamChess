'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Link2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OnlineLobby() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const create = () => {
    const id = uuid().slice(0, 8);
    router.push(`/play/online/${id}`);
  };
  const join = () => {
    if (!code.trim()) {
      toast.error('Enter a room code');
      return;
    }
    router.push(`/play/online/${code.trim()}`);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-display font-bold mb-2">Online with Voice</h1>
      <p className="text-gray-500 mb-8">Create a room or join one. Voice chat opens automatically.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={create} className="card text-left hover:scale-[1.02] transition-transform">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-pink-500 flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">Create room</h3>
          <p className="text-sm text-gray-500">Generate a shareable link.</p>
        </button>

        <div className="card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center mb-4">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">Join room</h3>
          <input
            placeholder="Room code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input mt-2 mb-3"
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button onClick={join} className="btn-primary w-full">Join</button>
        </div>
      </div>
    </div>
  );
}
