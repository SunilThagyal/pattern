
export interface Player {
  id: string;
  name: string;
  score: number;
  isOnline: boolean;
  isHost?: boolean;
  referredByPlayerId?: string | null; // ID of the player who referred this player
  referralRewardsThisSession?: number; // Conceptual rewards earned in this room session
}

export interface Guess {
  playerId: string;
  playerName:string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
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
  wordSelectionEndsAt?: number | null;
  correctGuessersThisRound?: string[];
  usedWords?: string[];
  createdAt: number;
  aiSketchDataUri?: string | null; // New field for AI sketch
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt' | 'config' | 'currentRoundNumber'> & {
  drawingData: DrawingPoint[];
  revealedPattern?: string[];
  selectableWords?: string[];
  usedWords?: string[];
  wordSelectionEndsAt?: null;
  aiSketchDataUri?: null; // Initialize new field
};

