
"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, Home } from "lucide-react";

interface VerifiedModalProps {
  isOpen: boolean;
  onGoToHomepage: () => void;
  userEmail: string | null;
}

export default function VerifiedModal({ isOpen, onGoToHomepage, userEmail }: VerifiedModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onGoToHomepage()} >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl text-green-600">
            <CheckCircle className="mr-2 h-6 w-6" />
            Email Verified!
          </DialogTitle>
          <DialogDescription className="pt-2">
            Your email address {userEmail ? <strong>{userEmail}</strong> : ''} has been successfully verified.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button onClick={onGoToHomepage} className="w-full">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
