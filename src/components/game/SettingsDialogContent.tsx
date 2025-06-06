
"use client";

import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle, DialogDescription, DialogContent } from '@/components/ui/dialog';
import { Share2, LogOut, Loader2, Gift } from 'lucide-react'; // Added Gift
import { useToast } from '@/hooks/use-toast'; // Added useToast

interface SettingsDialogContentProps {
  onCopyLink: () => void;
  onLeaveRoom: () => void;
  isLeavingRoom?: boolean;
  playerId?: string | null; // Added playerId
}

export function SettingsDialogContent({ onCopyLink, onLeaveRoom, isLeavingRoom, playerId }: SettingsDialogContentProps) {
  const { toast } = useToast(); // Added

  const handleCopyReferralCode = () => {
    if (playerId) {
      navigator.clipboard.writeText(playerId)
        .then(() => toast({ title: "Referral ID Copied!", description: "Your Player ID has been copied to the clipboard." }))
        .catch(() => toast({ title: "Error", description: "Could not copy Referral ID.", variant: "destructive" }));
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Room Settings</DialogTitle>
        <DialogDescription>Manage your room preferences here.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {playerId && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
            <p className="text-sm font-medium text-foreground flex items-center">
              <Gift className="mr-2 h-4 w-4 text-primary" /> Your Referral ID:
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-mono text-primary break-all">{playerId}</p>
              <Button variant="ghost" size="sm" onClick={handleCopyReferralCode} className="text-xs">
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this ID with friends! If they complete a game after joining with your ID, you might earn a bonus in this room.</p>
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

