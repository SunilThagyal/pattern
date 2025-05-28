export interface Player {
  id: string;
  name: string;
  // isDrawing: boolean; // Replaced by currentDrawerId in Room
  score: number;
  isOnline: boolean;
  isHost?: boolean; // Set on creation, but room.hostId is source of truth
}

export interface Guess {
  playerId: string;
  playerName:string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
  isFirstCorrect?: boolean; // To identify the first correct guesser
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
  currentPattern?: string | null; // The word being drawn
  selectableWords?: string[]; // Words for the drawer to choose from
  revealedPattern?: string[]; // For hint system, e.g., ['A', '_', '_']
  guesses: Guess[];
  drawingData: DrawingPoint[];
  gameState: 'waiting' | 'word_selection' | 'drawing' | 'round_end' | 'game_over';
  currentRoundNumber: number;
  roundEndsAt?: number | null; // Timestamp for when the current drawing phase ends
  correctGuessersThisRound?: string[]; // List of player IDs who guessed correctly this round
  createdAt: number;
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt' | 'config' | 'currentRoundNumber'> & { drawingData: DrawingPoint[], revealedPattern?: string[] };

