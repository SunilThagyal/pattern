
"use client";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"; // Added
import { Loader2 } from "lucide-react"; // Added

interface RevealConfirmDialogContentProps {
  letterChar?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRevealingLetter?: boolean; // Added
}

export function RevealConfirmDialogContent({ letterChar, onConfirm, onCancel, isRevealingLetter }: RevealConfirmDialogContentProps) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reveal Hint?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to reveal the letter "{letterChar}" to other players?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel} disabled={isRevealingLetter}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={isRevealingLetter}>
          {isRevealingLetter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
