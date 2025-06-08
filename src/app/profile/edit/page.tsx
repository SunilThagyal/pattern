
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Globe, Banknote, Save, Home, Settings2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';
import { database } from '@/lib/firebase';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import type { UserProfile } from '@/lib/types';

type PaymentMethod = 'upi' | 'paytm' | 'bank' | 'paypal';

const SPECIAL_VALUE_NONE = "_NONE_"; // Define a constant for clarity

export default function EditProfilePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [authUserUid, setAuthUserUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState<'India' | 'Other'>('India');
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod | ''>('');
  
  // Payment details state
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [paytmNumber, setPaytmNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');

  useEffect(() => {
    const storedAuthStatus = localStorage.getItem('drawlyAuthStatus');
    const storedUid = localStorage.getItem('drawlyUserUid');

    if (storedAuthStatus === 'loggedIn' && storedUid) {
      setAuthUserUid(storedUid);
      const userProfileRef = ref(database, `users/${storedUid}`);
      get(userProfileRef).then((snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.val() as UserProfile;
          setUserProfile(profileData);
          setDisplayName(profileData.displayName);
          setCountry(profileData.country || 'India');
          setDefaultPaymentMethod(profileData.defaultPaymentMethod || '');
          
          const details = profileData.defaultPaymentDetails || {};
          setUpiId(details.upiId || '');
          setAccountNumber(details.accountNumber || '');
          setIfscCode(details.ifscCode || '');
          setPaytmNumber(details.paytmNumber || '');
          setPaypalEmail(details.paypalEmail || '');

        } else {
          toast({ title: "Error", description: "User profile not found.", variant: "destructive" });
          router.push('/');
        }
        setIsLoading(false);
      }).catch(error => {
        console.error("Error fetching user profile:", error);
        toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
        setIsLoading(false);
      });
    } else {
      toast({ title: "Access Denied", description: "You must be logged in to edit your profile.", variant: "destructive" });
      router.push('/auth');
    }
  }, [router, toast]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUserUid || !userProfile) return;

    if (!displayName.trim()) {
      toast({ title: "Display Name Required", description: "Please enter a display name.", variant: "destructive"});
      return;
    }

    setIsSaving(true);

    const updates: Partial<UserProfile> = {
      displayName: displayName.trim(),
      country: country,
      currency: country === 'India' ? 'INR' : 'USD',
      defaultPaymentMethod: defaultPaymentMethod || undefined, // Store as undefined if empty string
    };

    const paymentDetailsToSave: Record<string, string> = {};
    if (defaultPaymentMethod === 'upi' && upiId.trim()) paymentDetailsToSave.upiId = upiId.trim();
    else if (defaultPaymentMethod === 'paytm' && paytmNumber.trim()) paymentDetailsToSave.paytmNumber = paytmNumber.trim();
    else if (defaultPaymentMethod === 'bank' && accountNumber.trim() && ifscCode.trim()) {
        paymentDetailsToSave.accountNumber = accountNumber.trim();
        paymentDetailsToSave.ifscCode = ifscCode.trim();
    } else if (defaultPaymentMethod === 'paypal' && paypalEmail.trim()) paymentDetailsToSave.paypalEmail = paypalEmail.trim();
    
    if (defaultPaymentMethod && Object.keys(paymentDetailsToSave).length > 0) {
        updates.defaultPaymentDetails = paymentDetailsToSave;
    } else if (defaultPaymentMethod && Object.keys(paymentDetailsToSave).length === 0) {
        toast({ title: "Payment Details Missing", description: `Please enter details for ${defaultPaymentMethod.toUpperCase()} or clear the default method selection.`, variant: "destructive" });
        setIsSaving(false);
        return;
    } else { 
        updates.defaultPaymentDetails = {}; // Clear details if no method is selected by setting to empty object or undefined
    }


    try {
      await update(ref(database, `users/${authUserUid}`), updates);
      if (userProfile.displayName !== displayName.trim()) {
        localStorage.setItem('drawlyUserDisplayName', displayName.trim());
      }
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
      setUserProfile(prev => prev ? {...prev, ...updates, defaultPaymentDetails: updates.defaultPaymentDetails || {}} : null);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update your profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePaymentMethodChange = (value: string) => { // Value from Select onValueChange is always string
    if (value === SPECIAL_VALUE_NONE) {
        setDefaultPaymentMethod('');
    } else {
        setDefaultPaymentMethod(value as PaymentMethod);
    }
    // Clear previous details when method changes to avoid saving stale data if user doesn't update
    setUpiId('');
    setAccountNumber('');
    setIfscCode('');
    setPaytmNumber('');
    setPaypalEmail('');
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading Profile...</p>
      </div>
    );
  }

  if (!userProfile) {
     return (
      <div className="flex items-center justify-center min-h-screen">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="ml-4 text-destructive">Could not load user profile.</p>
         <Link href="/" passHref className="ml-4">
            <Button variant="outline">Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-2xl">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center">
            <Settings2 className="mr-3 h-8 w-8 text-primary" /> Edit Your Profile
          </CardTitle>
          <CardDescription>
            Manage your account details and preferences for {APP_NAME}.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveProfile}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-lg flex items-center">
                <User className="mr-2 text-muted-foreground" /> Display Name
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your game name"
                required
                className="text-base py-3"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-lg flex items-center">
                <Globe className="mr-2 text-muted-foreground" /> Country
              </Label>
              <Select
                value={country}
                onValueChange={(value: 'India' | 'Other') => setCountry(value)}
                required
                disabled={isSaving}
              >
                <SelectTrigger id="country" className="text-base py-3">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="India">India (Currency: INR ₹)</SelectItem>
                  <SelectItem value="Other">Other (Currency: USD $)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Changing country will update your currency for future earnings and withdrawals.</p>
            </div>
            
            <div className="border-t pt-6 mt-6">
                 <Label className="text-lg flex items-center mb-2">
                    <Banknote className="mr-2 text-muted-foreground" /> Default Payment Method (Optional)
                 </Label>
                 <p className="text-xs text-muted-foreground mb-3">Set your preferred way to receive withdrawals. This will pre-fill the withdrawal form.</p>
                  <Select 
                    value={defaultPaymentMethod} 
                    onValueChange={(value: string) => handlePaymentMethodChange(value)} 
                    disabled={isSaving}
                   >
                    <SelectTrigger id="defaultPaymentMethod" className="w-full mt-1 text-base py-3">
                      <SelectValue placeholder="None (Select during withdrawal)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SPECIAL_VALUE_NONE}>None (Select during withdrawal)</SelectItem>
                      {country === 'India' ? (
                        <>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="paytm">Paytm Wallet</SelectItem>
                          <SelectItem value="bank">Bank Account</SelectItem>
                        </>
                      ) : (
                        <SelectItem value="paypal">PayPal</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
            </div>

            {defaultPaymentMethod === 'upi' && country === 'India' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="upiId" className="text-base">UPI ID</Label>
                <Input id="upiId" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@okhdfcbank" className="py-3" disabled={isSaving}/>
              </div>
            )}
            {defaultPaymentMethod === 'paytm' && country === 'India' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="paytmNumber" className="text-base">Paytm Wallet Number</Label>
                <Input id="paytmNumber" type="tel" value={paytmNumber} onChange={e => setPaytmNumber(e.target.value)} placeholder="Your Paytm mobile number" className="py-3" disabled={isSaving}/>
              </div>
            )}
            {defaultPaymentMethod === 'bank' && country === 'India' && (
              <div className="space-y-4 mt-3">
                <div>
                  <Label htmlFor="accountNumber" className="text-base">Account Number</Label>
                  <Input id="accountNumber" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Your bank account number" className="py-3 mt-1" disabled={isSaving}/>
                </div>
                <div>
                  <Label htmlFor="ifscCode" className="text-base">IFSC Code</Label>
                  <Input id="ifscCode" value={ifscCode} onChange={e => setIfscCode(e.target.value)} placeholder="Your bank's IFSC code" className="py-3 mt-1" disabled={isSaving}/>
                </div>
              </div>
            )}
            {defaultPaymentMethod === 'paypal' && country === 'Other' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="paypalEmail" className="text-base">PayPal Email</Label>
                <Input id="paypalEmail" type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your.paypal.email@example.com" className="py-3" disabled={isSaving}/>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t">
            <Link href="/earnings" passHref>
              <Button variant="outline" type="button" disabled={isSaving}>
                <Home className="mr-2 h-4 w-4" /> Back to Earnings
              </Button>
            </Link>
            <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

