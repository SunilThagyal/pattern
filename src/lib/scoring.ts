
import type { Room, Guess } from './types';

interface CalculateTurnScoresArgs {
  currentRoomData: Room;
  currentDrawerId: string;
  activeGuesserCountAtTurnStart: number;
  roundStartedAt: number;
  T_total: number; // Total time for the round in seconds
}

interface TurnScoreChanges {
  [playerId: string]: number;
}

export function calculateTurnScores({
  currentRoomData,
  currentDrawerId,
  activeGuesserCountAtTurnStart,
  roundStartedAt,
  T_total,
}: CalculateTurnScoresArgs): TurnScoreChanges {
  const turnScoreChanges: TurnScoreChanges = {};

  // Initialize scores for all players involved in the turn to 0
  // This ensures even players who score 0 are listed in lastRoundScoreChanges
  Object.keys(currentRoomData.players).forEach(pid => {
    if (currentRoomData.players[pid]?.isOnline) {
        turnScoreChanges[pid] = 0;
    }
  });


  // 1. Guesser Scoring
  const correctGuessersThisRound = currentRoomData.correctGuessersThisRound || [];
  const relevantGuessesForTurn = (currentRoomData.guesses || []).filter(g =>
    g.timestamp >= roundStartedAt && g.isCorrect && g.playerId !== currentDrawerId
  );

  correctGuessersThisRound.forEach(guesserId => {
    if (guesserId === currentDrawerId) return; // Drawer cannot be a guesser

    const playerCorrectGuessesForTurn = relevantGuessesForTurn
        .filter(g => g.playerId === guesserId)
        .sort((a,b) => a.timestamp - b.timestamp);

    if (playerCorrectGuessesForTurn.length > 0) {
        const firstCorrectGuessTimestamp = playerCorrectGuessesForTurn[0].timestamp;
        const T_guess_seconds = Math.max(0, (firstCorrectGuessTimestamp - roundStartedAt) / 1000);
        
        // Ensure T_guess_seconds does not exceed T_total for calculation
        const effective_T_guess_seconds = Math.min(T_guess_seconds, T_total);

        const guesserScore = 10 - (10 * (effective_T_guess_seconds / T_total));
        const finalGuesserScore = Math.floor(Math.max(0, Math.min(10, guesserScore)));
        turnScoreChanges[guesserId] = (turnScoreChanges[guesserId] || 0) + finalGuesserScore;
    }
  });

  // 2. Drawer Scoring
  let drawerAccumulatedPoints = 0;
  const basePointsForDrawing = 2;
  drawerAccumulatedPoints += basePointsForDrawing;

  if (activeGuesserCountAtTurnStart > 0 && correctGuessersThisRound.length > 0) {
    const pointsPerCorrectGuesser = 8 / activeGuesserCountAtTurnStart;
    drawerAccumulatedPoints += correctGuessersThisRound.filter(id => id !== currentDrawerId).length * pointsPerCorrectGuesser;
  }
  
  const finalDrawerScore = Math.floor(Math.max(0, Math.min(10, drawerAccumulatedPoints)));
  turnScoreChanges[currentDrawerId] = (turnScoreChanges[currentDrawerId] || 0) + finalDrawerScore;
  
  // Ensure all online players from the start of the turn have an entry, even if 0
  Object.keys(currentRoomData.players).forEach(pid => {
    if (currentRoomData.players[pid]?.isOnline && !(pid in turnScoreChanges)) {
        turnScoreChanges[pid] = 0;
    }
  });

  return turnScoreChanges;
}
