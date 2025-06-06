
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ref, set, get, child, serverTimestamp, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, RoomCreationData, RoomConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Timer, ListChecks, TextCursorInput, UserPlus,LogIn } from 'lucide-react';

interface RoomFormProps {
  mode: 'create' | 'join';
  initialRoomId?: string;
}

export default function RoomForm({ mode, initialRoomId }: RoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Room config states
  const [roundTimeoutSeconds, setRoundTimeoutSeconds] = useState(90);
  const [totalRounds, setTotalRounds] = useState(5);
  const [maxWordLength, setMaxWordLength] = useState(20);

  // Simulated Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPlayerId, setAuthPlayerId] = useState<string | null>(null);
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // Check for simulated auth state in localStorage
    const authStatus = localStorage.getItem('drawlyAuthStatus');
    const storedName = localStorage.getItem('drawlyUserDisplayName');
    const storedUid = localStorage.getItem('drawlyUserUid');
    
    if (authStatus === 'loggedIn' && storedName && storedUid) {
      setIsAuthenticated(true);
      setAuthPlayerId(storedUid);
      setPlayerName(storedName); // Pre-fill player name if authenticated
      setAuthDisplayName(storedName);
    } else {
      const storedPlayerName = localStorage.getItem('patternPartyPlayerName');
      if (storedPlayerName) {
        setPlayerName(storedPlayerName);
      }
    }
  }, []);

  const getPlayerIdForFirebase = (): string => {
    if (isAuthenticated && authPlayerId) {
      return authPlayerId;
    }
    let localPlayerId = localStorage.getItem('patternPartyPlayerId');
    if (!localPlayerId) {
      localPlayerId = `anon_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('patternPartyPlayerId', localPlayerId);
    }
    return localPlayerId;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      toast({ title: "Name Required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (mode === 'join' && !roomId.trim()) {
      toast({ title: "Room ID Required", description: "Please enter a Room ID to join.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    if (mode === 'create') {
        if (
            Number.isNaN(roundTimeoutSeconds) || roundTimeoutSeconds < 30 ||
            Number.isNaN(totalRounds) || totalRounds < 1 ||
            Number.isNaN(maxWordLength) || maxWordLength < 3
        ) {
            toast({ title: "Invalid Config", description: "Please check room settings. Timeout >= 30s, Rounds >= 1, Max Word Length >= 3.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
    }

    if (!isAuthenticated) {
        localStorage.setItem('patternPartyPlayerName', playerName);
    }
    
    const finalPlayerId = getPlayerIdForFirebase();

    if (mode === 'create') {
      const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      const player: Player = { 
        id: finalPlayerId, 
        name: playerName, 
        score: 0, 
        isOnline: true, 
        isHost: true,
        referralRewardsThisSession: 0,
        isAnonymous: !isAuthenticated,
      };
      
      const roomConfig: RoomConfig = {
        roundTimeoutSeconds: roundTimeoutSeconds,
        totalRounds: totalRounds,
        maxWordLength: maxWordLength,
      };
      
      const roomData: RoomCreationData = {
        id: newRoomId,
        hostId: finalPlayerId,
        players: { [finalPlayerId]: player },
        gameState: 'waiting',
        createdAt: serverTimestamp() as unknown as number,
        drawingData: [],
        config: roomConfig,
        currentRoundNumber: 0, 
        usedWords: [],
        revealedPattern: [],
        selectableWords: [],
        wordSelectionEndsAt: null,
        aiSketchDataUri: null,
      };

      try {
        await set(ref(database, `rooms/${newRoomId}`), roomData);
        toast({ title: "Room Created!", description: `Room ${newRoomId} created successfully. You are the host.` });
        localStorage.setItem('patternPartyCurrentRoomId', newRoomId); // Store current room
        router.push(`/room/${newRoomId}`);
      } catch (error) {
        console.error("Error creating room:", error);
        toast({ title: "Error", description: "Could not create room. Please try again.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }

    } else { // mode === 'join'
      const roomRef = ref(database, `rooms/${roomId}`);
      try {
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
          const room: Room = snapshot.val();
          
          const playerUpdates: Partial<Player> = {
            isOnline: true,
            name: playerName,
            isAnonymous: !isAuthenticated,
          };

          if (referralCode.trim() && isAuthenticated) { // Only allow referral codes if joining user is authenticated
            // Basic validation: check if referralCode is not the player's own ID
            if (referralCode.trim() !== finalPlayerId) {
                playerUpdates.referredByPlayerId = referralCode.trim(); // This should be a UID
                toast({ title: "Referral Applied", description: "Referral code has been noted.", variant: "default" });
            } else {
                toast({ title: "Invalid Referral", description: "You cannot refer yourself.", variant: "destructive" });
            }
          } else if (referralCode.trim() && !isAuthenticated) {
            toast({ title: "Login Required for Referral", description: "Please login/signup to use a referral code.", variant: "default" });
          }


          if (room.players && room.players[finalPlayerId]) { 
             await update(child(roomRef, `players/${finalPlayerId}`), playerUpdates);
          } else { 
            if (room.players && Object.keys(room.players).length >= 10) { 
                toast({ title: "Room Full", description: "This room has reached its maximum player limit.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const newPlayer: Player = { 
                id: finalPlayerId, 
                name: playerName, 
                score: 0, 
                isOnline: true, 
                isHost: false,
                referralRewardsThisSession: 0,
                ...playerUpdates 
            };
            await set(child(roomRef, `players/${finalPlayerId}`), newPlayer);
          }
          toast({ title: "Joined Room!", description: `Successfully joined room ${roomId}.` });
          localStorage.setItem('patternPartyCurrentRoomId', roomId); // Store current room
          router.push(`/room/${roomId}`);
        } else {
          toast({ title: "Room Not Found", description: `Room ${roomId} does not exist.`, variant: "destructive" });
        }
      } catch (error) {
        console.error("Error joining room:", error);
        toast({ title: "Error", description: "Could not join room. Please try again.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleSimulatedLogin = () => {
    // Simulate login
    const dummyName = "User" + Math.floor(Math.random() * 1000);
    const dummyUid = `uid_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('drawlyAuthStatus', 'loggedIn');
    localStorage.setItem('drawlyUserDisplayName', dummyName);
    localStorage.setItem('drawlyUserUid', dummyUid);
    setIsAuthenticated(true);
    setAuthPlayerId(dummyUid);
    setPlayerName(dummyName);
    setAuthDisplayName(dummyName);
    toast({ title: "Logged In!", description: `Welcome, ${dummyName}!`});
  };


  return (
    <Card className="w-full max-w-md shadow-xl animate-in fade-in-50 duration-500">
      <CardHeader>
        <CardTitle className="text-3xl">{mode === 'create' ? 'Create a New Room' : 'Join an Existing Room'}</CardTitle>
        <CardDescription>
          {mode === 'create'
            ? "Enter your name and configure your game session."
            : `Enter your name and the Room ID to join the fun.${initialRoomId ? ` You're joining room: ${initialRoomId}` : ''}`}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {!isAuthenticated && (
             <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
                <p className="text-sm text-blue-700 mb-2">Want to use referrals or save your progress? Login first!</p>
                <Button type="button" variant="outline" size="sm" onClick={handleSimulatedLogin}>
                   <LogIn className="mr-2 h-4 w-4"/> Login / Sign Up
                </Button>
             </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="playerName" className="text-lg">Your Name</Label>
            <Input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your display name"
              required
              className="text-base py-6"
              disabled={isLoading || (isAuthenticated && !!authDisplayName)}
            />
            {isAuthenticated && <p className="text-xs text-muted-foreground">Logged in as {authDisplayName}.</p>}
          </div>
          {mode === 'join' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="roomId" className="text-lg">Room ID</Label>
                <Input
                  id="roomId"
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character Room ID"
                  required
                  disabled={!!initialRoomId || isLoading}
                  className="text-base py-6"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-lg flex items-center">
                  <UserPlus size={18} className="mr-2 text-muted-foreground"/> Referral Code (Optional)
                </Label>
                <Input
                  id="referralCode"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referrer's User ID"
                  className="text-base py-3"
                  maxLength={20} // UIDs can be longer
                  disabled={isLoading || !isAuthenticated}
                />
                 <p className="text-xs text-muted-foreground">
                   {isAuthenticated ? "Ask your friend for their User ID (from their homepage)." : "Log in to use a referral code."}
                 </p>
              </div>
            </>
          )}
          {mode === 'create' && (
            <>
              <h3 className="text-xl font-semibold pt-2 border-t mt-4">Room Configuration</h3>
              <div className="space-y-2">
                <Label htmlFor="roundTimeout" className="flex items-center"><Timer size={16} className="mr-2 text-muted-foreground"/> Round Timeout (seconds)</Label>
                <Input 
                  id="roundTimeout" 
                  type="number" 
                  value={Number.isNaN(roundTimeoutSeconds) ? '' : roundTimeoutSeconds} 
                  onChange={e => setRoundTimeoutSeconds(parseInt(e.target.value))} 
                  min="30" 
                  className="text-base py-3"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Time limit for each player to draw (min 30s).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalRounds" className="flex items-center"><ListChecks size={16} className="mr-2 text-muted-foreground"/> Total Rounds</Label>
                <Input 
                  id="totalRounds" 
                  type="number" 
                  value={Number.isNaN(totalRounds) ? '' : totalRounds} 
                  onChange={e => setTotalRounds(parseInt(e.target.value))} 
                  min="1" 
                  className="text-base py-3"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Number of rounds before the game ends (min 1).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWordLength" className="flex items-center"><TextCursorInput size={16} className="mr-2 text-muted-foreground"/> Max Word Length</Label>
                <Input 
                  id="maxWordLength" 
                  type="number" 
                  value={Number.isNaN(maxWordLength) ? '' : maxWordLength} 
                  onChange={e => setMaxWordLength(parseInt(e.target.value))} 
                  min="3" 
                  className="text-base py-3"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Maximum character length for words to be drawn (min 3 chars).</p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Joining...'}
              </>
            ) : (
              mode === 'create' ? 'Create Room &amp; Start Playing' : 'Join Room &amp; Play'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
