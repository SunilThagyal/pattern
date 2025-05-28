
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ref, set, get, child, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, RoomCreationData, RoomConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Timer, ListChecks, TextCursorInput } from 'lucide-react';

interface RoomFormProps {
  mode: 'create' | 'join';
  initialRoomId?: string;
}

export default function RoomForm({ mode, initialRoomId }: RoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Room config states
  const [roundTimeoutSeconds, setRoundTimeoutSeconds] = useState(90);
  const [totalRounds, setTotalRounds] = useState(5);
  const [maxWordLength, setMaxWordLength] = useState(20);


  useEffect(() => {
    const storedPlayerName = localStorage.getItem('patternPartyPlayerName');
    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }
  }, []);

  const getPlayerId = (): string => {
    let playerId = localStorage.getItem('patternPartyPlayerId');
    if (!playerId) {
      playerId = Math.random().toString(36).substr(2, 9);
      localStorage.setItem('patternPartyPlayerId', playerId);
    }
    return playerId;
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

    if (mode === 'create' && (
        Number.isNaN(roundTimeoutSeconds) || roundTimeoutSeconds < 30 ||
        Number.isNaN(totalRounds) || totalRounds < 1 ||
        Number.isNaN(maxWordLength) || maxWordLength < 3
    )) {
        toast({ title: "Invalid Config", description: "Please check room settings. Values must be valid numbers (min timeout 30s, min 1 round, min word length 3).", variant: "destructive" });
        setIsLoading(false);
        return;
    }


    localStorage.setItem('patternPartyPlayerName', playerName);
    const playerId = getPlayerId();

    if (mode === 'create') {
      const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      const player: Player = { id: playerId, name: playerName, score: 0, isOnline: true, isHost: true };
      
      const roomConfig: RoomConfig = {
        roundTimeoutSeconds: roundTimeoutSeconds, // Will be valid numbers due to check above
        totalRounds: totalRounds,
        maxWordLength: maxWordLength,
      };
      
      const roomData: RoomCreationData = {
        id: newRoomId,
        hostId: playerId,
        players: { [playerId]: player },
        gameState: 'waiting',
        createdAt: serverTimestamp() as unknown as number,
        drawingData: [],
        config: roomConfig,
        currentRoundNumber: 0, // Will be set to 1 when game starts
      };

      try {
        await set(ref(database, `rooms/${newRoomId}`), roomData);
        toast({ title: "Room Created!", description: `Room ${newRoomId} created successfully. You are the host.` });
        router.push(`/room/${newRoomId}`);
      } catch (error) {
        console.error("Error creating room:", error);
        toast({ title: "Error", description: "Could not create room. Please try again.", variant: "destructive" });
        setIsLoading(false);
      }

    } else { // mode === 'join'
      const roomRef = ref(database, `rooms/${roomId}`);
      try {
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
          const room: Room = snapshot.val();
          if (room.players[playerId]) { 
             await set(child(roomRef, `players/${playerId}/isOnline`), true);
          } else { 
            if (Object.keys(room.players || {}).length >= 10) { // Max 10 players
                toast({ title: "Room Full", description: "This room has reached its maximum player limit.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const player: Player = { id: playerId, name: playerName, score: 0, isOnline: true, isHost: false };
            await set(child(roomRef, `players/${playerId}`), player);
          }
          toast({ title: "Joined Room!", description: `Successfully joined room ${roomId}.` });
          router.push(`/room/${roomId}`);
        } else {
          toast({ title: "Room Not Found", description: `Room ${roomId} does not exist.`, variant: "destructive" });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error joining room:", error);
        toast({ title: "Error", description: "Could not join room. Please try again.", variant: "destructive" });
        setIsLoading(false);
      }
    }
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
            />
          </div>
          {mode === 'join' && (
            <div className="space-y-2">
              <Label htmlFor="roomId" className="text-lg">Room ID</Label>
              <Input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter 6-character Room ID"
                required
                disabled={!!initialRoomId}
                className="text-base py-6"
                maxLength={6}
              />
            </div>
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
                  onChange={e => setRoundTimeoutSeconds(Math.max(30, parseInt(e.target.value)))} 
                  min="30" 
                  className="text-base py-3"
                />
                <p className="text-xs text-muted-foreground">Time limit for each player to draw (min 30s).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalRounds" className="flex items-center"><ListChecks size={16} className="mr-2 text-muted-foreground"/> Total Rounds</Label>
                <Input 
                  id="totalRounds" 
                  type="number" 
                  value={Number.isNaN(totalRounds) ? '' : totalRounds} 
                  onChange={e => setTotalRounds(Math.max(1, parseInt(e.target.value)))} 
                  min="1" 
                  className="text-base py-3"
                />
                <p className="text-xs text-muted-foreground">Number of rounds before the game ends (min 1).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWordLength" className="flex items-center"><TextCursorInput size={16} className="mr-2 text-muted-foreground"/> Max Word Length</Label>
                <Input 
                  id="maxWordLength" 
                  type="number" 
                  value={Number.isNaN(maxWordLength) ? '' : maxWordLength} 
                  onChange={e => setMaxWordLength(Math.max(3, parseInt(e.target.value)))} 
                  min="3" 
                  className="text-base py-3"
                />
                <p className="text-xs text-muted-foreground">Maximum character length for words to be drawn (min 3).</p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isLoading ? (mode === 'create' ? 'Creating...' : 'Joining...') : (mode === 'create' ? 'Create Room & Start Playing' : 'Join Room & Play')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
