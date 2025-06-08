
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Users, TrendingUp, Gamepad2, Gift, Copy, Loader2, AlertCircle } from "lucide-react";
import { database } from '@/lib/firebase';
import { ref, get, onValue, off } from 'firebase/database';
import type { UserProfile, ReferralEntry, Transaction, PlatformSettings } from '@/lib/types';
import { format, isToday, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { APP_NAME } from '@/lib/config';

interface ReferralManagementTabProps {
  authUserUid: string | null;
  userProfile: UserProfile | null;
}

interface DisplayReferral extends ReferralEntry {
    id: string;
}

interface ReferralStats {
    totalReferrals: number;
    totalEarningsFromReferrals: number; // This will show based on user's currency
    gamesByReferralsToday: number;
    activeReferralsLast7Days: number;
}

interface ReferralEarningsMap {
    [referredUserId: string]: number;
}

const parseRewardTransactionDescription = (description: string): { referredUserName: string; rounds: number; players: number } | null => {
    const match = description.match(/^Reward from (.*?) \(Played (\d+) rounds? with (\d+) players?\)$/i);
    if (match && match[1] && match[2] && match[3]) {
        return {
            referredUserName: match[1].trim(),
            rounds: parseInt(match[2], 10),
            players: parseInt(match[3], 10),
        };
    }
    return null;
};


export default function ReferralManagementTab({ authUserUid, userProfile }: ReferralManagementTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [referrals, setReferrals] = useState<DisplayReferral[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalEarningsFromReferrals: 0,
    gamesByReferralsToday: 0,
    activeReferralsLast7Days: 0,
  });
  const [referralEarningsMap, setReferralEarningsMap] = useState<ReferralEarningsMap>({});
  const [shortReferralCode, setShortReferralCode] = useState<string | null>(null);
  const [referralProgramEnabled, setReferralProgramEnabled] = useState(true);
  const [isLoadingPlatformSettings, setIsLoadingPlatformSettings] = useState(true);

  const currencySymbol = userProfile?.currency === 'USD' ? '$' : '₹';

  useEffect(() => {
    const settingsRef = ref(database, 'platformSettings');
    const listener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setReferralProgramEnabled(snapshot.val().referralProgramEnabled !== false);
      } else {
        setReferralProgramEnabled(true);
      }
      setIsLoadingPlatformSettings(false);
    }, (error) => {
      console.error("Error fetching platform settings for ReferralTab:", error);
      setReferralProgramEnabled(true);
      setIsLoadingPlatformSettings(false);
    });
    return () => off(settingsRef, 'value', listener);
  }, []);

  useEffect(() => {
    if (!authUserUid || !userProfile || isLoadingPlatformSettings) {
      if (!isLoadingPlatformSettings) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setShortReferralCode(userProfile.shortReferralCode || null);

    const fetchData = async () => {
      try {
        const referralsRef = ref(database, `referrals/${authUserUid}`);
        const referralsSnapshot = await get(referralsRef);
        let loadedReferrals: DisplayReferral[] = [];
        if (referralsSnapshot.exists()) {
          const referralsData = referralsSnapshot.val();
          loadedReferrals = Object.keys(referralsData).map(key => ({
            id: key,
            ...referralsData[key]
          }));
        }
        setReferrals(loadedReferrals);

        const transactionsSnapshot = await get(ref(database, `transactions/${authUserUid}`));
        let loadedTransactions: Transaction[] = [];
        if (transactionsSnapshot.exists()) {
          const transactionsData = transactionsSnapshot.val();
          loadedTransactions = Object.keys(transactionsData)
            .map(key => ({ id: key, ...transactionsData[key] }))
            .sort((a, b) => b.date - a.date);
        }

        let gamesTodayCount = 0;
        const activeUserNamesLast7Days = new Set<string>();
        const newReferralEarningsMap: ReferralEarningsMap = {};
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const sevenDaysAgoStart = startOfDay(subDays(new Date(), 6));
        let totalEarningsThisUserFromReferrals = 0;

        loadedTransactions.forEach(tx => {
          if (tx.type === 'earning') {
            const parsedInfo = parseRewardTransactionDescription(tx.description);
            if (parsedInfo && parsedInfo.referredUserName) {
              totalEarningsThisUserFromReferrals += tx.amount; // Summing up all referral earnings
              const txDateValue = new Date(tx.date).getTime();
              if (txDateValue >= todayStart.getTime() && txDateValue <= todayEnd.getTime()) gamesTodayCount++;
              if (txDateValue >= sevenDaysAgoStart.getTime() && txDateValue <= todayEnd.getTime()) activeUserNamesLast7Days.add(parsedInfo.referredUserName);

              const matchingReferralInList = loadedReferrals.find(r => r.referredUserName === parsedInfo.referredUserName);
              if (matchingReferralInList) {
                newReferralEarningsMap[matchingReferralInList.id] = (newReferralEarningsMap[matchingReferralInList.id] || 0) + tx.amount;
              }
            }
          }
        });

        setReferralEarningsMap(newReferralEarningsMap);
        setReferralStats({
          totalReferrals: loadedReferrals.length,
          totalEarningsFromReferrals: totalEarningsThisUserFromReferrals, // Use the calculated sum
          gamesByReferralsToday: gamesTodayCount,
          activeReferralsLast7Days: activeUserNamesLast7Days.size,
        });

      } catch (error) {
        console.error("[ReferralTab] Error fetching referral data:", error);
        toast({ title: "Error", description: "Could not load referral dashboard data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    if (referralProgramEnabled) {
        fetchData();
    } else {
        setIsLoading(false);
        setReferrals([]);
        setReferralEarningsMap({});
        // Even if program is off, show their past earnings if any, which is now part of userProfile.totalEarnings.
        // For "Total Earnings from Referrals" card, it should probably show 0 if program is off, or sum of specific referral txns.
        // Let's show sum of specific referral transactions for historical accuracy.
        const fetchHistoricalReferralEarnings = async () => {
            let historicalReferralEarnings = 0;
            try {
                const transactionsSnapshot = await get(ref(database, `transactions/${authUserUid}`));
                if (transactionsSnapshot.exists()) {
                    const transactionsData = transactionsSnapshot.val();
                    Object.values(transactionsData).forEach((tx: any) => {
                        if (tx.type === 'earning' && parseRewardTransactionDescription(tx.description)) {
                            historicalReferralEarnings += tx.amount;
                        }
                    });
                }
            } catch (e) { console.error("Error fetching historical referral earnings:", e); }
            setReferralStats({ totalReferrals: 0, totalEarningsFromReferrals: historicalReferralEarnings, gamesByReferralsToday: 0, activeReferralsLast7Days: 0 });
        };
        fetchHistoricalReferralEarnings();

    }

  }, [authUserUid, userProfile, toast, isLoadingPlatformSettings, referralProgramEnabled]);

  const handleCopyReferralLink = () => {
    if (shortReferralCode && typeof window !== 'undefined') {
      const fullReferralLink = `${window.location.origin}/referral/${shortReferralCode}`;
      navigator.clipboard.writeText(fullReferralLink)
        .then(() => toast({ title: "Referral Link Copied!", description: "Your Referral Link is copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy Referral Link.", variant: "destructive" }));
    } else {
        toast({ title: "Referral Code Unavailable", description: "Your short referral code is not available.", variant: "default" });
    }
  };

  if (isLoading || isLoadingPlatformSettings) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!referralProgramEnabled) {
    return (
      <div className="space-y-6">
        <Card className="bg-yellow-50 border border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-yellow-700">
              <AlertCircle className="mr-2 h-5 w-5" /> Referral Program Disabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-600">
              The referral and earning program is currently disabled by the administrators.
              You can still view your overall transaction history and manage withdrawals if applicable.
              Your past referral earnings (if any): {currencySymbol}{referralStats.totalEarningsFromReferrals.toFixed(2)}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {shortReferralCode && (
        <Card className="bg-card border-2 border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-primary">
              <Gift className="mr-2 h-5 w-5 text-yellow-500" /> Your Unique Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="font-mono text-primary bg-primary/10 px-2 py-1 rounded-sm text-lg break-all">{shortReferralCode}</p>
            <Button variant="ghost" size="sm" onClick={handleCopyReferralLink} className="text-primary hover:bg-primary/10 mt-2 sm:mt-0 self-start sm:self-center">
              <Copy className="mr-2 h-4 w-4" /> Copy Link
            </Button>
          </CardContent>
           <CardDescription className="px-6 pb-4 text-xs text-muted-foreground">
            Share this link (copied with the button) with friends. When they sign up and complete games, you'll earn rewards!
          </CardDescription>
        </Card>
      )}
      {!shortReferralCode && authUserUid && (
         <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-muted-foreground">
               Referral Code Not Found
            </CardTitle>
          </CardHeader>
           <CardContent>
            <p className="text-sm text-muted-foreground">Your short referral code is not available. This might happen if your account is new. Please try re-logging or check back later.</p>
           </CardContent>
         </Card>
      )}


      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Referral Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referralStats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                Users you've successfully referred.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings from Referrals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currencySymbol}{referralStats.totalEarningsFromReferrals.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings from your referrals.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Games by Referrals Today</CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referralStats.gamesByReferralsToday}</div>
              <p className="text-xs text-muted-foreground">
                Reward-triggering games completed today.
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Referrals (Last 7d)</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referralStats.activeReferralsLast7Days}</div>
              <p className="text-xs text-muted-foreground">
                 Unique referrals generating rewards.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">My Referrals List</CardTitle>
            <CardDescription>Users you have referred to {APP_NAME}. Earnings are calculated from completed games.</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Username</TableHead>
                    <TableHead className="text-center">Referred On</TableHead>
                    <TableHead className="text-right">Earnings Generated ({currencySymbol})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.referredUserName}</TableCell>
                      <TableCell className="text-center">{format(new Date(referral.timestamp), "PP")}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {(referralEarningsMap[referral.id] || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't referred anyone yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Share your referral link to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Note: Data is based on recorded transactions. If there are discrepancies, they might be due to pending operations or data propagation delays. Please check browser console for detailed processing logs.
      </p>
    </div>
  );
}
