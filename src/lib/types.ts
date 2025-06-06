
export interface Player {
  id: string; // If authenticated, this is the User UID. If anonymous, this is patternPartyPlayerId.
  name: string;
  score: number;
  isOnline: boolean;
  isHost?: boolean;
  referredByPlayerId?: string | null; // UID of the authenticated player who referred this player (set at sign-up)
  referralRewardsThisSession?: number; // Conceptual rewards earned in this room session (visual only)
  isAnonymous?: boolean; // Flag to indicate if the player is anonymous
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
  hostId: string; // UID of the authenticated host, or patternPartyPlayerId if host is anonymous
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
  aiSketchDataUri?: string | null;
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt' | 'config' | 'currentRoundNumber'> & {
  drawingData: DrawingPoint[];
  revealedPattern?: string[];
  selectableWords?: string[];
  usedWords?: string[];
  wordSelectionEndsAt?: null;
  aiSketchDataUri?: null;
};

// New types for global user data and earnings
export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  referralCode: string; // This is their own userId
  totalEarnings: number;
  referredBy?: string | null; // UID of the user who referred them
  createdAt: number;
}

export interface ReferralEntry {
  referredUserId: string;
  referredUserName: string;
  timestamp: number;
}

export type TransactionStatus = 'Earned' | 'Pending' | 'Approved' | 'Rejected';
export type TransactionType = 'earning' | 'withdrawal';

export interface Transaction {
  id?: string; // Will be the key from Firebase push
  date: number; // Timestamp
  description: string;
  amount: number; // Positive for earnings, negative for withdrawals
  type: TransactionType;
  status: TransactionStatus;
  notes?: string;
}

export interface WithdrawalRequest {
  id?: string; // Will be the key from Firebase push
  userId: string;
  amount: number;
  method: 'upi' | 'paytm' | 'bank';
  details: Record<string, string>; // e.g., { upiId: '...' } or { accountNumber: '...', ifsc: '...' }
  status: 'Pending' | 'Approved' | 'Rejected';
  requestDate: number; // Timestamp
  processedDate?: number; // Timestamp
  adminNotes?: string;
}
