
export interface Player {
  id: string; 
  name: string;
  score: number;
  isOnline: boolean;
  isHost?: boolean;
  referredByPlayerId?: string | null; 
  referralRewardsThisSession?: number; 
  isAnonymous?: boolean; 
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

export interface PlatformSettings {
  referralProgramEnabled: boolean;
  platformWithdrawalsEnabled: boolean;
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
  roundStartedAt?: number | null; 
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

export interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  referralCode: string; 
  shortReferralCode?: string; 
  totalEarnings: number; 
  referredBy?: string | null; 
  createdAt: number;
  isBlocked?: boolean;
  blockReason?: string;
  canWithdraw?: boolean; // New field for individual user withdrawal status
}

export interface DisplayUser extends UserProfile {
  referredUsersCount: number; 
  totalWithdrawn?: number; 
  grossLifetimeEarnings?: number; 
}

export interface ReferralEntry {
  id?: string; 
  referredUserName: string;
  timestamp: number;
}

export type TransactionStatus = 'Earned' | 'Pending' | 'Approved' | 'Rejected';
export type TransactionType = 'earning' | 'withdrawal';

export interface Transaction {
  id?: string; 
  date: number; 
  description: string;
  amount: number; 
  type: TransactionType;
  status: TransactionStatus;
  notes?: string;
  withdrawalRequestId?: string; 
}

export interface WithdrawalRequest {
  id?: string; 
  userId: string;
  amount: number;
  method: 'upi' | 'paytm' | 'bank';
  details: Record<string, string>; 
  status: 'Pending' | 'Approved' | 'Rejected'; 
  requestDate: number; 
  processedDate?: number; 
  adminNotes?: string; 
  transactionId?: string; 
}

export interface AdminDisplayWithdrawalRequest extends WithdrawalRequest { 
  originalId: string; 
}


export interface AdminDashboardStats {
  totalUsers: number;
  totalPlatformEarnings: number; 
  totalApprovedWithdrawalsAmount: number;
  totalPendingWithdrawalsAmount: number;
}

export type WithdrawalFilterCriteria = {
    status: 'all' | 'Pending' | 'Approved' | 'Rejected';
    method: 'all' | 'upi' | 'paytm' | 'bank';
    dateFrom?: Date | null;
    dateTo?: Date | null;
    searchTerm: string;
};

