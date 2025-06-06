
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
import { APP_NAME } from '@/lib/config';

interface ReferralManagementTabProps {
  authUserUid: string | null;
  userProfile: UserProfile | null;
}

interface DisplayReferral extends ReferralEntry {
    id: string; 
}

export default function ReferralManagementTab({ authUserUid, userProfile }: ReferralManagementTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [referrals, setReferrals] = useState<DisplayReferral[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [shortReferralCode, setShortReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authUserUid || !userProfile) {
      setIsLoading(false);
      return;
    }

    setTotalEarnings(userProfile.totalEarnings || 0);
    setShortReferralCode(userProfile.shortReferralCode || null);

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

  if (isLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  const summaryStats = {
    totalReferrals: referrals.length,
    totalEarningsFromReferrals: totalEarnings, 
    gamesToday: "N/A", 
    activeReferrals: "N/A", 
  };


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
              <CardTitle className="text-sm font-medium">Total Earnings from Referrals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{summaryStats.totalEarningsFromReferrals.toFixed(2)}</div>
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
         <p className="text-xs text-muted-foreground mt-2">
            Developer Note: "Referral Summary" data is based on available client-side information.
            "Games by Referrals Today" and "Active Referrals" stats are illustrative and require backend processing for accuracy.
          </p>
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
                <p className="text-sm text-muted-foreground mt-1">Share your referral link to start earning!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Developer Note: This dashboard is a UI prototype. Real data fetching, aggregation, and financial transactions
        would require a secure backend implementation and Firebase Cloud Functions for robust operations.
      </p>
    </div>
  );
}

