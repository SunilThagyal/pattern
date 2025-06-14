
"use client";

import { useState, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import VerifiedModal from './VerifiedModal';

interface VerificationWatcherProps {
  onUserVerifiedAndModalConfirmed: () => void; // Callback after modal's "Go to Homepage"
  userEmailForModal: string | null;
}

const POLLING_INTERVAL_MS = 4000; // Poll every 4 seconds

export default function VerificationWatcher({ onUserVerifiedAndModalConfirmed, userEmailForModal }: VerificationWatcherProps) {
  const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user && user.emailVerified) {
        // If already verified when component mounts or auth state changes
        if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        setIsVerifiedModalOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (currentUser && !currentUser.emailVerified && !isVerifiedModalOpen) {
      intervalIdRef.current = setInterval(async () => {
        if (auth.currentUser) {
          try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              if (intervalIdRef.current) clearInterval(intervalIdRef.current);
              setIsVerifiedModalOpen(true);
            }
          } catch (error) {
            console.error("Error reloading user for verification check:", error);
            // Optionally stop polling on certain errors, e.g., user deleted
            if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/user-not-found') {
                 if (intervalIdRef.current) clearInterval(intervalIdRef.current);
            }
          }
        }
      }, POLLING_INTERVAL_MS);
    } else if (intervalIdRef.current && (currentUser?.emailVerified || isVerifiedModalOpen)) {
      clearInterval(intervalIdRef.current);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [currentUser, isVerifiedModalOpen]);

  const handleModalConfirmation = () => {
    setIsVerifiedModalOpen(false); // Close modal
    onUserVerifiedAndModalConfirmed(); // Trigger login/redirect logic
  };

  return (
    <VerifiedModal
      isOpen={isVerifiedModalOpen}
      onGoToHomepage={handleModalConfirmation}
      userEmail={userEmailForModal}
    />
  );
}
