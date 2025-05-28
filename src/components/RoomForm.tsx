"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ref, set, get, child, serverTimestamp } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, RoomCreationData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
    localStorage.setItem('patternPartyPlayerName', playerName);
    const playerId = getPlayerId();

    if (mode === 'create') {
      const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
      const player: Player = { id: playerId, name: playerName, isDrawing: false, score: 0, isOnline: true, isHost: true };
      const roomData: RoomCreationData = {
        id: newRoomId,
        hostId: playerId,
        players: { [playerId]: player },
        gameState: 'waiting',
        createdAt: serverTimestamp() as unknown as number, // Firebase will convert this
        drawingData: [],
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
          if (room.players[playerId]) { // Player is rejoining
             await set(child(roomRef, `players/${playerId}/isOnline`), true);
          } else { // New player joining
            const player: Player = { id: playerId, name: playerName, isDrawing: false, score: 0, isOnline: true };
             // Limit number of players if needed in future
            // if (Object.keys(room.players).length >= 8) {
            //   toast({ title: "Room Full", description: "This room is full.", variant: "destructive" });
            //   setIsLoading(false);
            //   return;
            // }
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
            ? "Enter your name to start a new game session."
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
