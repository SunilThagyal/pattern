
"use client";

import { Button } from '@/components/ui/button';
import type { Room, Player } from '@/lib/types';
import { Trophy, Play, RotateCcw, Loader2, Home, PlusCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  if (!room || (room.gameState !== 'round_end' && room.gameState !== 'game_over')) {
    return null;
  }

  const startButtonInfo = room.gameState === 'game_over'
    ? { text: isStartingNextRoundOrGame ? 'Starting...' : 'Play Again', icon: isStartingNextRoundOrGame ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} /> }
    : null;

  const currentDrawerName = room.currentDrawerId && room.players && room.players[room.currentDrawerId]
    ? room.players[room.currentDrawerId].name
    : 'N/A';

  const currentTurnDisplay = (room.currentTurnInRound || 0) + 1;
  const totalTurnsInRoundDisplay = room.playerOrderForCurrentRound?.length || Object.keys(room.players || {}).filter(pid => room.players[pid]?.isOnline).length || 0;

  let turnScoreEntries: {playerId: string, name: string, score: number, isDrawer: boolean}[] = [];

  if (room.gameState === 'round_end' && room.lastRoundScoreChanges) {
    turnScoreEntries = Object.entries(room.lastRoundScoreChanges)
      .map(([playerId, score]) => {
        const playerDetails = room.players?.[playerId];
        // Ensure playerDetails and playerDetails.name exist, otherwise provide a fallback.
        const playerName = (playerDetails && playerDetails.name) ? playerDetails.name : `Player ${playerId.substring(0, 4)}`;
        return {
          playerId,
          name: playerName,
          score,
          isDrawer: playerId === room.currentDrawerId,
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score
  }


  const handleNavigation = (path: string) => {
    router.push(path);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20 p-4 overflow-y-auto">
      <div className="bg-background p-4 sm:p-6 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {room.gameState === 'round_end' && (
          <>
            <div className="flex-shrink-0">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1 text-center">
                Round {room.currentRoundNumber} / {room.config.totalRounds} | Turn {currentTurnDisplay} of {totalTurnsInRoundDisplay}
              </div>
              <h2 className="text-xl sm:text-2xl mb-2 text-primary font-bold text-center">Turn Over!</h2>
              <div className="text-center mb-3 text-sm sm:text-base">
                <p className="text-foreground">Drawer: <strong className="font-semibold">{currentDrawerName}</strong></p>
                <p className="text-foreground">The word was: <strong className="font-mono text-accent">{room.currentPattern || "N/A"}</strong></p>
              </div>
            </div>

            <div className="my-3 p-3 bg-muted/30 rounded-md flex-grow overflow-y-auto min-h-0">
              <h3 className="text-md sm:text-lg font-semibold text-foreground mb-1.5 text-center sticky top-0 bg-muted/30 py-1 z-10">Turn Scores</h3>
              {turnScoreEntries.length > 0 ? (
                <ul className="space-y-1">
                  {turnScoreEntries.map(({ playerId, name, score, isDrawer }) => (
                        <li key={playerId} className="flex justify-between items-center text-xs sm:text-sm p-1.5 bg-card rounded-sm shadow-sm">
                        <span className="truncate">{name} {isDrawer ? <span className="text-primary text-[10px]">(Drawer)</span> : ''}</span>
                        <span className={cn("font-bold", score > 0 ? 'text-green-600' : score < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                            {score >= 0 ? '+' : ''}{score}
                        </span>
                        </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Score changes for this turn will appear here.</p>
              )}
            </div>
            
            <div className="flex-shrink-0">
                <div className="text-xs sm:text-sm text-muted-foreground text-center mb-2">
                    {room.correctGuessersThisRound && room.activeGuesserCountAtTurnStart > 0
                    ? `${room.correctGuessersThisRound.length} of ${room.activeGuesserCountAtTurnStart} guesser(s) guessed correctly!`
                    : room.activeGuesserCountAtTurnStart > 0 ? "No one guessed the word!" : "No active guessers this turn."}
                </div>

                {roundEndCountdown !== null && (
                <p className="mt-3 text-center text-md sm:text-lg font-semibold text-primary animate-pulse">
                    Next turn in {roundEndCountdown}s...
                </p>
                )}
                {!isHost && roundEndCountdown === null && (
                <p className="mt-3 text-center text-xs sm:text-sm text-muted-foreground">Waiting for host to proceed...</p>
                )}
            </div>
          </>
        )}
        {room.gameState === 'game_over' && (
          <>
            <div className="text-2xl sm:text-3xl mb-3 text-center text-primary flex items-center justify-center gap-2 font-bold">
                <Trophy className="text-yellow-500 h-6 w-6 sm:h-7 sm:w-7" /> Game Over! <Trophy className="text-yellow-500 h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="text-center mb-2 text-md sm:text-lg text-foreground">Final Scores:</div>
            <ul className="space-y-1 max-h-40 sm:max-h-48 overflow-y-auto mb-3">
              {players.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
                <li key={player.id} className={cn(
                    "flex justify-between items-center p-1.5 sm:p-2 text-xs sm:text-sm rounded-md shadow-sm",
                    index === 0 ? 'bg-yellow-100 font-bold text-yellow-800 border border-yellow-300' 
                                : index === 1 ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : index === 2 ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                : 'bg-muted/50'
                )}>
                  <span className="text-foreground truncate">{index + 1}. {player.name || 'Player'}</span>
                  <span className="font-semibold text-foreground">{player.score || 0} pts</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 sm:gap-3 items-center">
              {isHost && startButtonInfo && (
                  <Button
                    onClick={onPlayAgain}
                    size="lg"
                    variant="default"
                    className="w-full max-w-xs px-6 py-2.5 sm:px-8 sm:py-3 text-sm sm:text-lg"
                    disabled={!canPlayAgain || isStartingNextRoundOrGame}
                  >
                    {startButtonInfo.icon} {startButtonInfo.text}
                  </Button>
              )}
               <Button
                variant="outline"
                size="default"
                className="w-full max-w-xs py-2 sm:py-2.5 text-sm sm:text-base"
                onClick={() => handleNavigation('/create-room')}
              >
                <PlusCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Create New Room
              </Button>
              <Button
                variant="outline"
                size="default"
                className="w-full max-w-xs py-2 sm:py-2.5 text-sm sm:text-base"
                onClick={() => handleNavigation('/')}
              >
                <Home className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Go Home
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
