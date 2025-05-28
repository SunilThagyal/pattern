
"use client";

import { useEffect, useState, useRef, type MouseEvent, type TouchEvent } from 'react';
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

const DrawingCanvas = ({ 
  drawingData, 
  onDraw, 
  currentDrawerId, 
  playerId, 
  isDrawingEnabled, 
  clearCanvas 
}: { 
  drawingData: DrawingPoint[], 
  onDraw: (point: DrawingPoint) => void, 
  currentDrawerId?: string | null, 
  playerId: string, 
  isDrawingEnabled: boolean, 
  clearCanvas: () => void 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);

  const colors = ["#000000", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#d946ef", "#06b6d4", "#ffffff", "#a855f7", "#f97316"];


  // Initialize canvas and context, and handle resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        contextRef.current = ctx;
        redrawFullCanvas(); // Redraw after setup/resize
      }
    };
    
    const redrawFullCanvas = () => {
        const currentCtx = contextRef.current;
        const currentCanvas = canvasRef.current;
        if (!currentCtx || !currentCanvas) return;

        currentCtx.clearRect(0, 0, currentCanvas.offsetWidth, currentCanvas.offsetHeight);

        let pathActive = false;
        let lastPointForPath: DrawingPoint | null = null;

        drawingData.forEach(point => {
            if (!currentCtx || !currentCanvas) return;
            const xPx = point.x * currentCanvas.offsetWidth;
            const yPx = point.y * currentCanvas.offsetHeight;

            if (point.type === 'clear') {
                if (pathActive) currentCtx.stroke(); // Finalize any open path
                currentCtx.clearRect(0, 0, currentCanvas.offsetWidth, currentCanvas.offsetHeight);
                pathActive = false;
                lastPointForPath = null;
                return;
            }

            if (point.type === 'start') {
                if (pathActive) currentCtx.stroke(); // Finalize previous path
                currentCtx.beginPath();
                currentCtx.strokeStyle = point.color;
                currentCtx.lineWidth = point.lineWidth;
                currentCtx.moveTo(xPx, yPx);
                pathActive = true;
            } else if (point.type === 'draw' && pathActive) {
                 // If style changed, end old stroke and start new
                if (currentCtx.strokeStyle.toLowerCase() !== point.color.toLowerCase() || currentCtx.lineWidth !== point.lineWidth) {
                    currentCtx.stroke(); // End previous segment
                    currentCtx.beginPath(); // Start new segment
                    if(lastPointForPath) { // Move to the last actual drawn point
                         currentCtx.moveTo(lastPointForPath.x * currentCanvas.offsetWidth, lastPointForPath.y * currentCanvas.offsetHeight);
                    } else {
                         currentCtx.moveTo(xPx, yPx); // Fallback if no last point
                    }
                    currentCtx.strokeStyle = point.color;
                    currentCtx.lineWidth = point.lineWidth;
                }
                currentCtx.lineTo(xPx, yPx);
                currentCtx.stroke(); // Stroke each segment for 'draw' points
                currentCtx.beginPath(); // Prepare for next segment, starting from current point
                currentCtx.moveTo(xPx, yPx);
            } else if (point.type === 'end' && pathActive) {
                currentCtx.stroke(); // Finalize current path
                pathActive = false;
            }
            lastPointForPath = point;
        });
         if (pathActive) currentCtx.stroke(); // Stroke any unclosed path
    };


    setupCanvas();
    redrawFullCanvas(); // Initial draw based on existing data

    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [drawingData]); // Redraw when drawingData changes


  const getCoordinates = (event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event.nativeEvent) {
      clientX = event.nativeEvent.touches[0].clientX;
      clientY = event.nativeEvent.touches[0].clientY;
    } else {
      clientX = event.nativeEvent.clientX;
      clientY = event.nativeEvent.clientY;
    }
    
    return {
      x: (clientX - rect.left) / canvas.offsetWidth, // Normalize to 0-1
      y: (clientY - rect.top) / canvas.offsetHeight, // Normalize to 0-1
    };
  };

  const startPaint = (event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingEnabled || (event.nativeEvent instanceof MouseEvent && event.nativeEvent.button !== 0)) return;
    event.preventDefault();
    const coords = getCoordinates(event);
    if (!coords) return;

    setIsPainting(true);
    const newPoint: DrawingPoint = { ...coords, color, lineWidth, type: 'start' };
    onDraw(newPoint);
    
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight);
    }
  };

  const paint = (event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isPainting || !isDrawingEnabled) return;
    event.preventDefault();
    const coords = getCoordinates(event);
    if (!coords) return;

    const newPoint: DrawingPoint = { ...coords, color, lineWidth, type: 'draw' };
    onDraw(newPoint);

    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      // Check if style changed for local drawing responsiveness
      if (ctx.strokeStyle.toLowerCase() !== color.toLowerCase() || ctx.lineWidth !== lineWidth) {
          ctx.stroke(); // End current segment
          ctx.beginPath(); // Start new
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          // Get last drawn point coords from newPoint (which is current) or previous from local path if maintained
          // For simplicity, if style changes, the next point starts a new segment from its own position
          ctx.moveTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight); 
      }
      ctx.lineTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight);
      ctx.stroke();
      ctx.beginPath(); // Prepare for next stroke segment
      ctx.moveTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight);
    }
  };

  const exitPaint = (event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isPainting || !isDrawingEnabled) return;
    // For touch, touchend might not have coordinates, so we use the last known point
    // For mouse, mouseup has coords.
    let coords = getCoordinates(event);

    if (isPainting) { // Check isPainting before setting it to false
        setIsPainting(false); // Set before onDraw
        const lastDrawnPoint = drawingData.length > 0 ? drawingData[drawingData.length-1] : null;
        // Use last point's coords for 'end' if current event doesn't provide them or makes sense
        const endCoords = (coords && (coords.x !== undefined)) ? coords : 
                          (lastDrawnPoint ? {x: lastDrawnPoint.x, y: lastDrawnPoint.y} : {x:0,y:0});

        const endPoint: DrawingPoint = { ...endCoords, color, lineWidth, type: 'end' };
        onDraw(endPoint);
        
        const ctx = contextRef.current;
        if (ctx) {
            ctx.stroke(); // Ensure the last segment is drawn
        }
    }
  };
  
  const localClearAndPropagate = () => {
    if (!isDrawingEnabled) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if(canvas && ctx) {
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    }
    clearCanvas(); // Propagates to other users via onDraw({type:'clear'})
  };

  return (
    <Card className="w-full h-[400px] md:h-[500px] lg:h-[600px] flex flex-col shadow-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-1 flex-wrap">
          {isDrawingEnabled && colors.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full border-2 shadow-sm" style={{ backgroundColor: c, borderColor: color.toLowerCase() === c.toLowerCase() ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} aria-label={`Select color ${c}`}/>
          ))}
           {isDrawingEnabled && <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 p-0.5 border-none rounded-md" />}
        </div>
        {isDrawingEnabled && (
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-muted-foreground" />
            <Input type="range" min="1" max="30" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-20 md:w-24 h-6" />
            <span className="text-xs text-muted-foreground w-4 text-right">{lineWidth}</span>
            <Button variant="ghost" size="icon" onClick={localClearAndPropagate} title="Clear Canvas">
              <Eraser className="w-5 h-5" />
            </Button>
          </div>
        )}
        {!isDrawingEnabled && currentDrawerId && <p className="text-sm text-muted-foreground">It's {room?.players[currentDrawerId]?.name || 'someone'}'s turn to draw.</p>}
        {!currentDrawerId && <p className="text-sm text-muted-foreground">Waiting for drawer...</p>}
      </CardHeader>
      <CardContent className="flex-grow p-0 bg-slate-50 relative">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full bg-white touch-none" // touch-none for better drawing experience on touch devices
          onMouseDown={startPaint}
          onMouseMove={paint}
          onMouseUp={exitPaint}
          onMouseLeave={exitPaint}
          onTouchStart={startPaint}
          onTouchMove={paint}
          onTouchEnd={exitPaint}
        />
        {!isDrawingEnabled && currentDrawerId !== playerId && <p className="absolute top-2 left-2 text-xs bg-primary/20 text-primary-foreground p-1 rounded">You are guessing!</p>}
        {isDrawingEnabled && currentDrawerId === playerId && <p className="absolute top-2 left-2 text-xs bg-accent/20 text-accent-foreground p-1 rounded">Your turn to draw!</p>}
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

// Predefined list of patterns/words
const designPatternsAndWords = [
  "Singleton", "Factory Method", "Abstract Factory", "Builder", "Prototype", "Adapter",
  "Bridge", "Composite", "Decorator", "Facade", "Flyweight", "Proxy", "Chain of Responsibility",
  "Command", "Interpreter", "Iterator", "Mediator", "Memento", "Observer", "State", "Strategy",
  "Template Method", "Visitor", "Pixel", "Smiley Face", "House", "Tree", "Car", "Star", "Heart",
  "Sun", "Moon", "Cloud", "Flower", "Book", "Key", "Lock", "Cup", "Banana", "Apple", "Dog", "Cat"
];


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
        const roomData = snapshot.val() as Room;
        // Ensure drawingData is always an array
        if (!roomData.drawingData) {
            roomData.drawingData = [];
        }
        // Ensure guesses is always an array
        if (!roomData.guesses) {
            roomData.guesses = [];
        }
        setRoom(roomData);
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
      if (snap.val() === true && playerId) { // check playerId again
        const playerRefForOnline = ref(database, `rooms/${roomId}/players/${playerId}`);
        get(playerRefForOnline).then(playerSnap => {
            if (playerSnap.exists()) {
                 set(playerStatusRef, true);
                 onDisconnect(playerStatusRef).set(false).catch(err => console.error("onDisconnect error for status", err));
            }
        });
      }
    });

    get(child(roomRef, `players/${playerId}`)).then(playerSnap => {
      if (playerSnap.exists()) {
        update(child(roomRef, `players/${playerId}`), { isOnline: true });
      } else {
        if (!isLoading) { 
            toast({ title: "Access Denied", description: "You are not part of this room. Please join properly.", variant: "destructive" });
            router.push(`/join/${roomId}`);
        }
      }
    });


    return () => {
      off(roomRef, 'value', onRoomValueChange);
      off(playerConnectionsRef, 'value', onConnectedChange);
      // Consider if onDisconnect needs manual cancellation or if set(false) on normal leave is enough
      // const currentOnDisconnect = onDisconnect(playerStatusRef);
      // if (currentOnDisconnect) currentOnDisconnect.cancel();
    };
  }, [roomId, playerId, router, toast, isLoading]);


  const handleLeaveRoom = async () => {
    if (playerId && room) {
      const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
      try {
        await update(playerRef, { isOnline: false }); 
        toast({ title: "Left Room", description: "You have left the room." });
        router.push('/');
      } catch (err) {
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
         router.push('/'); // still try to navigate away
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
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    
    // Instead of replacing, append the new point. Firebase RTDB handles array-like structures well with push or by index.
    // For simplicity and direct control, we manage drawingData as a full array update.
    // More optimized: use push for new points, or set specific indices if points had unique IDs.
    const newDrawingData = [...(room.drawingData || []), point];
    set(ref(database, `rooms/${roomId}/drawingData`), newDrawingData);
  };
  
  const handleClearCanvas = () => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    const clearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'', lineWidth:0 }; // Dummy values for clear
    // Send a clear command by setting drawingData to an array with just the clear event.
    // The DrawingCanvas useEffect will interpret this.
    set(ref(database, `rooms/${roomId}/drawingData`), [clearPoint]); 
  };


  const handleGuessSubmit = (guessText: string) => {
    if (!room || !playerId || !playerName || room.currentDrawerId === playerId || room.gameState !== 'drawing') return;
    // Basic profanity filter (very simple, extend as needed)
    const forbiddenWords = ["badword1", "badword2"]; // Add actual bad words
    if (forbiddenWords.some(word => guessText.toLowerCase().includes(word))) {
        toast({ title: "Inappropriate Guess", description: "Your guess contains inappropriate language.", variant: "destructive" });
        return;
    }

    const newGuess: Guess = {
      playerId,
      playerName,
      text: guessText,
      isCorrect: room.currentPattern ? guessText.toLowerCase() === room.currentPattern.toLowerCase() : false,
      timestamp: serverTimestamp() as any 
    };

    const guessesRef = ref(database, `rooms/${roomId}/guesses`);
    const newGuesses = [...(room.guesses || []), newGuess];
    set(guessesRef, newGuesses);

    if (newGuess.isCorrect) {
        toast({ title: "Correct!", description: `${playerName} guessed the word!`, className: "bg-green-500 text-white" });
        // Award points - this logic should ideally be server-side or host-managed for security
        const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
        const drawerRef = ref(database, `rooms/${roomId}/players/${room.currentDrawerId!}`);
        
        get(playerRef).then(snapshot => {
            if(snapshot.exists()){
                const currentScore = snapshot.val().score || 0;
                update(playerRef, { score: currentScore + 10 }); // Guesser gets 10 points
            }
        });
        get(drawerRef).then(snapshot => {
             if(snapshot.exists()){
                const currentScore = snapshot.val().score || 0;
                update(drawerRef, { score: currentScore + 5 }); // Drawer gets 5 points for good drawing
            }
        });
        // Potentially end round or start next one after a correct guess
        // For now, let timer run out or host start new round.
    }
  };
  
  const handleStartRound = () => {
    if (!room || !playerId || room.hostId !== playerId || room.gameState === 'drawing') return;
    
    const onlinePlayers = Object.values(room.players || {}).filter(p => p.isOnline);
    if (onlinePlayers.length < 2 && room.gameState === 'waiting') { // Allow start if just 1 player for testing, but ideally 2
      toast({title: "Not enough players", description: "Need at least 2 online players to start a proper game.", variant: "default"});
      // return; // Uncomment for strict 2 player rule
    }

    let newDrawer = onlinePlayers[0]; // Default to first online player if no other logic
    if (onlinePlayers.length > 1) {
        // Simplistic: next player in list who isn't current drawer (or host if no current drawer)
        const currentIndex = room.currentDrawerId ? onlinePlayers.findIndex(p => p.id === room.currentDrawerId) : -1;
        newDrawer = onlinePlayers[(currentIndex + 1) % onlinePlayers.length];
    } else if (onlinePlayers.length === 1) {
        newDrawer = onlinePlayers[0]; // The only online player draws
    }


    if (newDrawer) {
      const getRandomPattern = () => {
        return designPatternsAndWords[Math.floor(Math.random() * designPatternsAndWords.length)];
      };
      const initialClearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'#000', lineWidth:1 };

      const updates: Partial<Room> = {
        gameState: 'drawing',
        currentDrawerId: newDrawer.id,
        currentPattern: getRandomPattern(),
        roundEndsAt: Date.now() + 90000, // 90 seconds round
        drawingData: [initialClearPoint], // Start with a clear canvas command
        guesses: [], 
      };
      update(ref(database, `rooms/${roomId}`), updates)
        .then(() => toast({title: "Round Started!", description: `${newDrawer.name} is drawing.`}))
        .catch(err => toast({title:"Error", description: "Could not start round.", variant: "destructive"}));
    } else {
        toast({title: "No Drawer", description: "Could not find an eligible player to draw.", variant: "destructive"});
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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="text-xl md:text-3xl">Room: <span className="font-mono text-accent">{room.id}</span></CardTitle>
            <CardDescription>Playing Pattern Party! Status: <span className="font-semibold text-primary">{room.gameState}</span></CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <TimerDisplay roundEndsAt={room.roundEndsAt} gameState={room.gameState} />
            <Button variant="outline" size="sm" onClick={handleCopyLink}><Share2 size={16} className="mr-1.5" /> Share</Button>
            <Button variant="destructive" size="sm" onClick={handleLeaveRoom}><LogOut size={16} className="mr-1.5" /> Leave</Button>
          </div>
        </CardHeader>
      </Card>

      {(room.gameState === 'waiting' || room.gameState === 'round_end' || room.gameState === 'game_over') && isHost && (
         <Button onClick={handleStartRound} disabled={Object.values(room.players).filter(p=>p.isOnline).length < 1 /* Changed to 1 for easier testing, ideally 2 */}>
           Start Next Round 
           (Need {Math.max(0, (room.gameState === 'waiting' ? 1:1) - Object.values(room.players).filter(p=>p.isOnline).length)} more player{Object.values(room.players).filter(p=>p.isOnline).length === 1 ? '' : 's'})
         </Button>
      )}
      {room.gameState === 'drawing' && room.currentPattern && (
        <Card className="p-3 text-center bg-accent/10 border-accent shadow">
          <p className="text-sm text-accent-foreground">
            {isCurrentPlayerDrawing ? "Your word to draw is: " : "Guess the word!"}
            {isCurrentPlayerDrawing && <strong className="text-xl ml-2 font-mono tracking-wider">{room.currentPattern}</strong>}
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

