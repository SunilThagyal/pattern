
"use client";

import { useEffect, useState, useRef, type MouseEvent, type TouchEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, update, serverTimestamp, set, child, get, onDisconnect, runTransaction } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, DrawingPoint, Guess, RoomConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Copy, LogOut, Send, Palette, Eraser, Users, MessageSquare, Clock, Loader2, Share2, CheckCircle, Trophy, Play, SkipForward, RotateCcw, HelpCircle, Lightbulb, Edit3, Info, ChevronUp, ChevronDown, Brush } from 'lucide-react';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { suggestWords, type SuggestWordsInput, type SuggestWordsOutput } from '@/ai/flows/suggest-words-flow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


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
  const [isToolbarMinimized, setIsToolbarMinimized] = useState(true);
  const isMobile = useIsMobile();

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
    <Card className="w-full h-full flex flex-col shadow-lg overflow-hidden">
      <CardHeader className="p-2 border-b bg-muted/30">
        <div className="flex flex-row items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isDrawingEnabled
              ? (isMobile ? (isToolbarMinimized ? "Tools (Tap to expand)" : "Tools (Tap to collapse)") : "Drawing Tools")
              : (currentDrawerId ? `It's ${currentDrawerName || 'someone'}'s turn to draw.` : (gameState !== 'word_selection' ? "Waiting for drawer..." : ""))}
          </div>

          {isDrawingEnabled && isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsToolbarMinimized(!isToolbarMinimized)} aria-label={isToolbarMinimized ? "Expand toolbar" : "Collapse toolbar"}>
                  {isToolbarMinimized ? <ChevronDown className="h-5 w-5"/> : <ChevronUp className="h-5 w-5"/>}
              </Button>
          )}
        </div>

        <div className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isDrawingEnabled ?
              (isMobile ? (isToolbarMinimized ? "max-h-0 opacity-0" : "max-h-28 opacity-100 pt-2")
                         : "max-h-28 opacity-100 pt-2")
              : "max-h-0 opacity-0"
        )}>
          {isDrawingEnabled && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                    {colors.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className="w-6 h-6 rounded-full border-2 shadow-sm"
                            style={{ backgroundColor: c, borderColor: color.toLowerCase() === c.toLowerCase() ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                            aria-label={`Select color ${c}`}
                        />
                    ))}
                    <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 p-0.5 border-none rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-muted-foreground" />
                    <Input type="range" min="1" max="30" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-20 md:w-24 h-6" />
                    <span className="text-xs text-muted-foreground w-4 text-right">{lineWidth}</span>
                    <Button variant="ghost" size="icon" onClick={localClearAndPropagate} title="Clear Canvas">
                        <Eraser className="w-5 h-5" />
                    </Button>
                </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 bg-slate-50 relative min-h-0">
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

const PlayerList = ({
    players,
    currentPlayerId,
    hostId,
    isMinimized,
    setIsMinimized
}: {
    players: Player[],
    currentPlayerId?: string | null,
    hostId?: string,
    isMinimized: boolean,
    setIsMinimized: (isMinimized: boolean) => void
}) => (
  <Card className="shadow-lg flex flex-col">
    <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Users /> Players ({players.length})</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand player list" : "Collapse player list"}>
            {isMinimized ? <ChevronDown className="h-5 w-5"/> : <ChevronUp className="h-5 w-5"/>}
        </Button>
    </CardHeader>
    <div className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isMinimized ? "max-h-0 opacity-0" : "max-h-72 opacity-100"
    )}>
        <CardContent className="h-full pt-3 sm:pt-4"> 
        <ScrollArea className="h-full pr-3">
            <ul className="space-y-1.5 sm:space-y-2">
            {players.map(player => (
                <li key={player.id} className={`flex items-center justify-between p-1.5 sm:p-2 rounded-md ${player.id === currentPlayerId ? 'bg-primary/10' : ''}`}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                    <AvatarImage src={`https://placehold.co/40x40.png?text=${player.name.substring(0,1)}`} data-ai-hint="profile avatar"/>
                    <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className={`text-xs sm:text-sm font-medium ${!player.isOnline ? 'text-muted-foreground line-through' : ''}`}>{player.name} {player.id === hostId ? <span className="text-xs">(Host)</span> : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {player.id === currentPlayerId && <Palette className="text-primary animate-pulse h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" title="Drawing" />}
                    <span className="text-xs sm:text-sm font-bold text-accent">{player.score || 0} pts</span>
                </div>
                </li>
            ))}
            </ul>
        </ScrollArea>
        </CardContent>
    </div>
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
  const letterCount = guess.trim().length;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-grow">
        <Input
          type="text"
          value={guess}
          onChange={e => setGuess(e.target.value)}
          placeholder="Type your guess..."
          disabled={disabled}
          className="pr-12 sm:pr-16" // Adjusted padding for letter count
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {letterCount}
        </span>
      </div>
      <Button type="submit" disabled={disabled} size="icon" aria-label="Send guess">
        <Send size={18} />
      </Button>
    </form>
  );
};

