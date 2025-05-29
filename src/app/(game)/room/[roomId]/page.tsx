
"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, off, update, serverTimestamp, set, child, get, onDisconnect, runTransaction } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, DrawingPoint, Guess } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Copy, LogOut, Send, Palette, Eraser, Users, Clock, Loader2, Share2, CheckCircle, Trophy, Play, SkipForward, RotateCcw, Lightbulb, Edit3, ChevronUp, ChevronDown, Brush, Settings } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { APP_NAME } from '@/lib/config';
import { suggestWords, type SuggestWordsInput, type SuggestWordsOutput } from '@/ai/flows/suggest-words-flow';

// Lazy load modals and dialogs
const WordSelectionDialog = dynamic(() => import('@/components/game/WordSelectionDialog').then(mod => mod.WordSelectionDialog), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
  ssr: false
});

const GameStateModals = dynamic(() => import('@/components/game/GameStateModals').then(mod => mod.GameStateModals), {
  loading: () => null, // Or a minimal loader if preferred for these overlay-style modals
  ssr: false
});

const SettingsDialogContent = dynamic(() => import('@/components/game/SettingsDialogContent').then(mod => mod.SettingsDialogContent), {
  ssr: false
});

const RevealConfirmDialogContent = dynamic(() => import('@/components/game/RevealConfirmDialogContent').then(mod => mod.RevealConfirmDialogContent), {
  ssr: false
});

import {
  AlertDialog,
  AlertDialogTrigger, 
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';


const DrawingCanvas = React.memo(({
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


  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
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

  const startPaint = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const paint = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const exitPaint = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
    <div className="w-full h-full flex flex-col bg-muted/10 border border-black overflow-hidden">
      <div className="p-1 border-b border-border/30">
        <div className="flex flex-row items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {isDrawingEnabled
              ? (isMobile ? (isToolbarMinimized ? "Tools (Tap to expand)" : "Tools (Tap to collapse)") : "Drawing Tools")
              : (currentDrawerId ? `It's ${currentDrawerName || 'someone'}'s turn to draw.` : (gameState !== 'word_selection' ? "Waiting for drawer..." : ""))}
          </div>

          {isDrawingEnabled && isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsToolbarMinimized(!isToolbarMinimized)} aria-label={isToolbarMinimized ? "Expand toolbar" : "Collapse toolbar"} className="w-7 h-7">
                  {isToolbarMinimized ? <ChevronDown className="h-5 w-5"/> : <ChevronUp className="h-5 w-5"/>}
              </Button>
          )}
        </div>

        <div className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isDrawingEnabled ?
              (isMobile ? (isToolbarMinimized ? "max-h-0 opacity-0" : "max-h-28 opacity-100 pt-1")
                         : "max-h-28 opacity-100 pt-1")
              : "max-h-0 opacity-0"
        )}>
          {isDrawingEnabled && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                    {colors.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className="w-5 h-5 rounded-full border-2 shadow-sm"
                            style={{ backgroundColor: c, borderColor: color.toLowerCase() === c.toLowerCase() ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                            aria-label={`Select color ${c}`}
                        />
                    ))}
                    <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-6 p-0.5 border-none rounded-sm" />
                </div>
                <div className="flex items-center gap-1">
                    <Brush className="w-4 h-4 text-muted-foreground" />
                    <Input type="range" min="1" max="30" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-16 md:w-20 h-5" />
                    <span className="text-xs text-muted-foreground w-3 text-right">{lineWidth}</span>
                    <Button variant="ghost" size="icon" onClick={localClearAndPropagate} title="Clear Canvas" className="w-7 h-7">
                        <Eraser className="w-4 h-4" />
                    </Button>
                </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-grow p-0 bg-white relative min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onMouseDown={startPaint}
          onMouseMove={paint}
          onMouseUp={exitPaint}
          onMouseLeave={exitPaint}
          onTouchStart={startPaint}
          onTouchMove={paint}
          onTouchEnd={exitPaint}
        />
        {!isDrawingEnabled && currentDrawerId !== playerId && gameState === 'drawing' && <p className="absolute top-1 left-1 text-xs bg-primary/20 text-primary-foreground p-0.5 rounded-sm">You are guessing!</p>}
        {isDrawingEnabled && currentDrawerId === playerId && gameState === 'drawing' && <p className="absolute top-1 left-1 text-xs bg-accent/20 text-accent-foreground p-0.5 rounded-sm">Your turn to draw!</p>}
      </div>
    </div>
  );
});
DrawingCanvas.displayName = 'DrawingCanvas';


const PlayerList = React.memo(({
    players,
    currentPlayerId,
    playerId,
    hostId,
    correctGuessersThisRound,
    isMinimized,
    setIsMinimized,
}: {
    players: Player[],
    currentPlayerId?: string | null,
    playerId: string,
    hostId?: string,
    correctGuessersThisRound: string[],
    isMinimized: boolean,
    setIsMinimized: (isMinimized: boolean) => void,
}) => {
    const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score || 0) - (a.score || 0)), [players]);

    return (
    <div className="w-full h-full flex flex-col border border-black bg-gray-50">
        <div className="p-1.5 border-b border-black flex items-center justify-between bg-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700">Players ({players.length})</h3>
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}
            </Button>
        </div>
        <div className={cn(
            "flex-grow overflow-y-auto scrollbar-thin min-h-0 transition-all duration-300 ease-in-out",
            isMinimized ? "max-h-0 opacity-0" : "opacity-100 flex-1"
        )}>
            {sortedPlayers.map((player, index) => (
            <div
                key={player.id}
                className={cn(
                    "flex items-center px-2 py-1 border-b border-gray-300",
                    correctGuessersThisRound.includes(player.id) && player.id !== currentPlayerId ? "bg-green-100" : "bg-white",
                    player.id === playerId ? "border-l-4 border-blue-500" : ""
                )}
            >
                <div className="w-8 font-bold text-sm text-gray-700">#{index + 1}</div>
                <div className="flex-1 text-center text-xs">
                <span className={cn("font-bold", player.id === playerId ? "text-blue-600" : "text-gray-800", !player.isOnline ? "line-through text-gray-400" : "")}>
                    {player.name} {player.id === playerId ? "(You)" : ""} {player.id === hostId ? <span className="text-xs">(Host)</span> : ""}
                </span>
                <br />
                <span className="font-normal text-gray-600">{player.score || 0} points</span>
                </div>
                <div className="w-10 h-10 flex items-center justify-center">
                    {player.id === currentPlayerId ? (
                        <Brush className="text-blue-500 animate-pulse h-5 w-5" title="Drawing" />
                    ) : (
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://placehold.co/32x32.png?text=${player.name.substring(0,1)}`} data-ai-hint="profile avatar"/>
                            <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
            </div>
            ))}
        </div>
    </div>
    );
});
PlayerList.displayName = 'PlayerList';

