'use client';

import { useEffect, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  roomId: string;
  enabled: boolean;
  /** True for the peer that creates the WebRTC offer (typically white). */
  initiator: boolean;
  signalingChannel?: any;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function VoiceChat({ roomId, enabled, initiator, signalingChannel }: Props) {
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState<string>('idle');

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subscribedHandlersRef = useRef<{ off: () => void } | null>(null);

  useEffect(() => {
    if (!enabled || !signalingChannel) {
      setStatusText('idle');
      return;
    }

    let cancelled = false;
    setStatusText('starting');

    const send = (event: string, payload: any) => {
      try {
        signalingChannel.send({ type: 'broadcast', event, payload });
      } catch (e) {
        console.warn('[voicechat] send failed', event, e);
      }
    };

    const setup = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (e: any) {
        console.error('[voicechat] getUserMedia failed', e);
        toast.error('🎧 Mic permission denied');
        setStatusText('mic-denied');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRef.current = pc;

      stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (ev) => {
        if (audioRef.current) {
          audioRef.current.srcObject = ev.streams[0];
          audioRef.current.play().catch((err) => console.warn('[voicechat] audio play blocked', err));
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        console.log('[voicechat] state =', st);
        setConnected(st === 'connected');
        setStatusText(st);
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) send('voice-ice', ev.candidate.toJSON());
      };

      // Handlers
      const onOffer = async ({ payload }: any) => {
        if (!payload || initiator) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send('voice-answer', ans);
        } catch (e) {
          console.error('[voicechat] handle offer failed', e);
        }
      };
      const onAnswer = async ({ payload }: any) => {
        if (!payload || !initiator) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        } catch (e) {
          console.error('[voicechat] handle answer failed', e);
        }
      };
      const onIce = async ({ payload }: any) => {
        if (!payload) return;
        try {
          await pc.addIceCandidate(payload);
        } catch (e) {
          console.warn('[voicechat] addIceCandidate failed', e);
        }
      };
      const onHello = async () => {
        // Non-initiator says "I'm ready" → initiator (re-)sends offer.
        if (!initiator) return;
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          send('voice-offer', offer);
        } catch (e) {
          console.error('[voicechat] createOffer failed', e);
        }
      };

      signalingChannel
        .on('broadcast', { event: 'voice-offer' }, onOffer)
        .on('broadcast', { event: 'voice-answer' }, onAnswer)
        .on('broadcast', { event: 'voice-ice' }, onIce)
        .on('broadcast', { event: 'voice-hello' }, onHello);

      subscribedHandlersRef.current = {
        off: () => {
          // Supabase channel doesn't expose .off for individual handlers;
          // we rely on full channel teardown happening in the parent. This is a no-op safety net.
        },
      };

      if (initiator) {
        // Send the offer right away; non-initiator may also re-trigger us via 'voice-hello'.
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          send('voice-offer', offer);
        } catch (e) {
          console.error('[voicechat] initial createOffer failed', e);
        }
      } else {
        // Tell the initiator we're ready in case they set up first and missed our subscribe.
        send('voice-hello', { roomId });
      }
      setStatusText('connecting');
    };

    setup();

    return () => {
      cancelled = true;
      try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      try { peerRef.current?.close(); } catch {}
      localStreamRef.current = null;
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signalingChannel, initiator]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  if (!enabled) return null;

  return (
    <div className="card flex items-center gap-3">
      <Headphones className={`w-5 h-5 ${connected ? 'text-green-500' : 'text-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">Voice chat — {roomId}</div>
        <div className="text-xs text-gray-500">
          {connected ? 'Connected' : statusText}
        </div>
      </div>
      <button onClick={toggleMute} className="btn-ghost p-2" title={muted ? 'Unmute' : 'Mute'}>
        {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <Volume2 className="w-4 h-4 text-gray-400" />
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
}
