'use client';

import { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  roomId: string;
  enabled: boolean;
  signalingChannel?: any;
}

// Lightweight WebRTC voice chat scaffold. Signaling expected via Supabase Realtime channel.
export default function VoiceChat({ roomId, enabled, signalingChannel }: Props) {
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) return;
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        peerRef.current = pc;

        stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (ev) => {
          if (audioRef.current) {
            audioRef.current.srcObject = ev.streams[0];
            audioRef.current.play().catch(() => {});
          }
        };
        pc.onconnectionstatechange = () => {
          setConnected(pc.connectionState === 'connected');
        };
        pc.onicecandidate = (ev) => {
          if (ev.candidate && signalingChannel) {
            signalingChannel.send({ type: 'broadcast', event: 'ice', payload: ev.candidate });
          }
        };

        if (signalingChannel) {
          signalingChannel.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            signalingChannel.send({ type: 'broadcast', event: 'answer', payload: ans });
          });
          signalingChannel.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
          });
          signalingChannel.on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
            try { await pc.addIceCandidate(payload); } catch {}
          });
        }

        toast.success('🎧 Mic ready');
      } catch (e) {
        console.error(e);
        toast.error('Mic permission denied');
      }
    })();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      try { peerRef.current?.close(); } catch {}
    };
  }, [enabled, signalingChannel]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };

  if (!enabled) return null;

  return (
    <div className="card flex items-center gap-3">
      <Headphones className={`w-5 h-5 ${connected ? 'text-green-500' : 'text-gray-400'}`} />
      <div className="flex-1">
        <div className="text-sm font-medium">Voice chat — Room {roomId}</div>
        <div className="text-xs text-gray-500">{connected ? 'Connected' : 'Connecting…'}</div>
      </div>
      <button onClick={toggleMute} className="btn-ghost p-2">
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
}
