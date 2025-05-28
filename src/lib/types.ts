export interface Player {
  id: string;
  name: string;
  isDrawing: boolean;
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
}

export interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  lineWidth: number;
  type: 'start' | 'draw' | 'end' | 'clear'; 
}

export interface Room {
  id: string;
  // name?: string; // Decided against room name for simplicity for now
  hostId: string;
  players: { [playerId: string]: Player };
  currentDrawerId?: string | null;
  currentPattern?: string | null;
  guesses: Guess[];
  drawingData: DrawingPoint[];
  gameState: 'waiting' | 'starting' | 'drawing' | 'round_end' | 'game_over';
  roundEndsAt?: number | null; // Timestamp for when the current round ends
  createdAt: number;
  // Future: maxPlayers, rounds, currentRound
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt'> & { drawingData: DrawingPoint[]};
