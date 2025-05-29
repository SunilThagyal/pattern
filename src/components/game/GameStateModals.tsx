
"use client";

import { Button } from '@/components/ui/button';
import type { Room, Guess, Player } from '@/lib/types';
import { Trophy, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStateModalsProps {
  gameState: Room['gameState'];
  currentPattern?: string | null;
  currentDrawerName?: string | null;
  guesses: Guess[];
  roundEndCountdown: number | null;
  players: Player[];
  isHost: boolean;
  onPlayAgain: () => void;
  canPlayAgain: boolean;
}

export function GameStateModals({
  gameState,
  currentPattern,
  currentDrawerName,
  guesses,
  roundEndCountdown,
  players,
  isHost,
  onPlayAgain,
  canPlayAgain,
}: GameStateModalsProps) {
  if (gameState !== 'round_end' && gameState !== 'game_over') {
    return null;
  }

  const startButtonInfo = gameState === 'game_over' 
    ? { text: 'Play Again', icon: <RotateCcw size={16} /> }
    : null; // No button for round_end as it's automatic

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
      <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full">
        {gameState === 'round_end' && (
          <>
            <div className="text-2xl mb-3 text-green-700 font-bold text-center">Round Over!</div>
            <p className="text-md mb-2 text-center text-foreground">The word was: <strong className="font-mono text-primary">{currentPattern || "N/A"}</strong></p>
            <p className="text-md mb-3 text-center text-foreground">Drawer: {currentDrawerName || 'N/A'}</p>
            <h4 className="font-semibold mt-3 mb-1 text-center text-foreground">Correct Guesses:</h4>
            {guesses.filter(g => g.isCorrect).length > 0 ? (
              <ul className="list-disc list-inside text-sm text-center max-h-32 overflow-y-auto text-muted-foreground">
                {guesses.filter(g => g.isCorrect).map(g => (
                  <li key={`${g.playerId}_${g.timestamp}`}>{g.playerName} {g.isFirstCorrect ? <span className="font-bold text-accent">(First!)</span> : ''}</li>
                ))}
              </ul>
            ) : <p className="text-sm italic text-center text-muted-foreground">No one guessed it right this time!</p>}
            {roundEndCountdown !== null && <p className="mt-4 text-center text-lg font-semibold text-primary animate-pulse">Next round in {roundEndCountdown}s...</p>}
          </>
        )}
        {gameState === 'game_over' && (
          <>
            <div className="text-3xl mb-4 text-center text-primary flex items-center justify-center gap-2 font-bold"><Trophy className="text-yellow-500" /> Game Over! <Trophy className="text-yellow-500" /></div>
            <div className="text-center mb-3 text-lg text-foreground">Final Scores:</div>
            <ul className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {players.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
                <li key={player.id} className={cn(
                    "flex justify-between items-center p-2 text-sm rounded-md", 
                    index === 0 ? 'bg-yellow-100 font-bold text-yellow-800' : 'bg-muted'
                )}>
                  <span className="text-foreground">{index + 1}. {player.name}</span>
                  <span className="font-semibold text-foreground">{player.score || 0} pts</span>
                </li>
              ))}
            </ul>
            {isHost && startButtonInfo && (
              <div className="mt-6 text-center">
                <Button
                  onClick={onPlayAgain}
                  size="lg"
                  variant="default"
                  className="px-8 py-3 text-lg"
                  disabled={!canPlayAgain}
                >
                  {startButtonInfo.icon} {startButtonInfo.text}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
