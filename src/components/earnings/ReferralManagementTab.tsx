
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Users, TrendingUp, Gamepad2, Gift, Copy, Loader2 } from "lucide-react";
import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import type { UserProfile, ReferralEntry, Transaction } from '@/lib/types';
import { format, isToday, isWithinInterval, subDays, startOfDay, endOfDay } from 'date-fns';
import { APP_NAME } from '@/lib/config';

interface ReferralManagementTabProps {
  authUserUid: string | null;
  userProfile: UserProfile | null;
}

interface DisplayReferral extends ReferralEntry {
    id: string; // This is the referredUser's UID
}

interface ReferralStats {
    totalReferrals: number;
    totalEarningsFromReferrals: number;
    gamesByReferralsToday: number;
    activeReferralsLast7Days: number;
}

interface ReferralEarningsMap {
    [referredUserId: string]: number;
}

// Enhanced parser for the specific reward transaction description
const parseRewardTransactionDescription = (description: string): { referredUserName: string; rounds: number; players: number } | null => {
    const match = description.match(/^Reward from (.*?) \(Played (\d+) rounds? with (\d+) players?\)$/i); // Made "round" and "player" optionally plural, case-insensitive
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
  // Removed transactions state as it's part of userProfile now for total earnings.
  // We will still fetch transactions to calculate stats.
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalEarningsFromReferrals: 0,
    gamesByReferralsToday: 0,
    activeReferralsLast7Days: 0,
  });
  const [referralEarningsMap, setReferralEarningsMap] = useState<ReferralEarningsMap>({});
  const [shortReferralCode, setShortReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authUserUid || !userProfile) {
      console.log("[ReferralTab] AuthUserUid or UserProfile missing. Skipping fetch.", { authUserUid, userProfile });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setShortReferralCode(userProfile.shortReferralCode || null);
    console.log("[ReferralTab] Starting data fetch for user:", authUserUid);

    const fetchData = async () => {
      try {
        // Fetch referrals list (users referred by authUserUid)
        const referralsRef = ref(database, `referrals/${authUserUid}`);
        const referralsSnapshot = await get(referralsRef);
        let loadedReferrals: DisplayReferral[] = [];
        if (referralsSnapshot.exists()) {
          const referralsData = referralsSnapshot.val();
          loadedReferrals = Object.keys(referralsData).map(key => ({
            id: key, // The key is the referredUser's UID
            ...referralsData[key]
          }));
        }
        setReferrals(loadedReferrals);
        console.log("[ReferralTab] Loaded referrals list:", loadedReferrals);

        // Fetch all transactions for the authUserUid to calculate stats
        const transactionsRefPath = `transactions/${authUserUid}`;
        console.log("[ReferralTab] Fetching transactions from path:", transactionsRefPath);
        const transactionsSnapshot = await get(ref(database, transactionsRefPath));
        let loadedTransactions: Transaction[] = [];
        if (transactionsSnapshot.exists()) {
          const transactionsData = transactionsSnapshot.val();
          loadedTransactions = Object.keys(transactionsData)
            .map(key => ({ id: key, ...transactionsData[key] }))
            .sort((a, b) => b.date - a.date); // Sort by date desc
        }
        console.log("[ReferralTab] Loaded transactions for calculations:", loadedTransactions);


        // Calculate stats
        let gamesTodayCount = 0;
        const activeUserNamesLast7Days = new Set<string>();
        const newReferralEarningsMap: ReferralEarningsMap = {};

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const sevenDaysAgoStart = startOfDay(subDays(new Date(), 6)); // last 7 days including today

        console.log(`[ReferralTab] Date Ranges for Stats:
          Today: ${todayStart.toISOString()} - ${todayEnd.toISOString()}
          Last 7 Days Start: ${sevenDaysAgoStart.toISOString()}`);

        loadedTransactions.forEach(tx => {
          console.log(`[ReferralTab] Processing TX ID: ${tx.id}, Type: ${tx.type}, Desc: "${tx.description}", Date: ${new Date(tx.date).toISOString()}, Amount: ${tx.amount}`);
          if (tx.type === 'earning') {
            const parsedInfo = parseRewardTransactionDescription(tx.description);
            console.log(`[ReferralTab] Parsed info for "${tx.description}":`, parsedInfo);

            if (parsedInfo && parsedInfo.referredUserName) {
              const txDateValue = new Date(tx.date).getTime(); // Compare timestamps

              // Games by referrals today
              if (txDateValue >= todayStart.getTime() && txDateValue <= todayEnd.getTime()) {
                console.log(`[ReferralTab]  ✅ TX IS TODAY. User: ${parsedInfo.referredUserName}. Incrementing gamesTodayCount.`);
                gamesTodayCount++;
              } else {
                // console.log(`[ReferralTab]  ❌ TX NOT TODAY. TxDate: ${new Date(tx.date).toISOString()}`);
              }

              // Active referrals last 7 days
              if (txDateValue >= sevenDaysAgoStart.getTime() && txDateValue <= todayEnd.getTime()) {
                console.log(`[ReferralTab]  ✅ TX IS WITHIN LAST 7 DAYS. Adding user to Set: ${parsedInfo.referredUserName}`);
                activeUserNamesLast7Days.add(parsedInfo.referredUserName);
              } else {
                // console.log(`[ReferralTab]  ❌ TX NOT WITHIN LAST 7 DAYS. TxDate: ${new Date(tx.date).toISOString()}`);
              }

              // Earnings for each referral in the main list
              // Match by referredUserName parsed from transaction against the names in the loadedReferrals list
              const matchingReferralInList = loadedReferrals.find(r => r.referredUserName === parsedInfo.referredUserName);
              if (matchingReferralInList) {
                newReferralEarningsMap[matchingReferralInList.id] = (newReferralEarningsMap[matchingReferralInList.id] || 0) + tx.amount;
                console.log(`[ReferralTab]  💰 Attributed ₹${tx.amount} to ${parsedInfo.referredUserName} (ID: ${matchingReferralInList.id}). Total for this user: ${newReferralEarningsMap[matchingReferralInList.id]}`);
              } else {
                console.warn(`[ReferralTab]  ⚠️ Could not find referred user '${parsedInfo.referredUserName}' (from TX desc) in the main 'referrals' list to attribute earnings. Tx ID: ${tx.id}`);
              }
            } else {
              // console.log(`[ReferralTab]  ℹ️ Transaction description did not parse as a reward: "${tx.description}"`);
            }
          } else {
            // console.log(`[ReferralTab]  ℹ️ Transaction type is not 'earning': ${tx.type}`);
          }
        });
        
        setReferralEarningsMap(newReferralEarningsMap);
        console.log("[ReferralTab] Final Referral Earnings Map:", newReferralEarningsMap);

        setReferralStats({
          totalReferrals: loadedReferrals.length,
          totalEarningsFromReferrals: userProfile.totalEarnings || 0,
          gamesByReferralsToday: gamesTodayCount,
          activeReferralsLast7Days: activeUserNamesLast7Days.size,
        });
        console.log("[ReferralTab] Final Stats:", {
            totalReferrals: loadedReferrals.length,
            totalEarningsFromReferrals: userProfile.totalEarnings || 0,
            gamesByReferralsToday: gamesTodayCount,
            activeReferralsLast7Days: activeUserNamesLast7Days.size,
        });

      } catch (error) {
        console.error("[ReferralTab] Error fetching referral data:", error);
        toast({ title: "Error", description: "Could not load referral dashboard data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
        console.log("[ReferralTab] Fetching and processing complete.");
      }
    };

    fetchData();

  }, [authUserUid, userProfile, toast]);

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

  if (isLoading && (!userProfile || !authUserUid)) { 
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
      {!shortReferralCode && authUserUid && !isLoading && (
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
      {isLoading && (shortReferralCode === null && authUserUid) && ( 
         <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Your Referral Code...
            </CardTitle>
          </CardHeader>
           <CardContent>
            <p className="text-sm text-muted-foreground">Your short referral code is being prepared. Please check back shortly or try re-logging if it doesn't appear.</p>
           </CardContent>
         </Card>
      )}


      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Referral Summary</h2>
        {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_,i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                           <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                           <Users className="h-4 w-4 text-muted-foreground/30" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 bg-muted rounded w-1/2 animate-pulse mb-1"></div>
                            <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        ) : (
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
              <div className="text-2xl font-bold">₹{referralStats.totalEarningsFromReferrals.toFixed(2)}</div>
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
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">My Referrals List</CardTitle>
            <CardDescription>Users you have referred to {APP_NAME}. Earnings are calculated from completed games.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-muted rounded animate-pulse">
                            <div className="h-5 bg-muted-foreground/20 rounded w-1/3"></div>
                            <div className="h-5 bg-muted-foreground/20 rounded w-1/4"></div>
                            <div className="h-5 bg-muted-foreground/20 rounded w-1/6"></div>
                        </div>
                    ))}
                </div>
            ) : referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Username</TableHead>
                    <TableHead className="text-center">Referred On</TableHead>
                    <TableHead className="text-right">Earnings Generated (₹)</TableHead>
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