const GuessInput = React.memo(({ onGuessSubmit, disabled }: { onGuessSubmit: (guess: string) => void, disabled: boolean }) => {
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full items-center relative">
      <Input
        type="text"
        value={guess}
        onChange={e => setGuess(e.target.value)}
        placeholder="Type your guess here..."
        disabled={disabled}
        className="w-full text-center text-gray-600 text-base font-normal outline-none border-gray-300 focus:border-blue-500 h-10 px-3 pr-10"
      />
      <span className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
        {letterCount}
      </span>
      <Button type="submit" disabled={disabled} size="icon" className="h-10 w-10 bg-blue-500 hover:bg-blue-600">
        <Send size={18} className="text-white" />
      </Button>
    </form>
  );
});
GuessInput.displayName = 'GuessInput';

const ChatArea = React.memo(({
    guesses,
    gameState,
    playerId,
}: {
    guesses: Guess[],
    gameState: Room['gameState'] | undefined,
    playerId: string,
}) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [guesses]);

    return (
    <div className="w-full h-full flex flex-col border border-black bg-gray-50">
        <div className="p-1.5 border-b border-black bg-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700">Guesses & Chat</h3>
        </div>
        <div
            ref={scrollAreaRef}
            className="flex-grow overflow-y-auto scrollbar-thin min-h-0 text-[12px] leading-tight"
        >
            {guesses.map((g, i) => {
            let messageContent;
            let messageClasses = "px-2 py-1 border-b border-gray-300";

            if (g.text === "[[SYSTEM_DRAWER_CHANGE]]") {
                messageContent = <span className="font-semibold text-blue-600">{g.playerName} is drawing now!</span>;
                messageClasses = cn(messageClasses, "bg-blue-100");
            } else if (g.text === "[[SYSTEM_GAME_RESET]]") {
                messageContent = <span className="font-semibold text-purple-600">Game has been reset!</span>;
                 messageClasses = cn(messageClasses, "bg-purple-100");
            } else if (g.text.startsWith("[[SYSTEM_JOINED]]")) {
                messageContent = <span className="font-semibold text-gray-600">{g.playerName} joined the room!</span>;
                messageClasses = cn(messageClasses, "bg-gray-100");
            } else if (g.text.startsWith("[[SYSTEM_LEFT]]")) {
                 messageContent = <span className="font-semibold text-orange-600">{g.playerName} left the room!</span>;
                messageClasses = cn(messageClasses, "bg-orange-100");
            } else if (g.isCorrect) {
                messageContent = <span className="font-semibold text-green-700">{g.playerName} guessed the word!</span>;
                messageClasses = cn(messageClasses, "bg-green-100 animate-pulse-bg-once");
            } else if (g.text.startsWith("[[SYSTEM_ROUND_END_WORD]]")) {
                 messageContent = <span className="font-semibold text-indigo-700">The word was '{g.playerName}'</span>;
                messageClasses = cn(messageClasses, "bg-indigo-100");
            } else {
                messageContent = <>
                <span className={cn("font-bold", g.playerId === playerId ? "text-blue-600" : "text-gray-800")}>
                    {g.playerName}{g.playerId === playerId ? " (You)" : ""}:
                </span> {g.text}
                </>;
            }

            return (
                <div key={`${g.timestamp}-${i}`} className={messageClasses}> {/* Ensure unique key */}
                {messageContent}
                </div>
            );
            })}
            {guesses.length === 0 && <p className="text-gray-500 text-center italic p-4">
                {gameState === 'drawing' ? "No guesses yet. Be the first!" : "Chat messages will appear here."}
            </p>}
        </div>
    </div>
    );
});
ChatArea.displayName = 'ChatArea';

