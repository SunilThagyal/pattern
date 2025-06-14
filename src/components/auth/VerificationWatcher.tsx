
"use client";

import { useState, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import VerifiedModal from './VerifiedModal';

interface VerificationWatcherProps {
  onUserVerifiedAndModalConfirmed: () => void;
  userEmailForModal: string | null;
}

const POLLING_INTERVAL_MS = 4000;

export default function VerificationWatcher({ onUserVerifiedAndModalConfirmed, userEmailForModal }: VerificationWatcherProps) {
  const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser); // Initialize with current user

  // Effect to subscribe to auth state changes and update local currentUser
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('[VerificationWatcher] Auth state changed. User:', user, 'Verified:', user?.emailVerified);
      setCurrentUser(user); // Keep local state in sync
    });
    return () => unsubscribe();
  }, []); // Run once on mount to subscribe

  // Effect to handle modal opening if user becomes verified (either initially or through polling update)
  useEffect(() => {
    if (currentUser && currentUser.emailVerified && !isVerifiedModalOpen) {
      console.log('[VerificationWatcher] currentUser is now verified (detected by state change). Opening modal.');
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
        console.log('[VerificationWatcher] Cleared polling interval because user is verified.');
      }
      setIsVerifiedModalOpen(true);
    }
  }, [currentUser, isVerifiedModalOpen]); // React to changes in currentUser or modal state

  // Effect for polling
  useEffect(() => {
    // Only start polling if we have a user, they are not verified, and the modal isn't already open
    if (currentUser && !currentUser.emailVerified && !isVerifiedModalOpen) {
      console.log('[VerificationWatcher] Starting polling for email verification.');
      intervalIdRef.current = setInterval(async () => {
        if (auth.currentUser) { // Use auth.currentUser for reload to get the latest from Firebase
          try {
            console.log('[VerificationWatcher] Polling: reloading user...');
            await auth.currentUser.reload();
            // After reload, check the Firebase's updated currentUser object
            if (auth.currentUser.emailVerified) {
               console.log('[VerificationWatcher] Polling: User IS NOW VERIFIED directly after reload. Opening modal.');
               if (intervalIdRef.current) clearInterval(intervalIdRef.current);
               intervalIdRef.current = null;
               setIsVerifiedModalOpen(true); // Directly trigger modal
            } else {
               console.log('[VerificationWatcher] Polling: User still not verified after reload.');
            }
          } catch (error: any) {
            console.error("[VerificationWatcher] Polling error during user.reload():", error.message);
            if (['auth/user-token-expired', 'auth/user-not-found', 'auth/network-request-failed'].includes(error.code)) {
              if (intervalIdRef.current) clearInterval(intervalIdRef.current);
              intervalIdRef.current = null;
              console.log('[VerificationWatcher] Stopping polling due to critical user auth error or network issue.');
              // Optionally, inform the user or redirect to login
            }
          }
        } else {
          // auth.currentUser became null (e.g., user signed out elsewhere)
          console.log('[VerificationWatcher] Polling: auth.currentUser is null. Stopping polling.');
          if (intervalIdRef.current) clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
      }, POLLING_INTERVAL_MS);
    } else {
      // Conditions for polling not met (no user, user already verified, or modal already open)
      if (intervalIdRef.current) {
        console.log('[VerificationWatcher] Clearing polling interval because conditions (no user / already verified / modal open) no longer met.');
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }

    // Cleanup function for the polling effect
    return () => {
      if (intervalIdRef.current) {
        console.log('[VerificationWatcher] Cleaning up polling interval on unmount or dependency change.');
        clearInterval(intervalIdRef.current);
      }
    };
  }, [currentUser, isVerifiedModalOpen]); // This effect runs when currentUser or isVerifiedModalOpen changes

  const handleModalConfirmation = () => {
    console.log('[VerificationWatcher] Modal confirmed by user.');
    setIsVerifiedModalOpen(false);
    onUserVerifiedAndModalConfirmed();
  };

  return (
    <VerifiedModal
      isOpen={isVerifiedModalOpen}
      onGoToHomepage={handleModalConfirmation}
      userEmail={userEmailForModal}
    />
  );
}

