
"use client";

import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle, DialogDescription, DialogContent } from '@/components/ui/dialog';
import { Share2, LogOut, Loader2 } from 'lucide-react';

interface SettingsDialogContentProps {
  onCopyLink: () => void;
  onLeaveRoom: () => void;
  isLeavingRoom?: boolean;
}

export function SettingsDialogContent({ onCopyLink, onLeaveRoom, isLeavingRoom }: SettingsDialogContentProps) {
  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Room Settings</DialogTitle>
        <DialogDescription>Manage your room preferences here.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
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
