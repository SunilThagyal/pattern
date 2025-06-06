
"use client";

import { Button } from '@/components/ui/button';
import type { Room, Player } from '@/lib/types';
import { Trophy, Play, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStateModalsProps {
  room: Room | null;
  players: Player[];
  isHost: boolean;
  onPlayAgain: () => void;
  canPlayAgain: boolean;
  roundEndCountdown: number | null;
  isStartingNextRoundOrGame?: boolean;
}

export function GameStateModals({
  room,
  players,
  isHost,
  onPlayAgain,
  canPlayAgain,
  roundEndCountdown,
  isStartingNextRoundOrGame,
}: GameStateModalsProps) {
  if (!room || (room.gameState !== 'round_end' && room.gameState !== 'game_over')) {
    return null;
  }

  const startButtonInfo = room.gameState === 'game_over' 
    ? { text: isStartingNextRoundOrGame ? 'Starting...' : 'Play Again', icon: isStartingNextRoundOrGame ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} /> }
    : null; 

  const currentDrawerName = room.currentDrawerId && room.players && room.players[room.currentDrawerId] 
    ? room.players[room.currentDrawerId].name 
    : 'N/A';

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
      <div className="bg-background p-6 rounded-lg shadow-xl max-w-md w-full">
        {room.gameState === 'round_end' && (
          <>
            <div className="text-2xl mb-3 text-green-700 font-bold text-center">Round Over!</div>
            <p className="text-md mb-2 text-center text-foreground">The word was: <strong className="font-mono text-primary">{room.currentPattern || "N/A"}</strong></p>
            <p className="text-md mb-3 text-center text-foreground">Drawer: {currentDrawerName}</p>
            
            <p className="text-sm text-center text-muted-foreground mt-3">
              { (room.correctGuessersThisRound && room.correctGuessersThisRound.length > 0)
                ? `${room.correctGuessersThisRound.length} player(s) guessed correctly!`
                : "No one guessed it right this time!"
              }
            </p>
            <p className="text-sm text-center text-muted-foreground">Check the player list for updated scores.</p>

            {roundEndCountdown !== null && <p className="mt-4 text-center text-lg font-semibold text-primary animate-pulse">Next round in {roundEndCountdown}s...</p>}
          </>
        )}
        {room.gameState === 'game_over' && (
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
                  disabled={!canPlayAgain || isStartingNextRoundOrGame}
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
