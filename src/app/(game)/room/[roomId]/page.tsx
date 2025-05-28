
"use client";

import { useEffect, useState, useRef, type MouseEvent, type TouchEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, update, serverTimestamp, set, child, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, DrawingPoint, Guess, RoomConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Copy, LogOut, Send, Palette, Eraser, Users, MessageSquare, Clock, Loader2, Share2, CheckCircle, Trophy, Play, SkipForward, RotateCcw } from 'lucide-react';
import Link from 'next/link';

const DrawingCanvas = ({ 
  drawingData, 
  onDraw, 
  currentDrawerId, 
  playerId, 
  isDrawingEnabled, 
  clearCanvas,
  currentDrawerName,
  gameState
}: { 
  drawingData: DrawingPoint[], 
  onDraw: (point: DrawingPoint) => void, 
  currentDrawerId?: string | null, 
  playerId: string, 
  isDrawingEnabled: boolean, 
  clearCanvas: () => void,
  currentDrawerName?: string | null,
  gameState: Room['gameState'] | undefined
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);

  const colors = ["#000000", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#d946ef", "#06b6d4", "#ffffff", "#a855f7", "#f97316"];

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
        redrawFullCanvas(); 
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
                if (pathActive) currentCtx.stroke(); 
                currentCtx.clearRect(0, 0, currentCanvas.offsetWidth, currentCanvas.offsetHeight);
                pathActive = false;
                lastPointForPath = null;
                return;
            }

            if (point.type === 'start') {
                if (pathActive) currentCtx.stroke(); 
                currentCtx.beginPath();
                currentCtx.strokeStyle = point.color;
                currentCtx.lineWidth = point.lineWidth;
                currentCtx.moveTo(xPx, yPx);
                pathActive = true;
            } else if (point.type === 'draw' && pathActive) {
                if (currentCtx.strokeStyle.toLowerCase() !== point.color.toLowerCase() || currentCtx.lineWidth !== point.lineWidth) {
                    currentCtx.stroke(); 
                    currentCtx.beginPath(); 
                    if(lastPointForPath) { 
                         currentCtx.moveTo(lastPointForPath.x * currentCanvas.offsetWidth, lastPointForPath.y * currentCanvas.offsetHeight);
                    } else {
                         currentCtx.moveTo(xPx, yPx); 
                    }
                    currentCtx.strokeStyle = point.color;
                    currentCtx.lineWidth = point.lineWidth;
                }
                currentCtx.lineTo(xPx, yPx);
                currentCtx.stroke(); 
                currentCtx.beginPath(); 
                currentCtx.moveTo(xPx, yPx);
            } else if (point.type === 'end' && pathActive) {
                currentCtx.stroke(); 
                pathActive = false;
            }
            lastPointForPath = point;
        });
         if (pathActive) currentCtx.stroke(); 
    };

    setupCanvas();
    redrawFullCanvas(); 

    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [drawingData]); 


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
      x: (clientX - rect.left) / canvas.offsetWidth, 
      y: (clientY - rect.top) / canvas.offsetHeight, 
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
      if (ctx.strokeStyle.toLowerCase() !== color.toLowerCase() || ctx.lineWidth !== lineWidth) {
          ctx.stroke(); 
          ctx.beginPath(); 
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.moveTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight); 
      }
      ctx.lineTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight);
      ctx.stroke();
      ctx.beginPath(); 
      ctx.moveTo(coords.x * canvas.offsetWidth, coords.y * canvas.offsetHeight);
    }
  };

  const exitPaint = (event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isPainting || !isDrawingEnabled) return;
    let coords = getCoordinates(event);

    if (isPainting) { 
        setIsPainting(false); 
        const lastDrawnPoint = drawingData.length > 0 ? drawingData[drawingData.length-1] : null;
        const endCoords = (coords && (coords.x !== undefined)) ? coords : 
                          (lastDrawnPoint ? {x: lastDrawnPoint.x, y: lastDrawnPoint.y} : {x:0,y:0});

        const endPoint: DrawingPoint = { ...endCoords, color, lineWidth, type: 'end' };
        onDraw(endPoint);
        
        const ctx = contextRef.current;
        if (ctx) {
            ctx.stroke(); 
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
    clearCanvas(); 
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
        {!isDrawingEnabled && currentDrawerId && <p className="text-sm text-muted-foreground">It's {currentDrawerName || 'someone'}'s turn to draw.</p>}
        {!currentDrawerId && <p className="text-sm text-muted-foreground">Waiting for drawer...</p>}
      </CardHeader>
      <CardContent className="flex-grow p-0 bg-slate-50 relative">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full bg-white touch-none"
          onMouseDown={startPaint}
          onMouseMove={paint}
          onMouseUp={exitPaint}
          onMouseLeave={exitPaint}
          onTouchStart={startPaint}
          onTouchMove={paint}
          onTouchEnd={exitPaint}
        />
        {!isDrawingEnabled && currentDrawerId !== playerId && gameState === 'drawing' && <p className="absolute top-2 left-2 text-xs bg-primary/20 text-primary-foreground p-1 rounded">You are guessing!</p>}
        {isDrawingEnabled && currentDrawerId === playerId && gameState === 'drawing' && <p className="absolute top-2 left-2 text-xs bg-accent/20 text-accent-foreground p-1 rounded">Your turn to draw!</p>}
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
                <span className="text-sm font-bold text-accent">{player.score || 0} pts</span>
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

const ChatArea = ({ guesses, room }: { guesses: Guess[], room: Room | null }) => (
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
              {g.isCorrect && <span className="ml-1 font-bold text-green-600">(Correct! {g.isFirstCorrect ? '+10pts' : '+5pts'})</span>}
            </li>
          ))}
           {guesses.length === 0 && <p className="text-muted-foreground text-center italic py-4">
             {room?.gameState === 'drawing' ? "No guesses yet. Be the first!" : "Guesses will appear here."}
            </p>}
        </ul>
      </ScrollArea>
    </CardContent>
  </Card>
);

