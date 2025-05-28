
export interface Player {
  id: string;
  name: string;
  score: number;
  isOnline: boolean;
  isHost?: boolean;
}

export interface Guess {
  playerId: string;
  playerName:string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
  isFirstCorrect?: boolean;
}

export interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  lineWidth: number;
  type: 'start' | 'draw' | 'end' | 'clear';
}

export interface RoomConfig {
  roundTimeoutSeconds: number;
  totalRounds: number;
  maxWordLength: number;
  // maxHintLetters removed as hints are now manual by host
}

export interface Room {
  id: string;
  hostId: string;
  players: { [playerId: string]: Player };
  config: RoomConfig;
  currentDrawerId?: string | null;
  currentPattern?: string | null;
  selectableWords?: string[];
  revealedPattern?: string[];
  guesses: Guess[];
  drawingData: DrawingPoint[];
  gameState: 'waiting' | 'word_selection' | 'drawing' | 'round_end' | 'game_over';
  currentRoundNumber: number;
  roundEndsAt?: number | null;
  wordSelectionEndsAt?: number | null; // Timer for drawer to pick a word
  correctGuessersThisRound?: string[];
  usedWords?: string[]; // Words already used in this game session
  createdAt: number;
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt' | 'config' | 'currentRoundNumber'> & {
  drawingData: DrawingPoint[];
  revealedPattern?: string[];
  selectableWords?: string[];
  usedWords?: string[];
  wordSelectionEndsAt?: null;
};
