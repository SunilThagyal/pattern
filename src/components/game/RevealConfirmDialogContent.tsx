
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

interface RevealConfirmDialogContentProps {
  letterChar?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevealConfirmDialogContent({ letterChar, onConfirm, onCancel }: RevealConfirmDialogContentProps) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reveal Hint?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to reveal the letter "{letterChar}" to other players?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
