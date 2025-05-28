
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, update, serverTimestamp, onDisconnect, goOffline, goOnline, set, child, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, DrawingPoint, Guess } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Copy, LogOut, Send, Palette, Eraser, Users, MessageSquare, Clock, Loader2, Share2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

// Placeholder components - to be implemented properly
const DrawingCanvas = ({ drawingData, onDraw, currentDrawerId, playerId, isDrawingEnabled, clearCanvas }: { drawingData: DrawingPoint[], onDraw: (point: DrawingPoint) => void, currentDrawerId?: string | null, playerId: string, isDrawingEnabled: boolean, clearCanvas: () => void }) => {
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);

  // Basic color palette
  const colors = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF"];


  return (
    <Card className="w-full h-[400px] md:h-[500px] lg:h-[600px] flex flex-col shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          {isDrawingEnabled && colors.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: c, borderColor: color === c ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} aria-label={`Select color ${c}`}/>
          ))}
           {isDrawingEnabled && <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 p-0 border-none" />}
        </div>
        {isDrawingEnabled && (
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-muted-foreground" />
            <Input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-24" />
            <Button variant="ghost" size="icon" onClick={clearCanvas} title="Clear Canvas (Drawer only)">
              <Eraser className="w-5 h-5" />
            </Button>
          </div>
        )}
        {!isDrawingEnabled && <p className="text-sm text-muted-foreground">Waiting for drawer...</p>}
      </CardHeader>
      <CardContent className="flex-grow p-0 bg-slate-50 relative">
        {/* Actual canvas rendering logic would go here. This is a placeholder. */}
        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gray-100 rounded-b-md">
          <p data-ai-hint="drawing board canvas">Canvas Area (Drawing: {drawingData.length} points)</p>
          {!isDrawingEnabled && currentDrawerId !== playerId && <p>You are guessing!</p>}
          {isDrawingEnabled && currentDrawerId === playerId && <p>Your turn to draw!</p>}
        </div>
         {/* Basic drawing data visualization for debugging, to be replaced by actual canvas */}
        <svg className="absolute inset-0 pointer-events-none">
          {drawingData.filter(p => p.type === 'draw' || p.type === 'start').map((point, index) => {
            const prevPoint = drawingData[index-1];
            if (point.type === 'draw' && prevPoint && prevPoint.type !== 'end' && prevPoint.type !== 'clear') {
              return <line key={index} x1={prevPoint.x * 100 + "%"} y1={prevPoint.y * 100 + "%"} x2={point.x * 100 + "%"} y2={point.y * 100 + "%"} stroke={point.color} strokeWidth={point.lineWidth} strokeLinecap="round" />
            }
            return null;
          })}
        </svg>
      </CardContent>
    </Card>
  );
};

