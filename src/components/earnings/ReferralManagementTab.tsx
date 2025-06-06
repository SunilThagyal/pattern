
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Users, TrendingUp, Gamepad2, AlertTriangle, Gift, Copy, Loader2 } from "lucide-react";
import { database } from '@/lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import type { UserProfile, ReferralEntry } from '@/lib/types';
import { format } from 'date-fns';

interface ReferralManagementTabProps {
  authUserUid: string | null;
  userProfile: UserProfile | null;
}

interface DisplayReferral extends ReferralEntry {
    id: string; // referredUserId
    // Add other stats if calculable client-side, e.g. totalGames (hard)
}

export default function ReferralManagementTab({ authUserUid, userProfile }: ReferralManagementTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [referrals, setReferrals] = useState<DisplayReferral[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    if (!authUserUid || !userProfile) {
      setIsLoading(false);
      return;
    }

    setTotalEarnings(userProfile.totalEarnings || 0);

    const referralsRef = ref(database, `referrals/${authUserUid}`);
    get(referralsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const referralsData = snapshot.val();
        const loadedReferrals: DisplayReferral[] = Object.keys(referralsData).map(key => ({
          id: key,
          ...referralsData[key]
        }));
        setReferrals(loadedReferrals);
      } else {
        setReferrals([]);
      }
      setIsLoading(false);
    }).catch(error => {
      console.error("Error fetching referrals:", error);
      toast({ title: "Error", description: "Could not load referral data.", variant: "destructive" });
      setIsLoading(false);
    });

  }, [authUserUid, userProfile, toast]);

  const handleCopyReferralId = () => {
    if (authUserUid) {
      navigator.clipboard.writeText(authUserUid)
        .then(() => toast({ title: "Referral ID Copied!", description: "Your Referral ID is copied to clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy Referral ID.", variant: "destructive" }));
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  // Summary stats (some are still conceptual for client-side)
  const summaryStats = {
    totalReferrals: referrals.length,
    totalEarnings: totalEarnings,
    // GamesToday & ActiveReferrals would require more complex queries or backend aggregation.
    gamesToday: "N/A (Backend needed)",
    activeReferrals: "N/A (Backend needed)",
  };


  return (
    <div className="space-y-6">
      {authUserUid && (
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-primary-foreground">
              <Gift className="mr-2 h-5 w-5 text-yellow-400" /> Your Unique Referral ID
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2">
            <p className="font-mono text-primary-foreground bg-primary/20 px-2 py-1 rounded-sm text-sm break-all">{authUserUid}</p>
            <Button variant="ghost" size="sm" onClick={handleCopyReferralId} className="text-primary-foreground hover:bg-primary/30">
              <Copy className="mr-2 h-4 w-4" /> Copy ID
            </Button>
          </CardContent>
           <CardDescription className="px-6 pb-4 text-xs text-primary-foreground/80">
            Share this ID with friends. When they sign up using your ID and complete games, you'll earn rewards!
          </CardDescription>
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
              <div className="text-2xl font-bold">{summaryStats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                Users you've successfully referred.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{summaryStats.totalEarnings.toFixed(2)}</div>
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
              <div className="text-2xl font-bold">{summaryStats.gamesToday}</div>
              <p className="text-xs text-muted-foreground">
                (Requires backend aggregation)
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Referrals (Last 7d)</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.activeReferrals}</div>
              <p className="text-xs text-muted-foreground">
                 (Requires backend aggregation)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">My Referrals List</CardTitle>
            <CardDescription>Users you have referred to {APP_NAME}. Detailed stats per user require backend processing.</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Username</TableHead>
                    <TableHead className="text-center">Referred On</TableHead>
                    <TableHead className="text-right">Earnings Generated (Est.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.referredUserName}</TableCell>
                      <TableCell className="text-center">{format(new Date(referral.timestamp), "PP")}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">N/A (Backend Needed)</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't referred anyone yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Share your referral ID to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
