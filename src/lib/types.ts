
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
  roundStartedAt?: number | null; // Timestamp for when the current drawing round started
  roundEndsAt?: number | null;
  wordSelectionEndsAt?: number | null;
  correctGuessersThisRound?: string[];
  usedWords?: string[];
  createdAt: number;
  aiSketchDataUri?: string | null;
  lastRoundScoreChanges?: { [playerId: string]: number };
}

export type RoomCreationData = Pick<Room, 'id' | 'hostId' | 'players' | 'gameState' | 'createdAt' | 'config' | 'currentRoundNumber'> & {
  drawingData: DrawingPoint[];
  revealedPattern?: string[];
  selectableWords?: string[];
  usedWords?: string[];
  wordSelectionEndsAt?: null;
  roundStartedAt?: null;
  aiSketchDataUri?: null;
  lastRoundScoreChanges?: null;
};

// New types for global user data and earnings
export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  referralCode: string; // This is their own userId (kept for potential internal use)
  shortReferralCode?: string; // The new 5-character shareable code
  totalEarnings: number;
  referredBy?: string | null; // UID of the user who referred them
  createdAt: number;
}

// For displaying in admin panel user list
export interface DisplayUser extends UserProfile {
  referredUsersCount: number; // Calculated client-side
  totalWithdrawn?: number; // Calculated client-side for user detail modal
}

export interface ReferralEntry {
  id?: string; // Firebase key
  referredUserName: string;
  timestamp: number;
}

export type TransactionStatus = 'Earned' | 'Pending' | 'Approved' | 'Rejected';
export type TransactionType = 'earning' | 'withdrawal';

export interface Transaction {
  id?: string; // Will be the key from Firebase push
  date: number; // Timestamp
  description: string;
  amount: number; // Positive for earnings, typically negative or handled as debit for withdrawals
  type: TransactionType;
  status: TransactionStatus;
  notes?: string;
  withdrawalRequestId?: string; // Link back to the withdrawal request if this transaction is a withdrawal
}

export interface WithdrawalRequest {
  id?: string; // Will be the key from Firebase push, or originalId in DisplayWithdrawalRequest
  userId: string;
  amount: number;
  method: 'upi' | 'paytm' | 'bank';
  details: Record<string, string>; // e.g., { upiId: '...' } or { accountNumber: '...', ifsc: '...' }
  status: 'Pending' | 'Approved' | 'Rejected'; // Status of the withdrawal request itself
  requestDate: number; // Timestamp
  processedDate?: number; // Timestamp
  adminNotes?: string; // For rejection reasons or other admin notes
  transactionId?: string; // ID of the corresponding transaction in /transactions/{userId}
}

// For displaying withdrawal requests in admin panel (includes original ID for Firebase path)
export interface DisplayWithdrawalRequest extends WithdrawalRequest {
  originalId: string; // Firebase key of the request
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalPlatformEarnings: number;
  totalApprovedWithdrawalsAmount: number;
  totalPendingWithdrawalsAmount: number;
  // Add more stats as needed
}
