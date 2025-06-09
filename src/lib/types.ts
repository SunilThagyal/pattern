
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
  canWithdraw?: boolean;
  country: 'India' | 'Other';
  currency: 'INR' | 'USD';
  defaultPaymentMethod?: 'upi' | 'paytm' | 'bank' | 'paypal';
  defaultPaymentDetails?: Record<string, string>;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  countryCode?: string;
  phoneNumber?: string;
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
  currency?: 'INR' | 'USD';
}

export interface WithdrawalRequest {
  id?: string;
  userId: string;
  amount: number;
  currency: 'INR' | 'USD';
  method: 'upi' | 'paytm' | 'bank' | 'paypal';
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
  totalPlatformEarningsINR: number;
  totalPlatformEarningsUSD: number;
  totalApprovedWithdrawalsAmountINR: number;
  totalApprovedWithdrawalsAmountUSD: number;
  totalPendingWithdrawalsAmountINR: number;
  totalPendingWithdrawalsAmountUSD: number;
}

export type WithdrawalFilterCriteria = {
    status: 'all' | 'Pending' | 'Approved' | 'Rejected';
    method: 'all' | 'upi' | 'paytm' | 'bank' | 'paypal';
    dateFrom?: Date | null;
    dateTo?: Date | null;
    searchTerm: string;
    currency: 'all' | 'INR' | 'USD';
};