const TimerDisplay = ({ roundEndsAt, gameState, roundTimeoutSeconds }: { roundEndsAt?: number | null, gameState: Room['gameState'], roundTimeoutSeconds: number }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!roundEndsAt || gameState !== 'drawing') {
      setTimeLeft(gameState === 'drawing' && roundTimeoutSeconds ? roundTimeoutSeconds : null); // Show full time initially if round just started
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((roundEndsAt - now) / 1000));
      setTimeLeft(remaining);
    };

    calculateTimeLeft(); // Initial calculation
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [roundEndsAt, gameState, roundTimeoutSeconds]);

  if (gameState !== 'drawing' || timeLeft === null) {
      if (gameState === 'word_selection') return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Word selection...</div>;
      if (gameState === 'round_end') return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Round Over!</div>;
      if (gameState === 'game_over') return <div className="text-lg font-semibold"><Trophy className="inline mr-2" />Game Over!</div>;
      return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Waiting...</div>;
  }

  return <div className="text-2xl font-bold text-primary"><Clock className="inline mr-2 animate-pulse" /> {timeLeft}s</div>;
};

// Predefined list of patterns/words - will be filtered by maxWordLength
const designPatternsAndWords = [
  "Singleton", "Factory Method", "Abstract Factory", "Builder", "Prototype", "Adapter",
  "Bridge", "Composite", "Decorator", "Facade", "Flyweight", "Proxy", "Chain of Responsibility",
  "Command", "Interpreter", "Iterator", "Mediator", "Memento", "Observer", "State", "Strategy",
  "Template Method", "Visitor", "Pixel", "Smiley Face", "House", "Tree", "Car", "Star", "Heart",
  "Sun", "Moon", "Cloud", "Flower", "Book", "Key", "Lock", "Cup", "Banana", "Apple", "Dog", "Cat",
  "Computer", "Phone", "Glasses", "Chair", "Table", "Pizza", "Burger", "Ice Cream", "Boat", "Plane"
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

  // Firebase Listeners
  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomRef = ref(database, `rooms/${roomId}`);
    const playerStatusRef = ref(database, `rooms/${roomId}/players/${playerId}/isOnline`);
    const playerConnectionsRef = ref(database, '.info/connected');

    const onRoomValueChange = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val() as Room;
        if (!roomData.drawingData) roomData.drawingData = [];
        if (!roomData.guesses) roomData.guesses = [];
        if (!roomData.players) roomData.players = {};
        if (!roomData.correctGuessersThisRound) roomData.correctGuessersThisRound = [];
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
      if (snap.val() === true && playerId) {
        const playerRefForOnline = ref(database, `rooms/${roomId}/players/${playerId}`);
        get(playerRefForOnline).then(playerSnap => {
            if (playerSnap.exists()) {
                 set(playerStatusRef, true);
                 // @ts-ignore TODO: Fix onDisconnect type
                 onDisconnect(playerStatusRef).set(false).catch(err => console.error("onDisconnect error for status", err));
            }
        });
      }
    });

    get(child(roomRef, `players/${playerId}`)).then(playerSnap => {
      if (playerSnap.exists()) {
        update(child(roomRef, `players/${playerId}`), { isOnline: true });
      } else {
        if (!isLoading && !error) { 
            toast({ title: "Access Denied", description: "You are not part of this room. Please join properly.", variant: "destructive" });
            router.push(`/join/${roomId}`);
        }
      }
    });

    return () => {
      off(roomRef, 'value', onRoomValueChange);
      off(playerConnectionsRef, 'value', onConnectedChange);
    };
  }, [roomId, playerId, router, toast, isLoading, error]);

  // Timer effect for ending round
  useEffect(() => {
    if (room?.gameState === 'drawing' && room.roundEndsAt && playerId === room.hostId) {
      const now = Date.now();
      const timeLeftMs = room.roundEndsAt - now;
      if (timeLeftMs <= 0) {
        endCurrentRound();
      } else {
        const timer = setTimeout(() => {
          endCurrentRound();
        }, timeLeftMs);
        return () => clearTimeout(timer);
      }
    }
  }, [room?.gameState, room?.roundEndsAt, room?.hostId, playerId]);


  const handleLeaveRoom = async () => {
    if (playerId && room) {
      const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
      try {
        await update(playerRef, { isOnline: false }); 
        toast({ title: "Left Room", description: "You have left the room." });
        router.push('/');
      } catch (err) {
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
         router.push('/'); 
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
    const newDrawingData = [...(room.drawingData || []), point];
    set(ref(database, `rooms/${roomId}/drawingData`), newDrawingData);
  };
  
  const handleClearCanvas = () => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    const clearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'', lineWidth:0 };
    set(ref(database, `rooms/${roomId}/drawingData`), [clearPoint]); 
  };

  const prepareNewGameSession = useCallback(async () => {
    if (!room || !playerId || room.hostId !== playerId) return;

    const updates: Partial<Room> = {
        gameState: 'waiting', // Will transition to word_selection
        currentRoundNumber: 0, // Will be incremented by selectWordForNewRound
        currentDrawerId: null,
        currentPattern: null,
        roundEndsAt: null,
        guesses: [],
        drawingData: [],
        correctGuessersThisRound: [],
        selectableWords: [],
    };
    
    // Reset scores for all players
    const playerUpdates: any = {};
    Object.keys(room.players).forEach(pid => {
        playerUpdates[`/players/${pid}/score`] = 0;
    });

    try {
        await update(ref(database, `rooms/${roomId}`), { ...updates, ...playerUpdates });
        toast({ title: "Game Reset", description: "Scores have been reset. Starting new game."});
        // selectWordForNewRound will be called next by the host clicking "Start Game"
        // which actually calls selectWordForNewRound implicitly through manageGameProgression
    } catch (err) {
        toast({ title: "Error", description: "Could not reset game.", variant: "destructive" });
    }
  }, [room, playerId, roomId, toast]);


  const selectWordForNewRound = useCallback(async () => {
    if (!room || !playerId || room.hostId !== playerId) return;

    const onlinePlayers = Object.values(room.players || {}).filter(p => p.isOnline && p.id);
    if (onlinePlayers.length < 1 && room.gameState === 'waiting') { // Min 1 player to start/test
         toast({title: "Not enough players", description: "Need at least 1 online player to start.", variant: "default"});
         return;
    }
    if (onlinePlayers.length === 0) {
        toast({title: "No online players", description: "Cannot start a round without online players.", variant: "destructive"});
        return;
    }

    const newRoundNumber = (room.currentRoundNumber || 0) + 1;

    if (newRoundNumber > room.config.totalRounds) {
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
        toast({ title: "Game Over!", description: "All rounds completed. Check the final scores!" });
        return;
    }
    
    let newDrawer = onlinePlayers[0]; // Default
    if (onlinePlayers.length > 0) {
        const lastDrawerId = room.currentDrawerId;
        let currentDrawerIndex = -1;
        if (lastDrawerId) {
            currentDrawerIndex = onlinePlayers.findIndex(p => p.id === lastDrawerId);
        }
        newDrawer = onlinePlayers[(currentDrawerIndex + 1) % onlinePlayers.length];
    }
     if (!newDrawer || !newDrawer.id) {
        toast({title: "No Drawer", description: "Could not find an eligible player to draw.", variant: "destructive"});
        return;
    }

    const filteredWords = designPatternsAndWords.filter(word => word.length <= room.config.maxWordLength);
    const selectableWords = [];
    if (filteredWords.length > 0) {
        for (let i = 0; i < 3; i++) { // Offer 3 words
            if (filteredWords.length === 0) break; // No more words to pick
            const randomIndex = Math.floor(Math.random() * filteredWords.length);
            selectableWords.push(filteredWords.splice(randomIndex, 1)[0]);
        }
    }
    if (selectableWords.length === 0) selectableWords.push("Pattern"); // Fallback

    const updates: Partial<Room> = {
        gameState: 'word_selection',
        currentDrawerId: newDrawer.id,
        currentPattern: null, // Word not chosen yet
        roundEndsAt: null,
        currentRoundNumber: newRoundNumber,
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }], // Clear canvas
        guesses: [],
        correctGuessersThisRound: [],
        selectableWords: selectableWords,
    };
    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        toast({title: `Round ${newRoundNumber} Starting!`, description: `${newDrawer.name} is choosing a word.`});
    } catch (err) {
        toast({title:"Error", description: "Could not start new round.", variant: "destructive"});
    }

  }, [room, playerId, roomId, toast]);

  const confirmWordAndStartDrawing = useCallback(async (word: string) => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'word_selection') return;

    const updates: Partial<Room> = {
        gameState: 'drawing',
        currentPattern: word,
        roundEndsAt: Date.now() + room.config.roundTimeoutSeconds * 1000,
        selectableWords: [], // Clear selectable words
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }],
        guesses: [],
        correctGuessersThisRound: [],
    };
    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        toast({title: "Drawing Started!", description: `The word has been chosen. Time to draw!`});
    } catch(err) {
        toast({title: "Error", description: "Could not start drawing phase.", variant: "destructive"});
    }
  }, [room, playerId, roomId, toast]);


  const endCurrentRound = useCallback(async () => {
    if (!room || playerId !== room.hostId || room.gameState !== 'drawing') return; // Only host ends round via timer/auto

    try {
        await update(ref(database, `rooms/${roomId}`), { gameState: 'round_end' });
        toast({ title: "Round Over!", description: `The word was: ${room.currentPattern}`});
    } catch (err) {
        toast({ title: "Error", description: "Failed to end round.", variant: "destructive"});
    }
  }, [room, playerId, roomId, toast]);


  const handleGuessSubmit = async (guessText: string) => {
    if (!room || !playerId || !playerName || room.currentDrawerId === playerId || room.gameState !== 'drawing' || !room.currentPattern) return;
    
    // Check if player already guessed correctly this round
    if ((room.correctGuessersThisRound || []).includes(playerId)) {
        toast({title: "Already Guessed", description: "You've already guessed correctly this round!", variant: "default"});
        return;
    }

    const isCorrect = guessText.toLowerCase() === room.currentPattern.toLowerCase();
    let isFirstCorrectGlobal = false;
    if (isCorrect && (room.correctGuessersThisRound || []).length === 0) {
        isFirstCorrectGlobal = true;
    }

    const newGuess: Guess = {
      playerId,
      playerName,
      text: guessText,
      isCorrect,
      isFirstCorrect: isCorrect && isFirstCorrectGlobal,
      timestamp: serverTimestamp() as any 
    };

    const newGuesses = [...(room.guesses || []), newGuess];
    const updates: Partial<Room> = { guesses: newGuesses };
    let playerScored = false;

    if (isCorrect) {
        const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
        const drawerRef = ref(database, `rooms/${roomId}/players/${room.currentDrawerId!}`);
        let pointsAwarded = 0;

        if (isFirstCorrectGlobal) {
            pointsAwarded = 10;
            toast({ title: "First Correct Guess!", description: `${playerName} guessed the word! +${pointsAwarded}pts`, className: "bg-green-500 text-white" });
        } else {
            pointsAwarded = 5;
            toast({ title: "Correct!", description: `${playerName} also guessed the word! +${pointsAwarded}pts`, className: "bg-green-400 text-white" });
        }
        
        const currentPlayerData = room.players[playerId];
        await update(playerRef, { score: (currentPlayerData?.score || 0) + pointsAwarded });
        playerScored = true;

        // Award drawer points
        const drawerData = room.players[room.currentDrawerId!];
        await update(drawerRef, { score: (drawerData?.score || 0) + 3 }); // Drawer gets 3 points per correct guesser

        // Add to correct guessers list
        updates.correctGuessersThisRound = [...(room.correctGuessersThisRound || []), playerId];

        // Check if all guessable players have guessed correctly
        const onlinePlayers = Object.values(room.players).filter(p => p.isOnline && p.id !== room.currentDrawerId);
        const allGuessed = onlinePlayers.every(p => (updates.correctGuessersThisRound || []).includes(p.id));

        if ((isFirstCorrectGlobal || allGuessed) && room.hostId === playerId) { // If first correct guess OR all players guessed, host ends round
             // Host who guessed correctly can trigger round end
        } else if (isFirstCorrectGlobal && room.hostId !== playerId) {
            // Non-host made first correct guess, host will handle round end via listener or timer
        }
         if (isFirstCorrectGlobal && playerId === room.hostId) { // Host made first correct guess, end round
            updates.gameState = 'round_end';
        }

    }
    
    await update(ref(database, `rooms/${roomId}`), updates);
     // If host makes first correct guess, or if it's the host's turn to trigger round end
    if (isFirstCorrectGlobal && playerId === room.hostId && room.gameState !== 'round_end') {
        endCurrentRound(); 
    }
  };
  
  const manageGameProgression = () => {
    if (!room || !playerId || room.hostId !== playerId) return;

    if (room.gameState === 'waiting' || room.gameState === 'game_over') {
        prepareNewGameSession().then(() => {
            // After resetting, directly call to select word for the first round
            // This requires prepareNewGameSession to set gameState to something that selectWordForNewRound can act upon
            // Or, call selectWordForNewRound directly if prepareNewGameSession doesn't change state to 'word_selection' yet
            // For simplicity, let's assume host clicks "Start Game" again after "Play Again"
            // No, this is for the button click. So if game is over, this will restart it.
            // If waiting, this will start it.
            // The critical part is the state transition in prepareNewGameSession -> selectWordForNewRound
             const updatedRoomRef = ref(database, `rooms/${roomId}`);
             get(updatedRoomRef).then(snapshot => {
                 if(snapshot.exists()) {
                     const updatedRoomData = snapshot.val() as Room;
                     if (updatedRoomData.currentRoundNumber === 0) { // Indicates a fresh game or reset game
                         selectWordForNewRound();
                     }
                 }
             });
        });
    } else if (room.gameState === 'round_end') {
        selectWordForNewRound();
    }
  };


  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-xl">Loading Room...</span></div>;
  if (error) return <div className="text-center text-red-500 p-8 bg-red-50 border border-red-200 rounded-md"><AlertCircle className="mx-auto h-12 w-12 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Error Loading Room</h2><p>{error}</p><Button onClick={() => router.push('/')} className="mt-4">Go Home</Button></div>;
  if (!room || !playerId || !room.config) return <div className="text-center p-8">Room data is not available or incomplete. <Link href="/" className="text-primary hover:underline">Go Home</Link></div>;

  const playersArray = Object.values(room.players || {});
  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const canGuess = room.gameState === 'drawing' && !isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId);
  const isHost = room.hostId === playerId;
  const currentDrawerName = room.currentDrawerId && room.players[room.currentDrawerId] ? room.players[room.currentDrawerId].name : null;

  const getStartButtonTextAndIcon = () => {
    if (room.gameState === 'waiting') return { text: 'Start Game', icon: <Play size={18} /> };
    if (room.gameState === 'round_end') return { text: 'Start Next Round', icon: <SkipForward size={18} /> };
    if (room.gameState === 'game_over') return { text: 'Play Again', icon: <RotateCcw size={18} /> };
    return { text: 'Starting...', icon: <Loader2 size={18} className="animate-spin" /> };
  };
  const { text: startButtonText, icon: startButtonIcon } = getStartButtonTextAndIcon();


  return (
    <div className="container mx-auto p-2 md:p-4 h-full flex flex-col gap-4 animate-in fade-in duration-300">
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="text-xl md:text-3xl">Room: <span className="font-mono text-accent">{room.id}</span></CardTitle>
            <CardDescription>
                Round {room.currentRoundNumber || 0}/{room.config.totalRounds} | Status: <span className="font-semibold text-primary">{room.gameState}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <TimerDisplay roundEndsAt={room.roundEndsAt} gameState={room.gameState} roundTimeoutSeconds={room.config.roundTimeoutSeconds} />
            <Button variant="outline" size="sm" onClick={handleCopyLink}><Share2 size={16} className="mr-1.5" /> Share</Button>
            <Button variant="destructive" size="sm" onClick={handleLeaveRoom}><LogOut size={16} className="mr-1.5" /> Leave</Button>
          </div>
        </CardHeader>
        {isHost && (room.gameState === 'waiting' || room.gameState === 'round_end' || room.gameState === 'game_over') && (
          <CardFooter className="pt-4 border-t">
             <Button onClick={manageGameProgression} className="w-full md:w-auto" disabled={room.gameState === 'waiting' && Object.values(room.players).filter(p=>p.isOnline).length < 1}>
               {startButtonIcon} {startButtonText}
             </Button>
          </CardFooter>
        )}
      </Card>

      {room.gameState === 'word_selection' && isCurrentPlayerDrawing && (
        <Card className="p-4 shadow-lg bg-primary/5">
          <CardTitle className="text-xl mb-3 text-primary">Choose a word to draw:</CardTitle>
          <div className="flex flex-wrap gap-3">
            {(room.selectableWords || []).map(word => (
              <Button key={word} variant="secondary" className="text-lg" onClick={() => confirmWordAndStartDrawing(word)}>
                {word}
              </Button>
            ))}
          </div>
          <CardDescription className="mt-3 text-sm">Pick one word. Others will try to guess it!</CardDescription>
        </Card>
      )}
      
      {room.gameState === 'word_selection' && !isCurrentPlayerDrawing && (
          <Card className="p-4 text-center bg-muted/80 shadow">
              <p className="text-lg font-semibold">
                  <Loader2 className="inline mr-2 h-5 w-5 animate-spin" />
                  {currentDrawerName || "The drawer"} is choosing a word... Get ready to guess!
              </p>
          </Card>
      )}


      {room.gameState === 'drawing' && room.currentPattern && (
        <Card className="p-3 text-center bg-accent/10 border-accent shadow">
          <p className="text-sm text-accent-foreground">
            {isCurrentPlayerDrawing ? "Your word to draw is: " : (room.correctGuessersThisRound || []).includes(playerId) ? "You guessed it! The word is: " : "Guess the word!"}
            {(isCurrentPlayerDrawing || (room.correctGuessersThisRound || []).includes(playerId)) && <strong className="text-xl ml-2 font-mono tracking-wider">{room.currentPattern}</strong>}
          </p>
        </Card>
      )}
      
      {room.gameState === 'round_end' && (
        <Card className="p-4 shadow-lg bg-green-50 border-green-200">
            <CardTitle className="text-xl mb-2 text-green-700">Round Over!</CardTitle>
            <p className="text-md mb-1">The word was: <strong className="font-mono text-green-800">{room.currentPattern}</strong></p>
            <p className="text-md">Drawer: {currentDrawerName || 'N/A'}</p>
            <h4 className="font-semibold mt-3 mb-1">Correct Guesses:</h4>
            {room.guesses.filter(g => g.isCorrect).length > 0 ? (
                <ul className="list-disc list-inside text-sm">
                    {room.guesses.filter(g => g.isCorrect).map(g => (
                        <li key={g.playerId}>{g.playerName} {g.isFirstCorrect ? '(First!)' : ''}</li>
                    ))}
                </ul>
            ) : <p className="text-sm italic">No one guessed it right this time!</p>}
        </Card>
      )}

      {room.gameState === 'game_over' && (
        <Card className="p-6 shadow-xl bg-primary/10 border-primary">
            <CardTitle className="text-2xl mb-4 text-center text-primary flex items-center justify-center gap-2"><Trophy /> Game Over! <Trophy /></CardTitle>
            <CardDescription className="text-center mb-4 text-lg">Final Scores:</CardDescription>
            <ul className="space-y-2">
                {playersArray.sort((a,b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
                    <li key={player.id} className={`flex justify-between items-center p-3 rounded-md text-lg ${index === 0 ? 'bg-accent/20 font-bold' : 'bg-background'}`}>
                        <span>{index + 1}. {player.name}</span>
                        <span className="font-semibold">{player.score || 0} pts</span>
                    </li>
                ))}
            </ul>
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
            currentDrawerName={currentDrawerName}
            gameState={room.gameState}
          />
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          <PlayerList players={playersArray} currentPlayerId={room.currentDrawerId} hostId={room.hostId}/>
          <ChatArea guesses={room.guesses || []} room={room} />
          <GuessInput onGuessSubmit={handleGuessSubmit} disabled={!canGuess} />
        </div>
      </div>
    </div>
  );
}