const PlayerList = ({ players, currentPlayerId, hostId }: { players: Player[], currentPlayerId?: string | null, hostId?: string }) => (
  <Card className="shadow-md">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Users /> Players ({players.length})</CardTitle>
    </CardHeader>
    <CardContent>
      <ScrollArea className="h-40">
        <ul className="space-y-2">
          {players.map(player => (
            <li key={player.id} className={`flex items-center justify-between p-2 rounded-md ${player.id === currentPlayerId ? 'bg-primary/10' : ''}`}>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${player.name.substring(0,1)}`} data-ai-hint="profile avatar" />
                  <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className={`font-medium ${!player.isOnline ? 'text-muted-foreground line-through' : ''}`}>{player.name} {player.id === hostId ? '(Host)' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {player.id === currentPlayerId && <Palette size={18} className="text-primary animate-pulse" title="Drawing" />}
                <span className="text-sm font-bold text-accent">{player.score} pts</span>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </CardContent>
  </Card>
);

const GuessInput = ({ onGuessSubmit, disabled }: { onGuessSubmit: (guess: string) => void, disabled: boolean }) => {
  const [guess, setGuess] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guess.trim()) {
      onGuessSubmit(guess.trim());
      setGuess('');
    }
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <Input type="text" value={guess} onChange={e => setGuess(e.target.value)} placeholder="Type your guess..." disabled={disabled} className="flex-grow" />
      <Button type="submit" disabled={disabled}><Send size={18} className="mr-1" /> Guess</Button>
    </form>
  );
};

const ChatArea = ({ guesses }: { guesses: Guess[] }) => (
 <Card className="shadow-md flex-grow">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><MessageSquare /> Guesses & Chat</CardTitle>
    </CardHeader>
    <CardContent className="h-64">
      <ScrollArea className="h-full pr-3">
        <ul className="space-y-2 text-sm">
          {guesses.map((g, i) => (
            <li key={i} className={`p-2 rounded-md ${g.isCorrect ? 'bg-green-100 border border-green-300' : 'bg-muted/50'}`}>
              <span className="font-semibold text-primary">{g.playerName}: </span>
              <span>{g.text}</span>
              {g.isCorrect && <span className="ml-2 font-bold text-green-600">(Correct!)</span>}
            </li>
          ))}
           {guesses.length === 0 && <p className="text-muted-foreground text-center italic py-4">No guesses yet. Be the first!</p>}
        </ul>
      </ScrollArea>
    </CardContent>
  </Card>
);

const TimerDisplay = ({ roundEndsAt, gameState }: { roundEndsAt?: number | null, gameState: Room['gameState'] }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!roundEndsAt || gameState !== 'drawing') {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((roundEndsAt - now) / 1000));
      setTimeLeft(remaining);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [roundEndsAt, gameState]);

  if (gameState !== 'drawing' || timeLeft === null) return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Waiting...</div>;

  return <div className="text-2xl font-bold text-primary"><Clock className="inline mr-2 animate-pulse" /> {timeLeft}s</div>;
};


export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pId = localStorage.getItem('patternPartyPlayerId');
    const pName = localStorage.getItem('patternPartyPlayerName');
    if (!pId || !pName) {
      toast({ title: "Error", description: "Player identity not found. Please rejoin.", variant: "destructive" });
      router.push(`/join/${roomId}`);
      return;
    }
    setPlayerId(pId);
    setPlayerName(pName);
  }, [roomId, router, toast]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomRef = ref(database, `rooms/${roomId}`);
    const playerStatusRef = ref(database, `rooms/${roomId}/players/${playerId}/isOnline`);
    const playerConnectionsRef = ref(database, '.info/connected');

    const onRoomValueChange = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoom(snapshot.val() as Room);
        setError(null);
      } else {
        setError("Room not found or has been deleted.");
        setRoom(null);
        toast({ title: "Room Error", description: "This room no longer exists.", variant: "destructive" });
        router.push('/');
      }
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to load room data.");
      setIsLoading(false);
      toast({ title: "Connection Error", description: "Could not connect to the room.", variant: "destructive" });
    });
    
    const onConnectedChange = onValue(playerConnectionsRef, (snap) => {
      if (snap.val() === true) {
        set(playerStatusRef, true);
        onDisconnect(playerStatusRef).set(false).catch(err => console.error("onDisconnect error", err));
      }
    });

    // Initial online status set
    get(child(roomRef, `players/${playerId}`)).then(playerSnap => {
      if (playerSnap.exists()) {
        update(child(roomRef, `players/${playerId}`), { isOnline: true });
      } else {
        // Player not in room, likely direct entry without proper join. Redirect.
        if (!isLoading) { // Avoid redirect during initial load if room exists
            toast({ title: "Access Denied", description: "You are not part of this room. Please join properly.", variant: "destructive" });
            router.push(`/join/${roomId}`);
        }
      }
    });


    return () => {
      off(roomRef, 'value', onRoomValueChange);
      off(playerConnectionsRef, 'value', onConnectedChange);
      // onDisconnect(playerStatusRef).cancel(); // Not strictly necessary if setting to false is okay
      // Setting player offline immediately on unmount might be too aggressive if it's just a refresh.
      // Firebase onDisconnect handles closures better.
      // Consider leaving player in room but marked offline for a short period.
    };
  }, [roomId, playerId, router, toast, isLoading]);


  const handleLeaveRoom = async () => {
    if (playerId && room) {
      const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
      try {
        await update(playerRef, { isOnline: false }); // Mark as offline instead of removing, host can clean up later.
        // If player is host and last one, consider deleting room or passing host
        toast({ title: "Left Room", description: "You have left the room." });
        router.push('/');
      } catch (err) {
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
      }
    } else {
      router.push('/');
    }
  };
  
  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Link Copied!", description: "Room link copied to clipboard." }))
      .catch(() => toast({ title: "Error", description: "Could not copy link.", variant: "destructive" }));
  };

  const handleDraw = (point: DrawingPoint) => {
    if (!room || !playerId || room.currentDrawerId !== playerId) return;
    const newDrawingData = [...(room.drawingData || []), point];
    set(ref(database, `rooms/${roomId}/drawingData`), newDrawingData);
  };
  
  const handleClearCanvas = () => {
    if (!room || !playerId || room.currentDrawerId !== playerId) return;
     const clearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'', lineWidth:0 }; // Dummy values
    set(ref(database, `rooms/${roomId}/drawingData`), [clearPoint]); // Send a clear command
  };


  const handleGuessSubmit = (guessText: string) => {
    if (!room || !playerId || !playerName || room.currentDrawerId === playerId) return;
    const newGuess: Guess = {
      playerId,
      playerName,
      text: guessText,
      isCorrect: false, // Server/host would verify this ideally
      timestamp: serverTimestamp() as any
    };
    const newGuesses = [...(room.guesses || []), newGuess];
    set(ref(database, `rooms/${roomId}/guesses`), newGuesses);
  };
  
  // TODO: Game logic for starting round, assigning drawer, checking guesses, ending round
  // This would typically be managed by the host or a cloud function.
  // For now, this is a client-side placeholder.
  const handleStartRound = () => {
    if (!room || !playerId || room.hostId !== playerId || room.gameState !== 'waiting') return;
    if (Object.values(room.players).filter(p => p.isOnline).length < 2) {
      toast({title: "Not enough players", description: "Need at least 2 online players to start.", variant: "destructive"});
      return;
    }
    // Simplistic: first online player who is not host becomes drawer
    const onlinePlayers = Object.values(room.players).filter(p => p.isOnline);
    const newDrawer = onlinePlayers.find(p => p.id !== room.hostId) || onlinePlayers[0];

    if (newDrawer) {
      const updates: Partial<Room> = {
        gameState: 'drawing',
        currentDrawerId: newDrawer.id,
        currentPattern: "Pattern Party", // Placeholder pattern
        roundEndsAt: Date.now() + 60000, // 60 seconds round
        drawingData: [], // Clear canvas
        guesses: [], // Clear guesses
      };
      update(ref(database, `rooms/${roomId}`), updates);
    }
  };


  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-xl">Loading Room...</span></div>;
  if (error) return <div className="text-center text-red-500 p-8 bg-red-50 border border-red-200 rounded-md"><AlertCircle className="mx-auto h-12 w-12 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Error Loading Room</h2><p>{error}</p><Button onClick={() => router.push('/')} className="mt-4">Go Home</Button></div>;
  if (!room || !playerId) return <div className="text-center p-8">Room data is not available. <Link href="/" className="text-primary hover:underline">Go Home</Link></div>;

  const playersArray = Object.values(room.players || {});
  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const canGuess = room.gameState === 'drawing' && !isCurrentPlayerDrawing;
  const isHost = room.hostId === playerId;

  return (
    <div className="container mx-auto p-2 md:p-4 h-full flex flex-col gap-4 animate-in fade-in duration-300">
      <Card className="shadow-md">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-2xl md:text-3xl">Room: {room.id}</CardTitle>
            <CardDescription>Playing Pattern Party! Current state: <span className="font-semibold text-primary">{room.gameState}</span></CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TimerDisplay roundEndsAt={room.roundEndsAt} gameState={room.gameState} />
            <Button variant="outline" size="sm" onClick={handleCopyLink}><Share2 size={16} className="mr-1.5" /> Share Link</Button>
            <Button variant="destructive" size="sm" onClick={handleLeaveRoom}><LogOut size={16} className="mr-1.5" /> Leave</Button>
          </div>
        </CardHeader>
      </Card>

      {room.gameState === 'waiting' && isHost && (
         <Button onClick={handleStartRound} disabled={Object.values(room.players).filter(p=>p.isOnline).length < 2}>
           Start Round (Need {Math.max(0, 2-Object.values(room.players).filter(p=>p.isOnline).length)} more player{Object.values(room.players).filter(p=>p.isOnline).length === 1 ? '' : 's'})
         </Button>
      )}
      {room.gameState === 'drawing' && room.currentPattern && (
        <Card className="p-3 text-center bg-accent/10 border-accent">
          <p className="text-sm text-accent-foreground">
            {isCurrentPlayerDrawing ? "Draw this pattern: " : "Guess the pattern!"}
            {isCurrentPlayerDrawing && <strong className="text-xl ml-2">{room.currentPattern}</strong>}
          </p>
        </Card>
      )}


      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4">
           <DrawingCanvas
            drawingData={room.drawingData || []}
            onDraw={handleDraw}
            currentDrawerId={room.currentDrawerId}
            playerId={playerId}
            isDrawingEnabled={isCurrentPlayerDrawing && room.gameState === 'drawing'}
            clearCanvas={handleClearCanvas}
          />
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          <PlayerList players={playersArray} currentPlayerId={room.currentDrawerId} hostId={room.hostId}/>
          <ChatArea guesses={room.guesses || []} />
          <GuessInput onGuessSubmit={handleGuessSubmit} disabled={!canGuess} />
        </div>
      </div>
    </div>
  );
}

