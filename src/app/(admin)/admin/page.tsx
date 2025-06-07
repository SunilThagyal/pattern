
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { database } from '@/lib/firebase';
import { ref, get, update, serverTimestamp, remove } from 'firebase/database';
import type { WithdrawalRequest, TransactionStatus, UserProfile, DisplayUser, ReferralEntry, AdminDisplayWithdrawalRequest, Transaction, AdminDashboardStats, WithdrawalFilterCriteria } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Users, CreditCard, Info, ExternalLink, SortAsc, SortDesc, RefreshCcw, LayoutDashboard, CalendarDays, TrendingUp, TrendingDown, CircleDollarSign, Users2, Ban, CheckCheck, Filter as FilterIcon, Search, EllipsisVertical, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay, isValid as isValidDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserWithdrawalRequests {
  userId: string;
  requests: AdminDisplayWithdrawalRequest[];
  userEmail?: string;
}

const ADMIN_EMAIL = "admin@devifyo.com";
const ADMIN_PASSWORD = "pass@admin";

type DateFilterOption = "all_time" | "today" | "last_7_days" | "last_30_days";
const ITEMS_PER_PAGE = 10; // For admin panel lists

export default function AdminPage() {
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Withdrawal Management State
  const [allRequests, setAllRequests] = useState<UserWithdrawalRequests[]>([]);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [currentRequestToProcess, setCurrentRequestToProcess] = useState<AdminDisplayWithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [selectedWithdrawalForModal, setSelectedWithdrawalForModal] = useState<AdminDisplayWithdrawalRequest | null>(null);
  const [isWithdrawalDetailModalOpen, setIsWithdrawalDetailModalOpen] = useState(false);
  const [withdrawalFilters, setWithdrawalFilters] = useState<WithdrawalFilterCriteria>({
    status: 'all',
    method: 'all',
    dateFrom: null,
    dateTo: null,
    searchTerm: '',
  });
  const [withdrawalDateRange, setWithdrawalDateRange] = useState<DateRange | undefined>(undefined);
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState(0);
  const [visibleWithdrawalGroupsCount, setVisibleWithdrawalGroupsCount] = useState(ITEMS_PER_PAGE);


  // User Management State
  const [allUsers, setAllUsers] = useState<DisplayUser[]>([]);
  const [userError, setUserError] = useState<string | null>(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState<DisplayUser | null>(null);
  const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
  const [selectedUserReferrals, setSelectedUserReferrals] = useState<ReferralEntry[]>([]);
  const [isLoadingUserReferrals, setIsLoadingUserReferrals] = useState(false);
  const [userSortCriteria, setUserSortCriteria] = useState<'displayName' | 'grossLifetimeEarnings' | 'referredUsersCount'>('displayName');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedUserTransactions, setSelectedUserTransactions] = useState<Transaction[]>([]);
  const [isLoadingUserTransactions, setIsLoadingUserTransactions] = useState(false);
  const [isBlockUserDialogOpen, setIsBlockUserDialogOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<DisplayUser | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [processingBlock, setProcessingBlock] = useState(false);
  const [visibleUsersCount, setVisibleUsersCount] = useState(ITEMS_PER_PAGE);


  // Dashboard State
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats>({
    totalUsers: 0,
    totalPlatformEarnings: 0,
    totalApprovedWithdrawalsAmount: 0,
    totalPendingWithdrawalsAmount: 0,
  });
  const [dashboardDateFilter, setDashboardDateFilter] = useState<DateFilterOption>("all_time");

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!isAuthenticatedAdmin) {
      setIsDataLoading(false);
      return;
    }
    setIsDataLoading(true);
    setWithdrawalError(null);
    setUserError(null);
    setVisibleUsersCount(ITEMS_PER_PAGE); // Reset pagination on refresh
    setVisibleWithdrawalGroupsCount(ITEMS_PER_PAGE); // Reset pagination on refresh

    try {
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      let fetchedUsers: DisplayUser[] = [];
      const userMapForWithdrawals = new Map<string, { email?: string }>();

      const allTransactionsRef = ref(database, 'transactions');
      const allTransactionsSnapshot = await get(allTransactionsRef);
      const userTransactionsMap = new Map<string, Transaction[]>();

      if (allTransactionsSnapshot.exists()) {
        const allTransactionsData = allTransactionsSnapshot.val();
        for (const userId in allTransactionsData) {
          const userTxns = Object.keys(allTransactionsData[userId]).map(txId => ({
            id: txId,
            ...allTransactionsData[userId][txId] as Transaction,
          }));
          userTransactionsMap.set(userId, userTxns);
        }
      }
      
      if (usersSnapshot.exists()) {
        const usersData = usersSnapshot.val();
        const loadedUsersPromises = Object.keys(usersData).map(async (userId) => {
          const userProfile = usersData[userId] as UserProfile;
          userMapForWithdrawals.set(userId, { email: userProfile.email });
          
          const referralsRef = ref(database, `referrals/${userId}`);
          const referralsSnapshot = await get(referralsRef);
          const referredUsersCount = referralsSnapshot.exists() ? Object.keys(referralsSnapshot.val()).length : 0;

          let grossLifetimeEarnings = 0;
          const currentUserTransactions = userTransactionsMap.get(userId) || [];
          currentUserTransactions.forEach(tx => {
            if (tx.type === 'earning') {
              grossLifetimeEarnings += tx.amount;
            }
          });

          return {
            ...userProfile,
            userId,
            referredUsersCount,
            grossLifetimeEarnings,
          };
        });
        fetchedUsers = await Promise.all(loadedUsersPromises);
      }
      setAllUsers(fetchedUsers);

      const withdrawalRequestsRef = ref(database, 'withdrawalRequests');
      const withdrawalSnapshot = await get(withdrawalRequestsRef);
      const loadedRequests: UserWithdrawalRequests[] = [];
      let totalPendingCount = 0;
      if (withdrawalSnapshot.exists()) {
        const usersWithdrawalData = withdrawalSnapshot.val();
        for (const userId in usersWithdrawalData) {
          const userRequestsData = usersWithdrawalData[userId];
          const userRequestsList: AdminDisplayWithdrawalRequest[] = [];
          for (const reqId in userRequestsData) {
             const request = {
              ...userRequestsData[reqId],
              userId: userId,
              originalId: reqId,
            } as AdminDisplayWithdrawalRequest;
            userRequestsList.push(request);
            if (request.status === 'Pending') {
              totalPendingCount++;
            }
          }
          if (userRequestsList.length > 0) {
            loadedRequests.push({ userId, requests: userRequestsList.sort((a, b) => b.requestDate - a.requestDate), userEmail: userMapForWithdrawals.get(userId)?.email });
          }
        }
      }
      setAllRequests(loadedRequests.sort((a, b) => (b.requests[0]?.requestDate || 0) - (a.requests[0]?.requestDate || 0)));
      setPendingWithdrawalCount(totalPendingCount);

    } catch (err) {
      console.error("Error fetching admin data:", err);
      setWithdrawalError("Failed to load withdrawal requests.");
      setUserError("Failed to load users.");
      toast({ title: "Error", description: "Could not fetch admin data.", variant: "destructive" });
    } finally {
      setIsDataLoading(false);
    }
  }, [isAuthenticatedAdmin, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (!isDataLoading) {
      let filteredWithdrawalsForDashboard = allRequests.flatMap(ur => ur.requests);
      
      const now = new Date();
      let startDate: Date | null = null;

      if (dashboardDateFilter === "today") {
        startDate = startOfDay(now);
      } else if (dashboardDateFilter === "last_7_days") {
        startDate = startOfDay(subDays(now, 6));
      } else if (dashboardDateFilter === "last_30_days") {
        startDate = startOfDay(subDays(now, 29));
      }

      if (startDate) {
        const startTime = startDate.getTime();
        filteredWithdrawalsForDashboard = filteredWithdrawalsForDashboard.filter(req => req.requestDate >= startTime);
      }

      const newStats: AdminDashboardStats = {
        totalUsers: allUsers.length,
        totalPlatformEarnings: allUsers.reduce((sum, user) => sum + (user.grossLifetimeEarnings || 0), 0),
        totalApprovedWithdrawalsAmount: filteredWithdrawalsForDashboard
          .filter(req => req.status === 'Approved')
          .reduce((sum, req) => sum + req.amount, 0),
        totalPendingWithdrawalsAmount: filteredWithdrawalsForDashboard
          .filter(req => req.status === 'Pending')
          .reduce((sum, req) => sum + req.amount, 0),
      };
      setDashboardStats(newStats);
    }
  }, [allRequests, allUsers, dashboardDateFilter, isDataLoading]);


  const sortedUsers = useMemo(() => {
    const usersToSort = [...allUsers];
    usersToSort.sort((a, b) => {
      let compareA, compareB;
      if (userSortCriteria === 'grossLifetimeEarnings') {
        compareA = a.grossLifetimeEarnings || 0;
        compareB = b.grossLifetimeEarnings || 0;
      } else if (userSortCriteria === 'referredUsersCount') {
        compareA = a.referredUsersCount || 0;
        compareB = b.referredUsersCount || 0;
      } else { 
        compareA = a.displayName?.toLowerCase() || '';
        compareB = b.displayName?.toLowerCase() || '';
      }

      if (userSortOrder === 'asc') {
        return typeof compareA === 'string' ? (compareA as string).localeCompare(compareB as string) : (compareA as number) - (compareB as number);
      } else {
        return typeof compareB === 'string' ? (compareB as string).localeCompare(compareA as string) : (compareB as number) - (compareA as number);
      }
    });
    return usersToSort;
  }, [allUsers, userSortCriteria, userSortOrder]);

  const usersToDisplay = useMemo(() => {
    return sortedUsers.slice(0, visibleUsersCount);
  }, [sortedUsers, visibleUsersCount]);

  const handleLoadMoreUsers = () => {
    setVisibleUsersCount(prev => prev + ITEMS_PER_PAGE);
  };


  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput === ADMIN_EMAIL && passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticatedAdmin(true);
      setAuthError(null);
      sessionStorage.setItem('isAdminAuthenticated_drawly', 'true');
    } else {
      setAuthError("Invalid email or password.");
      setIsAuthenticatedAdmin(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('isAdminAuthenticated_drawly') === 'true') {
      setIsAuthenticatedAdmin(true);
    }
  }, []);

  const updateRequestAndTransactionStatus = async (
    userId: string,
    requestId: string,
    transactionId: string | undefined,
    newStatus: 'Approved' | 'Rejected',
    adminNotes?: string
  ) => {
    setProcessingAction(`${userId}_${requestId}`);
    try {
      const requestUpdates: Partial<AdminDisplayWithdrawalRequest> = {
        status: newStatus,
        processedDate: serverTimestamp() as number,
      };
      if (adminNotes) requestUpdates.adminNotes = adminNotes;
      await update(ref(database, `withdrawalRequests/${userId}/${requestId}`), requestUpdates);

      if (transactionId) {
        await update(ref(database, `transactions/${userId}/${transactionId}`), { status: newStatus });
      } else {
        toast({ title: "Warning", description: `Transaction ID missing for request ${requestId}. Transaction status not updated.`, variant: "default" });
      }
      
      toast({ title: "Success", description: `Request ${requestId} has been ${newStatus.toLowerCase()}.` });
      
      fetchData(); 

    } catch (err) {
      console.error(`Error updating request ${requestId} to ${newStatus}:`, err);
      toast({ title: "Error", description: `Failed to update request ${requestId}.`, variant: "destructive" });
    } finally {
      setProcessingAction(null);
      if (newStatus === 'Rejected') {
        setIsRejectDialogOpen(false);
        setRejectionReason('');
        setCurrentRequestToProcess(null);
      }
    }
  };

  const handleApprove = (request: AdminDisplayWithdrawalRequest) => {
    updateRequestAndTransactionStatus(request.userId, request.originalId, request.transactionId, 'Approved');
  };

  const openRejectDialog = (request: AdminDisplayWithdrawalRequest) => {
    setCurrentRequestToProcess(request);
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (currentRequestToProcess && rejectionReason.trim()) {
      updateRequestAndTransactionStatus(
        currentRequestToProcess.userId,
        currentRequestToProcess.originalId,
        currentRequestToProcess.transactionId,
        'Rejected',
        rejectionReason.trim()
      );
    } else if (!rejectionReason.trim()) {
        toast({ title: "Validation Error", description: "Rejection reason cannot be empty.", variant: "destructive"});
    }
  };

 const getStatusBadgeClass = (status: WithdrawalRequest['status'] | TransactionStatus): string => {
    switch (status) {
      case 'Approved': 
      case 'Earned':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handleWithdrawalRowClick = (request: AdminDisplayWithdrawalRequest) => {
    setSelectedWithdrawalForModal(request);
    setIsWithdrawalDetailModalOpen(true);
  };

  const handleUserRowClick = async (user: DisplayUser) => {
    setSelectedUserForModal(user);
    setIsUserDetailModalOpen(true);
    setIsLoadingUserReferrals(true);
    setIsLoadingUserTransactions(true);
    setSelectedUserReferrals([]);
    setSelectedUserTransactions([]);

    try {
      const referralsRef = ref(database, `referrals/${user.userId}`);
      const referralsSnapshot = await get(referralsRef);
      if (referralsSnapshot.exists()) {
        const referralsData = referralsSnapshot.val();
        setSelectedUserReferrals(Object.keys(referralsData).map(key => ({ id: key, ...referralsData[key] })));
      }
    } catch (error) {
      console.error("Error fetching user referrals:", error);
      toast({ title: "Error", description: "Could not fetch user's referral details.", variant: "destructive" });
    } finally {
      setIsLoadingUserReferrals(false);
    }

    try {
      const transactionsRef = ref(database, `transactions/${user.userId}`);
      const transactionsSnapshot = await get(transactionsRef);
      let loadedTransactions: Transaction[] = [];
      if (transactionsSnapshot.exists()) {
        const transactionsData = transactionsSnapshot.val();
        loadedTransactions = Object.keys(transactionsData)
          .map(key => ({ id: key, ...transactionsData[key] as Transaction }))
          .sort((a, b) => b.date - a.date);
      }
      setSelectedUserTransactions(loadedTransactions);
      
      const totalWithdrawn = loadedTransactions
        .filter(tx => tx.type === 'withdrawal' && tx.status === 'Approved')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
      setSelectedUserForModal(prevUser => prevUser ? {...prevUser, totalWithdrawn } : null);

    } catch (error) {
      console.error("Error fetching user transactions:", error);
      toast({ title: "Error", description: "Could not fetch user's transaction details.", variant: "destructive" });
    } finally {
      setIsLoadingUserTransactions(false);
    }
  };

  const toggleUserSortOrder = () => {
    setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const openBlockUserDialog = (user: DisplayUser) => {
    setUserToBlock(user);
    setIsBlockUserDialogOpen(true);
    setBlockReason(user.blockReason || ''); 
  };

  const handleConfirmBlockUser = async () => {
    if (!userToBlock || !blockReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for blocking the user.", variant: "destructive" });
      return;
    }
    setProcessingBlock(true);
    try {
      await update(ref(database, `users/${userToBlock.userId}`), {
        isBlocked: true,
        blockReason: blockReason.trim(),
      });
      toast({ title: "User Blocked", description: `${userToBlock.displayName} has been blocked.` });
      fetchData(); 
      setIsBlockUserDialogOpen(false);
      setUserToBlock(null);
      setBlockReason('');
    } catch (error) {
      console.error("Error blocking user:", error);
      toast({ title: "Error", description: "Could not block user.", variant: "destructive" });
    } finally {
      setProcessingBlock(false);
    }
  };

  const handleUnblockUser = async (userId: string, userName: string) => {
    setProcessingBlock(true);
    try {
      await update(ref(database, `users/${userId}`), {
        isBlocked: false,
        blockReason: null, 
      });
      toast({ title: "User Unblocked", description: `${userName} has been unblocked.` });
      fetchData(); 
      setIsUserDetailModalOpen(false); 
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast({ title: "Error", description: "Could not unblock user.", variant: "destructive" });
    } finally {
      setProcessingBlock(false);
    }
  };
  
  const filteredWithdrawalRequests = useMemo(() => {
    let result = [...allRequests];
    const { status, method, dateFrom, dateTo, searchTerm } = withdrawalFilters;

    result = result.map(userReqGroup => {
        let filteredUserRequests = [...userReqGroup.requests];

        if (status !== 'all') {
            filteredUserRequests = filteredUserRequests.filter(req => req.status === status);
        }
        if (method !== 'all') {
            filteredUserRequests = filteredUserRequests.filter(req => req.method === method);
        }
        if (dateFrom && isValidDate(dateFrom)) {
            const fromTime = startOfDay(dateFrom).getTime();
            filteredUserRequests = filteredUserRequests.filter(req => req.requestDate >= fromTime);
        }
        if (dateTo && isValidDate(dateTo)) {
            const toTime = endOfDay(dateTo).getTime();
            filteredUserRequests = filteredUserRequests.filter(req => req.requestDate <= toTime);
        }
        if (searchTerm.trim()) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            filteredUserRequests = filteredUserRequests.filter(req => 
                req.userId.toLowerCase().includes(lowerSearchTerm) ||
                (req.transactionId && req.transactionId.toLowerCase().includes(lowerSearchTerm)) ||
                req.originalId.toLowerCase().includes(lowerSearchTerm) ||
                (userReqGroup.userEmail && userReqGroup.userEmail.toLowerCase().includes(lowerSearchTerm))
            );
        }
        return { ...userReqGroup, requests: filteredUserRequests };
    }).filter(userReqGroup => userReqGroup.requests.length > 0); 

    // Reset visible count for withdrawals when filters change
    setVisibleWithdrawalGroupsCount(ITEMS_PER_PAGE);
    return result;
  }, [allRequests, withdrawalFilters]);

  const withdrawalGroupsToDisplay = useMemo(() => {
    return filteredWithdrawalRequests.slice(0, visibleWithdrawalGroupsCount);
  }, [filteredWithdrawalRequests, visibleWithdrawalGroupsCount]);

  const handleLoadMoreWithdrawalGroups = () => {
    setVisibleWithdrawalGroupsCount(prev => prev + ITEMS_PER_PAGE);
  };


  if (!isAuthenticatedAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle className="text-2xl text-center">Admin Login</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div><Label htmlFor="adminEmail">Email</Label><Input id="adminEmail" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="Email" required /></div>
              <div><Label htmlFor="adminPassword">Password</Label><div className="relative"><Input id="adminPassword" type={showPassword ? "text" : "password"} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" required /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
              {authError && <p className="text-sm text-destructive">{authError}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-foreground">Admin Dashboard</h1>
        <Button variant="outline" onClick={fetchData} disabled={isDataLoading}>
          <RefreshCcw className={cn("mr-2 h-4 w-4", isDataLoading && "animate-spin")} /> Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="withdrawals" className="relative">
            <CreditCard className="mr-2 h-4 w-4" />Withdrawals
            {pendingWithdrawalCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs">
                {pendingWithdrawalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Users</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="mb-6 flex flex-col sm:flex-row gap-2 items-center">
            <Label htmlFor="dashboardDateFilter" className="text-sm">Filter Stats By:</Label>
            <Select value={dashboardDateFilter} onValueChange={(value) => setDashboardDateFilter(value as DateFilterOption)}>
              <SelectTrigger id="dashboardDateFilter" className="w-full sm:w-[200px]">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground"/>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isDataLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}><CardHeader><CardTitle className="h-5 bg-muted rounded w-3/4 animate-pulse"></CardTitle><CardDescription className="h-4 bg-muted rounded w-1/2 animate-pulse mt-1"></CardDescription></CardHeader><CardContent><div className="h-8 bg-muted rounded w-1/3 animate-pulse"></div></CardContent></Card>
                ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center text-muted-foreground"><Users2 className="mr-2 h-4 w-4"/>Total Users</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{dashboardStats.totalUsers}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center text-muted-foreground"><CircleDollarSign className="mr-2 h-4 w-4"/>Total Platform Gross Earnings</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">₹{dashboardStats.totalPlatformEarnings.toFixed(2)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center text-muted-foreground"><TrendingUp className="mr-2 h-4 w-4 text-green-500"/>Approved Withdrawals</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">₹{dashboardStats.totalApprovedWithdrawalsAmount.toFixed(2)}</div><p className="text-xs text-muted-foreground">({dashboardDateFilter.replace(/_/g, ' ')})</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center text-muted-foreground"><TrendingDown className="mr-2 h-4 w-4 text-yellow-500"/>Pending Withdrawals</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-yellow-600">₹{dashboardStats.totalPendingWithdrawalsAmount.toFixed(2)}</div><p className="text-xs text-muted-foreground">({dashboardDateFilter.replace(/_/g, ' ')})</p></CardContent>
              </Card>
            </div>
          )}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
             <Card className="h-[300px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                    <LayoutDashboard className="mx-auto h-12 w-12 mb-2" />
                    <p>User Signups Graph Placeholder</p>
                    <p className="text-xs">(Chart component would go here)</p>
                </CardContent>
             </Card>
             <Card className="h-[300px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                    <CreditCard className="mx-auto h-12 w-12 mb-2" />
                    <p>Withdrawal Trends Placeholder</p>
                    <p className="text-xs">(Chart component would go here)</p>
                </CardContent>
             </Card>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-6">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Withdrawal Requests</h2>
           <Card className="mb-6">
            <CardHeader><CardTitle className="text-lg">Filters & Search</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="withdrawalStatusFilter">Status</Label>
                        <Select value={withdrawalFilters.status} onValueChange={(value) => setWithdrawalFilters(prev => ({ ...prev, status: value as WithdrawalFilterCriteria['status'] }))}>
                            <SelectTrigger id="withdrawalStatusFilter"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="withdrawalMethodFilter">Payment Method</Label>
                        <Select value={withdrawalFilters.method} onValueChange={(value) => setWithdrawalFilters(prev => ({ ...prev, method: value as WithdrawalFilterCriteria['method'] }))}>
                            <SelectTrigger id="withdrawalMethodFilter"><SelectValue placeholder="Filter by method" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Methods</SelectItem>
                                <SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="paytm">Paytm</SelectItem>
                                <SelectItem value="bank">Bank</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="lg:col-span-2">
                        <Label htmlFor="withdrawalDateFilterPopover">Date Range</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button id="withdrawalDateFilterPopover" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !withdrawalDateRange && "text-muted-foreground")}>
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    {withdrawalDateRange?.from ? (withdrawalDateRange.to ? (<>{format(withdrawalDateRange.from, "LLL dd, y")} - {format(withdrawalDateRange.to, "LLL dd, y")}</>) : (format(withdrawalDateRange.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={withdrawalDateRange?.from} selected={withdrawalDateRange} onSelect={(range) => {setWithdrawalDateRange(range); setWithdrawalFilters(prev => ({...prev, dateFrom: range?.from || null, dateTo: range?.to || null }))}} numberOfMonths={2}/>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div>
                    <Label htmlFor="withdrawalSearch">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="withdrawalSearch" type="text" placeholder="Search by User ID, Email, Txn ID, Req ID..." value={withdrawalFilters.searchTerm} onChange={(e) => setWithdrawalFilters(prev => ({ ...prev, searchTerm: e.target.value }))} className="pl-8" />
                    </div>
                </div>
            </CardContent>
           </Card>

          {isDataLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : withdrawalError ? (
            <div className="text-center text-destructive p-4 bg-destructive/10 rounded-md flex items-center justify-center gap-2"><AlertTriangle /> {withdrawalError}</div>
          ) : withdrawalGroupsToDisplay.length === 0 ? (
            <p className="text-muted-foreground">No withdrawal requests found matching your criteria.</p>
          ) : (
            <>
              {withdrawalGroupsToDisplay.map(userReqs => (
                <Card key={userReqs.userId} className="mb-8 shadow-sm bg-card">
                  <CardHeader><CardTitle className="text-lg">User ID: <span className="font-mono text-sm bg-muted p-1 rounded">{userReqs.userId}</span> {userReqs.userEmail && <span className="text-xs text-muted-foreground">({userReqs.userEmail})</span>}</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Req ID</TableHead><TableHead>Date</TableHead><TableHead>Amount (₹)</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {userReqs.requests.map((req) => (
                          <TableRow key={req.originalId} >
                            <TableCell className="text-xs font-mono" onClick={() => handleWithdrawalRowClick(req)}>{req.originalId.substring(0,10)}...</TableCell>
                            <TableCell onClick={() => handleWithdrawalRowClick(req)}>{format(new Date(req.requestDate), "PP pp")}</TableCell>
                            <TableCell className="font-semibold" onClick={() => handleWithdrawalRowClick(req)}>₹{req.amount.toFixed(2)}</TableCell>
                            <TableCell onClick={() => handleWithdrawalRowClick(req)}>{req.method.toUpperCase()}</TableCell>
                            <TableCell onClick={() => handleWithdrawalRowClick(req)}><Badge variant="outline" className={cn("text-xs", getStatusBadgeClass(req.status))}>{req.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <EllipsisVertical className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleWithdrawalRowClick(req)}>
                                    <Info className="mr-2 h-4 w-4" /> View Details
                                  </DropdownMenuItem>
                                  {req.status === 'Pending' && (
                                    <>
                                    <DropdownMenuItem onClick={() => handleApprove(req)} disabled={processingAction === `${req.userId}_${req.originalId}`} className="text-green-600 focus:bg-green-50 focus:text-green-700">
                                      {processingAction === `${req.userId}_${req.originalId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openRejectDialog(req)} disabled={processingAction === `${req.userId}_${req.originalId}`} className="text-red-600 focus:bg-red-50 focus:text-red-700">
                                      {processingAction === `${req.userId}_${req.originalId}` && currentRequestToProcess?.originalId !== req.originalId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                                    </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
              {visibleWithdrawalGroupsCount < filteredWithdrawalRequests.length && (
                <div className="mt-6 text-center">
                  <Button variant="outline" onClick={handleLoadMoreWithdrawalGroups}>
                    <ChevronDown className="mr-2 h-4 w-4" /> Load More Withdrawal Groups
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <h2 className="text-2xl font-semibold text-foreground mb-4">User Management</h2>
          <div className="mb-4 flex items-center gap-4">
            <Label htmlFor="userSort" className="text-sm">Sort Users By:</Label>
            <Select value={userSortCriteria} onValueChange={(value) => setUserSortCriteria(value as any)}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select criteria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="displayName">Display Name</SelectItem>
                  <SelectItem value="grossLifetimeEarnings">Gross Lifetime Earnings</SelectItem>
                  <SelectItem value="referredUsersCount">Number of Referrals</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={toggleUserSortOrder} title={`Sort ${userSortOrder === 'asc' ? 'Descending' : 'Ascending'}`}>{userSortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}</Button>
          </div>
          {isDataLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : userError ? (
            <div className="text-center text-destructive p-4 bg-destructive/10 rounded-md flex items-center justify-center gap-2"><AlertTriangle /> {userError}</div>
          ) : usersToDisplay.length === 0 ? (
            <p className="text-muted-foreground">No users found.</p>
          ) : (
            <>
            <Card><CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Gross Lifetime Earnings (₹)</TableHead>
                        <TableHead className="text-right">Current Balance (₹)</TableHead>
                        <TableHead className="text-center">Referrals Made</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersToDisplay.map((user) => (
                        <TableRow key={user.userId} onClick={() => handleUserRowClick(user)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="text-xs font-mono">{user.userId.substring(0,10)}...</TableCell>
                          <TableCell className="font-medium flex items-center">
                            {user.displayName}
                            {user.isBlocked && <Badge variant="destructive" className="ml-2 text-xs">Blocked</Badge>}
                          </TableCell>
                          <TableCell>{user.email || 'N/A'}</TableCell>
                          <TableCell className="text-right font-semibold">₹{(user.grossLifetimeEarnings || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">₹{(user.totalEarnings || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-center">{user.referredUsersCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
            </CardContent></Card>
            {visibleUsersCount < sortedUsers.length && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={handleLoadMoreUsers}>
                  <ChevronDown className="mr-2 h-4 w-4" /> Load More Users
                </Button>
              </div>
            )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Withdrawal Request</DialogTitle><DialogDescription>Please provide a reason for rejecting this withdrawal request. This will be saved as admin notes. User: {currentRequestToProcess?.userId}, Amount: ₹{currentRequestToProcess?.amount.toFixed(2)}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2"><Label htmlFor="rejectionReason">Rejection Reason</Label><Textarea id="rejectionReason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g., Insufficient details, suspected activity, etc." rows={3}/></div>
          <DialogFooter><Button variant="outline" onClick={() => {setIsRejectDialogOpen(false); setRejectionReason(''); setCurrentRequestToProcess(null);}} disabled={processingAction === `${currentRequestToProcess?.userId}_${currentRequestToProcess?.originalId}`}>Cancel</Button><Button onClick={handleConfirmReject} disabled={!rejectionReason.trim() || processingAction === `${currentRequestToProcess?.userId}_${currentRequestToProcess?.originalId}`} variant="destructive">{processingAction === `${currentRequestToProcess?.userId}_${currentRequestToProcess?.originalId}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Rejection</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedWithdrawalForModal && (
        <Dialog open={isWithdrawalDetailModalOpen} onOpenChange={setIsWithdrawalDetailModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info size={20}/>Withdrawal Request Details</DialogTitle><DialogDescription>Req ID: <span className="font-mono text-xs">{selectedWithdrawalForModal.originalId}</span> for User: <span className="font-mono text-xs">{selectedWithdrawalForModal.userId}</span></DialogDescription></DialogHeader>
            <div className="py-4 space-y-3 text-sm">
                <div><strong>Request Date:</strong> {format(new Date(selectedWithdrawalForModal.requestDate), "PPP ppp")}</div>
                <div><strong>Amount:</strong> <span className="font-semibold">₹{selectedWithdrawalForModal.amount.toFixed(2)}</span></div>
                <div><strong>Method:</strong> <span className="capitalize">{selectedWithdrawalForModal.method}</span></div>
                <div className="space-y-1"><strong>Payment Details:</strong>{Object.entries(selectedWithdrawalForModal.details).map(([key, value]) => (<div key={key} className="pl-2 text-xs"><span className="capitalize font-medium">{key.replace(/([A-Z])/g, ' $1')}:</span> {String(value)}</div>))}</div>
                <div className="flex items-center gap-2"><strong>Status:</strong> <Badge variant="outline" className={cn("text-xs", getStatusBadgeClass(selectedWithdrawalForModal.status))}>{selectedWithdrawalForModal.status}</Badge></div>
                {selectedWithdrawalForModal.processedDate && <div><strong>Processed Date:</strong> {format(new Date(selectedWithdrawalForModal.processedDate), "PPP ppp")}</div>}
                {selectedWithdrawalForModal.transactionId && <div><strong>Transaction ID:</strong> <span className="font-mono text-xs">{selectedWithdrawalForModal.transactionId}</span></div>}
                {selectedWithdrawalForModal.adminNotes && (<div className="mt-2 p-2 bg-muted/50 border rounded-md"><p className="font-semibold">Admin Notes:</p><p className="text-muted-foreground">{selectedWithdrawalForModal.adminNotes}</p></div>)}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsWithdrawalDetailModalOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedUserForModal && (
        <Dialog open={isUserDetailModalOpen} onOpenChange={setIsUserDetailModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Users size={20}/>User Details: {selectedUserForModal.displayName}
                    {selectedUserForModal.isBlocked && <Badge variant="destructive" className="ml-2 text-sm">Blocked</Badge>}
                </DialogTitle>
                <DialogDescription>User ID: <span className="font-mono text-xs">{selectedUserForModal.userId}</span></DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
                <Card>
                    <CardHeader className="pb-2 flex flex-row justify-between items-center">
                        <CardTitle className="text-base">Profile Information</CardTitle>
                        {!selectedUserForModal.isBlocked ? (
                            <Button variant="destructive" size="sm" onClick={() => openBlockUserDialog(selectedUserForModal)} disabled={processingBlock}>
                                {processingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />} Block User
                            </Button>
                        ) : (
                             <Button variant="outline" size="sm" onClick={() => handleUnblockUser(selectedUserForModal.userId, selectedUserForModal.displayName)} disabled={processingBlock} className="text-green-600 border-green-600 hover:text-green-700 hover:bg-green-50">
                                {processingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCheck className="h-4 w-4 mr-1" />} Unblock User
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs">
                        <div><strong>Email:</strong> {selectedUserForModal.email || 'N/A'}</div>
                        <div><strong>Account Created:</strong> {format(new Date(selectedUserForModal.createdAt), "PPP ppp")}</div>
                        <div><strong>Short Referral Code:</strong> <span className="font-mono text-primary">{selectedUserForModal.shortReferralCode || 'N/A'}</span></div>
                        <div><strong>Gross Lifetime Earnings:</strong> <span className="font-semibold text-green-600">₹{(selectedUserForModal.grossLifetimeEarnings || 0).toFixed(2)}</span></div>
                        {isLoadingUserTransactions ? <Loader2 className="h-4 w-4 animate-spin" /> : <div><strong>Total Withdrawn (Approved):</strong> <span className="font-semibold text-red-600">₹{(selectedUserForModal.totalWithdrawn || 0).toFixed(2)}</span></div>}
                        <div><strong>Current Available Balance:</strong> <span className="font-semibold text-blue-600">₹{(selectedUserForModal.totalEarnings || 0).toFixed(2)}</span></div>
                        {selectedUserForModal.referredBy && <div><strong>Referred By User ID:</strong> <span className="font-mono">{selectedUserForModal.referredBy}</span></div>}
                        {selectedUserForModal.isBlocked && selectedUserForModal.blockReason && (
                            <div className="mt-2 p-1.5 bg-destructive/10 border border-destructive/20 rounded-sm">
                                <p className="font-semibold text-destructive">Block Reason:</p>
                                <p className="text-destructive/80">{selectedUserForModal.blockReason}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                 <Card><CardHeader className="pb-2"><CardTitle className="text-base">Referral Activity ({selectedUserForModal.referredUsersCount} users referred)</CardTitle></CardHeader>
                    <CardContent>
                        {isLoadingUserReferrals ? (<div className="flex items-center justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary mr-2" /> Loading referrals...</div>
                        ) : selectedUserReferrals.length > 0 ? (<ul className="space-y-1 text-xs">{selectedUserReferrals.map(refEntry => (<li key={refEntry.id} className="p-1.5 bg-muted/30 rounded-sm"><strong>{refEntry.referredUserName}</strong> (Referred on: {format(new Date(refEntry.timestamp), "PP")})</li>))}</ul>
                        ) : (<p className="text-xs text-muted-foreground text-center py-2">This user has not referred anyone yet.</p>)}
                    </CardContent>
                </Card>
                 <Card><CardHeader className="pb-2"><CardTitle className="text-base">Transaction History (Last 10)</CardTitle></CardHeader>
                    <CardContent>
                         {isLoadingUserTransactions ? (<div className="flex items-center justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary mr-2" /> Loading transactions...</div>
                         ) : selectedUserTransactions.length > 0 ? (
                            <Table><TableHeader><TableRow><TableHead className="h-8">Date</TableHead><TableHead className="h-8">Description</TableHead><TableHead className="h-8 text-right">Amount</TableHead><TableHead className="h-8 text-center">Status</TableHead></TableRow></TableHeader>
                                <TableBody>{selectedUserTransactions.slice(0,10).map(tx => (
                                    <TableRow key={tx.id} className="text-xs"><TableCell>{format(new Date(tx.date), "MM/dd HH:mm")}</TableCell><TableCell>{tx.description}</TableCell><TableCell className={cn("text-right", tx.type === 'earning' ? 'text-green-500' : 'text-red-500')}>{tx.type === 'earning' ? '+' : ''}{tx.amount.toFixed(2)}</TableCell><TableCell className="text-center"><Badge variant="outline" size="sm" className={cn("text-[10px] px-1.5 py-0", getStatusBadgeClass(tx.status))}>{tx.status}</Badge></TableCell></TableRow>
                                ))}</TableBody>
                            </Table>
                         ) : (<p className="text-xs text-muted-foreground text-center py-2">No transactions found for this user.</p>)}
                    </CardContent>
                 </Card>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsUserDetailModalOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isBlockUserDialogOpen} onOpenChange={setIsBlockUserDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Block User: {userToBlock?.displayName}</DialogTitle>
                <DialogDescription>Please provide a reason for blocking this user. This reason will be visible to the user if they attempt to access blocked features.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="blockReason">Reason for Blocking</Label>
                <Textarea id="blockReason" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="e.g., Violation of terms, suspicious activity..." rows={3} />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => {setIsBlockUserDialogOpen(false); setUserToBlock(null); setBlockReason('');}} disabled={processingBlock}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmBlockUser} disabled={processingBlock || !blockReason.trim()}>
                    {processingBlock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Block
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

