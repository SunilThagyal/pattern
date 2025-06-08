
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { DollarSign, AlertTriangle, Banknote, Landmark, CreditCard, Loader2, Ban, PowerOff, Power, Mail } from 'lucide-react'; // Added Mail for PayPal
import { database } from '@/lib/firebase';
import { ref, push, serverTimestamp, runTransaction, get, onValue, off, type DataSnapshot, update } from 'firebase/database';
import type { Transaction, WithdrawalRequest, UserProfile, PlatformSettings } from '@/lib/types';

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
  const [withdrawalMethod, setWithdrawalMethod] = useState<'upi' | 'paytm' | 'bank' | 'paypal' | ''>(''); // Added paypal
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [paytmNumber, setPaytmNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState(''); // Added for PayPal

  const { toast } = useToast();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({ referralProgramEnabled: true, platformWithdrawalsEnabled: true });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const currencySymbol = userProfile?.currency === 'USD' ? '$' : '₹';
  const userCountry = userProfile?.country;

  useEffect(() => {
    if (!authUserUid) {
        setCurrentBalance(initialBalance);
        setIsLoadingSettings(false);
        return;
    }

    setIsLoadingSettings(true);
    const settingsRef = ref(database, 'platformSettings');
    const userProfileRef = ref(database, `users/${authUserUid}`);

    let settingsDataLoaded = false;
    let profileDataLoaded = false;

    const checkIfAllInitialDataLoaded = () => {
      if (settingsDataLoaded && profileDataLoaded) {
        setIsLoadingSettings(false);
      }
    };

    const platformSettingsListener = onValue(settingsRef, (snapshot) => {
        let newSettings: PlatformSettings;
        if (snapshot.exists()) {
            newSettings = snapshot.val() as PlatformSettings;
            setPlatformSettings({
                referralProgramEnabled: newSettings.referralProgramEnabled !== false,
                platformWithdrawalsEnabled: newSettings.platformWithdrawalsEnabled !== false,
            });
        } else {
             newSettings = { referralProgramEnabled: true, platformWithdrawalsEnabled: true };
             setPlatformSettings(newSettings);
        }
        settingsDataLoaded = true;
        checkIfAllInitialDataLoaded();
    }, (error) => {
        console.error("Error fetching platform settings via onValue:", error);
        setPlatformSettings({ referralProgramEnabled: true, platformWithdrawalsEnabled: true }); // Fallback
        settingsDataLoaded = true;
        checkIfAllInitialDataLoaded();
    });

    const userProfileListener = onValue(userProfileRef, (snapshot) => {
        if (snapshot.exists()) {
            const profile = snapshot.val() as UserProfile;
            setUserProfile(profile);
            setCurrentBalance(profile.totalEarnings || 0);
        } else {
            setUserProfile(null);
            setCurrentBalance(initialBalance);
        }
        profileDataLoaded = true;
        checkIfAllInitialDataLoaded();
    }, (error) => {
        console.error("Error fetching user profile via onValue:", error);
        setUserProfile(null);
        setCurrentBalance(initialBalance);
        profileDataLoaded = true;
        checkIfAllInitialDataLoaded();
    });

    return () => {
      off(settingsRef, 'value', platformSettingsListener);
      off(userProfileRef, 'value', userProfileListener);
    };
  }, [authUserUid, initialBalance]);


  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUserUid || !platformSettings.platformWithdrawalsEnabled || (userProfile && userProfile.canWithdraw === false) || !userProfile) return;

    setIsWithdrawing(true);

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid withdrawal amount.", variant: "destructive" });
      setIsWithdrawing(false);
      return;
    }
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      toast({ title: "Minimum Amount Not Met", description: `Minimum withdrawal amount is ${currencySymbol}${MIN_WITHDRAWAL_AMOUNT}.`, variant: "destructive" });
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
    } else if (withdrawalMethod === 'paypal') {
        if(!paypalEmail.trim()) { toast({ title: "PayPal Email Required", variant: "destructive" }); setIsWithdrawing(false); return; }
        details = { paypalEmail: paypalEmail.trim() };
    }


    const withdrawalRequestData: Omit<WithdrawalRequest, 'id' | 'transactionId'> = {
      userId: authUserUid,
      amount,
      currency: userProfile.currency, // Store currency with the request
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

    const transactionData: Transaction = {
      date: serverTimestamp() as number,
      description: `Withdrawal Request via ${withdrawalMethod.toUpperCase()}`,
      amount: -amount,
      type: 'withdrawal',
      status: 'Pending',
      withdrawalRequestId: withdrawalRequestId,
      currency: userProfile.currency, // Store currency with the transaction
    };

    const transactionRef = push(ref(database, `transactions/${authUserUid}`), transactionData);
    const transactionId = transactionRef.key;

    if (!transactionId) {
        toast({ title: "Error", description: "Could not create transaction record. Please try again. Withdrawal request creation might need manual check.", variant: "destructive" });
        setIsWithdrawing(false);
        return;
    }

    await update(ref(database, `withdrawalRequests/${authUserUid}/${withdrawalRequestId}`), { transactionId: transactionId });
    await update(ref(database, `transactions/${authUserUid}/${transactionId}`), { notes: `Txn ID: ${transactionId}; Req ID: ${withdrawalRequestId}`});


    try {
      const userBalanceRef = ref(database, `users/${authUserUid}/totalEarnings`);
      await runTransaction(userBalanceRef, (currentEarnings) => {
        const earningsVal = currentEarnings || 0;
        if (earningsVal < amount) {
          return;
        }
        return earningsVal - amount;
      });

      toast({ title: "Withdrawal Requested", description: `Your request to withdraw ${currencySymbol}${amount.toFixed(2)} via ${withdrawalMethod.toUpperCase()} is pending. Your balance has been updated.`, variant: "default" });
      setWithdrawalAmount('');
      setWithdrawalMethod('');
      setUpiId('');
      setAccountNumber('');
      setIfscCode('');
      setPaytmNumber('');
      setPaypalEmail('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error("[WithdrawalTab] Withdrawal request error (post-record creation):", error);
      toast({ title: "Error", description: "Could not finalize withdrawal request (balance update failed). Check console for details.", variant: "destructive" });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const userCanWithdraw = userProfile ? userProfile.canWithdraw !== false : true;
  const isWithdrawalDisabled = isLoadingSettings || !platformSettings.platformWithdrawalsEnabled || !userCanWithdraw;
  let disabledReason = "";
  if (isLoadingSettings) disabledReason = "Loading settings...";
  else if (!platformSettings.platformWithdrawalsEnabled) disabledReason = "Platform withdrawals are temporarily disabled.";
  else if (!userCanWithdraw) disabledReason = "Withdrawals are currently disabled for your account.";
  else if (currentBalance < MIN_WITHDRAWAL_AMOUNT) disabledReason = `Minimum balance of ${currencySymbol}${MIN_WITHDRAWAL_AMOUNT} required.`;


  if (isLoadingSettings) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

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
          <p className="text-4xl font-bold text-foreground">{currencySymbol}{currentBalance.toFixed(2)}</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                disabled={isWithdrawalDisabled || currentBalance < MIN_WITHDRAWAL_AMOUNT || isWithdrawing}
                title={disabledReason || "Request a withdrawal"}
              >
                {!platformSettings.platformWithdrawalsEnabled || !userCanWithdraw ? <Ban className="mr-2 h-5 w-5" /> : <DollarSign className="mr-2 h-5 w-5" />}
                {isWithdrawalDisabled ? (userCanWithdraw ? (platformSettings.platformWithdrawalsEnabled ? "Loading..." : "Platform Disabled") : "Account Disabled") : "Withdraw Funds"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Enter the amount and select your preferred method. Minimum withdrawal: {currencySymbol}{MIN_WITHDRAWAL_AMOUNT}.
                  Your balance will be updated immediately upon submitting the request.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="withdrawalAmount" className="text-sm font-medium">Amount to Withdraw ({currencySymbol})</Label>
                  <Input
                    id="withdrawalAmount"
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder={`Min ${currencySymbol}${MIN_WITHDRAWAL_AMOUNT}`}
                    min={MIN_WITHDRAWAL_AMOUNT.toString()}
                    step="0.01"
                    required
                    className="mt-1"
                    disabled={isWithdrawing}
                  />
                </div>
                <div>
                  <Label htmlFor="withdrawalMethod" className="text-sm font-medium">Withdrawal Method</Label>
                  <Select value={withdrawalMethod} onValueChange={(value) => setWithdrawalMethod(value as any)} disabled={isWithdrawing}>
                    <SelectTrigger id="withdrawalMethod" className="w-full mt-1">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {userCountry === 'India' && (
                        <>
                          <SelectItem value="upi"><CreditCard className="mr-2 h-4 w-4 inline-block"/> UPI</SelectItem>
                          <SelectItem value="paytm"><Banknote className="mr-2 h-4 w-4 inline-block"/> Paytm Wallet</SelectItem>
                          <SelectItem value="bank"><Landmark className="mr-2 h-4 w-4 inline-block"/> Bank Account</SelectItem>
                        </>
                      )}
                      {userCountry === 'Other' && (
                        <SelectItem value="paypal"><Mail className="mr-2 h-4 w-4 inline-block"/> PayPal</SelectItem>
                      )}
                      {/* Fallback if country is not yet loaded or unexpected value */}
                      {!userCountry && (
                        <>
                          <SelectItem value="upi"><CreditCard className="mr-2 h-4 w-4 inline-block"/> UPI</SelectItem>
                          <SelectItem value="paytm"><Banknote className="mr-2 h-4 w-4 inline-block"/> Paytm Wallet</SelectItem>
                          <SelectItem value="bank"><Landmark className="mr-2 h-4 w-4 inline-block"/> Bank Account</SelectItem>
                          <SelectItem value="paypal"><Mail className="mr-2 h-4 w-4 inline-block"/> PayPal</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {withdrawalMethod === 'upi' && userCountry === 'India' && (
                  <div>
                    <Label htmlFor="upiId" className="text-sm font-medium">UPI ID</Label>
                    <Input id="upiId" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@okhdfcbank" required className="mt-1" disabled={isWithdrawing}/>
                  </div>
                )}
                {withdrawalMethod === 'paytm' && userCountry === 'India' && (
                  <div>
                    <Label htmlFor="paytmNumber" className="text-sm font-medium">Paytm Wallet Number</Label>
                    <Input id="paytmNumber" type="tel" value={paytmNumber} onChange={e => setPaytmNumber(e.target.value)} placeholder="Your Paytm registered mobile number" required className="mt-1" disabled={isWithdrawing}/>
                  </div>
                )}
                {withdrawalMethod === 'bank' && userCountry === 'India' && (
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
                {withdrawalMethod === 'paypal' && userCountry === 'Other' && (
                  <div>
                    <Label htmlFor="paypalEmail" className="text-sm font-medium">PayPal Email</Label>
                    <Input id="paypalEmail" type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your.paypal.email@example.com" required className="mt-1" disabled={isWithdrawing}/>
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

      {isWithdrawalDisabled && !isLoadingSettings && (
         <div className="p-4 bg-orange-50 border border-orange-200 rounded-md text-orange-700 flex items-center">
          <Ban className="mr-3 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">
                {disabledReason.includes("Platform") ? "Withdrawals Temporarily Disabled by Platform" :
                 disabledReason.includes("Account") ? "Withdrawals Disabled for Your Account" :
                 "Withdrawals Unavailable"}
            </p>
            <p className="text-xs">
              {disabledReason.includes("Minimum balance") ? disabledReason :
               disabledReason.includes("Platform") ? "Platform-wide withdrawals are currently unavailable. Please check back later." :
               "Withdrawals are currently not permitted for your account. Please contact support if you believe this is an error."}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Withdrawal Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Minimum Withdrawal:</strong> You can request a withdrawal once your balance reaches at least {currencySymbol}{MIN_WITHDRAWAL_AMOUNT}.</p>
          <p><strong>Balance Update:</strong> Your available balance will be reduced by the requested amount immediately upon successful request submission. The request status will be 'Pending'.</p>
          <p><strong>Processing Time:</strong> Withdrawal requests are typically processed within [Specify processing time, e.g., 3-5 business days]. This is a simulation.</p>
          <p><strong>Rejection:</strong> If a withdrawal is rejected (e.g., due to incorrect details), the amount will be credited back to your available balance. You will see a 'Rejected' status and a corresponding refund transaction in your history.</p>
          <p><strong>Fees:</strong> Standard transaction fees from payment processors may apply in a real system (not simulated here).</p>
        </CardContent>
      </Card>
    </div>
  );
}
