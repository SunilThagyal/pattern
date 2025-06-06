
"use client";

import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle, DialogDescription, DialogContent } from '@/components/ui/dialog';
import { Share2, LogOut, Loader2, Gift, UserCircle, Link2, Copy } from 'lucide-react'; // Added Link2, Copy
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react'; // Added useState, useEffect

interface SettingsDialogContentProps {
  onCopyLink: () => void; // Room link
  onLeaveRoom: () => void;
  isLeavingRoom?: boolean;
  isAuthenticated?: boolean; 
  authPlayerId?: string | null; 
}

export function SettingsDialogContent({ 
  onCopyLink, 
  onLeaveRoom, 
  isLeavingRoom, 
  isAuthenticated, 
  authPlayerId 
}: SettingsDialogContentProps) {
  const { toast } = useToast();
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    if (isAuthenticated && authPlayerId && typeof window !== 'undefined') {
      setReferralLink(`${window.location.origin}/referral/${authPlayerId}`);
    }
  }, [isAuthenticated, authPlayerId]);

  const handleCopyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
        .then(() => toast({ title: "Referral Link Copied!", description: "Your Referral Link has been copied to the clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy Referral Link.", variant: "destructive" }));
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Room Settings</DialogTitle>
        <DialogDescription>Manage your room preferences here.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {isAuthenticated && authPlayerId && referralLink && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
            <p className="text-sm font-medium text-foreground flex items-center">
              <Link2 className="mr-2 h-4 w-4 text-primary" /> Your Referral Link:
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono text-primary break-all">{referralLink}</p>
              <Button variant="ghost" size="sm" onClick={handleCopyReferralLink} className="text-xs">
                <Copy className="mr-1 h-3 w-3"/>Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this link with friends! If they complete a game after joining with your link, you might earn a bonus.</p>
          </div>
        )}
        {!isAuthenticated && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                <p className="text-sm text-blue-600 mb-2 flex items-center justify-center">
                    <UserCircle className="mr-2 h-5 w-5"/> You are playing as a guest.
                </p>
                <p className="text-xs text-blue-500">Log in on the homepage to get your Referral Link and save progress.</p>
            </div>
        )}
        <Button variant="outline" onClick={onCopyLink} className="w-full justify-start" disabled={isLeavingRoom}>
          <Share2 className="mr-2 h-4 w-4" /> Share Room Link
        </Button>
        <Button variant="destructive" onClick={onLeaveRoom} className="w-full justify-start" disabled={isLeavingRoom}>
          {isLeavingRoom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          {isLeavingRoom ? 'Leaving...' : 'Leave Room'}
        </Button>
      </div>
    </DialogContent>
  );
}