const ChatArea = ({
    guesses,
    room,
    onGuessSubmit,
    disabled
}: {
    guesses: Guess[],
    room: Room | null,
    onGuessSubmit: (guess: string) => void,
    disabled: boolean
}) => (
 <Card className="shadow-lg flex-grow flex flex-col min-h-0">
    <CardHeader className="p-3 sm:p-4 border-b">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><MessageSquare /> Guesses & Chat</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow min-h-0 max-h-96 pt-3 sm:pt-4 pb-0 pr-0">
      <ScrollArea className="h-full pr-3">
        <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
          {guesses.map((g, i) => (
            <li key={i} className={`p-1.5 sm:p-2 rounded-md ${g.isCorrect ? 'bg-green-500/20 border border-green-500/30 animate-pulse-bg-once' : 'bg-muted/50'}`}>
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
    <CardFooter className="p-2 border-t">
        <GuessInput onGuessSubmit={onGuessSubmit} disabled={disabled} />
    </CardFooter>
  </Card>
);

const TimerDisplay = ({ targetTime, gameState, defaultSeconds, label }: { targetTime?: number | null, gameState: Room['gameState'], defaultSeconds: number, label: string }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft(defaultSeconds);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((targetTime - now) / 1000));
      setTimeLeft(remaining);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [targetTime, defaultSeconds]);

  if (timeLeft === null && (gameState === 'drawing' || gameState === 'word_selection')) {
      return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Loading...</div>;
  }
  if (timeLeft === null) {
      return <div className="text-lg font-semibold"><Clock className="inline mr-2" />Waiting...</div>;
  }

  const displayLabel = gameState === 'word_selection' ? "Word Choice" : label;

  return <div className="text-2xl font-bold text-primary"><Clock className="inline mr-2 animate-pulse" /> {timeLeft}s <span className="text-sm font-normal text-muted-foreground">({displayLabel})</span></div>;
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
  
  const [customWordInput, setCustomWordInput] = useState('');
  const [isSubmittingWord, setIsSubmittingWord] = useState(false);
  
  const [roundEndCountdown, setRoundEndCountdown] = useState<number | null>(null);
  const [isRoomInfoMinimized, setIsRoomInfoMinimized] = useState(true);
  const [isPlayerListMinimized, setIsPlayerListMinimized] = useState(true);


  const hintTimerRef = useRef<NodeJS.Timeout[]>([]);

  const prepareNewGameSession = useCallback(async () => {
    if (!room || !playerId || room.hostId !== playerId) return;

    const updates: Partial<Room> = {
        gameState: 'waiting',
        currentRoundNumber: 0,
        currentDrawerId: null,
        currentPattern: null,
        roundEndsAt: null,
        wordSelectionEndsAt: null,
        guesses: [],
        drawingData: [],
        correctGuessersThisRound: [],
        selectableWords: [],
        revealedPattern: [],
        usedWords: [],
    };

    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        // Reset scores for all players
        for (const pid of Object.keys(room.players)) {
           await update(ref(database, `rooms/${roomId}/players/${pid}`), { score: 0 });
        }
        toast({ title: "Game Reset", description: "Scores have been reset. Ready for a new game."});
    } catch (err) {
        console.error("Error resetting game:", err);
        toast({ title: "Error", description: "Could not reset game.", variant: "destructive" });
    }
  }, [room, playerId, roomId, toast]);

  const selectWordForNewRound = useCallback(async () => {
    // This function should only be callable by the host.
    // It's triggered automatically by effects or by initial game start.
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) {
        toast({ title: "Error", description: "Room data not found for starting new round.", variant: "destructive" });
        return;
    }
    const currentRoomData: Room = currentRoomSnapshot.val();

    // Double check if current user is still the host before proceeding
    if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId ) {
        console.warn("selectWordForNewRound called by non-host or missing data. PlayerId:", playerId, "HostId:", currentRoomData?.hostId);
        return;
    }

    // Clear any existing hint timers from previous rounds
    hintTimerRef.current.forEach(clearTimeout);
    hintTimerRef.current = [];

    const onlinePlayers = Object.values(currentRoomData.players || {}).filter(p => p.isOnline && p.id);
    if (onlinePlayers.length < 1 && (currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over' || currentRoomData.gameState === 'round_end')) {
         toast({title: "Not enough players", description: "Need at least 1 online player to start/continue.", variant: "default"});
         // If not waiting or game over, transition to game_over
         if(currentRoomData.gameState !== 'waiting' && currentRoomData.gameState !== 'game_over'){
            await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
         }
         return;
    }


    const newRoundNumber = currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over' ? 1 : (currentRoomData.currentRoundNumber || 0) + 1;

    if (currentRoomData.config && currentRoomData.config.totalRounds > 0 && newRoundNumber > currentRoomData.config.totalRounds) {
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
        toast({ title: "Game Over!", description: "All rounds completed. Check the final scores!" });
        return;
    }

    // Determine next drawer
    let newDrawer = onlinePlayers[0]; // Default to first online player if no other logic
    if (onlinePlayers.length > 0) {
        const lastDrawerId = currentRoomData.currentDrawerId;
        let currentDrawerIndex = -1;
        if (lastDrawerId) {
            currentDrawerIndex = onlinePlayers.findIndex(p => p.id === lastDrawerId);
        }
        // Cycle to the next player
        newDrawer = onlinePlayers[(currentDrawerIndex + 1) % onlinePlayers.length];
    }


     if (!newDrawer || !newDrawer.id) {
        toast({title: "No Drawer", description: "Could not find an eligible player to draw. Game may end.", variant: "destructive"});
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
        return;
    }

    // Fetch words for selection using AI
    let wordsForSelection: string[] = ["Apple", "House", "Star"]; // Default words
    if (currentRoomData.config) { // Ensure config exists
        try {
            const suggestInput: SuggestWordsInput = {
                previouslyUsedWords: currentRoomData.usedWords || [],
                count: 3, // Always ask for 3
                maxWordLength: currentRoomData.config.maxWordLength,
            };
            const aiSuggestions = await suggestWords(suggestInput);

            // Validate AI suggestions
            if (aiSuggestions && Array.isArray(aiSuggestions) && aiSuggestions.length === 3 && aiSuggestions.every(w => typeof w === 'string' && w.trim().length > 0)) {
                wordsForSelection = aiSuggestions;
            } else {
                 // Log the unexpected AI output for debugging
                 console.warn("AI did not return 3 valid words, using defaults. Received:", aiSuggestions);
                 toast({ title: "AI Word Gen Issue", description: "Could not fetch 3 valid words from AI. Using default words.", variant: "default" });
                 // Fallback to a more robust default word generation if AI fails
                 wordsForSelection = ["Cat", "Sun", "Car"].filter(w => w.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).includes(w));
                 if (wordsForSelection.length < 3) { // Ensure we have 3 words
                    const defaults = ["Tree", "House", "Star", "Dog", "Moon", "Boat"];
                    for (const defWord of defaults) {
                        if (wordsForSelection.length >=3) break;
                        if (defWord.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).includes(defWord) && !wordsForSelection.includes(defWord)) {
                            wordsForSelection.push(defWord);
                        }
                    }
                 }
                 // If still not 3, duplicate last one or add a very generic one
                 while(wordsForSelection.length < 3 && wordsForSelection.length > 0) wordsForSelection.push(wordsForSelection[0]); 
                 while(wordsForSelection.length < 3) wordsForSelection.push("Ball"); // Ultimate fallback
            }

        } catch (aiError) {
            console.error("AI word suggestion error:", aiError);
            toast({ title: "AI Error", description: "Failed to get words from AI. Using default words.", variant: "destructive" });
            // Fallback if AI call itself fails
            wordsForSelection = ["Dog", "Moon", "Boat"].filter(w => w.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).includes(w));
             if (wordsForSelection.length < 3) {
                const defaults = ["Apple", "House", "Star", "Cat", "Sun", "Car"];
                for (const defWord of defaults) {
                    if (wordsForSelection.length >=3) break;
                     if (defWord.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).includes(defWord) && !wordsForSelection.includes(defWord)) {
                        wordsForSelection.push(defWord);
                    }
                }
             }
             while(wordsForSelection.length < 3 && wordsForSelection.length > 0) wordsForSelection.push(wordsForSelection[0]);
             while(wordsForSelection.length < 3) wordsForSelection.push("Key");
        }
    }


    const updates: Partial<Room> = {
        gameState: 'word_selection',
        currentDrawerId: newDrawer.id,
        currentPattern: null, // Word not chosen yet
        roundEndsAt: null, // Timer for drawing not started
        wordSelectionEndsAt: Date.now() + 15 * 1000, // 15 seconds for word selection
        currentRoundNumber: newRoundNumber,
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }], // Clear canvas for new round
        guesses: [], // Clear previous guesses
        correctGuessersThisRound: [], // Clear previous correct guessers
        selectableWords: wordsForSelection,
        revealedPattern: [], // Clear revealed pattern
    };
    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        toast({title: `Round ${newRoundNumber} Starting!`, description: `${newDrawer.name} is choosing a word.`});
    } catch (err) {
        console.error("Error starting new round selection:", err);
        toast({title:"Error", description: "Could not start new round.", variant: "destructive"});
    }
  }, [playerId, roomId, toast]);


  const confirmWordAndStartDrawing = useCallback(async (word: string) => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    // Only the current drawer can confirm a word, and only during word_selection phase
    if (!currentRoomData || !playerId || currentRoomData.currentDrawerId !== playerId || currentRoomData.gameState !== 'word_selection' || !currentRoomData.config) {
        return;
    }
    setIsSubmittingWord(true);

    const initialRevealedPattern = word.split('').map(char => char === ' ' ? ' ' : '_');
    const newUsedWords = Array.from(new Set([...(currentRoomData.usedWords || []), word]));


    const updates: Partial<Room> = {
        gameState: 'drawing',
        currentPattern: word,
        roundEndsAt: Date.now() + currentRoomData.config.roundTimeoutSeconds * 1000,
        selectableWords: [], // Clear selectable words
        wordSelectionEndsAt: null, // Clear word selection timer
        guesses: [], // Clear guesses for the new drawing phase
        correctGuessersThisRound: [], // Clear correct guessers for the new drawing phase
    };
    try {
        // Explicitly set revealedPattern and drawingData for the new drawing round
        await set(ref(database, `rooms/${roomId}/revealedPattern`), initialRevealedPattern);
        await set(ref(database, `rooms/${roomId}/drawingData`), [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }]); // Clear canvas
        
        // Update other room properties
        await update(ref(database, `rooms/${roomId}`), {
            ...updates,
            usedWords: newUsedWords // Persist used words
        });

        toast({title: "Drawing Started!", description: `The word has been chosen. Time to draw!`});
    } catch(err) {
        console.error("Error starting drawing phase:", err);
        toast({title: "Error", description: "Could not start drawing phase.", variant: "destructive"});
    } finally {
        setIsSubmittingWord(false);
        setCustomWordInput(''); // Clear custom word input after submission
    }
  }, [playerId, roomId, toast]);


  const endCurrentRound = useCallback(async (reason: string = "Round ended.") => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    // Only host should formally end the round, and only if it's in 'drawing' state
    if (currentRoomData.gameState !== 'drawing' || !playerId ) {
       // console.log("endCurrentRound called inappropriately. GameState:", currentRoomData.gameState, "PlayerId:", playerId);
       return;
    }

    // Clear any active hint timers for the round just ending
    hintTimerRef.current.forEach(clearTimeout);
    hintTimerRef.current = [];

    // Only the host transitions the game state to 'round_end'
    if (currentRoomData.hostId === playerId && currentRoomData.gameState === 'drawing') {
        try {
            await update(ref(database, `rooms/${roomId}`), {
                gameState: 'round_end',
                wordSelectionEndsAt: null, // Ensure selection timer is cleared
                roundEndsAt: null // Ensure drawing timer is cleared
            });
            toast({ title: "Round Over!", description: `${reason} The word was: ${currentRoomData.currentPattern || "N/A"}`});
        } catch (err) {
            console.error("Error ending round:", err);
            toast({ title: "Error", description: "Failed to end round.", variant: "destructive"});
        }
    }
  }, [playerId, roomId, toast]);


  const handleGuessSubmit = useCallback(async (guessText: string) => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`)); // Get fresh room data
    if (!currentRoomSnapshot.exists()) return;
    const currentRoom: Room = currentRoomSnapshot.val();

    if (!currentRoom || !playerId || !playerName || currentRoom.currentDrawerId === playerId || currentRoom.gameState !== 'drawing' || !currentRoom.currentPattern) {
        // console.log("Guess submitted at invalid time or by drawer.");
        return;
    }

    if ((currentRoom.correctGuessersThisRound || []).includes(playerId)) {
        toast({title: "Already Guessed", description: "You've already guessed correctly this round!", variant: "default"});
        return;
    }

    const isCorrect = guessText.toLowerCase() === currentRoom.currentPattern.toLowerCase();
    let isFirstCorrectGlobal = false;
    if (isCorrect && (currentRoom.correctGuessersThisRound || []).length === 0) {
        isFirstCorrectGlobal = true;
    }

    const newGuess: Guess = {
      playerId,
      playerName,
      text: guessText,
      isCorrect,
      isFirstCorrect: isCorrect && isFirstCorrectGlobal,
      timestamp: serverTimestamp() as any // Firebase server timestamp
    };

    // Path to guesses array
    const guessesRef = ref(database, `rooms/${roomId}/guesses`);
    const currentGuesses = currentRoom.guesses || [];
    const newGuesses = [...currentGuesses, newGuess]; // Add new guess to local copy
    
    const updates: Partial<Room> = { guesses: newGuesses }; // Prepare update for guesses
    let newCorrectGuessers = [...(currentRoom.correctGuessersThisRound || [])];

    if (isCorrect) {
        const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
        const drawerRef = ref(database, `rooms/${roomId}/players/${currentRoom.currentDrawerId!}`); // Assert drawerId exists
        let pointsAwardedToGuesser = 0;

        if (isFirstCorrectGlobal) {
            pointsAwardedToGuesser = 10;
        } else {
            pointsAwardedToGuesser = 5;
        }
        
        // Award points to guesser
        const currentPlayerData = currentRoom.players[playerId];
        if (currentPlayerData) { // Ensure player exists
             await update(playerRef, { score: (currentPlayerData.score || 0) + pointsAwardedToGuesser });
        }
        
        // Award points to drawer
        const drawerData = currentRoom.players[currentRoom.currentDrawerId!];
        if (drawerData) { // Ensure drawer exists
            await update(drawerRef, { score: (drawerData.score || 0) + 3 }); // Example: 3 points per correct guesser
        }
        
        newCorrectGuessers.push(playerId);
        updates.correctGuessersThisRound = newCorrectGuessers;
    }

    await update(ref(database, `rooms/${roomId}`), updates); // Write new guesses and correctGuessersThisRound to DB

    // Check if all players have guessed (host responsibility)
    if (isCorrect) { // Only check if the guess was correct
        const updatedRoomSnap = await get(ref(database, `rooms/${roomId}`)); // Get the very latest room state
        if (!updatedRoomSnap.exists()) return;
        const updatedRoomData: Room = updatedRoomSnap.val();
    
        // Only the host should trigger early round end
        if (updatedRoomData.gameState === 'drawing' && updatedRoomData.hostId === playerId) {
            const onlineNonDrawingPlayers = Object.values(updatedRoomData.players || {}).filter(p => p.isOnline && p.id !== updatedRoomData.currentDrawerId);
            const allGuessed = onlineNonDrawingPlayers.length > 0 && onlineNonDrawingPlayers.every(p => (updatedRoomData.correctGuessersThisRound || []).includes(p.id));
    
            if (allGuessed) {
               endCurrentRound("All players guessed correctly!");
            }
        }
    }

  }, [playerId, playerName, roomId, toast, endCurrentRound]); // endCurrentRound must be stable via useCallback

  // Host's action to start the game (from 'waiting' or 'game_over')
  const manageGameStart = useCallback(async () => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId) return;

    if (currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over') {
        if (currentRoomData.gameState === 'game_over') {
            await prepareNewGameSession(); // This resets scores and game state for "Play Again"
        }
        // For both 'waiting' (initial start) and after 'game_over' (play again), proceed to select word for new round.
        await selectWordForNewRound(); 
    }
  }, [playerId, roomId, prepareNewGameSession, selectWordForNewRound]);


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

  const handleLeaveRoom = async () => {
    if (playerId && room) {
      const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
      try {
        // Set player to offline before navigating away.
        // onDisconnect will also handle this if browser closes abruptly.
        await update(playerRef, { isOnline: false });
        toast({ title: "Left Room", description: "You have left the room." });
        router.push('/');
      } catch (err) {
        // Still navigate away even if DB update fails.
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
         router.push('/');
      }
    } else {
      // If no playerId or room, just go home.
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
    // For performance, consider batching points or using a different strategy if many points are drawn rapidly.
    // For now, direct set is fine for moderate drawing.
    const newDrawingData = [...(room.drawingData || []), point];
    set(ref(database, `rooms/${roomId}/drawingData`), newDrawingData);
  };

  const handleClearCanvas = () => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    const clearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'', lineWidth:0 };
    // Replace entire drawingData with a single clear event.
    set(ref(database, `rooms/${roomId}/drawingData`), [clearPoint]);
  };

  // Drawer's action to submit a custom word.
  const handleCustomWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !customWordInput.trim() || !playerId || currentRoomData.currentDrawerId !== playerId || currentRoomData.gameState !== 'word_selection' || !currentRoomData.config) return;

    const word = customWordInput.trim();
    // Validate custom word
    if (word.length > currentRoomData.config.maxWordLength ) {
        toast({ title: "Word too long!", description: `Max length is ${currentRoomData.config.maxWordLength} chars.`, variant: "destructive"});
        return;
    }
    if ((currentRoomData.usedWords || []).map(w => w.toLowerCase()).includes(word.toLowerCase())) {
        toast({ title: "Word Used!", description: "This word has already been drawn.", variant: "destructive"});
        return;
    }
    await confirmWordAndStartDrawing(word);
  };


  // Main effect for room data synchronization and player online status
  useEffect(() => {
    if (!roomId || !playerId) return; // Wait for roomId and playerId to be set

    const roomRefVal = ref(database, `rooms/${roomId}`);
    const playerStatusRef = ref(database, `rooms/${roomId}/players/${playerId}/isOnline`);
    const playerConnectionsRef = ref(database, '.info/connected');

    const onRoomValueChange = onValue(roomRefVal, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val() as Room;

        // Ensure defaults for potentially missing fields
        if (!roomData.drawingData) roomData.drawingData = [];
        if (!roomData.guesses) roomData.guesses = [];
        if (!roomData.players) roomData.players = {}; // Should be initialized by room creation
        if (!roomData.correctGuessersThisRound) roomData.correctGuessersThisRound = [];
        if (!roomData.usedWords) roomData.usedWords = [];
        if (!roomData.selectableWords) roomData.selectableWords = [];
        if (!roomData.config) {
            // This default should ideally not be hit if room creation is robust
            roomData.config = { roundTimeoutSeconds: 90, totalRounds: 5, maxWordLength: 20, maxHintLetters: 2 };
        }
        // If revealedPattern is absolutely missing from Firebase data, treat it as an empty array.
        // The actual content (underscores or revealed letters) is managed by confirmWordAndStartDrawing (initial underscores)
        // and the host's hint effect (revealing letters).
        // This client-side code should not try to "correct" it beyond ensuring it's a valid array.
        if (roomData.revealedPattern === undefined) {
            roomData.revealedPattern = [];
        }

        setRoom(roomData);
        setError(null);
      } else {
        setError("Room not found or has been deleted.");
        setRoom(null);
        if (!isLoading) { // Only redirect/toast if not in initial loading phase
            toast({ title: "Room Error", description: "This room no longer exists.", variant: "destructive" });
            router.push('/');
        }
      }
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to load room data.");
      setIsLoading(false);
      toast({ title: "Connection Error", description: "Could not connect to the room.", variant: "destructive" });
    });

    // Firebase connection listener to manage online status
    const onConnectedChange = onValue(playerConnectionsRef, (snap) => {
      if (snap.val() === true && playerId && roomId) { // Ensure playerId and roomId are available
        const playerRefForOnline = ref(database, `rooms/${roomId}/players/${playerId}`);
        get(playerRefForOnline).then(playerSnap => {
            if (playerSnap.exists()) { // Only set online if player node exists
                 set(playerStatusRef, true);
                 // Set onDisconnect last, after confirming player is part of the room and online.
                 onDisconnect(playerStatusRef).set(false).catch(err => console.error("onDisconnect error for player status", err));
            }
        });
      }
    });

    // Initial online status set if player ID is known
    if (playerId && roomId) { // Check roomId too
        // Check if player already exists in the room before setting online
        get(child(ref(database, `rooms/${roomId}`), `players/${playerId}`)).then(playerSnap => {
          if (playerSnap.exists()) {
            update(child(ref(database, `rooms/${roomId}`), `players/${playerId}`), { isOnline: true });
          }
          // If player doesn't exist (e.g., stale localStorage ID for a new room),
          // they will be added as online by RoomForm logic when joining/creating.
        });
    }


    return () => {
      off(roomRefVal, 'value', onRoomValueChange);
      off(playerConnectionsRef, 'value', onConnectedChange);
      // Clear all hint timers when component unmounts or dependencies change
      if (hintTimerRef.current && Array.isArray(hintTimerRef.current)) {
        hintTimerRef.current.forEach(clearTimeout);
      }
      hintTimerRef.current = [];
    };
  }, [roomId, playerId, router, toast, isLoading]); // isLoading is included to re-run if initial load had error


  // Effect for host to manage drawing round timer and end round if all guessed
  useEffect(() => {
    if (room?.gameState === 'drawing' && room?.hostId === playerId) {
      let roundTimer: NodeJS.Timeout | null = null;

      // Check if all players have guessed
      const onlineNonDrawingPlayers = Object.values(room.players || {}).filter(p => p.isOnline && p.id !== room.currentDrawerId);
      const allGuessed = onlineNonDrawingPlayers.length > 0 && onlineNonDrawingPlayers.every(p => (room.correctGuessersThisRound || []).includes(p.id));

      if (allGuessed) {
        // Delay slightly to allow last guess to propagate/display, then end round
        setTimeout(() => {
            // Re-fetch room state to ensure conditions are still met
            get(ref(database, `rooms/${roomId}`)).then(snap => {
                if (snap.exists()) {
                    const currentRoomData = snap.val() as Room;
                     // Check again before ending
                     const currentOnlineNonDrawingPlayers = Object.values(currentRoomData.players || {}).filter(p => p.isOnline && p.id !== currentRoomData.currentDrawerId);
                     const currentAllGuessed = currentOnlineNonDrawingPlayers.length > 0 && currentOnlineNonDrawingPlayers.every(p => (currentRoomData.correctGuessersThisRound || []).includes(p.id));
                    if (currentRoomData.gameState === 'drawing' && currentAllGuessed) {
                        endCurrentRound("All players guessed correctly!");
                    }
                }
            });
        }, 500); // 500ms delay
      } else if (room.roundEndsAt) {
        const now = Date.now();
        const timeLeftMs = room.roundEndsAt - now;
        if (timeLeftMs <= 0) {
          // Timer has already expired, end the round if still in drawing state
          get(ref(database, `rooms/${roomId}/gameState`)).then(snap => { // Check gameState before ending
            if (snap.exists() && snap.val() === 'drawing') { // Ensure still in drawing state
               endCurrentRound("Timer ran out!");
            }
          });
        } else {
          roundTimer = setTimeout(() => {
            // Re-fetch room state to ensure conditions are still met when timer fires
            get(ref(database, `rooms/${roomId}`)).then(snap => {
              if (snap.exists()) {
                const currentRoomData = snap.val() as Room;
                // Ensure this client is still host and round is still active and timer has indeed passed
                if (currentRoomData.gameState === 'drawing' && 
                    currentRoomData.hostId === playerId && 
                    currentRoomData.roundEndsAt && // Ensure roundEndsAt is still set
                    Date.now() >= currentRoomData.roundEndsAt) { // Verify timer condition
                   endCurrentRound("Timer ran out!");
                }
              }
            });
          }, timeLeftMs);
        }
      }
      return () => {
        if (roundTimer) clearTimeout(roundTimer);
      };
    }
  }, [room?.gameState, room?.roundEndsAt, room?.hostId, playerId, endCurrentRound, room?.players, room?.currentDrawerId, room?.correctGuessersThisRound, roomId]);


  // Effect for host to automatically start next round after round_end
  useEffect(() => {
    if (room?.gameState === 'round_end' && playerId === room?.hostId) {
        const NEXT_ROUND_DELAY_SECONDS = 5;
        setRoundEndCountdown(NEXT_ROUND_DELAY_SECONDS);

        const countdownInterval = setInterval(() => {
            setRoundEndCountdown(prev => (prev ? prev - 1 : null));
        }, 1000);

        const nextRoundTimer = setTimeout(async () => {
            clearInterval(countdownInterval);
            setRoundEndCountdown(null); // Clear countdown visual

            // Before starting next round, ensure there are still players
            const playersSnap = await get(ref(database, `rooms/${roomId}/players`));
            if (playersSnap.exists()) {
                const playersData = playersSnap.val();
                const onlinePlayersCount = Object.values(playersData || {}).filter((p: any) => p.isOnline).length;

                const currentRoomStateSnap = await get(ref(database, `rooms/${roomId}/gameState`)); // Check current game state
                if (currentRoomStateSnap.exists() && currentRoomStateSnap.val() === 'round_end') { // Ensure still in round_end
                    if (onlinePlayersCount > 0) {
                        selectWordForNewRound();
                    } else {
                        // No online players, game should end
                        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
                        toast({title: "No Active Players", description: "Game ended as no players are online.", variant: "default"});
                    }
                }
            } else {
                 // Should not happen, but if player data is missing, end game.
                 await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
                 toast({title: "Game Error", description: "Cannot proceed, player data missing.", variant: "destructive"});
            }
        }, NEXT_ROUND_DELAY_SECONDS * 1000);

        return () => {
            clearTimeout(nextRoundTimer);
            clearInterval(countdownInterval);
            setRoundEndCountdown(null); // Ensure countdown is cleared on unmount/change
        };
    } else if (room?.gameState !== 'round_end') {
        // If gameState changes from round_end for other reasons, clear countdown
        setRoundEndCountdown(null); 
    }
  }, [room?.gameState, room?.hostId, playerId, selectWordForNewRound, roomId, toast]);


  // Effect for host to reveal hints
  useEffect(() => {
    // Clear any previous hint timers when dependencies change (e.g., new round)
    hintTimerRef.current.forEach(clearTimeout); 
    hintTimerRef.current = [];

    if (
        room?.gameState === 'drawing' &&
        room.currentPattern &&
        playerId === room.hostId && // Only host sets up hint timers
        room.roundEndsAt &&
        room.config &&
        room.revealedPattern // Make sure revealedPattern exists
    ) {
        const currentPatternStr = room.currentPattern;
        const patternChars = currentPatternStr.split('');
        const currentPatternNonSpaceLength = patternChars.filter(char => char !== ' ').length;

        if (currentPatternNonSpaceLength === 0) return; // No hints for empty/space-only words

        // Calculate the number of hints to reveal based on host config and word length
        // Max hints is host's setting, but no more than (word_length - 1)
        const hostConfiguredMaxHints = room.config.maxHintLetters;
        const finalHintCount = Math.min(hostConfiguredMaxHints, Math.max(0, currentPatternNonSpaceLength - 1));
        
        if (finalHintCount === 0) {
            return; // No hints to reveal
        }

        // Get indices of non-space characters that are currently underscores
        const nonSpaceUnderscoreIndices = patternChars
            .map((char, index) => (char !== ' ' && room.revealedPattern && room.revealedPattern[index] === '_' ? index : -1))
            .filter(index => index !== -1);

        // Shuffle these available indices and pick 'finalHintCount' of them to reveal
        const shuffledIndices = [...nonSpaceUnderscoreIndices].sort(() => 0.5 - Math.random());
        const indicesToRevealThisRound = shuffledIndices.slice(0, finalHintCount);

        if (indicesToRevealThisRound.length === 0) return; // No valid indices to reveal hints for

        // Timing for progressive reveal
        const roundDurationMs = room.config.roundTimeoutSeconds * 1000;
        const startRevealTimeMs = roundDurationMs / 2; // Start revealing hints after 50% of round time
        const timeWindowForHintsMs = roundDurationMs - startRevealTimeMs; // Time window for all hints
        // Calculate delay between each hint reveal
        const delayBetweenHintsMs = indicesToRevealThisRound.length > 0 ? timeWindowForHintsMs / indicesToRevealThisRound.length : 0;

        const initialUnderscorePatternForTransaction = currentPatternStr.split('').map(char => char === ' ' ? ' ' : '_');


        indicesToRevealThisRound.forEach((targetCharIndex, hintIteration) => {
            const revealAtMs = startRevealTimeMs + (hintIteration * delayBetweenHintsMs);

            const timerId = setTimeout(async () => {
                // Before running transaction, get the latest room state
                const latestRoomSnap = await get(ref(database, `rooms/${roomId}`));
                if (!latestRoomSnap.exists()) return; // Room deleted
                const latestRoomData = latestRoomSnap.val() as Room;

                // Only proceed if game is still in drawing state and pattern matches
                if (latestRoomData.gameState !== 'drawing' || latestRoomData.currentPattern !== currentPatternStr) {
                    return; // Round ended or pattern changed, abort this hint
                }

                const roomRevealedPatternRef = ref(database, `rooms/${roomId}/revealedPattern`);
                try {
                    await runTransaction(roomRevealedPatternRef, (currentFirebaseRevealedPattern) => {
                        // `currentFirebaseRevealedPattern` is the current value in DB or null if path doesn't exist
                        let basePattern;
                        if (currentFirebaseRevealedPattern && 
                            Array.isArray(currentFirebaseRevealedPattern) && 
                            currentFirebaseRevealedPattern.length === patternChars.length) {
                            // Firebase has a valid-looking pattern, use it
                            basePattern = [...currentFirebaseRevealedPattern];
                        } else {
                            // Firebase pattern is missing, empty, or wrong length. Start from fresh underscores.
                            // This ensures that even if revealedPattern was somehow reset, we can still apply hints.
                            basePattern = [...initialUnderscorePatternForTransaction];
                        }
                        
                        // Reveal the character if it's not already revealed
                        if (patternChars[targetCharIndex] && basePattern[targetCharIndex] === '_') {
                            basePattern[targetCharIndex] = patternChars[targetCharIndex];
                            return basePattern; // Return the new pattern to Firebase
                        }
                        return undefined; // Abort transaction if char already revealed or no change
                    });
                } catch (error) {
                    // console.error("Transaction error revealing hint:", error); 
                    // Errors are automatically retried by Firebase, so logging might be noisy.
                    // If it fails consistently, there's a deeper issue.
                }
            }, revealAtMs);
            hintTimerRef.current.push(timerId);
        });
    }

    return () => { // Cleanup function
        if (hintTimerRef.current && Array.isArray(hintTimerRef.current)) {
            hintTimerRef.current.forEach(clearTimeout);
        }
        hintTimerRef.current = [];
    };
  // Dependencies for re-running hint logic:
  // gameState (to start/stop), currentPattern (to know what to reveal),
  // hostId/playerId (to ensure only host runs it), roomId, config (for timings),
  // roundEndsAt (for timing calculation), revealedPattern (to know current state of hints to choose new ones).
  }, [room?.gameState, room?.currentPattern, room?.hostId, playerId, roomId, room?.config, room?.roundEndsAt, room?.revealedPattern]); 


  // Effect for host to handle word selection timeout
  useEffect(() => {
    if (room?.gameState === 'word_selection' && room?.hostId === playerId && room?.wordSelectionEndsAt && !room?.currentPattern) {
      const now = Date.now();
      const timeLeftMs = room.wordSelectionEndsAt - now;
      let timer: NodeJS.Timeout | null = null;

      if (timeLeftMs <= 0) {
        // Timer already expired, if still in word_selection and no pattern, skip turn
        get(ref(database, `rooms/${roomId}`)).then(snap => {
             if (snap.exists()) {
                 const latestRoomData = snap.val() as Room;
                 // Check all conditions again before acting
                 if (latestRoomData.gameState === 'word_selection' && 
                     latestRoomData.hostId === playerId && 
                     !latestRoomData.currentPattern && // Word still not chosen
                     latestRoomData.wordSelectionEndsAt && Date.now() >= latestRoomData.wordSelectionEndsAt) {
                    
                    const drawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                    toast({
                        title: "Word Selection Timed Out",
                        description: `${drawerName} didn't choose a word. Moving to the next player...`,
                        variant: "default"
                    });
                    selectWordForNewRound(); // Host initiates next round setup
                 }
             }
          });
      } else {
        timer = setTimeout(() => {
           // Re-fetch latest room data when timer fires
           get(ref(database, `rooms/${roomId}`)).then(snap => {
             if (snap.exists()) {
                 const latestRoomData = snap.val() as Room;
                 // Check all conditions again
                 if (latestRoomData.gameState === 'word_selection' && 
                     latestRoomData.hostId === playerId && 
                     !latestRoomData.currentPattern && 
                     latestRoomData.wordSelectionEndsAt && // Ensure timer is still relevant
                     Date.now() >= latestRoomData.wordSelectionEndsAt) {
                    
                    const currentDrawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                    toast({
                        title: "Word Selection Timed Out",
                        description: `${currentDrawerName} didn't choose a word. Moving to the next player...`,
                        variant: "default"
                    });
                    selectWordForNewRound(); // Host initiates next round setup
                 }
             }
          });
        }, timeLeftMs);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [room?.gameState, room?.hostId, playerId, room?.wordSelectionEndsAt, room?.currentPattern, room?.currentDrawerId, room?.players, selectWordForNewRound, toast, roomId]);


  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-xl">Loading Room...</span></div>;
  if (error) return <div className="text-center text-red-500 p-8 bg-red-50 border border-red-200 rounded-md"><AlertCircle className="mx-auto h-12 w-12 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Error Loading Room</h2><p>{error}</p><Button onClick={() => router.push('/')} className="mt-4">Go Home</Button></div>;
  if (!room || !playerId || !room.config) return <div className="text-center p-8">Room data is not available or incomplete. <Link href="/" className="text-primary hover:underline">Go Home</Link></div>;

  const playersArray = Object.values(room.players || {});
  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const canGuess = room.gameState === 'drawing' && !isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId);
  const isHost = room.hostId === playerId;
  const currentDrawerName = room.currentDrawerId && room.players[room.currentDrawerId] ? room.players[room.currentDrawerId].name : "Someone";

  const getStartButtonInfo = () => {
    if (room.gameState === 'waiting') return { text: 'Start Game', icon: <Play size={18} /> };
    if (room.gameState === 'game_over') return { text: 'Play Again', icon: <RotateCcw size={18} /> };
    // Add "Next Round" if needed, but it's mostly automatic now
    // if (room.gameState === 'round_end' && isHost) return { text: 'Start Next Round', icon: <SkipForward size={18}/> };
    return null;
  };
  const startButtonInfo = getStartButtonInfo();

  const wordToDisplay = () => {
    if (!room.currentPattern) return "Choosing word..."; // Or some placeholder during word selection
    
    // Drawer always sees the full word
    if (isCurrentPlayerDrawing || (room.correctGuessersThisRound || []).includes(playerId)) {
        return room.currentPattern; // Or perhaps a slightly different message for guessers who got it right
    }

    // For guessers, show revealedPattern or underscores
    const currentWordChars = room.currentPattern.split('');
    // Ensure revealedPattern has the same length as currentPattern for consistency
    const patternToShow = Array.isArray(room.revealedPattern) && room.revealedPattern.length === currentWordChars.length 
                          ? room.revealedPattern 
                          : currentWordChars.map((char) => char === ' ' ? ' ' : '_'); // Fallback to all underscores if mismatch
    return patternToShow.join(' ');
  };


  return (
    <TooltipProvider>
    <div className="container mx-auto p-2 md:p-4 h-full flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Room Info Card */}
      <Card className="shadow-lg border-border/80">
        <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4">
            <CardTitle className="text-lg sm:text-xl md:text-2xl font-semibold">
            Room: <span className="font-mono text-accent">{room.id}</span>
            </CardTitle>
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsRoomInfoMinimized(!isRoomInfoMinimized)}
            className="md:hidden" // Only show on mobile
            aria-label={isRoomInfoMinimized ? "Expand room info" : "Minimize room info"}
            >
            {isRoomInfoMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </Button>
        </CardHeader>

        {/* Collapsible content for Room Info */}
        <div
            className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
            { // Mobile state classes
                "max-h-0 opacity-0": isRoomInfoMinimized, // Minimized on mobile
                "max-h-[500px] opacity-100": !isRoomInfoMinimized, // Expanded on mobile (adjust max-h as needed)
            },
            "md:max-h-none md:opacity-100" // Always expanded on desktop (md and up)
            )}
        >
            <div className="px-3 sm:px-4 pb-2 md:px-6 md:pb-4 pt-0"> {/* Adjusted padding */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardDescription className="mt-1 sm:mt-0 text-sm text-muted-foreground">
                    Round {room.currentRoundNumber || 0}/{room.config.totalRounds || 'N/A'} | Status: <span className="font-semibold text-primary capitalize">{room.gameState.replace('_', ' ')}</span>
                </CardDescription>
                <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                    {/* Timer Display Logic */}
                    {room.gameState === 'drawing' && <TimerDisplay targetTime={room.roundEndsAt} gameState={room.gameState} defaultSeconds={room.config.roundTimeoutSeconds} label="Drawing Time" />}
                    {room.gameState === 'word_selection' && <TimerDisplay targetTime={room.wordSelectionEndsAt} gameState={room.gameState} defaultSeconds={15} label="Word Choice" />}
                    {/* For states without active timers, show a generic "Waiting" or relevant info */}
                    { (room.gameState === 'waiting' || room.gameState === 'round_end' || room.gameState === 'game_over') && <TimerDisplay gameState={room.gameState} defaultSeconds={0} label="N/A" /> }
                    <Button variant="outline" size="sm" onClick={handleCopyLink}><Share2 size={16} className="mr-1.5" /> Share</Button>
                    <Button variant="destructive" size="sm" onClick={handleLeaveRoom}><LogOut size={16} className="mr-1.5" /> Leave</Button>
                </div>
            </div>
            </div>

            {/* Host Game Control Button */}
            {isHost && startButtonInfo && (room.gameState === 'waiting' || room.gameState === 'game_over') && (
            <CardFooter className="pt-3 sm:pt-4 border-t">
                <Button
                    onClick={manageGameStart}
                    className="w-full md:w-auto"
                    // Disable if not enough online players to start/restart
                    disabled={(room.gameState === 'waiting' || room.gameState === 'game_over') && Object.values(room.players).filter(p=>p.isOnline).length < 1}
                >
                    {startButtonInfo.icon} {startButtonInfo.text}
                </Button>
            </CardFooter>
            )}
        </div>
        </Card>

      {/* Word Selection Dialog/Modal for Drawer */}
      {room.gameState === 'word_selection' && isCurrentPlayerDrawing && (
        <Dialog open={true} onOpenChange={() => { /* Prevent closing by clicking outside for now */ }}>
          <DialogContent className="sm:max-w-[480px] shadow-xl border-border/80">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl"><Lightbulb className="text-yellow-400"/> Choose a word to draw</DialogTitle>
              <DialogDescription>
                Select one of the suggested words or enter your own custom word below.
                Max word length: {room.config.maxWordLength} chars. You have 15 seconds!
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-wrap justify-center gap-3 mb-4">
                {(room.selectableWords || []).map(word => (
                  <Button
                    key={word}
                    variant="secondary"
                    className="text-lg px-6 py-3"
                    onClick={() => confirmWordAndStartDrawing(word)}
                    disabled={isSubmittingWord}
                  >
                    {word}
                  </Button>
                ))}
                {(!room.selectableWords || room.selectableWords.length === 0) && <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin"/>Loading AI suggestions...</p>}
              </div>
              <form onSubmit={handleCustomWordSubmit} className="space-y-3">
                <Label htmlFor="customWord" className="text-md font-medium">Or enter your custom word:</Label>
                <div className="flex gap-2">
                    <Input
                    id="customWord"
                    type="text"
                    value={customWordInput}
                    onChange={(e) => setCustomWordInput(e.target.value)}
                    placeholder={`Max ${room.config.maxWordLength} chars`}
                    maxLength={room.config.maxWordLength}
                    className="flex-grow"
                    disabled={isSubmittingWord}
                    />
                    <Button type="submit" disabled={isSubmittingWord || !customWordInput.trim()}>
                        {isSubmittingWord && customWordInput ? <Loader2 className="animate-spin mr-2"/> : <Edit3 className="mr-2" />}
                        Draw This
                    </Button>
                </div>
              </form>
            </div>
            {/* Timer specific to word selection dialog */}
            {room.wordSelectionEndsAt && ( 
                <div className="text-center mt-2 text-sm">
                    <TimerDisplay targetTime={room.wordSelectionEndsAt} gameState="word_selection" defaultSeconds={15} label="" />
                </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Message for guessers during word selection */}
      {room.gameState === 'word_selection' && !isCurrentPlayerDrawing && (
          <Card className="p-4 text-center bg-muted/80 shadow animate-in fade-in">
              <div className="text-lg font-semibold flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {currentDrawerName || "The drawer"} is choosing a word... Get ready to guess!
              </div>
              {room.wordSelectionEndsAt && // Show word selection timer to guessers too
                <div className="text-sm text-muted-foreground mt-1">
                    Time to choose: <TimerDisplay targetTime={room.wordSelectionEndsAt} gameState="word_selection" defaultSeconds={15} label="" />
                </div>
              }
          </Card>
      )}

      {/* Word Display during Drawing Phase */}
      {room.gameState === 'drawing' && room.currentPattern && (
        <div className="p-3 text-center bg-accent/10 border-accent shadow rounded-md">
          <div className="text-card-foreground flex items-center justify-center">
            <span>
                {isCurrentPlayerDrawing 
                    ? "Your word to draw is: " 
                    : (room.correctGuessersThisRound || []).includes(playerId) 
                    ? "You guessed it! The word is: " 
                    : "Guess the word!"}
                {/* Display (X letters) for guessers */}
                {!isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId) && room.currentPattern && room.gameState === 'drawing' && (
                    <span className="ml-1 text-muted-foreground">({room.currentPattern.replace(/\s/g, '').length} letters)</span>
                )}
            </span>
            <strong
                key={room.revealedPattern?.join('')} // Key for animation on change
                className="text-xl ml-2 font-mono tracking-wider text-accent animate-in fade-in duration-300" 
            >
                {wordToDisplay()}
            </strong>
            {!isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId) && ( // Tooltip for guessers
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 ml-2 cursor-help text-muted-foreground hover:text-accent" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Hints (random letters) will be revealed progressively after half the round time!</p>
                         <p className="text-xs">The number of hints depends on host settings and word length, ensuring at least one letter stays hidden.</p>
                    </TooltipContent>
                </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Round End Summary Card */}
      {room.gameState === 'round_end' && (
        <Card className="p-4 shadow-lg bg-green-500/10 border-green-500/30 animate-in fade-in">
            <CardTitle className="text-xl mb-2 text-green-700">Round Over!</CardTitle>
            <p className="text-md mb-1">The word was: <strong className="font-mono text-green-800">{room.currentPattern || "N/A"}</strong></p>
            <p className="text-md">Drawer: {currentDrawerName || 'N/A'}</p>
            <h4 className="font-semibold mt-3 mb-1">Correct Guesses:</h4>
            {room.guesses.filter(g => g.isCorrect).length > 0 ? (
                <ul className="list-disc list-inside text-sm">
                    {room.guesses.filter(g => g.isCorrect).map(g => (
                        <li key={g.playerId + "_" + g.timestamp}>{g.playerName} {g.isFirstCorrect ? <span className="font-bold text-accent">(First!)</span> : ''}</li>
                    ))}
                </ul>
            ) : <p className="text-sm italic">No one guessed it right this time!</p>}
            {roundEndCountdown !== null && <p className="mt-3 text-center text-lg font-semibold text-primary animate-pulse">Next round starting in {roundEndCountdown}s...</p>}
        </Card>
      )}

      {/* Game Over Summary Card */}
      {room.gameState === 'game_over' && (
        <Card className="p-6 shadow-xl bg-primary/10 border-primary/30 animate-in fade-in">
            <CardTitle className="text-2xl mb-4 text-center text-primary flex items-center justify-center gap-2"><Trophy /> Game Over! <Trophy /></CardTitle>
            <CardDescription className="text-center mb-4 text-lg">Final Scores:</CardDescription>
            <ul className="space-y-2">
                {playersArray.sort((a,b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
                    <li key={player.id} className={`flex justify-between items-center p-3 rounded-md text-lg ${index === 0 ? 'bg-accent/20 font-bold text-accent-foreground' : 'bg-card'}`}>
                        <span>{index + 1}. {player.name}</span>
                        <span className="font-semibold">{player.score || 0} pts</span>
                    </li>
                ))}
            </ul>
        </Card>
      )}


      {/* Main Game Layout: Canvas + Sidebar/Mobile-Specific-Layout */}
      <div className="flex-grow flex flex-col md:flex-row gap-4 min-h-0"> {/* This is the main flex container */}

          {/* Drawing Canvas Area */}
          <div className="order-1 w-full md:w-2/3 flex flex-col h-[60vh] md:h-auto md:flex-grow-[2] md:min-h-[300px]"> {/* Canvas takes 60% viewport height on mobile, or grows on desktop */}
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

          {/* Mobile layout for PlayerList and ChatArea (side-by-side) */}
          <div className="order-2 md:hidden flex flex-row gap-4 h-[calc(40vh-theme(space.12))] min-h-0"> {/* Adjust height dynamically */}
            <div className="w-1/2 h-full flex flex-col">
              <PlayerList
                players={playersArray}
                currentPlayerId={room.currentDrawerId}
                hostId={room.hostId}
                isMinimized={isPlayerListMinimized}
                setIsMinimized={setIsPlayerListMinimized}
              />
            </div>
            <div className="w-1/2 h-full flex flex-col">
              <ChatArea
                guesses={room.guesses || []}
                room={room}
                onGuessSubmit={handleGuessSubmit}
                disabled={!canGuess}
              />
            </div>
          </div>

          {/* Desktop Sidebar: ChatArea (top, grows), PlayerList (middle, collapsible) */}
          <div className="order-3 hidden md:flex md:flex-col md:w-1/3 md:gap-4 md:flex-grow-[1] md:min-h-0"> 
            <ChatArea
                guesses={room.guesses || []}
                room={room}
                onGuessSubmit={handleGuessSubmit}
                disabled={!canGuess}
            />
            <PlayerList
                players={playersArray}
                currentPlayerId={room.currentDrawerId}
                hostId={room.hostId}
                isMinimized={isPlayerListMinimized}
                setIsMinimized={setIsPlayerListMinimized}
            />
          </div>
        </div>
    </div>
    </TooltipProvider>
  );
}

