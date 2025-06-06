
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ReferralManagementTab from '@/components/earnings/ReferralManagementTab';
import WithdrawalManagementTab from '@/components/earnings/WithdrawalManagementTab';
import TransactionHistoryTab from '@/components/earnings/TransactionHistoryTab';
import { DollarSign, Users, CreditCard, History, Loader2 } from 'lucide-react';
import { APP_NAME } from '@/lib/config';

export default function EarningsDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('drawlyAuthStatus');
    if (authStatus === 'loggedIn') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      // Optional: Redirect to login if not authenticated, or show a message.
      // For now, let's allow viewing the structure but real data would be guarded.
      // router.push('/auth'); 
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading || isAuthenticated === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading Earnings Dashboard...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need to be logged in to view your earnings dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/auth')}>Login / Sign Up</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center">
          <DollarSign className="mr-3 h-8 w-8 text-primary" />
          {APP_NAME} Earnings Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your referrals, manage your earnings, and view your transaction history.
        </p>
      </header>

      <Tabs defaultValue="referrals" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-12 mb-6">
          <TabsTrigger value="referrals" className="py-2 sm:py-3 text-sm sm:text-base">
            <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Referral Management
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="py-2 sm:py-3 text-sm sm:text-base">
            <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Withdrawal Management
          </TabsTrigger>
          <TabsTrigger value="history" className="py-2 sm:py-3 text-sm sm:text-base">
            <History className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <ReferralManagementTab />
        </TabsContent>
        <TabsContent value="withdrawals">
          <WithdrawalManagementTab />
        </TabsContent>
        <TabsContent value="history">
          <TransactionHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
