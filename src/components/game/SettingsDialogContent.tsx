
"use client";

import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle, DialogDescription, DialogContent } from '@/components/ui/dialog';
import { Share2, LogOut, Loader2, Gift, UserCircle } from 'lucide-react'; // Added UserCircle
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogContentProps {
  onCopyLink: () => void;
  onLeaveRoom: () => void;
  isLeavingRoom?: boolean;
  isAuthenticated?: boolean; // Added
  authPlayerId?: string | null; // Changed from playerId to authPlayerId for clarity (UID)
}

export function SettingsDialogContent({ 
  onCopyLink, 
  onLeaveRoom, 
  isLeavingRoom, 
  isAuthenticated, 
  authPlayerId 
}: SettingsDialogContentProps) {
  const { toast } = useToast();

  const handleCopyReferralCode = () => {
    if (authPlayerId && isAuthenticated) {
      navigator.clipboard.writeText(authPlayerId)
        .then(() => toast({ title: "Referral ID Copied!", description: "Your User ID has been copied to the clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy User ID.", variant: "destructive" }));
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Room Settings</DialogTitle>
        <DialogDescription>Manage your room preferences here.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {isAuthenticated && authPlayerId && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
            <p className="text-sm font-medium text-foreground flex items-center">
              <Gift className="mr-2 h-4 w-4 text-primary" /> Your Referral ID (User ID):
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-mono text-primary break-all">{authPlayerId}</p>
              <Button variant="ghost" size="sm" onClick={handleCopyReferralCode} className="text-xs">
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this ID with friends! If they complete a game after joining with your ID, you might earn a bonus in this room.</p>
          </div>
        )}
        {!isAuthenticated && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                <p className="text-sm text-blue-600 mb-2 flex items-center justify-center">
                    <UserCircle className="mr-2 h-5 w-5"/> You are playing as a guest.
                </p>
                <p className="text-xs text-blue-500">Log in on the homepage to get a Referral ID and save progress across devices.</p>
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