const TimerDisplay = React.memo(({ targetTime, defaultSeconds, compact }: { targetTime?: number | null, defaultSeconds: number, compact?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!targetTime || targetTime <= Date.now()) {
      setTimeLeft(Math.max(0, defaultSeconds));
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


  if (timeLeft === null) {
      return <div className={cn("font-bold", compact ? "text-xs" : "text-base")}>...</div>;
  }

  return (
    <div className={cn("rounded-full border border-black bg-white flex items-center justify-center text-xs font-bold", compact ? "w-8 h-8 text-[10px]" : "w-10 h-10")}>
      {timeLeft}
    </div>
  );
});
TimerDisplay.displayName = 'TimerDisplay';

const WordDisplay = React.memo(({
  gameState,
  currentPattern,
  revealedPattern,
  isCurrentPlayerDrawing,
  hasPlayerGuessedCorrectly,
  onLetterClick,
}: {
  gameState: Room['gameState'] | undefined;
  currentPattern: string | null | undefined;
  revealedPattern: string[] | null | undefined;
  isCurrentPlayerDrawing: boolean;
  hasPlayerGuessedCorrectly: boolean;
  onLetterClick: (char: string, index: number) => void;
}) => {
  const wordToDisplayElements = useMemo(() => {
    const elements = [];
    if (!currentPattern) {
      elements.push(
        <span key="placeholder-no-pattern" className="text-muted-foreground">
          {gameState === 'word_selection' ? `Choosing...` : "Waiting..."}
        </span>
      );
      return elements;
    }

    const patternChars = currentPattern.split('');
    const currentRevealedToGuessersPattern = (revealedPattern && revealedPattern.length === patternChars.length)
      ? revealedPattern
      : patternChars.map(c => c === ' ' ? ' ' : '_');

    if (isCurrentPlayerDrawing) {
        // Drawer always sees the full word. Clickable letters change color upon reveal.
        patternChars.forEach((char, index) => {
            if (char === ' ') {
                elements.push(<span key={`drawer-space-${index}`} className="mx-0.5 select-none">{'\u00A0\u00A0'}</span>);
            } else {
                const isLetterRevealedToOthers = currentRevealedToGuessersPattern[index] !== '_' && currentRevealedToGuessersPattern[index] !== ' ';
                if (isLetterRevealedToOthers) {
                    elements.push(
                        <span key={`drawer-revealed-${index}`} className="font-bold text-green-600 cursor-default">
                            {char}
                        </span>
                    );
                } else {
                    elements.push(
                        <button
                            key={`drawer-clickable-${index}`}
                            onClick={() => onLetterClick(char, index)}
                            className="font-bold text-primary hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Reveal letter ${char}`}
                            title={`Click to reveal this letter: ${char}`}
                        >
                            {char}
                        </button>
                    );
                }
            }
        });
    } else if (hasPlayerGuessedCorrectly || gameState === 'round_end' || gameState === 'game_over') {
      // Player who guessed correctly or game/round over - show full word
      patternChars.forEach((char, index) => {
        elements.push(
          <span key={`guesser-correct-char-${index}`} className="font-bold text-foreground">
            {char === ' ' ? '\u00A0\u00A0' : char}
          </span>
        );
      });
    } else if (gameState === 'drawing') { // Regular guesser (including host not drawing)
      currentRevealedToGuessersPattern.forEach((char, index) => {
        elements.push(
          <span key={`guesser-revealed-char-${index}`} className={cn("font-bold", char === '_' || char === ' ' ? 'text-muted-foreground' : 'text-foreground')}>
            {char === ' ' ? '\u00A0\u00A0' : char}
          </span>
        );
      });
    } else { // Other states like 'waiting' or 'word_selection' for guessers
       elements.push(
        <span key="placeholder-state" className="text-muted-foreground">
          {gameState === 'word_selection' ? `Choosing...` : "Waiting..."}
        </span>
       );
    }
    return elements;
  }, [gameState, currentPattern, revealedPattern, isCurrentPlayerDrawing, hasPlayerGuessedCorrectly, onLetterClick]);

  const wordDisplayKey = useMemo(() => {
    return `${gameState}-${currentPattern}-${revealedPattern?.join('')}-${isCurrentPlayerDrawing}-${hasPlayerGuessedCorrectly}`;
  }, [gameState, currentPattern, revealedPattern, isCurrentPlayerDrawing, hasPlayerGuessedCorrectly]);


  return (
    <div
      key={wordDisplayKey}
      className={cn(
        "text-[20px] font-mono font-normal tracking-widest select-text flex items-center justify-center gap-0.5 animate-in fade-in duration-300",
         isCurrentPlayerDrawing ? "text-primary" : "text-foreground"
      )} style={{ letterSpacing: '0.2em' }}
    >
      {wordToDisplayElements}
      {(gameState === 'drawing' && currentPattern && !isCurrentPlayerDrawing && !hasPlayerGuessedCorrectly) && (
        <sup className="text-[10px] font-normal text-gray-500 self-start ml-0.5">
          {currentPattern.replace(/\s/g, '').length}
        </sup>
      )}
    </div>
  );
});
WordDisplay.displayName = 'WordDisplay';


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

  const [isSubmittingWord, setIsSubmittingWord] = useState(false);
  const [roundEndCountdown, setRoundEndCountdown] = useState<number | null>(null);

  const [isRevealConfirmDialogOpen, setIsRevealConfirmDialogOpen] = useState(false);
  const [letterToRevealInfo, setLetterToRevealInfo] = useState<{ char: string; index: number } | null>(null);
  const [isPlayerListMinimized, setIsPlayerListMinimized] = useState(true); // Default to minimized
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout[]>([]);


  const addSystemMessage = useCallback(async (text: string, nameOverride?: string) => {
    if (!roomId || !playerId || !playerName) return;
    const systemGuess: Guess = {
        playerId: 'system',
        playerName: nameOverride || APP_NAME,
        text: text,
        isCorrect: false,
        timestamp: serverTimestamp() as any,
    };
    const guessesRef = ref(database, `rooms/${roomId}/guesses`);
    const currentGuessesSnap = await get(guessesRef);
    const currentGuesses = currentGuessesSnap.exists() ? currentGuessesSnap.val() : [];
    await set(guessesRef, [...currentGuesses, systemGuess]);
  }, [roomId, playerId, playerName]);


  const prepareNewGameSession = useCallback(async () => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
     if (!currentRoomSnapshot.exists()) {
        toast({ title: "Error", description: "Room data not found for preparing new game.", variant: "destructive" });
        return;
    }
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId) return;

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
        for (const pid of Object.keys(currentRoomData.players || {})) {
           await update(ref(database, `rooms/${roomId}/players/${pid}`), { score: 0 });
        }
        addSystemMessage("[[SYSTEM_GAME_RESET]]");
        toast({ title: "Game Reset", description: "Scores have been reset. Ready for a new game."});
    } catch (err) {
        console.error("Error resetting game:", err);
        toast({ title: "Error", description: "Could not reset game.", variant: "destructive" });
    }
  }, [playerId, roomId, toast, addSystemMessage]);

  const selectWordForNewRound = useCallback(async () => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) {
        toast({ title: "Error", description: "Room data not found for starting new round.", variant: "destructive" });
        return;
    }
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId ) {
        console.warn("selectWordForNewRound called by non-host or missing data. PlayerId:", playerId, "HostId:", currentRoomData?.hostId);
        return;
    }

    const onlinePlayers = Object.values(currentRoomData.players || {}).filter(p => p.isOnline && p.id);
    if (onlinePlayers.length < 1 && (currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over' || currentRoomData.gameState === 'round_end')) {
         toast({title: "Not enough players", description: "Need at least 1 online player to start/continue.", variant: "default"});
         if(currentRoomData.gameState !== 'waiting' && currentRoomData.gameState !== 'game_over'){
            await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
         }
         return;
    }

    const newRoundNumber = currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over' ? 1 : (currentRoomData.currentRoundNumber || 0) + 1;

    if (currentRoomData.config && newRoundNumber > currentRoomData.config.totalRounds) {
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
        toast({ title: "Game Over!", description: "All rounds completed. Check the final scores!" });
        return;
    }

    let newDrawer = onlinePlayers[0];
    if (onlinePlayers.length > 0) {
        const lastDrawerId = currentRoomData.currentDrawerId;
        let currentDrawerIndex = -1;
        if (lastDrawerId) {
            currentDrawerIndex = onlinePlayers.findIndex(p => p.id === lastDrawerId);
        }
        newDrawer = onlinePlayers[(currentDrawerIndex + 1) % onlinePlayers.length];
    }

     if (!newDrawer || !newDrawer.id) {
        toast({title: "No Drawer", description: "Could not find an eligible player to draw. Game may end.", variant: "destructive"});
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
        return;
    }

    let wordsForSelection: string[] = [];
    if (currentRoomData.config) {
        try {
            const suggestInput: SuggestWordsInput = {
                previouslyUsedWords: currentRoomData.usedWords || [],
                count: 3,
                maxWordLength: currentRoomData.config.maxWordLength,
            };
            const aiSuggestions = await suggestWords(suggestInput);

            if (aiSuggestions && Array.isArray(aiSuggestions) && aiSuggestions.length === 3 && aiSuggestions.every(w => typeof w === 'string' && w.trim().length > 0 && /^[a-zA-Z]+$/.test(w.trim()))) {
                wordsForSelection = aiSuggestions;
            } else {
                 console.warn("AI did not return 3 valid words, using robust fallback. Received:", aiSuggestions);
                 toast({ title: "AI Word Gen Issue", description: "Using default words as AI had an issue.", variant: "default" });

                const defaultFallbackWords = [
                    "Apple", "House", "Star", "Car", "Tree", "Book", "Sun", "Moon", "Chair", "Guitar", "Lamp", "Phone", "Key", "Door", "Clock", "Shoes", "Hat", "Banana", "Orange", "Grape", "Bread", "Cheese", "Pizza", "World", "Cloud", "Pencil", "Brush", "Plane", "Train", "Boat", "Ball", "Box", "Cup", "Fish", "Duck", "Kite", "Drum", "Cake", "Sock", "Fork", "Spoon", "Plate", "Plant", "Flower"
                ];
                const shuffledFallbackWords = [...defaultFallbackWords].sort(() => 0.5 - Math.random());
                const localUsedWords = new Set((currentRoomData.usedWords || []).map(w => w.toLowerCase()));
                for (const word of shuffledFallbackWords) {
                    if (wordsForSelection.length >= 3) break;
                    const wordLower = word.toLowerCase();
                    if (word.length <= (currentRoomData.config?.maxWordLength || 20) && !localUsedWords.has(wordLower) && !wordsForSelection.map(w=>w.toLowerCase()).includes(wordLower)) {
                        wordsForSelection.push(word);
                    }
                }
                const absoluteFallbacks = ["Ball", "Box", "Cup"];
                let abIdx = 0;
                while(wordsForSelection.length < 3) {
                    const baseWord = absoluteFallbacks[abIdx % absoluteFallbacks.length];
                    let potentialWord = baseWord;
                    let attempt = 0;
                    while(wordsForSelection.map(w=>w.toLowerCase()).includes(potentialWord.toLowerCase()) || localUsedWords.has(potentialWord.toLowerCase())) {
                        attempt++; potentialWord = baseWord + attempt; if (attempt > 5) break;
                    }
                    if (potentialWord.length <= (currentRoomData.config?.maxWordLength || 20)) {
                         wordsForSelection.push(potentialWord);
                    } else {
                        wordsForSelection.push(absoluteFallbacks[abIdx % absoluteFallbacks.length]);
                    }
                    abIdx++;
                }
                wordsForSelection = wordsForSelection.slice(0,3);
            }
        } catch (aiError) {
            console.error("AI word suggestion error:", aiError);
            toast({ title: "AI Error", description: "Failed to get words from AI. Using default words.", variant: "destructive" });
            wordsForSelection = ["Dog", "Moon", "Boat"].filter(w => w.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).map(uw => uw.toLowerCase()).includes(w.toLowerCase()));
             if (wordsForSelection.length < 3) {
                const defaults = ["Apple", "House", "Star", "Cat", "Sun", "Car"];
                for (const defWord of defaults) {
                    if (wordsForSelection.length >=3) break;
                     if (defWord.length <= (currentRoomData.config?.maxWordLength || 20) && !(currentRoomData.usedWords || []).map(uw => uw.toLowerCase()).includes(defWord.toLowerCase()) && !wordsForSelection.map(w => w.toLowerCase()).includes(defWord.toLowerCase())) {
                        wordsForSelection.push(defWord);
                    }
                }
             }
             while(wordsForSelection.length < 3 && wordsForSelection.length > 0) wordsForSelection.push(wordsForSelection[0] + "!");
             while(wordsForSelection.length < 3) wordsForSelection.push("Key");
             wordsForSelection = wordsForSelection.slice(0,3);
        }
    }

    const updates: Partial<Room> = {
        gameState: 'word_selection',
        currentDrawerId: newDrawer.id,
        currentPattern: null,
        roundEndsAt: null,
        wordSelectionEndsAt: Date.now() + 15 * 1000,
        currentRoundNumber: newRoundNumber,
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }],
        guesses: currentRoomData.guesses || [],
        correctGuessersThisRound: [],
        selectableWords: wordsForSelection,
        revealedPattern: [],
    };
    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        addSystemMessage("[[SYSTEM_DRAWER_CHANGE]]", newDrawer.name);
        toast({title: `Round ${newRoundNumber} Starting!`, description: `${newDrawer.name} is choosing a word.`});
    } catch (err) {
        console.error("Error starting new round selection:", err);
        toast({title:"Error", description: "Could not start new round.", variant: "destructive"});
    }
  }, [playerId, roomId, toast, addSystemMessage]);

  const confirmWordAndStartDrawing = useCallback(async (word: string) => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.currentDrawerId !== playerId || currentRoomData.gameState !== 'word_selection' || !currentRoomData.config) {
        return;
    }
    setIsSubmittingWord(true);

    const initialRevealedPattern = word.split('').map(char => char === ' ' ? ' ' : '_');
    const newUsedWords = Array.from(new Set([...(currentRoomData.usedWords || []).map(w => w.toLowerCase()), word.toLowerCase()]));

    const updates: Partial<Room> = {
        // gameState: 'drawing', // This is set in a separate update below
        currentPattern: word,
        roundEndsAt: Date.now() + currentRoomData.config.roundTimeoutSeconds * 1000,
        selectableWords: [],
        wordSelectionEndsAt: null,
        guesses: currentRoomData.guesses || [],
        correctGuessersThisRound: [],
        usedWords: newUsedWords,
    };
    try {
        await set(ref(database, `rooms/${roomId}/drawingData`), [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }]);
        await set(ref(database, `rooms/${roomId}/revealedPattern`), initialRevealedPattern); 
        await update(ref(database, `rooms/${roomId}`), updates);
        await update(ref(database, `rooms/${roomId}`), { gameState: 'drawing' }); // Separate update for gameState

        toast({title: "Drawing Started!", description: `The word has been chosen. Time to draw!`});
    } catch(err) {
        console.error("Error starting drawing phase:", err);
        toast({title: "Error", description: "Could not start drawing phase.", variant: "destructive"});
    } finally {
        setIsSubmittingWord(false);
    }
  }, [playerId, roomId, toast]);


  const endCurrentRound = useCallback(async (reason: string = "Round ended.") => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (currentRoomData.gameState !== 'drawing' || !playerId ) {
       return;
    }

    if (currentRoomData.hostId === playerId && currentRoomData.gameState === 'drawing') {
        try {
            await update(ref(database, `rooms/${roomId}`), {
                gameState: 'round_end',
                wordSelectionEndsAt: null,
                roundEndsAt: null
            });
            addSystemMessage(`[[SYSTEM_ROUND_END_WORD]]`, currentRoomData.currentPattern || "N/A");
            toast({ title: "Round Over!", description: `${reason} The word was: ${currentRoomData.currentPattern || "N/A"}`});
        } catch (err) {
            console.error("Error ending round:", err);
            toast({ title: "Error", description: "Failed to end round.", variant: "destructive"});
        }
    }
  }, [playerId, roomId, toast, addSystemMessage]);

  const handleGuessSubmit = useCallback(async (guessText: string) => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoom: Room = currentRoomSnapshot.val();

    if (!currentRoom || !playerId || !playerName || currentRoom.currentDrawerId === playerId || currentRoom.gameState !== 'drawing' || !currentRoom.currentPattern) {
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
      timestamp: serverTimestamp() as any
    };

    const guessesRef = ref(database, `rooms/${roomId}/guesses`);
    const currentGuesses = currentRoom.guesses || [];
    const newGuesses = [...currentGuesses, newGuess];

    const updates: Partial<Room> = { guesses: newGuesses };
    let newCorrectGuessers = [...(currentRoom.correctGuessersThisRound || [])];

    if (isCorrect) {
        const playerRef = ref(database, `rooms/${roomId}/players/${playerId}`);
        const drawerRef = ref(database, `rooms/${roomId}/players/${currentRoom.currentDrawerId!}`);
        let pointsAwardedToGuesser = 0;

        if (isFirstCorrectGlobal) {
            pointsAwardedToGuesser = 10;
        } else {
            pointsAwardedToGuesser = 5;
        }

        const currentPlayerData = currentRoom.players[playerId];
        if (currentPlayerData) {
             await update(playerRef, { score: (currentPlayerData.score || 0) + pointsAwardedToGuesser });
        }

        const drawerData = currentRoom.players[currentRoom.currentDrawerId!];
        if (drawerData) {
            await update(drawerRef, { score: (drawerData.score || 0) + 3 });
        }

        newCorrectGuessers.push(playerId);
        updates.correctGuessersThisRound = newCorrectGuessers;
    }

    await update(ref(database, `rooms/${roomId}`), updates);

    // Check if all non-drawing online players have guessed
    const updatedRoomSnapForEndRound = await get(ref(database, `rooms/${roomId}`));
    if (!updatedRoomSnapForEndRound.exists()) return;
    const updatedRoomDataForEndRound: Room = updatedRoomSnapForEndRound.val();

    const onlineNonDrawingPlayers = Object.values(updatedRoomDataForEndRound.players || {}).filter(p => p.isOnline && p.id !== updatedRoomDataForEndRound.currentDrawerId);
    const allGuessed = onlineNonDrawingPlayers.length > 0 && onlineNonDrawingPlayers.every(p => (updatedRoomDataForEndRound.correctGuessersThisRound || []).includes(p.id));

    if (updatedRoomDataForEndRound.hostId === playerId && updatedRoomDataForEndRound.gameState === 'drawing') {
      if(allGuessed){
        endCurrentRound("All players guessed correctly!");
      }
    }
  }, [playerId, playerName, roomId, toast, endCurrentRound]);


  const manageGameStart = useCallback(async () => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId) return;

    if (currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over') {
        if (currentRoomData.gameState === 'game_over') {
            await prepareNewGameSession();
        }
        await selectWordForNewRound();
    }
  }, [playerId, roomId, prepareNewGameSession, selectWordForNewRound]);

  const handleDrawerLetterClick = useCallback((char: string, index: number) => {
    if (!room || !room.currentPattern || !room.revealedPattern || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    
    const currentRevealedPattern = (room.revealedPattern && room.revealedPattern.length === room.currentPattern.length)
                                 ? room.revealedPattern
                                 : room.currentPattern.split('').map(c => c === ' ' ? ' ' : '_');

    if (char === ' ' || (currentRevealedPattern[index] && currentRevealedPattern[index] !== '_')) {
      return; 
    }
    setLetterToRevealInfo({ char: room.currentPattern[index], index });
    setIsRevealConfirmDialogOpen(true);
  }, [room, playerId]);

  const handleConfirmLetterRevealByDrawer = useCallback(async () => {
    if (!room || !letterToRevealInfo || !room.currentPattern || room.currentDrawerId !== playerId) return;

    const revealedPatternRef = ref(database, `rooms/${roomId}/revealedPattern`);
    const patternChars = room.currentPattern.split('');
    const initialUnderscorePatternForTransaction = patternChars.map(c => (c === ' ' ? ' ' : '_'));
    
    try {
        await runTransaction(revealedPatternRef, (currentFirebaseRevealedPattern) => {
            let basePattern: string[];
            if (currentFirebaseRevealedPattern && 
                Array.isArray(currentFirebaseRevealedPattern) && 
                currentFirebaseRevealedPattern.length === patternChars.length) {
                basePattern = [...currentFirebaseRevealedPattern];
            } else {
                basePattern = [...initialUnderscorePatternForTransaction];
            }
            
            if(letterToRevealInfo && basePattern[letterToRevealInfo.index] === '_') { 
                basePattern[letterToRevealInfo.index] = patternChars[letterToRevealInfo.index];
            }
            return basePattern;
        });

      toast({ title: "Hint Revealed!", description: `Letter "${room.currentPattern[letterToRevealInfo.index]}" is now visible to guessers.` });
    } catch (error) {
      console.error("Error revealing hint:", error);
      toast({ title: "Error", description: "Could not reveal hint.", variant: "destructive" });
    } finally {
      setIsRevealConfirmDialogOpen(false);
      setLetterToRevealInfo(null);
    }
  }, [room, letterToRevealInfo, playerId, roomId, toast]);

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

  const handleLeaveRoom = useCallback(async () => {
    if (playerId && room) {
      const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
      try {
        addSystemMessage(`[[SYSTEM_LEFT]]`, playerName || "A player");
        await update(playerRef, { isOnline: false });
        setIsSettingsDialogOpen(false); 
        toast({ title: "Left Room", description: "You have left the room." });
        router.push('/');
      } catch (err) {
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
         router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [playerId, room, playerName, router, toast, addSystemMessage]);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Link Copied!", description: "Room link copied to clipboard." }))
      .catch(() => toast({ title: "Error", description: "Could not copy link.", variant: "destructive" }));
  }, [roomId, toast]);

  const handleDraw = useCallback((point: DrawingPoint) => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    const newDrawingData = [...(room.drawingData || []), point];
    set(ref(database, `rooms/${roomId}/drawingData`), newDrawingData);
  }, [room, playerId, roomId]);

  const handleClearCanvas = useCallback(() => {
    if (!room || !playerId || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;
    const clearPoint: DrawingPoint = { type: 'clear', x:0, y:0, color:'', lineWidth:0 };
    set(ref(database, `rooms/${roomId}/drawingData`), [clearPoint]);
  },[room, playerId, roomId]);


  // Moved useMemo calls before early returns to fix hook order issue
  const playersArray = useMemo(() => {
    return room ? Object.values(room.players || {}) : [];
  }, [room?.players]); 

  const memoizedDrawingData = useMemo(() => {
      return room ? (room.drawingData || []) : [];
  }, [room?.drawingData]);

  const memoizedGuesses = useMemo(() => {
      return room ? (room.guesses || []) : [];
  }, [room?.guesses]);


  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomRefVal = ref(database, `rooms/${roomId}`);
    const playerStatusRef = ref(database, `rooms/${roomId}/players/${playerId}/isOnline`);
    const playerConnectionsRef = ref(database, '.info/connected');

    const onRoomValueChange = onValue(roomRefVal, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val() as Room;

        if (!roomData.drawingData) roomData.drawingData = [];
        if (!roomData.guesses) roomData.guesses = [];
        if (!roomData.players) roomData.players = {};
        if (!roomData.correctGuessersThisRound) roomData.correctGuessersThisRound = [];
        if (!roomData.usedWords) roomData.usedWords = [];
        if (!roomData.selectableWords) roomData.selectableWords = [];
        if (!roomData.config) {
            roomData.config = { roundTimeoutSeconds: 90, totalRounds: 5, maxWordLength: 20 };
        }
        if (roomData.revealedPattern === undefined) {
             roomData.revealedPattern = [];
        }

        setRoom(roomData);
        setError(null);
      } else {
        setError("Room not found or has been deleted.");
        setRoom(null);
        if (!isLoading) {
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

    const onConnectedChange = onValue(playerConnectionsRef, (snap) => {
      if (snap.val() === true && playerId && roomId) {
        const playerRefForOnline = ref(database, `rooms/${roomId}/players/${playerId}`);
        get(playerRefForOnline).then(playerSnap => {
            if (playerSnap.exists()) {
                 set(playerStatusRef, true);
                 onDisconnect(playerStatusRef).set(false).catch(err => console.error("onDisconnect error for player status", err));

                 const currentPlayerData = playerSnap.val();
                 if (!currentPlayerData.isOnline) { 
                     addSystemMessage(`[[SYSTEM_JOINED]]`, playerName || "A player");
                 }
            }
        });
      }
    });

    if (playerId && roomId) {
        get(child(ref(database, `rooms/${roomId}`), `players/${playerId}`)).then(playerSnap => {
          if (playerSnap.exists()) {
            update(child(ref(database, `rooms/${roomId}`), `players/${playerId}`), { isOnline: true });
          }
        });
    }

    return () => {
      off(roomRefVal, 'value', onRoomValueChange);
      off(playerConnectionsRef, 'value', onConnectedChange);
      hintTimerRef.current.forEach(clearTimeout); 
      hintTimerRef.current = [];
    };
  }, [roomId, playerId, router, toast, isLoading, addSystemMessage, playerName]);


  useEffect(() => { 
    if (room?.gameState === 'drawing' && room?.hostId === playerId && room?.roundEndsAt) {
      let roundTimer: NodeJS.Timeout | null = null;

      const onlineNonDrawingPlayers = Object.values(room.players || {}).filter(p => p.isOnline && p.id !== room.currentDrawerId);
      const allGuessed = onlineNonDrawingPlayers.length > 0 && onlineNonDrawingPlayers.every(p => (room.correctGuessersThisRound || []).includes(p.id));

      if (allGuessed) {
        setTimeout(() => {
            get(ref(database, `rooms/${roomId}`)).then(snap => {
                if (snap.exists()) {
                    const currentRoomDataCheck = snap.val() as Room;
                    if (currentRoomDataCheck.gameState === 'drawing' && currentRoomDataCheck.hostId === playerId) { 
                        const currentOnlineNonDrawingCheck = Object.values(currentRoomDataCheck.players || {}).filter(p => p.isOnline && p.id !== currentRoomDataCheck.currentDrawerId);
                        const currentAllGuessedCheck = currentOnlineNonDrawingCheck.length > 0 && currentOnlineNonDrawingCheck.every(p => (currentRoomDataCheck.correctGuessersThisRound || []).includes(p.id));
                        if(currentAllGuessedCheck) endCurrentRound("All players guessed correctly!");
                    }
                }
            });
        }, 500);
      } else {
        const now = Date.now();
        const timeLeftMs = room.roundEndsAt - now;
        if (timeLeftMs <= 0) {
          get(ref(database, `rooms/${roomId}/gameState`)).then(snap => {
            if (snap.exists() && snap.val() === 'drawing') {
               endCurrentRound("Timer ran out!");
            }
          });
        } else {
          roundTimer = setTimeout(() => {
            get(ref(database, `rooms/${roomId}`)).then(snap => {
              if (snap.exists()) {
                const currentRoomData = snap.val() as Room;
                if (currentRoomData.gameState === 'drawing' &&
                    currentRoomData.hostId === playerId &&
                    currentRoomData.roundEndsAt &&
                    Date.now() >= currentRoomData.roundEndsAt) {
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


  useEffect(() => { 
    if (room?.gameState === 'round_end' && playerId === room?.hostId) {
        const NEXT_ROUND_DELAY_SECONDS = 5;
        setRoundEndCountdown(NEXT_ROUND_DELAY_SECONDS);

        const countdownInterval = setInterval(() => {
            setRoundEndCountdown(prev => (prev ? prev - 1 : null));
        }, 1000);

        const nextRoundTimer = setTimeout(async () => {
            clearInterval(countdownInterval);
            setRoundEndCountdown(null);

            const currentRoomStateSnap = await get(ref(database, `rooms/${roomId}/gameState`));
            if (currentRoomStateSnap.exists() && currentRoomStateSnap.val() === 'round_end') {
                const playersSnap = await get(ref(database, `rooms/${roomId}/players`));
                if (playersSnap.exists()) {
                    const playersData = playersSnap.val();
                    const onlinePlayersCount = Object.values(playersData || {}).filter((p: any) => p.isOnline).length;
                    if (onlinePlayersCount > 0) {
                        selectWordForNewRound();
                    } else {
                        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
                        toast({title: "No Active Players", description: "Game ended as no players are online.", variant: "default"});
                    }
                } else {
                    await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over' });
                    toast({title: "Game Error", description: "Cannot proceed, player data missing.", variant: "destructive"});
                }
            }
        }, NEXT_ROUND_DELAY_SECONDS * 1000);

        return () => {
            clearTimeout(nextRoundTimer);
            clearInterval(countdownInterval);
            setRoundEndCountdown(null);
        };
    } else if (room?.gameState !== 'round_end') {
        setRoundEndCountdown(null);
    }
  }, [room?.gameState, room?.hostId, playerId, selectWordForNewRound, roomId, toast]);


  useEffect(() => { 
    if (room?.gameState === 'word_selection' && room?.hostId === playerId && room?.wordSelectionEndsAt && !room?.currentPattern) {
      const now = Date.now();
      const timeLeftMs = room.wordSelectionEndsAt - now;
      let timer: NodeJS.Timeout | null = null;

      if (timeLeftMs <= 0) {
        get(ref(database, `rooms/${roomId}`)).then(snap => {
             if (snap.exists()) {
                 const latestRoomData = snap.val() as Room;
                 if (latestRoomData.gameState === 'word_selection' &&
                     latestRoomData.hostId === playerId &&
                     !latestRoomData.currentPattern && 
                     latestRoomData.wordSelectionEndsAt && Date.now() >= latestRoomData.wordSelectionEndsAt) {

                    const drawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                    toast({
                        title: "Word Selection Timed Out",
                        description: `${drawerName} didn't choose a word. Moving to the next player...`,
                        variant: "default"
                    });
                    addSystemMessage(`${drawerName} didn't choose. Next player!`);
                    selectWordForNewRound(); 
                 }
             }
          });
      } else {
        timer = setTimeout(() => {
           get(ref(database, `rooms/${roomId}`)).then(snap => {
             if (snap.exists()) {
                 const latestRoomData = snap.val() as Room;
                 if (latestRoomData.gameState === 'word_selection' &&
                     latestRoomData.hostId === playerId &&
                     !latestRoomData.currentPattern && 
                     latestRoomData.wordSelectionEndsAt &&
                     Date.now() >= latestRoomData.wordSelectionEndsAt) {

                    const currentDrawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                    toast({
                        title: "Word Selection Timed Out",
                        description: `${currentDrawerName} didn't choose a word. Moving to the next player...`,
                        variant: "default"
                    });
                    addSystemMessage(`${currentDrawerName} didn't choose. Next player!`);
                    selectWordForNewRound(); 
                 }
             }
          });
        }, timeLeftMs);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [room?.gameState, room?.hostId, playerId, room?.wordSelectionEndsAt, room?.currentPattern, room?.currentDrawerId, room?.players, selectWordForNewRound, toast, roomId, addSystemMessage]);


  useEffect(() => {
      hintTimerRef.current.forEach(clearTimeout);
      hintTimerRef.current = [];

      if (room?.gameState === 'drawing' && room.currentDrawerId === playerId && room.currentPattern && room.config) {
          const currentPatternStr = room.currentPattern;
          const patternChars = currentPatternStr.split('');
          const initialUnderscorePatternForTransaction = patternChars.map(c => (c === ' ' ? ' ' : '_'));
          const currentPatternNonSpaceLength = currentPatternStr.replace(/\s/g, '').length;
          
          const hostConfiguredMaxHints = room.config.roundTimeoutSeconds > 0 ? (room.config.maxWordLength > 0 ? room.config.maxWordLength : 2) : 2; // This was a placeholder, should be using a proper config from Room type for maxHintLetters

          const finalHintCount = Math.min(hostConfiguredMaxHints, Math.max(0, currentPatternNonSpaceLength - 1));

          if (finalHintCount > 0) {
              const roundDurationMs = room.config.roundTimeoutSeconds * 1000;
              const startRevealTimeMs = roundDurationMs / 2;
              const timeWindowForHintsMs = roundDurationMs - startRevealTimeMs;
              const delayBetweenHintsMs = finalHintCount > 0 ? timeWindowForHintsMs / finalHintCount : 0;

              const availableIndices = patternChars
                  .map((char, index) => (char !== ' ' ? index : -1))
                  .filter(index => index !== -1);
              
              const indicesToRevealThisRound: number[] = [];
              while (indicesToRevealThisRound.length < finalHintCount && availableIndices.length > 0) {
                  const randomIndex = Math.floor(Math.random() * availableIndices.length);
                  indicesToRevealThisRound.push(availableIndices.splice(randomIndex, 1)[0]);
              }

              indicesToRevealThisRound.forEach((targetCharIndex, hintIteration) => {
                  const currentHintRevealTimeMs = startRevealTimeMs + (hintIteration * delayBetweenHintsMs);
                  const timerId = setTimeout(async () => {
                      const latestRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
                      if (!latestRoomSnapshot.exists()) return;
                      const latestRoomData: Room = latestRoomSnapshot.val();

                      if (latestRoomData.gameState === 'drawing' && 
                          latestRoomData.currentPattern === currentPatternStr &&
                          latestRoomData.currentDrawerId === playerId) {
                          
                          const revealedPatternRef = ref(database, `rooms/${roomId}/revealedPattern`);
                          try {
                            await runTransaction(revealedPatternRef, (currentFirebaseRevealedPattern) => {
                                let basePattern;
                                if (currentFirebaseRevealedPattern && 
                                    Array.isArray(currentFirebaseRevealedPattern) && 
                                    currentFirebaseRevealedPattern.length === patternChars.length) {
                                    basePattern = [...currentFirebaseRevealedPattern];
                                } else {
                                    basePattern = [...initialUnderscorePatternForTransaction];
                                }
                                
                                if (basePattern[targetCharIndex] === '_') {
                                    basePattern[targetCharIndex] = patternChars[targetCharIndex];
                                }
                                return basePattern;
                            });
                          } catch (transactionError) {
                              console.error("Transaction to reveal hint failed:", transactionError);
                          }
                      }
                  }, currentHintRevealTimeMs);
                  hintTimerRef.current.push(timerId);
              });
          }
      }
      return () => {
          hintTimerRef.current.forEach(clearTimeout);
          hintTimerRef.current = [];
      };
  }, [room?.gameState, room?.currentDrawerId, playerId, room?.currentPattern, room?.config, roomId, toast]);


  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-xl text-foreground">Loading Room...</span></div>;
  if (error) return <div className="text-center text-destructive p-8 bg-destructive/10 border border-destructive/20 rounded-md h-screen flex flex-col justify-center items-center"><AlertCircle className="mx-auto h-12 w-12 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Error Loading Room</h2><p>{error}</p><Button onClick={() => router.push('/')} className="mt-4">Go Home</Button></div>;
  if (!room || !playerId || !playerName || !room.config) return <div className="text-center p-8 h-screen flex flex-col justify-center items-center">Room data is not available or incomplete. <Link href="/" className="text-primary hover:underline">Go Home</Link></div>;

  const isHost = room.hostId === playerId;
  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const canGuess = room.gameState === 'drawing' && !isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId);
  const currentDrawerName = room.currentDrawerId && room.players[room.currentDrawerId] ? room.players[room.currentDrawerId].name : "Someone";
  const hasPlayerGuessedCorrectly = (room.correctGuessersThisRound || []).includes(playerId);

  const getStartButtonInfo = () => {
    if (!room) return null;
    if (room.gameState === 'waiting') return { text: 'Start Game', icon: <Play size={16} className="mr-1 sm:mr-2"/> };
    if (room.gameState === 'game_over') return { text: 'Play Again', icon: <RotateCcw size={16} className="mr-1 sm:mr-2"/> };
    return null;
  };
  const startButtonInfo = getStartButtonInfo();


  return (
    <>
    <div className="max-w-md mx-auto border border-black flex flex-col select-none" style={{ height: '100vh', maxHeight: '900px', minHeight: '700px' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-blue-900 px-1 py-0.5" style={{ borderWidth: "2px"}}>
            <div className="flex flex-col items-center justify-center p-1 w-16 relative">
                <TimerDisplay
                    targetTime={room.gameState === 'drawing' ? room.roundEndsAt : (room.gameState === 'word_selection' ? room.wordSelectionEndsAt : null)}
                    defaultSeconds={room.gameState === 'drawing' ? room.config.roundTimeoutSeconds : (room.gameState === 'word_selection' ? 15 : 0)}
                    compact={true}
                />
                { (room.gameState === 'drawing' || room.gameState === 'word_selection' || room.gameState === 'round_end') &&
                    <div className="text-[9px] font-bold leading-none mt-0.5 text-gray-700">
                    Round <span className="font-normal">{room.currentRoundNumber || 0}/{room.config.totalRounds || 'N/A'}</span>
                    </div>
                }
                 {isHost && startButtonInfo && (room.gameState === 'waiting' || room.gameState === 'game_over') && (
                    <Button
                        onClick={manageGameStart}
                        size="icon"
                        variant="outline"
                        className="mt-1 w-8 h-8 text-primary hover:bg-primary/10"
                        aria-label={startButtonInfo.text}
                        disabled={(room.gameState === 'waiting' || room.gameState === 'game_over') && Object.values(room.players).filter(p=>p.isOnline).length < 1}
                    >
                        {startButtonInfo.icon}
                    </Button>
                 )}
            </div>

            <div className="flex flex-col items-center justify-center py-1 text-center">
                <div className={cn(
                    "text-[11px] font-semibold tracking-wide",
                    isCurrentPlayerDrawing ? "text-accent" : (hasPlayerGuessedCorrectly ? "text-green-600" : "text-muted-foreground")
                 )}>
                    {isCurrentPlayerDrawing 
                        ? "DRAW THIS" 
                        : hasPlayerGuessedCorrectly
                        ? "YOU GUESSED IT!"
                        : "GUESS THIS"}
                     {!isCurrentPlayerDrawing && !hasPlayerGuessedCorrectly && room.currentPattern && room.gameState === 'drawing' && (
                         <span className="ml-1 text-muted-foreground">({room.currentPattern.replace(/\s/g, '').length} letters)</span>
                     )}
                </div>
                <WordDisplay
                  gameState={room.gameState}
                  currentPattern={room.currentPattern}
                  revealedPattern={room.revealedPattern}
                  isCurrentPlayerDrawing={isCurrentPlayerDrawing}
                  hasPlayerGuessedCorrectly={hasPlayerGuessedCorrectly}
                  onLetterClick={handleDrawerLetterClick}
                />
                 {isCurrentPlayerDrawing && room.gameState === 'drawing' && (
                     <div className="text-[9px] text-blue-600 mt-0.5">(Click letters to reveal hints)</div>
                 )}
            </div>

            <div className="w-16 flex justify-end items-center gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 hover:bg-gray-200" onClick={handleCopyLink} aria-label="Copy room link"><Share2 size={18} /></Button>
                <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 hover:bg-gray-200" aria-label="Room Settings"><Settings size={18} /></Button>
                    </DialogTrigger>
                    <SettingsDialogContent onCopyLink={handleCopyLink} onLeaveRoom={handleLeaveRoom} />
                </Dialog>
            </div>
        </div>

        <div className="relative border border-black m-1 rounded" style={{ height: '40vh', minHeight: '220px' }}>
             <DrawingCanvas
                drawingData={memoizedDrawingData}
                onDraw={handleDraw}
                currentDrawerId={room.currentDrawerId}
                playerId={playerId}
                isDrawingEnabled={isCurrentPlayerDrawing && room.gameState === 'drawing'}
                clearCanvas={handleClearCanvas}
                currentDrawerName={currentDrawerName}
                gameState={room.gameState}
            />
        </div>

        <div className="flex-grow flex flex-row gap-1 min-h-0 w-full" style={{ height: 'calc(100% - 40vh - 2px - 42px - 52px)'}}> {/* Adjusted height calculation */}
            <div className="w-1/2 h-full">
                <PlayerList
                    players={playersArray}
                    currentPlayerId={room.currentDrawerId}
                    playerId={playerId}
                    hostId={room.hostId}
                    correctGuessersThisRound={room.correctGuessersThisRound || []}
                    isMinimized={isPlayerListMinimized}
                    setIsMinimized={setIsPlayerListMinimized}
                />
            </div>
            <div className="w-1/2 h-full">
                <ChatArea
                    guesses={memoizedGuesses}
                    gameState={room.gameState}
                    playerId={playerId}
                />
            </div>
        </div>
        
        {/* Sticky Guess Input Bar */}
        <div className="p-1 border-t border-black bg-background w-full flex-shrink-0 sticky bottom-0 z-20">
            <GuessInput onGuessSubmit={handleGuessSubmit} disabled={!canGuess} />
        </div>
    </div>

    {room.gameState === 'word_selection' && isCurrentPlayerDrawing && (
        <WordSelectionDialog
            isOpen={true}
            maxWordLength={room.config.maxWordLength}
            selectableWords={room.selectableWords || []}
            onConfirmWord={confirmWordAndStartDrawing}
            isSubmittingWord={isSubmittingWord}
            wordSelectionEndsAt={room.wordSelectionEndsAt}
        />
    )}

    {(room.gameState === 'round_end' || room.gameState === 'game_over') && (
        <GameStateModals
            gameState={room.gameState}
            currentPattern={room.currentPattern}
            currentDrawerName={currentDrawerName}
            guesses={memoizedGuesses}
            roundEndCountdown={roundEndCountdown}
            players={playersArray}
            isHost={isHost}
            onPlayAgain={manageGameStart}
            canPlayAgain={Object.values(room.players).filter(p=>p.isOnline).length >= 1}
        />
    )}

    <AlertDialog open={isRevealConfirmDialogOpen} onOpenChange={(open) => {
        setIsRevealConfirmDialogOpen(open);
        if (!open) setLetterToRevealInfo(null);
    }}>
        <RevealConfirmDialogContent
            letterChar={letterToRevealInfo?.char}
            onCancel={() => {
                setIsRevealConfirmDialogOpen(false);
                setLetterToRevealInfo(null);
            }}
            onConfirm={handleConfirmLetterRevealByDrawer}
        />
    </AlertDialog>
    </>
  );
}

