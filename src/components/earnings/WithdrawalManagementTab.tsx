
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
import { ref, push, serverTimestamp, runTransaction, get, onValue, off, type DataSnapshot, update } from 'firebase/database';
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
      console.log(`[WithdrawalTab] Setting up balance listener for UID: ${authUserUid}`);
      const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
      
      const listenerCallback = (snapshot: DataSnapshot) => {
        const newBalance = snapshot.val() || 0;
        console.log(`[WithdrawalTab] Balance listener fired. New balance from DB: ${newBalance}`);
        setCurrentBalance(newBalance);
      };
      
      onValue(userBalanceRef, listenerCallback);
      
      get(userBalanceRef).then(snapshot => {
        const initialFetchedBalance = snapshot.val() || 0;
        console.log(`[WithdrawalTab] Initial explicit fetch of balance: ${initialFetchedBalance}`);
        setCurrentBalance(initialFetchedBalance); 
      }).catch(error => {
        console.error("[WithdrawalTab] Error fetching initial balance explicitly:", error);
      });

      return () => {
        console.log(`[WithdrawalTab] Cleaning up balance listener for UID: ${authUserUid}`);
        off(userBalanceRef, 'value', listenerCallback);
      };
    } else {
        console.log("[WithdrawalTab] No authUserUid, using initialBalance:", initialBalance);
        setCurrentBalance(initialBalance);
    }
  }, [authUserUid, initialBalance]);


  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUserUid) return;

    setIsWithdrawing(true);
    console.log("[WithdrawalTab] Initiating withdrawal request.");

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

    // 1. Create and save the WithdrawalRequest to get its ID
    const withdrawalRequestData: Omit<WithdrawalRequest, 'id' | 'transactionId'> = { // Omit id and transactionId initially
      userId: authUserUid,
      amount,
      method: withdrawalMethod,
      details,
      status: 'Pending', 
      requestDate: serverTimestamp() as number,
    };

    const withdrawalRequestRef = push(ref(database, `withdrawalRequests/${authUserUid}`), withdrawalRequestData);
    const withdrawalRequestId = withdrawalRequestRef.key;

    if (!withdrawalRequestId) {
        toast({ title: "Error", description: "Could not create withdrawal request record. Please try again.", variant: "destructive" });
        setIsWithdrawing(false);
        return;
    }
    
    // 2. Create the Transaction, including the withdrawalRequestId
    const transactionData: Transaction = {
      date: serverTimestamp() as number,
      description: `Withdrawal Request via ${withdrawalMethod.toUpperCase()}`,
      amount: -amount, 
      type: 'withdrawal',
      status: 'Pending',
      withdrawalRequestId: withdrawalRequestId, // Link to the withdrawal request
    };
    
    const transactionRef = push(ref(database, `transactions/${authUserUid}`), transactionData);
    const transactionId = transactionRef.key;

    if (!transactionId) {
        // Potentially roll back withdrawalRequest or mark it as failed
        toast({ title: "Error", description: "Could not create transaction record. Please try again. Withdrawal request creation might need manual check.", variant: "destructive" });
        setIsWithdrawing(false);
        return;
    }
    
    // 3. Update the WithdrawalRequest with the transactionId
    await update(ref(database, `withdrawalRequests/${authUserUid}/${withdrawalRequestId}`), { transactionId: transactionId });
    // Also update the transaction with its own ID in notes for easier reference if needed (optional)
    await update(ref(database, `transactions/${authUserUid}/${transactionId}`), { notes: `Txn ID: ${transactionId}; Req ID: ${withdrawalRequestId}`});


    try {
      console.log("[WithdrawalTab] Attempting to deduct balance from user's totalEarnings.");
      const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
      await runTransaction(userBalanceRef, (currentEarnings) => {
        const earningsVal = currentEarnings || 0;
        console.log(`[WithdrawalTab] In runTransaction. Current earnings from DB: ${earningsVal}, Amount to deduct: ${amount}`);
        if (earningsVal < amount) {
          console.warn("[WithdrawalTab] Insufficient balance during Firebase transaction. Aborting.");
          return; 
        }
        return earningsVal - amount;
      });
      console.log("[WithdrawalTab] Balance deduction transaction should have completed.");

      toast({ title: "Withdrawal Requested", description: `Your request to withdraw ₹${amount.toFixed(2)} via ${withdrawalMethod.toUpperCase()} is pending. Your balance has been updated.`, variant: "default" });
      setWithdrawalAmount('');
      setWithdrawalMethod('');
      setUpiId('');
      setAccountNumber('');
      setIfscCode('');
      setPaytmNumber('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error("[WithdrawalTab] Withdrawal request error (post-record creation):", error);
      toast({ title: "Error", description: "Could not finalize withdrawal request (balance update failed). Check console for details.", variant: "destructive" });
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
           <CardDescription>This balance reflects your total confirmed earnings. It updates immediately when a withdrawal is requested.</CardDescription>
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
                  Your balance will be updated immediately upon submitting the request.
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
          <p><strong>Balance Update:</strong> Your available balance will be reduced by the requested amount immediately upon successful request submission. The request status will be 'Pending'.</p>
          <p><strong>Processing Time:</strong> Withdrawal requests are typically processed within [Specify processing time, e.g., 3-5 business days]. This is a simulation.</p>
          <p><strong>Rejection:</strong> If a withdrawal is rejected (e.g., due to incorrect details), the amount will be credited back to your available balance. You will see a 'Rejected' status and a corresponding refund transaction in your history.</p>
          <p><strong>Fees:</strong> Standard transaction fees from payment processors may apply in a real system (not simulated here).</p>
        </CardContent>
      </Card>
       <p className="text-xs text-muted-foreground text-center mt-4">
        Developer Note: This withdrawal system updates balances on request. The refund for rejected withdrawals is simulated on the client-side.
        Real financial processing requires a secure backend.
      </p>
    </div>
  );
}
