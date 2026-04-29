'use client';

import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { MoveRecord, VoiceEmotion } from '@/types';

interface GameState {
  chess: Chess;
  fen: string;
  history: MoveRecord[];
  turnStartedAt: number;
  isGameOver: boolean;
  result: string | null;
  lastMove: { from: string; to: string } | null;
  reset: () => void;
  makeMove: (move: { from: string; to: string; promotion?: string }, emotion?: VoiceEmotion, voiceConfidence?: number) => boolean;
  undo: (count?: number) => number;
  loadFen: (fen: string) => void;
  loadPgn: (pgn: string) => void;
  /** Replay a list of SAN moves (used when reconnecting and syncing from peer). */
  loadSans: (sans: string[], thinkMs?: number[]) => void;
}

const newChess = () => new Chess();

export const useGameStore = create<GameState>((set, get) => ({
  chess: newChess(),
  fen: newChess().fen(),
  history: [],
  turnStartedAt: Date.now(),
  isGameOver: false,
  result: null,
  lastMove: null,

  reset: () => {
    const c = newChess();
    set({ chess: c, fen: c.fen(), history: [], turnStartedAt: Date.now(), isGameOver: false, result: null, lastMove: null });
  },

  makeMove: (move, emotion, voiceConfidence) => {
    const { chess, history, turnStartedAt } = get();
    try {
      const m = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
      if (!m) return false;
      const record: MoveRecord = {
        san: m.san,
        from: m.from,
        to: m.to,
        fen: chess.fen(),
        thinkMs: Date.now() - turnStartedAt,
        emotion,
        voiceConfidence,
        ply: history.length + 1,
      };
      const isOver = chess.isGameOver();
      let result: string | null = null;
      if (isOver) {
        if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
        else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) result = '1/2-1/2';
      }
      set({
        fen: chess.fen(),
        history: [...history, record],
        turnStartedAt: Date.now(),
        isGameOver: isOver,
        result,
        lastMove: { from: m.from, to: m.to },
      });
      return true;
    } catch {
      return false;
    }
  },

  undo: (count = 1) => {
    const { chess, history } = get();
    let popped = 0;
    for (let i = 0; i < count; i++) {
      if (history.length - popped <= 0) break;
      const result = chess.undo();
      if (!result) break;
      popped++;
    }
    if (popped === 0) return 0;
    const newHistory = history.slice(0, history.length - popped);
    const last = newHistory[newHistory.length - 1];
    set({
      fen: chess.fen(),
      history: newHistory,
      turnStartedAt: Date.now(),
      isGameOver: false,
      result: null,
      lastMove: last ? { from: last.from, to: last.to } : null,
    });
    return popped;
  },

  loadFen: (fen) => {
    const c = new Chess(fen);
    set({ chess: c, fen: c.fen(), history: [], turnStartedAt: Date.now(), isGameOver: c.isGameOver(), result: null, lastMove: null });
  },

  loadPgn: (pgn) => {
    const c = newChess();
    c.loadPgn(pgn);
    set({ chess: c, fen: c.fen(), history: [], turnStartedAt: Date.now(), isGameOver: c.isGameOver(), result: null, lastMove: null });
  },

  loadSans: (sans, thinkMs) => {
    const c = newChess();
    const history: MoveRecord[] = [];
    for (let i = 0; i < sans.length; i++) {
      try {
        const m = c.move(sans[i]);
        if (!m) break;
        history.push({
          san: m.san,
          from: m.from,
          to: m.to,
          fen: c.fen(),
          thinkMs: thinkMs?.[i] ?? 0,
          ply: i + 1,
        });
      } catch {
        break;
      }
    }
    const last = history[history.length - 1];
    let isOver = c.isGameOver();
    let result: string | null = null;
    if (isOver) {
      if (c.isCheckmate()) result = c.turn() === 'w' ? '0-1' : '1-0';
      else if (c.isDraw() || c.isStalemate() || c.isThreefoldRepetition()) result = '1/2-1/2';
    }
    set({
      chess: c,
      fen: c.fen(),
      history,
      turnStartedAt: Date.now(),
      isGameOver: isOver,
      result,
      lastMove: last ? { from: last.from, to: last.to } : null,
    });
  },
}));
