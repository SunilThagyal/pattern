
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Gamepad2, AlertTriangle } from "lucide-react";

// Mock data for demonstration
const mockReferrals = [
  { id: 'ref1', name: 'Alice Wonderland', totalGames: 25, earnings: 125.00, status: 'active', breakdown: { today: 2, yesterday: 5, last7Days: 15 } },
  { id: 'ref2', name: 'Bob The Builder', totalGames: 10, earnings: 50.00, status: 'active', breakdown: { today: 0, yesterday: 1, last7Days: 7 } },
  { id: 'ref3', name: 'Charlie Brown', totalGames: 5, earnings: 25.00, status: 'inactive', breakdown: { today: 0, yesterday: 0, last7Days: 1 } },
  { id: 'ref4', name: 'Diana Prince', totalGames: 50, earnings: 250.00, status: 'active', breakdown: { today: 5, yesterday: 10, last7Days: 30 } },
];

const mockSummaryStats = {
  totalReferrals: mockReferrals.length,
  totalEarnings: mockReferrals.reduce((sum, ref) => sum + ref.earnings, 0),
  gamesToday: mockReferrals.reduce((sum, ref) => sum + ref.breakdown.today, 0),
  activeReferrals: mockReferrals.filter(ref => ref.status === 'active').length,
  inactiveReferrals: mockReferrals.filter(ref => ref.status === 'inactive').length,
};

export default function ReferralManagementTab() {
  // In a real app, this data would come from an API call based on the logged-in user.
  const referrals = mockReferrals;
  const summary = mockSummaryStats;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Referral Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalReferrals}</div>
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
              <div className="text-2xl font-bold">₹{summary.totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings from your referrals.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Games by Referrals (Today)</CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.gamesToday}</div>
              <p className="text-xs text-muted-foreground">
                Games completed by your referrals today.
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeReferrals}</div>
              <p className="text-xs text-muted-foreground">
                Referrals active in the last 7 days.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">My Referrals List</CardTitle>
            <CardDescription>Detailed information about each user you referred.</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Username</TableHead>
                    <TableHead className="text-center">Total Games</TableHead>
                    <TableHead className="text-center">Games (Today / Last 7d)</TableHead>
                    <TableHead className="text-right">Earnings Generated</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.name}</TableCell>
                      <TableCell className="text-center">{referral.totalGames}</TableCell>
                      <TableCell className="text-center">{referral.breakdown.today} / {referral.breakdown.last7Days}</TableCell>
                      <TableCell className="text-right">₹{referral.earnings.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={referral.status === 'active' ? 'default' : 'secondary'} 
                               className={referral.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {referral.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
