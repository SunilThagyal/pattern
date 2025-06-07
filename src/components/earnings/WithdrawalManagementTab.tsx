
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { DollarSign, AlertTriangle, Banknote, Landmark, CreditCard, Loader2 } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, push, serverTimestamp, runTransaction, get, onValue, off } from 'firebase/database'; // Added off
import type { Transaction, WithdrawalRequest, UserProfile } from '@/lib/types';

const MIN_WITHDRAWAL_AMOUNT = 50;

interface WithdrawalManagementTabProps {
  authUserUid: string | null;
  initialBalance: number;
}

export default function WithdrawalManagementTab({ authUserUid, initialBalance }: WithdrawalManagementTabProps) {
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<'upi' | 'paytm' | 'bank' | ''>('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [paytmNumber, setPaytmNumber] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (authUserUid) {
      const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
      const listenerCallback = (snapshot: any) => { // Explicitly type snapshot or use a more specific type if available
        setCurrentBalance(snapshot.val() || 0);
      };
      onValue(userBalanceRef, listenerCallback);
      
      return () => {
        // Detach the listener when the component unmounts or authUserUid changes
        off(userBalanceRef, 'value', listenerCallback);
      };
    } else {
        setCurrentBalance(initialBalance);
    }
  }, [authUserUid, initialBalance]);


  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUserUid) return;

    setIsWithdrawing(true);

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid withdrawal amount.", variant: "destructive" });
      setIsWithdrawing(false);
      return;
    }
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      toast({ title: "Minimum Amount Not Met", description: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_AMOUNT}.`, variant: "destructive" });
      setIsWithdrawing(false);
      return;
    }
    if (amount > currentBalance) {
      toast({ title: "Insufficient Balance", description: "Withdrawal amount cannot exceed your current balance.", variant: "destructive" });
      setIsWithdrawing(false);
      return;
    }
    if (!withdrawalMethod) {
      toast({ title: "Method Required", description: "Please select a withdrawal method.", variant: "destructive" });
      setIsWithdrawing(false);
      return;
    }

    let details: Record<string, string> = {};
    if (withdrawalMethod === 'upi') {
        if(!upiId.trim()) { toast({ title: "UPI ID Required", variant: "destructive" }); setIsWithdrawing(false); return; }
        details = { upiId: upiId.trim() };
    } else if (withdrawalMethod === 'bank') {
        if(!accountNumber.trim() || !ifscCode.trim()) { toast({ title: "Bank Details Required", variant: "destructive" }); setIsWithdrawing(false); return; }
        details = { accountNumber: accountNumber.trim(), ifscCode: ifscCode.trim() };
    } else if (withdrawalMethod === 'paytm') {
        if(!paytmNumber.trim()) { toast({ title: "Paytm Number Required", variant: "destructive" }); setIsWithdrawing(false); return; }
        details = { paytmNumber: paytmNumber.trim() };
    }

    const withdrawalRequestData: WithdrawalRequest = {
      userId: authUserUid,
      amount,
      method: withdrawalMethod,
      details,
      status: 'Pending', 
      requestDate: serverTimestamp() as number,
    };

    const transactionData: Transaction = {
      date: serverTimestamp() as number,
      description: `Withdrawal Request via ${withdrawalMethod.toUpperCase()}`,
      amount: -amount, 
      type: 'withdrawal',
      status: 'Pending', 
      notes: `Method: ${withdrawalMethod.toUpperCase()}`,
    };

    try {
      // 1. Save the withdrawal request
      const newWithdrawalRequestRef = push(ref(database, `withdrawalRequests/${authUserUid}`), withdrawalRequestData);
      transactionData.notes = `Ref ID: ${newWithdrawalRequestRef.key}. Method: ${withdrawalMethod.toUpperCase()}`;

      // 2. Log the transaction
      await push(ref(database, `transactions/${authUserUid}`), transactionData);
      
      // 3. Atomically update (decrease) the user's totalEarnings
      const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
      await runTransaction(userBalanceRef, (currentEarnings) => {
        if (currentEarnings === null) {
          return -amount; // Should not happen if user has balance, but as a safeguard
        }
        return (currentEarnings || 0) - amount;
      });

      toast({ title: "Withdrawal Requested", description: `Your request to withdraw ₹${amount} via ${withdrawalMethod.toUpperCase()} is pending. Your balance has been updated.`, variant: "default" });
      setWithdrawalAmount('');
      setWithdrawalMethod('');
      setUpiId('');
      setAccountNumber('');
      setIfscCode('');
      setPaytmNumber('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Withdrawal request error:", error);
      toast({ title: "Error", description: "Could not submit withdrawal request.", variant: "destructive" });
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center">
            <Banknote className="mr-2 h-5 w-5 text-primary" /> Current Available Balance
          </CardTitle>
           <CardDescription>This balance reflects your total confirmed earnings.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-baseline justify-between">
          <p className="text-4xl font-bold text-foreground">₹{currentBalance.toFixed(2)}</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" disabled={currentBalance < MIN_WITHDRAWAL_AMOUNT || isWithdrawing}>
                <DollarSign className="mr-2 h-5 w-5" /> Withdraw Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Enter the amount and select your preferred method. Minimum withdrawal: ₹{MIN_WITHDRAWAL_AMOUNT}.
                  Your balance will be updated upon request.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="withdrawalAmount" className="text-sm font-medium">Amount to Withdraw (₹)</Label>
                  <Input
                    id="withdrawalAmount"
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder={`Min ₹${MIN_WITHDRAWAL_AMOUNT}`}
                    min={MIN_WITHDRAWAL_AMOUNT.toString()}
                    step="0.01"
                    required
                    className="mt-1"
                    disabled={isWithdrawing}
                  />
                </div>
                <div>
                  <Label htmlFor="withdrawalMethod" className="text-sm font-medium">Withdrawal Method</Label>
                  <Select value={withdrawalMethod} onValueChange={(value) => setWithdrawalMethod(value as 'upi' | 'paytm' | 'bank' | '')} disabled={isWithdrawing}>
                    <SelectTrigger id="withdrawalMethod" className="w-full mt-1">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upi"><CreditCard className="mr-2 h-4 w-4 inline-block"/> UPI</SelectItem>
                      <SelectItem value="paytm"><Banknote className="mr-2 h-4 w-4 inline-block"/> Paytm Wallet</SelectItem>
                      <SelectItem value="bank"><Landmark className="mr-2 h-4 w-4 inline-block"/> Bank Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {withdrawalMethod === 'upi' && (
                  <div>
                    <Label htmlFor="upiId" className="text-sm font-medium">UPI ID</Label>
                    <Input id="upiId" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@okhdfcbank" required className="mt-1" disabled={isWithdrawing}/>
                  </div>
                )}
                {withdrawalMethod === 'paytm' && (
                  <div>
                    <Label htmlFor="paytmNumber" className="text-sm font-medium">Paytm Wallet Number</Label>
                    <Input id="paytmNumber" type="tel" value={paytmNumber} onChange={e => setPaytmNumber(e.target.value)} placeholder="Your Paytm registered mobile number" required className="mt-1" disabled={isWithdrawing}/>
                  </div>
                )}
                {withdrawalMethod === 'bank' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="accountNumber" className="text-sm font-medium">Account Number</Label>
                      <Input id="accountNumber" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Your bank account number" required className="mt-1" disabled={isWithdrawing}/>
                    </div>
                    <div>
                      <Label htmlFor="ifscCode" className="text-sm font-medium">IFSC Code</Label>
                      <Input id="ifscCode" value={ifscCode} onChange={e => setIfscCode(e.target.value)} placeholder="Your bank's IFSC code" required className="mt-1" disabled={isWithdrawing}/>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isWithdrawing}>Cancel</Button>
                  <Button type="submit" disabled={isWithdrawing || !withdrawalAmount || !withdrawalMethod || parseFloat(withdrawalAmount) > currentBalance || parseFloat(withdrawalAmount) < MIN_WITHDRAWAL_AMOUNT}>
                    {isWithdrawing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Withdrawal
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {currentBalance < MIN_WITHDRAWAL_AMOUNT && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 flex items-start">
          <AlertTriangle className="mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Minimum Withdrawal Not Met</p>
            <p className="text-xs">
              Your current balance (₹{currentBalance.toFixed(2)}) is below the minimum withdrawal threshold of ₹{MIN_WITHDRAWAL_AMOUNT}.
              Keep referring and earning!
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Withdrawal Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Minimum Withdrawal:</strong> You can request a withdrawal once your balance reaches at least ₹{MIN_WITHDRAWAL_AMOUNT}.</p>
          <p><strong>Balance Update:</strong> Your available balance will be reduced by the requested amount immediately. The request status will be 'Pending'.</p>
          <p><strong>Processing Time:</strong> In a real system, requests are reviewed. This is a simulation.</p>
          <p><strong>Verification:</strong> For security, identity verification might be required by a real system.</p>
          <p><strong>Fees:</strong> Standard transaction fees from payment processors may apply in a real system.</p>
        </CardContent>
      </Card>
       <p className="text-xs text-muted-foreground text-center mt-4">
        Developer Note: This withdrawal system updates balances on request. Real financial processing, approvals, and rejections
        would require a secure backend implementation.
      </p>
    </div>
  );
}

    