
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { DollarSign, AlertTriangle, Banknote, Landmark, CreditCard, Loader2 } from 'lucide-react';

const MIN_WITHDRAWAL_AMOUNT = 50; // Example: ₹50

export default function WithdrawalManagementTab() {
  // Mock data - in a real app, this would come from user's account data
  const [currentBalance, setCurrentBalance] = useState(275.50); 
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [paytmNumber, setPaytmNumber] = useState('');

  const { toast } = useToast();

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    // Add validation for method-specific details
    if (withdrawalMethod === 'upi' && !upiId.trim()) {
        toast({ title: "UPI ID Required", description: "Please enter your UPI ID.", variant: "destructive" });
        setIsWithdrawing(false); return;
    }
    if (withdrawalMethod === 'bank' && (!accountNumber.trim() || !ifscCode.trim())) {
        toast({ title: "Bank Details Required", description: "Please enter Account Number and IFSC Code.", variant: "destructive" });
        setIsWithdrawing(false); return;
    }
    if (withdrawalMethod === 'paytm' && !paytmNumber.trim()) {
        toast({ title: "Paytm Number Required", description: "Please enter your Paytm number.", variant: "destructive" });
        setIsWithdrawing(false); return;
    }


    // Simulate API call
    setTimeout(() => {
      toast({ title: "Withdrawal Requested", description: `Your request to withdraw ₹${amount} via ${withdrawalMethod.toUpperCase()} is being processed.`, variant: "default" });
      // Deduct from balance (mock)
      setCurrentBalance(prev => prev - amount);
      // Reset form
      setWithdrawalAmount('');
      setWithdrawalMethod('');
      setUpiId('');
      setAccountNumber('');
      setIfscCode('');
      setPaytmNumber('');
      setIsDialogOpen(false);
      setIsWithdrawing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center">
            <Banknote className="mr-2 h-5 w-5 text-primary" /> Current Available Balance
          </CardTitle>
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
                  <Select value={withdrawalMethod} onValueChange={setWithdrawalMethod} disabled={isWithdrawing}>
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
                  <Button type="submit" disabled={isWithdrawing || !withdrawalAmount || !withdrawalMethod}>
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
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 flex items-center">
          <AlertTriangle className="mr-3 h-5 w-5" />
          <p className="text-sm">
            Your current balance is below the minimum withdrawal threshold of ₹{MIN_WITHDRAWAL_AMOUNT}.
            Keep referring and earning!
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Withdrawal Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Minimum Withdrawal:</strong> You can request a withdrawal once your balance reaches at least ₹{MIN_WITHDRAWAL_AMOUNT}.</p>
          <p><strong>Processing Time:</strong> Withdrawal requests are typically processed within 3-5 business days.</p>
          <p><strong>Verification:</strong> For larger amounts or first-time withdrawals, we may require additional verification.</p>
          <p><strong>Fees:</strong> Standard transaction fees may apply depending on the chosen withdrawal method (we'll notify you if any).</p>
        </CardContent>
      </Card>
    </div>
  );
}
