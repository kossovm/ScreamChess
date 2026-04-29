'use client';

import { Chessboard } from 'react-chessboard';
import { useGameStore } from '@/store/gameStore';
import { useTheme } from './ThemeProvider';
import { Square } from 'chess.js';
import { useMemo } from 'react';
import toast from 'react-hot-toast';
import { useT } from './LanguageProvider';

interface Props {
  orientation?: 'white' | 'black';
  disabled?: boolean;
  /**
   * If set, only pieces of this colour can be moved by this client (used in
   * online play). When null/undefined, both sides can move (local play).
   */
  playerSide?: 'w' | 'b' | null;
  onMove?: (move: { from: string; to: string; promotion?: string }) => void;
  highlightSquares?: Record<string, React.CSSProperties>;
}

export default function ChessBoard({ orientation = 'white', disabled, playerSide, onMove, highlightSquares }: Props) {
  const { fen, chess, lastMove, makeMove, isGameOver } = useGameStore();
  const { theme } = useTheme();
  const t = useT();

  const onPieceDrop = (from: string, to: string, piece: string) => {
    if (disabled || isGameOver) return false;
    // piece looks like 'wP', 'bN', etc. First char is colour.
    const pieceColor = piece?.[0] as 'w' | 'b' | undefined;
    if (playerSide && pieceColor && pieceColor !== playerSide) {
      toast.error(t('online.notYourPiece'));
      return false;
    }
    if (playerSide && chess.turn() !== playerSide) {
      toast.error(t('online.notYourTurn'));
      return false;
    }
    const ok = makeMove({ from, to, promotion: 'q' });
    if (ok && onMove) onMove({ from, to, promotion: 'q' });
    return ok;
  };

  const isDraggablePiece = ({ piece }: { piece: string }) => {
    if (disabled || isGameOver) return false;
    const pieceColor = piece?.[0] as 'w' | 'b' | undefined;
    // Only colour gating happens here — turn-order is enforced inside onPieceDrop
    // so the user can pick up their pieces freely and just gets a toast if they
    // try to drop out of turn.
    if (playerSide && pieceColor && pieceColor !== playerSide) return false;
    return true;
  };

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...(highlightSquares || {}) };
    if (lastMove) {
      const c = 'rgba(168, 85, 247, 0.35)';
      styles[lastMove.from] = { ...styles[lastMove.from], background: c };
      styles[lastMove.to] = { ...styles[lastMove.to], background: c };
    }
    if (chess.inCheck()) {
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = board[r][f];
          if (sq && sq.type === 'k' && sq.color === chess.turn()) {
            const file = 'abcdefgh'[f];
            const rank = 8 - r;
            styles[`${file}${rank}`] = { background: 'rgba(239, 68, 68, 0.45)' };
          }
        }
      }
    }
    return styles;
  }, [chess, lastMove, highlightSquares]);

  const lightSquareColor = theme === 'dark' ? '#3a3a4a' : '#f0d9b5';
  const darkSquareColor = theme === 'dark' ? '#1c1c26' : '#b58863';

  return (
    <div className="chess-board-container w-full max-w-[640px] mx-auto rounded-2xl overflow-hidden">
      <Chessboard
        position={fen}
        onPieceDrop={onPieceDrop}
        isDraggablePiece={isDraggablePiece}
        boardOrientation={orientation}
        customBoardStyle={{ borderRadius: '14px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
        customDarkSquareStyle={{ backgroundColor: darkSquareColor }}
        customLightSquareStyle={{ backgroundColor: lightSquareColor }}
        customSquareStyles={customSquareStyles}
        animationDuration={200}
      />
    </div>
  );
}
