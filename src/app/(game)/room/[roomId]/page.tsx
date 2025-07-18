
"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter as useNextRouter } from 'next/navigation';
import { ref, onValue, off, update, serverTimestamp, set, child, get, runTransaction, push, onDisconnect } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { Room, Player, DrawingPoint, Guess, RoomConfig, UserProfile, Transaction, PlatformSettings } from '@/lib/types';
import { useToast as useShadToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, Copy, LogOut, Send, Palette, Eraser, Users, Clock, Loader2, Share2, CheckCircle, Trophy, Play, SkipForward, RotateCcw, Lightbulb, Edit3, ChevronUp, ChevronDown, Brush, Settings, Sparkles, X, Gift, Link2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { APP_NAME, REFERRAL_REWARD_BASE_RATE, MIN_PLAYERS_FOR_REWARD, MIN_ROUNDS_FOR_REWARD, MAX_REWARD_PER_GAME } from '@/lib/config';
import { suggestWords, type SuggestWordsInput, type SuggestWordsOutput } from '@/ai/flows/suggest-words-flow';
import { generateAISketch, type GenerateAISketchInput, type GenerateAISketchOutput } from '@/ai/flows/generate-ai-sketch-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { calculateTurnScores } from '@/lib/scoring';


const MIN_PLAYERS_TO_START_GAME = 2;


const WordSelectionDialog = dynamic(() => import('@/components/game/WordSelectionDialog').then(mod => mod.WordSelectionDialog), {
  loading: () => <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
  ssr: false
});

const GameStateModals = dynamic(() => import('@/components/game/GameStateModals').then(mod => mod.GameStateModals), {
  ssr: false
});

const SettingsDialogContent = dynamic(() => import('@/components/game/SettingsDialogContent').then(mod => mod.SettingsDialogContent), {
  ssr: false
});

const RevealConfirmDialogContent = dynamic(() => import('@/components/game/RevealConfirmDialogContent').then(mod => mod.RevealConfirmDialogContent), {
  ssr: false
});


const DrawingCanvas = React.memo(({
  drawingData,
  onDraw,
  currentDrawerId,
  playerId,
  isDrawingEnabled,
  clearCanvas,
  currentDrawerName,
  gameState,
  isHost,
  onStartGame,
  startButtonInfo,
  canStartGame,
  isStartingNextRoundOrGame,
  aiSketchDataUri,
  onDrawWithAI,
  isGeneratingAISketch,
}: {
  drawingData: DrawingPoint[],
  onDraw: (point: DrawingPoint) => void,
  currentDrawerId?: string | null,
  playerId: string,
  isDrawingEnabled: boolean,
  clearCanvas: () => void,
  currentDrawerName?: string | null,
  gameState: Room['gameState'] | undefined,
  isHost?: boolean,
  onStartGame?: () => void,
  startButtonInfo?: { text: string; icon: JSX.Element } | null,
  canStartGame?: boolean,
  isStartingNextRoundOrGame?: boolean,
  aiSketchDataUri?: string | null;
  onDrawWithAI?: () => void;
  isGeneratingAISketch?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [isToolbarMinimized, setIsToolbarMinimized] = useState(true);
  const isMobile = useIsMobile();
  const aiBaseImageRef = useRef<HTMLImageElement | null>(null);


  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);

  const colors = ["#000000", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#d946ef", "#06b6d4", "#ffffff", "#a076f2", "#f276bb"];

  const redrawFullCanvas = useCallback(() => {
    const currentCtx = contextRef.current;
    const currentCanvas = canvasRef.current;
    if (!currentCtx || !currentCanvas) return;

    currentCtx.clearRect(0, 0, currentCanvas.offsetWidth, currentCanvas.offsetHeight);

    if (aiBaseImageRef.current && aiBaseImageRef.current.complete) {
        try {
            currentCtx.drawImage(aiBaseImageRef.current, 0, 0, currentCanvas.offsetWidth, currentCanvas.offsetHeight);
        } catch (e) {
            console.error("Error drawing AI base image:", e);
            aiBaseImageRef.current = null;
        }
    }

    let pathActive = false;
    let lastPointForPath: DrawingPoint | null = null;

    drawingData.forEach(point => {
        if (!currentCtx || !currentCanvas) return;
        const xPx = point.x * currentCanvas.offsetWidth;
        const yPx = point.y * currentCanvas.offsetHeight;

        if (point.type === 'clear') {
            if (pathActive) currentCtx.stroke();
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
  }, [drawingData]);

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

    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [redrawFullCanvas]);

  useEffect(() => {
    if (aiSketchDataUri) {
        const img = new Image();
        img.onload = () => {
            aiBaseImageRef.current = img;
            redrawFullCanvas();
        };
        img.onerror = () => {
            console.error("Failed to load AI sketch image.");
            aiBaseImageRef.current = null;
            redrawFullCanvas();
        };
        img.src = aiSketchDataUri;
    } else {
        if (aiBaseImageRef.current) {
            aiBaseImageRef.current = null;
            redrawFullCanvas();
        }
    }
  }, [aiSketchDataUri, redrawFullCanvas]);

  useEffect(() => {
      redrawFullCanvas();
  }, [drawingData, redrawFullCanvas]);


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
    clearCanvas();
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 border border-border/30 overflow-hidden relative rounded-sm">
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
                    {onDrawWithAI && (
                        <Button variant="outline" size="sm" onClick={onDrawWithAI} disabled={isGeneratingAISketch} className="h-7 px-2 text-xs" title="Draw with AI">
                            {isGeneratingAISketch ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                            AI Sketch
                        </Button>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-grow p-0 bg-white relative min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none relative z-0"
          onMouseDown={startPaint}
          onMouseMove={paint}
          onMouseUp={exitPaint}
          onMouseLeave={exitPaint}
          onTouchStart={startPaint}
          onTouchMove={paint}
          onTouchEnd={exitPaint}
        />
        {(gameState === 'waiting' || gameState === 'game_over') && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            {isHost && startButtonInfo && onStartGame && (
              <Button
                onClick={onStartGame}
                size="lg"
                variant="secondary"
                className="shadow-xl animate-pulse"
                disabled={!canStartGame || isStartingNextRoundOrGame}
                title={!canStartGame ? `Need at least ${MIN_PLAYERS_TO_START_GAME} online players to start.` : startButtonInfo.text}
              >
                {isStartingNextRoundOrGame ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <>
                        {startButtonInfo.icon}
                        <span className="ml-2">{startButtonInfo.text}</span>
                    </>
                )}
              </Button>
            )}
            {!isHost && (gameState === 'waiting' || gameState === 'game_over') && (
                 <p className="text-white text-lg font-semibold bg-black/50 p-3 rounded-md">Waiting for the host to start the game...</p>
            )}
          </div>
        )}
        {!isDrawingEnabled && currentDrawerId !== playerId && gameState === 'drawing' && <p className="absolute top-1 left-1 text-xs bg-primary/20 text-primary-foreground p-0.5 rounded-sm z-10">You are guessing!</p>}
        {isDrawingEnabled && currentDrawerId === playerId && gameState === 'drawing' && <p className="absolute top-1 left-1 text-xs bg-accent/20 text-accent-foreground p-0.5 rounded-sm z-10">Your turn to draw!</p>}
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
    referralProgramEnabled,
}: {
    players: Player[],
    currentPlayerId?: string | null,
    playerId: string,
    hostId?: string,
    correctGuessersThisRound: string[],
    isMinimized: boolean,
    setIsMinimized: (isMinimized: boolean) => void,
    referralProgramEnabled?: boolean;
}) => {
    const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score || 0) - (a.score || 0)), [players]);

    return (
    <div className="flex flex-col h-full w-full bg-gray-50 border border-gray-300 rounded-sm">
        <div className="p-1.5 border-b border-black flex items-center justify-between bg-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700">Players ({players.length})</h3>
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}
            </Button>
        </div>
        <div className={cn(
            "transition-all duration-300 ease-in-out flex-grow min-h-0",
            isMinimized ? "max-h-0 opacity-0" : "max-h-full opacity-100"
        )}>
             <ScrollArea className="h-full">
                <ul className="divide-y divide-gray-200 px-2 py-1.5 sm:px-3 sm:py-2">
                    {sortedPlayers.map((player, index) => (
                    <li
                        key={player.id}
                        className={cn(
                            "flex items-center justify-between p-1.5 sm:p-2",
                            correctGuessersThisRound.includes(player.id) && player.id !== currentPlayerId ? "bg-green-100" : "bg-white",
                            player.id === playerId ? "border-l-2 border-blue-500" : ""
                        )}
                    >
                        <div className="w-6 sm:w-8 font-bold text-xs sm:text-sm text-gray-700">#{index + 1}</div>
                        <div className="flex-1 text-center text-xs">
                        <span className={cn("font-bold", player.id === playerId ? "text-blue-600" : "text-gray-800", !player.isOnline ? "line-through text-gray-400" : "")}>
                            {(player.name || 'Player')} {player.id === playerId ? "(You)" : ""} {player.id === hostId ? <span className="text-xs">(Host)</span> : ""} {!player.isOnline && <span className="text-red-500 text-xs">(Offline)</span>}
                        </span>
                        <br />
                        <span className="font-normal text-gray-600">{player.score || 0} points</span>
                        {referralProgramEnabled && (player.referralRewardsThisSession || 0) > 0 && (
                           <div className="text-xs text-yellow-600 flex items-center justify-center gap-1">
                               <Gift size={12} /> +{(player.referralRewardsThisSession || 0).toFixed(2)} bonus
                           </div>
                        )}
                        </div>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                            {player.id === currentPlayerId ? (
                                <Brush className="text-blue-500 animate-pulse h-5 w-5" title="Drawing" />
                            ) : (
                                <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                                    <AvatarImage src={`https://placehold.co/32x32.png?text=${(player.name || 'P').substring(0,1)}`} data-ai-hint="profile avatar"/>
                                    <AvatarFallback>{(player.name || 'Pl').substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    </li>
                    ))}
                </ul>
            </ScrollArea>
        </div>
    </div>
    );
});
PlayerList.displayName = 'PlayerList';

const GuessInput = React.memo(({ onGuessSubmit, disabled, isSubmittingGuess }: { onGuessSubmit: (guess: string) => void, disabled: boolean, isSubmittingGuess?: boolean }) => {
  const [guess, setGuess] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guess.trim() && !isSubmittingGuess) {
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
        placeholder="Type your guess or message..."
        disabled={disabled || isSubmittingGuess}
        className="w-full text-center text-gray-600 text-base font-normal outline-none border-gray-300 focus:border-blue-500 h-10 px-3 pr-10"
      />
      <span className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
        {letterCount > 0 ? letterCount : ''}
      </span>
      <Button type="submit" disabled={disabled || !guess.trim() || isSubmittingGuess} size="icon" className="h-10 w-10 bg-blue-500 hover:bg-blue-600">
        {isSubmittingGuess ? <Loader2 size={18} className="text-white animate-spin"/> : <Send size={18} className="text-white" />}
      </Button>
    </form>
  );
});
GuessInput.displayName = 'GuessInput';

const ChatArea = React.memo(({
    guesses,
    gameState,
    playerId,
    currentDrawerId,
    correctGuessersThisRound,
    referralProgramEnabled,
}: {
    guesses: Guess[],
    gameState: Room['gameState'] | undefined,
    playerId: string,
    currentDrawerId?: string | null,
    correctGuessersThisRound?: string[],
    referralProgramEnabled?: boolean;
}) => {
    const internalChatScrollRef = useRef<HTMLDivElement>(null);
    const reversedGuesses = useMemo(() => [...guesses].reverse(), [guesses]);

    useEffect(() => {
        if (internalChatScrollRef.current) {
            internalChatScrollRef.current.scrollTop = 0;
        }
    }, [guesses]);

    return (
    <div className="flex flex-col h-full w-full bg-gray-50 border border-gray-300 rounded-sm">
        <div className="p-1.5 border-b border-black bg-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700">Guesses &amp; Chat (Newest First)</h3>
        </div>
        <div className="flex-grow min-h-0 max-h-full">
             <ScrollArea className="h-full pr-3">
                <div ref={internalChatScrollRef} className="p-2 space-y-1">
                    {reversedGuesses.map((g, i) => {
                    let messageContent;
                    let messageClasses = "px-1.5 py-0.5 sm:px-2 sm:py-1 border-b border-gray-300 text-xs sm:text-sm";

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
                    } else if (g.text.startsWith("[[SYSTEM_REFERRAL_REWARD]]")) {
                        if (!referralProgramEnabled) return null;
                        const parts = g.playerName.split(" because ");
                        const rewardPart = parts[0];
                        const reasonPart = parts[1] || "";
                        messageContent = (
                            <span className="font-semibold text-yellow-600 flex items-center gap-1">
                                <Gift size={14}/> {rewardPart} {reasonPart && `because ${reasonPart}`}
                            </span>
                        );
                        messageClasses = cn(messageClasses, "bg-yellow-100");
                    } else if (g.isCorrect) {
                        const isFirst = (correctGuessersThisRound?.[0] === g.playerId) && (g.playerId !== currentDrawerId);
                        messageContent = <span className="font-semibold text-green-700">{g.playerName} guessed the word! {isFirst ? <span className="font-bold text-yellow-500">(First!)</span> : ""}</span>;
                        messageClasses = cn(messageClasses, "bg-green-100 animate-pulse-bg-once");
                    } else if (g.text.startsWith("[[SYSTEM_ROUND_END_WORD]]")) {
                         messageContent = <span className="font-semibold text-indigo-700">The word was '{g.playerName}'</span>;
                        messageClasses = cn(messageClasses, "bg-indigo-100");
                    } else if (g.text.startsWith("[[SYSTEM_NOBODY_GUESSED]]")) {
                        messageContent = <span className="font-semibold text-red-700">{g.playerName}</span>;
                        messageClasses = cn(messageClasses, "bg-red-100");
                    }
                    else {
                        messageContent = <>
                        <span className={cn("font-bold", g.playerId === playerId ? "text-blue-600" : "text-gray-800")}>
                            {g.playerName}{g.playerId === playerId ? " (You)" : ""}:
                        </span> {g.text}
                        </>;
                    }

                    return (
                        <div key={`${g.timestamp}-${i}-${g.playerId}`} className={messageClasses}>
                        {messageContent}
                        </div>
                    );
                    })}
                    {guesses.length === 0 && <p className="text-gray-500 text-center italic p-4 text-xs sm:text-sm">
                        {gameState === 'drawing' ? "No guesses yet. Be the first!" : "Chat messages will appear here."}
                    </p>}
                </div>
            </ScrollArea>
        </div>
    </div>
    );
});
ChatArea.displayName = 'ChatArea';

const TimerDisplay = React.memo(({ targetTime, defaultSeconds, compact, gameState }: { targetTime?: number | null, defaultSeconds: number, compact?: boolean, gameState?: Room['gameState'] }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

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
  }, [targetTime, defaultSeconds, hasMounted]);

  if (!hasMounted) {
    if (gameState === 'drawing' || gameState === 'word_selection') {
        return <div className={cn("font-bold", compact ? "text-xs" : "text-base")}>...</div>;
    }
    return <div className={cn("font-bold text-xs", compact ? "text-[9px]" : "text-xs")}>--</div>;
  }

  if (timeLeft === null) {
      if (gameState === 'drawing' || gameState === 'word_selection') {
          return <div className={cn("font-bold", compact ? "text-xs" : "text-base")}>...</div>;
      }
      return <div className={cn("font-bold text-xs", compact ? "text-[9px]" : "text-xs")}>--</div>;
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
  currentDrawerName,
}: {
  gameState: Room['gameState'] | undefined;
  currentPattern: string | null | undefined;
  revealedPattern: string[] | null | undefined;
  isCurrentPlayerDrawing: boolean;
  hasPlayerGuessedCorrectly: boolean;
  onLetterClick: (char: string, index: number) => void;
  currentDrawerName: string | undefined | null;
}) => {
  const wordToDisplayElements = useMemo(() => {
    const elements: JSX.Element[] = [];
    if (!currentPattern) {
      elements.push(
        <span key="placeholder-no-pattern" className="text-muted-foreground">
          {gameState === 'word_selection' ? `${currentDrawerName || "Someone"} is choosing...` : "Waiting..."}
        </span>
      );
      return elements;
    }

    const patternChars = currentPattern.split('');
    const currentRevealedForDisplay = (revealedPattern && revealedPattern.length === patternChars.length)
      ? revealedPattern
      : patternChars.map(c => c === ' ' ? ' ' : '_');

    if (isCurrentPlayerDrawing && gameState === 'drawing') {
        patternChars.forEach((char, index) => {
            const isLetterRevealedToOthers = currentRevealedForDisplay[index] !== '_' && currentRevealedForDisplay[index] !== ' ';
            if (char === ' ') {
                elements.push(<span key={`drawer-space-${index}`} className="mx-0.5 select-none">{'\u00A0\u00A0'}</span>);
            } else if(isLetterRevealedToOthers) {
                 elements.push(
                    <span key={`drawer-revealed-${index}`} className="font-bold text-green-600 cursor-default">
                        {char.toUpperCase()}
                    </span>
                );
            } else {
                elements.push(
                    <button
                        key={`drawer-clickable-${index}`}
                        onClick={() => {
                            if (typeof onLetterClick === 'function') {
                                onLetterClick(char, index);
                            } else {
                                console.error('WordDisplay: onLetterClick is not a function. Prop received:', onLetterClick);
                            }
                        }}
                        className="font-bold text-primary hover:text-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Reveal letter ${char}`}
                        title={`Click to reveal this letter: ${char.toUpperCase()}`}
                    >
                        {char.toUpperCase()}
                    </button>
                );
            }
        });
    }
    else if (hasPlayerGuessedCorrectly || gameState === 'round_end' || gameState === 'game_over' || (isCurrentPlayerDrawing && gameState !== 'drawing')) {
      patternChars.forEach((char, index) => {
        elements.push(
          <span key={`guesser-correct-char-${index}`} className="font-bold text-foreground">
            {char === ' ' ? '\u00A0\u00A0' : char.toUpperCase()}
          </span>
        );
      });
    }
    else if (gameState === 'drawing') {
      currentRevealedForDisplay.forEach((char, index) => {
        elements.push(
          <span key={`guesser-revealed-char-${index}`} className={cn("font-bold", char === '_' || char === ' ' ? 'text-muted-foreground' : 'text-foreground')}>
            {char === ' ' ? '\u00A0\u00A0' : (char === '_' ? char : char.toUpperCase())}
          </span>
        );
      });
    }
    else {
       elements.push(
        <span key="placeholder-state" className="text-muted-foreground">
          {gameState === 'word_selection' ? `${currentDrawerName || "Someone"} is choosing...` : "Waiting..."}
        </span>
       );
    }
    return elements;
  }, [gameState, currentPattern, revealedPattern, isCurrentPlayerDrawing, hasPlayerGuessedCorrectly, onLetterClick, currentDrawerName]);

  const wordDisplayKey = useMemo(() => {
    return `${gameState}-${currentPattern}-${revealedPattern?.join('')}-${isCurrentPlayerDrawing}-${hasPlayerGuessedCorrectly}`;
  }, [gameState, currentPattern, revealedPattern, isCurrentPlayerDrawing, hasPlayerGuessedCorrectly]);


  return (
    <div
      key={wordDisplayKey}
      className={cn(
        "text-[20px] font-mono font-normal tracking-widest select-text flex items-center justify-center gap-0.5 animate-in fade-in duration-300",
         isCurrentPlayerDrawing ? "text-card-foreground" : (hasPlayerGuessedCorrectly ? "text-green-600" : "text-muted-foreground")
      )} style={{ letterSpacing: '0.2em' }}
    >
      {wordToDisplayElements}
      {(gameState === 'drawing' && currentPattern && !isCurrentPlayerDrawing && !hasPlayerGuessedCorrectly) && (
        <sup className="text-[10px] font-normal text-gray-500 self-start ml-0.5">
          {currentPattern.replace(/\s/g, '').length}
        </sup>
      )}
       {isCurrentPlayerDrawing && gameState === 'drawing' && (
            <div className="text-[9px] text-blue-600 mt-0.5">(Click letters to reveal hints)</div>
        )}
    </div>
  );
});
WordDisplay.displayName = 'WordDisplay';

const MobileTopBar = React.memo(({
  room,
  playerId,
  isSettingsDialogOpen,
  setIsSettingsDialogOpen,
  onDrawerLetterClick,
  isLeavingRoom,
  authPlayerId,
  isAuthenticated,
}: {
  room: Room;
  playerId: string;
  isSettingsDialogOpen: boolean;
  setIsSettingsDialogOpen: (open: boolean) => void;
  onDrawerLetterClick: (char: string, index: number) => void;
  isLeavingRoom?: boolean;
  authPlayerId?: string | null;
  isAuthenticated?: boolean;
}) => {
  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const hasPlayerGuessedCorrectly = (room.correctGuessersThisRound || []).includes(playerId);
  const currentDrawerName = room.currentDrawerId && room.players[room.currentDrawerId] ? room.players[room.currentDrawerId].name : "Someone";
  const currentTurnDisplay = room.playerOrderForCurrentRound ? (room.currentTurnInRound || 0) + 1 : 0;
  const totalTurnsInRoundDisplay = room.playerOrderForCurrentRound ? room.playerOrderForCurrentRound.length : 0;


  return (
    <div className="flex items-center justify-between border-b border-blue-900 px-1 py-0.5 sticky top-0 z-20 bg-background" style={{ borderWidth: "3px" }}>
      <div className="flex flex-col items-center justify-center p-1 w-16">
        <TimerDisplay
          targetTime={room.gameState === 'drawing' ? room.roundEndsAt : (room.gameState === 'word_selection' ? room.wordSelectionEndsAt : null)}
          defaultSeconds={room.gameState === 'drawing' ? room.config.roundTimeoutSeconds : (room.gameState === 'word_selection' ? 15 : 0)}
          compact={true}
          gameState={room.gameState}
        />
        {(room.gameState === 'drawing' || room.gameState === 'word_selection' || room.gameState === 'round_end') &&
          <div className="text-[9px] font-bold leading-none mt-0.5 text-gray-700">
            R: {room.currentRoundNumber || 0}/{room.config.totalRounds || 'N/A'} | T: {currentTurnDisplay}/{totalTurnsInRoundDisplay}
          </div>
        }
      </div>

      <div className="flex flex-col items-center justify-center py-1 text-center flex-grow">
        <div className={cn(
          "text-[11px] font-semibold tracking-wide",
           isCurrentPlayerDrawing ? "text-primary" : (hasPlayerGuessedCorrectly ? "text-green-600" : "text-muted-foreground")
        )}>
          {isCurrentPlayerDrawing
            ? "Your word to draw is:"
            : hasPlayerGuessedCorrectly
              ? "You guessed it! The word is:"
              : "GUESS THIS"}
          {!isCurrentPlayerDrawing && !(room.correctGuessersThisRound || []).includes(playerId) && room.currentPattern && room.gameState === 'drawing' && (
            <span className="ml-1 text-muted-foreground">({room.currentPattern.replace(/\s/g, '').length} letters)</span>
          )}
        </div>
        <WordDisplay
          gameState={room.gameState}
          currentPattern={room.currentPattern}
          revealedPattern={room.revealedPattern}
          isCurrentPlayerDrawing={isCurrentPlayerDrawing}
          hasPlayerGuessedCorrectly={hasPlayerGuessedCorrectly}
          onLetterClick={onDrawerLetterClick}
          currentDrawerName={currentDrawerName}
        />
      </div>

      <div className="p-1 w-16 flex justify-end items-center gap-0.5">
         <DialogTrigger asChild>
             <Button variant="ghost" size="icon" className="text-gray-600 hover:bg-gray-200 w-7 h-7" aria-label="Room Settings" onClick={() => setIsSettingsDialogOpen(true)} disabled={isLeavingRoom}>
                {isLeavingRoom ? <Loader2 size={18} className="animate-spin"/> : <Settings size={18} />}
             </Button>
         </DialogTrigger>
      </div>
    </div>
  );
});
MobileTopBar.displayName = 'MobileTopBar';

const TOAST_MAX_COUNT = 3;

export default function GameRoomPage() {
  const params = useParams();
  const { toast } = useShadToast();
  const routerHook = useNextRouter();
  const rawRoomIdFromParams = params.roomId as string;
  const roomId = useMemo(() => rawRoomIdFromParams ? rawRoomIdFromParams.toUpperCase() : '', [rawRoomIdFromParams]);
  const isMobile = useIsMobile();

  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPlayerId, setAuthPlayerId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSubmittingWord, setIsSubmittingWord] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isStartingNextRoundOrGame, setIsStartingNextRoundOrGame] = useState(false);
  const [isRevealingLetter, setIsRevealingLetter] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);

  const [roundEndCountdown, setRoundEndCountdown] = useState<number | null>(null);

  const [isRevealConfirmDialogOpen, setIsRevealConfirmDialogOpenLocal] = useState(false);
  const [letterToRevealInfo, setLetterToRevealInfo] = useState<{ char: string; index: number } | null>(null);
  const [isPlayerListMinimized, setIsPlayerListMinimized] = useState(true);
  const [isSettingsDialogOpenLocal, setIsSettingsDialogOpenLocal] = useState(false);
  const [isGeneratingAISketch, setIsGeneratingAISketch] = useState(false);

  const [toastMessages, setToastMessages] = useState<Array<Guess & { uniqueId: string }>>([]);
  const toastIdCounter = useRef(0);
  const toastTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const gameOverProcessedRef = useRef(false);
  const prevPlayersRef = useRef<Room['players'] | undefined>(undefined);
  const lastProcessedTimeoutRef = useRef<string | null>(null);
  const processingTurnEndRef = useRef(false); // Client-side lock
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);


  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({ referralProgramEnabled: true, platformWithdrawalsEnabled: true });
  const [isLoadingPlatformSettings, setIsLoadingPlatformSettings] = useState(true);

  useEffect(() => {
    const settingsRef = ref(database, 'platformSettings');
    const listener = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlatformSettings(snapshot.val());
      } else {
        setPlatformSettings({ referralProgramEnabled: true, platformWithdrawalsEnabled: true });
      }
      setIsLoadingPlatformSettings(false);
    }, (error) => {
      console.error("Error fetching platform settings for GameRoom:", error);
      setPlatformSettings({ referralProgramEnabled: true, platformWithdrawalsEnabled: true });
      setIsLoadingPlatformSettings(false);
    });
    return () => off(settingsRef, 'value', listener);
  }, []);


  const playersArray = useMemo(() => {
    if (!room || !room.players) return [];
    // Ensure player has id and name
    return Object.values(room.players).filter(p => p && p.id && typeof p.name === 'string' && p.name.trim() !== '');
  }, [room]);

  const memoizedDrawingData = useMemo(() => {
      return room ? (room.drawingData || []) : [];
  }, [room?.drawingData]);

  const memoizedGuesses = useMemo(() => {
      return room ? (room.guesses || []) : [];
  }, [room?.guesses]);


  const addSystemMessage = useCallback(async (text: string, nameOverride?: string) => {
    if (!roomId || !playerId ) return;
    const messagePlayerName = nameOverride || APP_NAME;

    const systemGuess: Guess = {
        playerId: 'system',
        playerName: messagePlayerName,
        text: text,
        isCorrect: false,
        timestamp: serverTimestamp() as any,
    };
    const guessesRef = ref(database, `rooms/${roomId}/guesses`);
    const currentGuessesSnap = await get(guessesRef);
    const currentGuesses = currentGuessesSnap.exists() ? currentGuessesSnap.val() : [];
    try {
        await set(guessesRef, [...currentGuesses, systemGuess]);
    } catch(e){
        console.error("Error adding system message:", e)
    }
  }, [roomId, playerId]);

  const advanceGameToNextStep = useCallback(async (reasonForAdvance: 'new_game_start' | 'round_ended' | 'drawer_timed_out_selection') => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) {
        toast({ title: "Error", description: "Room data not found.", variant: "destructive" });
        return;
    }
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!playerId || currentRoomData.hostId !== playerId) {
        return;
    }

    const onlinePlayers = Object.values(currentRoomData.players || {}).filter(p => p.isOnline && p.id && p.name);

    if (onlinePlayers.length < MIN_PLAYERS_TO_START_GAME &&
        (reasonForAdvance === 'new_game_start' || (reasonForAdvance === 'round_ended' && currentRoomData.gameState !== 'game_over'))) {
        toast({ title: "Not Enough Players", description: `Need at least ${MIN_PLAYERS_TO_START_GAME} online players.`, variant: "default" });
        if (currentRoomData.gameState !== 'waiting' && currentRoomData.gameState !== 'game_over') {
            await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over', turnProcessingState: null });
            addSystemMessage(`Game ended: Not enough players (need ${MIN_PLAYERS_TO_START_GAME}).`);
            gameOverProcessedRef.current = false;
        }
        return;
    }

    let newRoundNumber = currentRoomData.currentRoundNumber || 0;
    let newTurnInRound = currentRoomData.currentTurnInRound !== undefined ? currentRoomData.currentTurnInRound : -1;
    let newPlayerOrderForCurrentRound = currentRoomData.playerOrderForCurrentRound || [];
    let newDrawerId: string | null = null;

    if (reasonForAdvance === 'new_game_start') {
        await update(ref(database, `rooms/${roomId}`), { usedWords: [], lastRoundScoreChanges: null, turnProcessingState: null });
        for (const pid of Object.keys(currentRoomData.players || {})) {
           await update(ref(database, `rooms/${roomId}/players/${pid}`), { score: 0, referralRewardsThisSession: 0 });
        }
        addSystemMessage("[[SYSTEM_GAME_RESET]]");
        newRoundNumber = 1;
        newTurnInRound = 0;
        newPlayerOrderForCurrentRound = onlinePlayers.map(p => p.id).sort(() => Math.random() - 0.5);
    } else { // 'round_ended' or 'drawer_timed_out_selection'
        newTurnInRound++;
        if (newPlayerOrderForCurrentRound.length === 0 || newTurnInRound >= newPlayerOrderForCurrentRound.length) {
            newRoundNumber++;
            newTurnInRound = 0;
            newPlayerOrderForCurrentRound = onlinePlayers.map(p => p.id).sort(() => Math.random() - 0.5);
        }
    }

    if (newPlayerOrderForCurrentRound.length === 0) {
         toast({ title: "No Online Players", description: "Cannot start/continue game.", variant: "destructive"});
         if (currentRoomData.gameState !== 'waiting' && currentRoomData.gameState !== 'game_over') {
            await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over', turnProcessingState: null });
            addSystemMessage("Game ended: No online players to continue.");
            gameOverProcessedRef.current = false;
         }
         return;
    }

    if (newRoundNumber > (currentRoomData.config?.totalRounds || 3)) {
        await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over', turnProcessingState: null });
        addSystemMessage("Game Over! All rounds completed.");
        gameOverProcessedRef.current = false;
        toast({ title: "Game Over!", description: "All rounds completed. Check final scores!" });
        return;
    }

    newDrawerId = newPlayerOrderForCurrentRound[newTurnInRound];

    if (!newDrawerId) {
         toast({title: "Error Assigning Drawer", description: "Could not find a player for the next turn. Game may end.", variant: "destructive"});
         await update(ref(database, `rooms/${roomId}`), { gameState: 'game_over', turnProcessingState: null });
         gameOverProcessedRef.current = false;
         return;
    }

    let wordsForSelection: string[] = [];
    if (currentRoomData.config) {
        try {
            const suggestInput: SuggestWordsInput = {
                previouslyUsedWords: currentRoomData.usedWords || [],
                count: 5,
                maxWordLength: currentRoomData.config.maxWordLength,
            };
            const aiSuggestions = await suggestWords(suggestInput);
            if (aiSuggestions && Array.isArray(aiSuggestions) && aiSuggestions.length > 0 && aiSuggestions.every(w => typeof w === 'string' && w.trim().length > 0 && /^[a-zA-Z]+$/.test(w.trim()))) {
                wordsForSelection = aiSuggestions.slice(0, 5);
            } else {
                 wordsForSelection = generateFallbackWords(5, currentRoomData.config.maxWordLength, currentRoomData.usedWords);
            }
            if (wordsForSelection.length < 5) {
                wordsForSelection = generateFallbackWords(5, currentRoomData.config.maxWordLength, [...(currentRoomData.usedWords || []), ...wordsForSelection]);
            }
        } catch (aiError) {
            console.error("AI word suggestion error:", aiError);
            toast({ title: "AI Error", description: "Failed to get words from AI. Using default words.", variant: "destructive" });
            wordsForSelection = generateFallbackWords(5, currentRoomData.config?.maxWordLength, currentRoomData.usedWords);
        }
    }

    const drawerPlayer = currentRoomData.players?.[newDrawerId];
    const drawerNameForMessage = drawerPlayer?.name || "Next player";
    const newWordSelectionEndsAt = Date.now() + Math.max(10000, (currentRoomData.config?.roundTimeoutSeconds || 90) / 6 * 1000);
    const activeGuessersAtTurnStart = onlinePlayers.filter(p => p.id !== newDrawerId).length;

    const currentTurnIdentifierForProcessing = `${newRoundNumber}_${newTurnInRound}_${newDrawerId}`;

    const updates: Partial<Room> = {
        gameState: 'word_selection',
        currentDrawerId: newDrawerId,
        currentPattern: null,
        roundStartedAt: null,
        roundEndsAt: null,
        wordSelectionEndsAt: newWordSelectionEndsAt,
        currentRoundNumber: newRoundNumber,
        currentTurnInRound: newTurnInRound,
        playerOrderForCurrentRound: newPlayerOrderForCurrentRound,
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }],
        aiSketchDataUri: null,
        guesses: [],
        correctGuessersThisRound: [],
        selectableWords: wordsForSelection.slice(0,5),
        revealedPattern: [],
        lastRoundScoreChanges: null,
        activeGuesserCountAtTurnStart: activeGuessersAtTurnStart,
        turnProcessingState: { turnId: currentTurnIdentifierForProcessing, status: 'pending' }
    };

    try {
        await update(ref(database, `rooms/${roomId}`), updates);
        addSystemMessage("[[SYSTEM_DRAWER_CHANGE]]", drawerNameForMessage);
        toast({title: `Next Turn: ${drawerNameForMessage}`, description: `${drawerNameForMessage} is choosing a word.`});
    } catch (err) {
        console.error("Error advancing game step:", err);
        toast({title:"Error", description: "Could not proceed to next turn/round.", variant: "destructive"});
    }
  }, [playerId, roomId, toast, addSystemMessage]);


  const confirmWordAndStartDrawing = useCallback(async (word: string) => {
    const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
    if (!currentRoomSnapshot.exists()) return;
    const currentRoomData: Room = currentRoomSnapshot.val();

    if (!currentRoomData || !playerId || currentRoomData.currentDrawerId !== playerId || currentRoomData.gameState !== 'word_selection' || !currentRoomData.config) {
        toast({ title: "Error", description: "Cannot select word now.", variant: "destructive" });
        return;
    }
    setIsSubmittingWord(true);

    const initialRevealedPattern = word.split('').map(char => char === ' ' ? ' ' : '_');
    const newUsedWords = Array.from(new Set([...(currentRoomData.usedWords || []).map(w => w.toLowerCase()), word.toLowerCase()]));
    const newRoundEndsAt = Date.now() + currentRoomData.config.roundTimeoutSeconds * 1000;

    const updatesForDrawingStart: Partial<Room> = {
        currentPattern: word,
        roundStartedAt: serverTimestamp() as any,
        roundEndsAt: newRoundEndsAt,
        selectableWords: [],
        wordSelectionEndsAt: null,
        correctGuessersThisRound: [],
        usedWords: newUsedWords,
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }],
        aiSketchDataUri: null,
        lastRoundScoreChanges: null,
        // activeGuesserCountAtTurnStart is set when the turn is assigned in advanceGameToNextStep
    };
    try {
        const now = Date.now();
        updatesForDrawingStart.roundStartedAt = now;

        await set(ref(database, `rooms/${roomId}/revealedPattern`), initialRevealedPattern);
        await update(ref(database, `rooms/${roomId}`), {
            ...updatesForDrawingStart,
            gameState: 'drawing'
        });
        toast({title: "Drawing Started!", description: `The word has been chosen. Time to draw!`});
    } catch(err) {
        console.error("Error starting drawing phase:", err);
        toast({title: "Error", description: "Could not start drawing phase.", variant: "destructive"});
    } finally {
        setIsSubmittingWord(false);
    }
  }, [playerId, roomId, toast]);


  const endCurrentDrawingTurn = useCallback(async (reason: string = "Turn ended.") => {
    const callInstanceId = Math.random().toString(36).substring(2, 8);
    console.log(`[${callInstanceId}] endCurrentDrawingTurn called. Reason: ${reason}. Client lock: ${processingTurnEndRef.current}`);

    if (processingTurnEndRef.current) {
      console.log(`[${callInstanceId}] Exiting: Client-side lock (processingTurnEndRef) is true.`);
      return;
    }
    processingTurnEndRef.current = true;

    try {
      const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
      if (!currentRoomSnapshot.exists()) {
        console.log(`[${callInstanceId}] Exiting: Room ${roomId} not found.`);
        toast({ title: "Error", description: "Room data not found while ending turn.", variant: "destructive" });
        return;
      }
      const currentRoomData: Room = currentRoomSnapshot.val();
      const currentDrawerId = currentRoomData.currentDrawerId;

      if (!currentRoomData || currentRoomData.gameState !== 'drawing' || !playerId || !currentDrawerId || !currentRoomData.config || !currentRoomData.roundStartedAt) {
        console.log(`[${callInstanceId}] Exiting: Pre-conditions not met. GameState: ${currentRoomData?.gameState}, PlayerID: ${playerId}, DrawerID: ${currentDrawerId}`);
        return;
      }
      console.log(`[${callInstanceId}] Initial checks passed. Proceeding...`);

      const currentTurnIdentifier = `${currentRoomData.currentRoundNumber}_${currentRoomData.currentTurnInRound}_${currentDrawerId}`;
      const turnProcessingStateRef = ref(database, `rooms/${roomId}/turnProcessingState`);

      let turnClaimedAndProcessed = false;
      await runTransaction(turnProcessingStateRef, (currentProcessingState) => {
        console.log(`[${callInstanceId}] Transaction for turnProcessingState. Current state in DB:`, currentProcessingState);
        if (currentProcessingState && currentProcessingState.turnId === currentTurnIdentifier && currentProcessingState.status === 'processed') {
          console.log(`[${callInstanceId}] Transaction: Turn ${currentTurnIdentifier} already processed. Aborting transaction.`);
          turnClaimedAndProcessed = true; // Mark as processed to prevent this client instance from proceeding
          return; // Abort transaction, no changes
        }
        // If it's a new turn, or this turn is not 'processed' yet, claim it as 'pending'
        console.log(`[${callInstanceId}] Transaction: Claiming turn ${currentTurnIdentifier} as pending.`);
        return { turnId: currentTurnIdentifier, status: 'pending' };
      });

      if (turnClaimedAndProcessed) {
         console.log(`[${callInstanceId}] Exiting after transaction: Turn ${currentTurnIdentifier} was already marked processed by DB state or claimed by another instance.`);
         return;
      }
      // Check again immediately after transaction IF the transaction itself might have failed due to contention
      const postTransactionSnap = await get(turnProcessingStateRef);
      if (postTransactionSnap.exists()) {
          const postTxState = postTransactionSnap.val();
          if (postTxState.turnId === currentTurnIdentifier && postTxState.status === 'processed') {
               console.log(`[${callInstanceId}] Exiting after re-check: Turn ${currentTurnIdentifier} found processed in DB immediately after non-conclusive transaction.`);
               return;
          }
          // If it's pending but not by *this* instance, this is complex. For now, we assume our transaction secured 'pending' or it was already 'pending'.
          if (postTxState.turnId === currentTurnIdentifier && postTxState.status === 'pending') {
            console.log(`[${callInstanceId}] Turn ${currentTurnIdentifier} is pending. This client instance proceeds with score calculation.`);
          }
      }


      console.log(`[${callInstanceId}] Calculating scores for turn ${currentTurnIdentifier}...`);
      const turnScoreChanges = calculateTurnScores({
        currentRoomData,
        currentDrawerId,
        activeGuesserCountAtTurnStart: currentRoomData.activeGuesserCountAtTurnStart || 0,
        roundStartedAt: currentRoomData.roundStartedAt,
        T_total: currentRoomData.config.roundTimeoutSeconds,
      });
      console.log(`[${callInstanceId}] Calculated turnScoreChanges:`, turnScoreChanges);

      for (const pId in turnScoreChanges) {
        if (turnScoreChanges[pId] !== 0 && currentRoomData.players[pId]) { // Ensure player exists
          const playerRef = ref(database, `rooms/${roomId}/players/${pId}/score`);
          console.log(`[${callInstanceId}] Updating score for player ${pId} by ${turnScoreChanges[pId]}`);
          try {
            await runTransaction(playerRef, (currentScore) => (currentScore || 0) + turnScoreChanges[pId]);
          } catch (e) {
            console.error(`[${callInstanceId}] Error updating score for player ${pId}:`, e);
          }
        }
      }

      if (currentRoomData.hostId === playerId) { // Only host finalizes
        console.log(`[${callInstanceId}] Host (this client) is finalizing turn ${currentTurnIdentifier}.`);
        const finalUpdates: Partial<Room> = {
          gameState: 'round_end',
          wordSelectionEndsAt: null,
          lastRoundScoreChanges: turnScoreChanges,
          turnProcessingState: { turnId: currentTurnIdentifier, status: 'processed' }
        };
        try {
          await update(ref(database, `rooms/${roomId}`), finalUpdates);
          console.log(`[${callInstanceId}] Turn ${currentTurnIdentifier} finalized by host.`);
          if (currentRoomData.currentPattern) {
            addSystemMessage(`[[SYSTEM_ROUND_END_WORD]]`, currentRoomData.currentPattern);
          }
          const activeGuesserCount = currentRoomData.activeGuesserCountAtTurnStart || 0;
          const correctGuessersCount = (currentRoomData.correctGuessersThisRound || []).length;
          if (correctGuessersCount === 0 && activeGuesserCount > 0) {
            addSystemMessage(`[[SYSTEM_NOBODY_GUESSED]]`, `Nobody guessed the word!`);
          }
          toast({ title: "Turn Over!", description: `${reason} The word was: ${currentRoomData.currentPattern || "N/A"}` });
        } catch (err) {
          console.error(`[${callInstanceId}] Error finalizing turn:`, err);
          toast({ title: "Error", description: "Failed to finalize drawing turn.", variant: "destructive" });
        }
      } else {
         console.log(`[${callInstanceId}] Non-host client. Turn ${currentTurnIdentifier} processing calculations complete. Host will finalize.`);
      }

    } catch (error) {
        console.error(`[${callInstanceId}] General error in endCurrentDrawingTurn:`, error);
        toast({ title: "Scoring System Error", description: "An unexpected error occurred during score calculation.", variant: "destructive" });
    } finally {
        console.log(`[${callInstanceId}] Releasing client-side lock (processingTurnEndRef).`);
        processingTurnEndRef.current = false;
    }
  }, [playerId, roomId, toast, addSystemMessage]);


  const handleGuessSubmit = useCallback(async (guessText: string) => {
    setIsSubmittingGuess(true);
    try {
        const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
        if (!currentRoomSnapshot.exists()) { setIsSubmittingGuess(false); return; }
        const currentRoom: Room = currentRoomSnapshot.val();

        if (!currentRoom || !playerId || !playerName || !currentRoom.config) {
            setIsSubmittingGuess(false);
            return;
        }

        const isDrawingPhase = currentRoom.gameState === 'drawing';
        const canPlayerGuessForPoints = isDrawingPhase &&
                                      currentRoom.currentDrawerId !== playerId &&
                                      !(currentRoom.correctGuessersThisRound || []).includes(playerId) &&
                                      currentRoom.currentPattern &&
                                      currentRoom.roundStartedAt;

        let isCorrectGuess = false;
        if (canPlayerGuessForPoints && currentRoom.currentPattern) {
            isCorrectGuess = guessText.toLowerCase() === currentRoom.currentPattern.toLowerCase();
        }

        const currentTimestamp = Date.now();
        const newGuess: Guess = {
          playerId,
          playerName,
          text: guessText,
          isCorrect: isCorrectGuess,
          timestamp: currentTimestamp
        };

        const guessesRef = ref(database, `rooms/${roomId}/guesses`);
        const currentGuesses = currentRoom.guesses || [];
        const newGuesses = [...currentGuesses, newGuess];

        const updates: Partial<Pick<Room, 'guesses' | 'correctGuessersThisRound'>> = {
            guesses: newGuesses
        };

        if (isCorrectGuess) {
            updates.correctGuessersThisRound = [...(currentRoom.correctGuessersThisRound || []), playerId];
        }

        await update(ref(database, `rooms/${roomId}`), updates);

        // Host checks if all players guessed to end turn early
        if (currentRoom.hostId === playerId && isCorrectGuess && isDrawingPhase) {
            const updatedRoomSnapForEndRound = await get(ref(database, `rooms/${roomId}`));
            if (!updatedRoomSnapForEndRound.exists()) { setIsSubmittingGuess(false); return; }
            const updatedRoomDataForEndRound: Room = updatedRoomSnapForEndRound.val();

            if (updatedRoomDataForEndRound.gameState === 'drawing' && updatedRoomDataForEndRound.activeGuesserCountAtTurnStart > 0) {
                const allGuessed = (updatedRoomDataForEndRound.correctGuessersThisRound || []).length >= updatedRoomDataForEndRound.activeGuesserCountAtTurnStart;
                if(allGuessed){
                  // Call endCurrentDrawingTurn only if not already being processed
                  if (!processingTurnEndRef.current) {
                    endCurrentDrawingTurn("All active players guessed correctly!");
                  }
                }
            }
        }

    } catch (error) {
        console.error("Error submitting guess/message:", error);
        toast({ title: "Error", description: "Could not submit message.", variant: "destructive" });
    } finally {
        setIsSubmittingGuess(false);
    }
  }, [playerId, playerName, roomId, toast, endCurrentDrawingTurn]);


  const manageGameStart = useCallback(async () => {
    setIsStartingNextRoundOrGame(true);
    try {
        const currentRoomSnapshot = await get(ref(database, `rooms/${roomId}`));
        if (!currentRoomSnapshot.exists()) {
            toast({ title: "Error", description: "Room not found.", variant: "destructive" });
            return;
        }
        const currentRoomData: Room = currentRoomSnapshot.val();

        if (!currentRoomData || !playerId || currentRoomData.hostId !== playerId) {
            toast({ title: "Error", description: "Only the host can start the game.", variant: "destructive" });
            return;
        }

        if (currentRoomData.gameState === 'waiting' || currentRoomData.gameState === 'game_over') {
            const onlinePlayersCount = Object.values(currentRoomData.players || {}).filter(p => p.isOnline).length;
            if (onlinePlayersCount < MIN_PLAYERS_TO_START_GAME) {
                toast({
                    title: "Cannot Start Game",
                    description: `At least ${MIN_PLAYERS_TO_START_GAME} online players are required. Currently: ${onlinePlayersCount}.`,
                    variant: "default"
                });
                return;
            }
            await advanceGameToNextStep('new_game_start');
        }
    } catch (error) {
        console.error("Error managing game start:", error);
        toast({ title: "Error", description: "Could not start the game.", variant: "destructive" });
    } finally {
        setIsStartingNextRoundOrGame(false);
    }
  }, [playerId, roomId, advanceGameToNextStep, toast]);

  const handleDrawerLetterClick = useCallback((char: string, index: number) => {
    if (!room || !room.currentPattern || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;

    const currentRevealedPattern = (room.revealedPattern && Array.isArray(room.revealedPattern) && room.revealedPattern.length === room.currentPattern.length)
                                 ? room.revealedPattern
                                 : room.currentPattern.split('').map(c => c === ' ' ? ' ' : '_');

    if (char === ' ' || (currentRevealedPattern[index] && currentRevealedPattern[index] !== '_')) {
      return;
    }
    setLetterToRevealInfo({ char: room.currentPattern[index], index });
    setIsRevealConfirmDialogOpenLocal(true);
  }, [room, playerId]);

  const handleConfirmLetterRevealByDrawer = useCallback(async () => {
    if (!room || !letterToRevealInfo || !room.currentPattern || room.currentDrawerId !== playerId || room.gameState !== 'drawing') return;

    setIsRevealingLetter(true);
    const revealedPatternRef = ref(database, `rooms/${roomId}/revealedPattern`);
    const currentPatternStr = room.currentPattern;
    const patternChars = currentPatternStr.split('');
    const { index: targetIndex } = letterToRevealInfo;
    const initialUnderscorePatternForTransaction = patternChars.map(c => (c === ' ' ? ' ' : '_'));

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

        if (basePattern[targetIndex] === '_') {
          basePattern[targetIndex] = patternChars[targetIndex];
        }
        return basePattern;
      });

      toast({ title: "Hint Revealed!", description: `Letter "${patternChars[targetIndex]}" is now visible to guessers.` });
    } catch (error) {
      console.error("Error revealing hint:", error);
      toast({ title: "Error", description: "Could not reveal hint.", variant: "destructive" });
    } finally {
      setIsRevealConfirmDialogOpenLocal(false);
      setLetterToRevealInfo(null);
      setIsRevealingLetter(false);
    }
  }, [room, letterToRevealInfo, playerId, roomId, toast]);


  const handleLeaveRoom = useCallback(async () => {
    if (!playerId || !room || !playerName) {
        routerHook.push('/');
        return;
    }
    setIsLeavingRoom(true);
    const playerRef = ref(database, `rooms/${room.id}/players/${playerId}`);
    try {
        addSystemMessage(`[[SYSTEM_LEFT]]`, playerName);
        await update(playerRef, { isOnline: false });
        setIsSettingsDialogOpenLocal(false);
        localStorage.removeItem('patternPartyCurrentRoomId');
        toast({ title: "Left Room", description: "You have left the room." });
        routerHook.push('/');
    } catch (err) {
        toast({ title: "Error", description: "Could not leave room cleanly.", variant: "destructive" });
        routerHook.push('/');
    } finally {
        setIsLeavingRoom(false);
    }
  }, [playerId, room, playerName, toast, addSystemMessage, setIsSettingsDialogOpenLocal, routerHook]);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Link Copied!", description: "Room link copied to clipboard." }))
      .catch(() => toast({ title: "Error", description: "Could not copy link.", variant: "destructive" }));
    setIsSettingsDialogOpenLocal(false);
  }, [roomId, toast, setIsSettingsDialogOpenLocal]);

  const handleDraw = useCallback((point: DrawingPoint) => {
    if (!room || !playerId || room?.currentDrawerId !== playerId || room?.gameState !== 'drawing') return;

    const drawingDataRef = ref(database, `rooms/${roomId}/drawingData`);
    const newDrawingData = [...(memoizedDrawingData || []), point];
    set(drawingDataRef, newDrawingData);

  }, [room, playerId, roomId, memoizedDrawingData]);

  const handleClearCanvas = useCallback(async () => {
    if (!room || !playerId || room?.currentDrawerId !== playerId || room?.gameState !== 'drawing') return;
    const updates = {
        drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }],
        aiSketchDataUri: null
    };
    await update(ref(database, `rooms/${roomId}`), updates);
  },[room, playerId, roomId]);

  const handleDrawWithAI = useCallback(async () => {
    if (!room || !room.currentPattern || room.currentDrawerId !== playerId) return;
    setIsGeneratingAISketch(true);
    try {
        const sketchInput: GenerateAISketchInput = { chosenWord: room.currentPattern };
        const result = await generateAISketch(sketchInput);
        if (result && result.imageDataUri) {
            const updates = {
                aiSketchDataUri: result.imageDataUri,
                drawingData: [{ type: 'clear', x:0, y:0, color:'#000', lineWidth:1 }]
            };
            await update(ref(database, `rooms/${roomId}`), updates);
            toast({ title: "AI Sketch Applied!", description: "The AI sketch is now on the canvas." });
        } else {
            throw new Error("AI sketch data URI was empty.");
        }
    } catch (error) {
        console.error("Error generating AI sketch:", error);
        toast({ title: "AI Sketch Error", description: "Could not generate AI sketch. Please try drawing manually.", variant: "destructive" });
    } finally {
        setIsGeneratingAISketch(false);
    }
  }, [room, playerId, roomId, toast]);


  useEffect(() => {
    const authStatus = localStorage.getItem('drawlyAuthStatus');
    const storedUid = localStorage.getItem('drawlyUserUid');
    let storedDisplayName = localStorage.getItem('drawlyUserDisplayName');
    let localPlayerId = localStorage.getItem('patternPartyPlayerId');
    let localPlayerName = localStorage.getItem('patternPartyPlayerName');
    const currentRoomIdInStorage = localStorage.getItem('patternPartyCurrentRoomId');

    let finalPlayerId: string | null = null;
    let finalPlayerName: string | null = null;
    let finalIsAuthenticated = false;

    if (authStatus === 'loggedIn' && storedUid && storedDisplayName) {
      finalPlayerId = storedUid;
      finalPlayerName = storedDisplayName;
      finalIsAuthenticated = true;
      setAuthPlayerId(storedUid);
    } else {
      if (currentRoomIdInStorage && currentRoomIdInStorage !== roomId) {
        localStorage.removeItem('patternPartyPlayerId');
        localStorage.removeItem('patternPartyPlayerName');
        localPlayerId = null;
        localPlayerName = null;
      }
      finalPlayerId = localPlayerId || `anon_${Math.random().toString(36).substr(2, 9)}`;
      finalPlayerName = localPlayerName;
    }

    if (!finalPlayerName && finalPlayerId) {
        toast({ title: "Name Required", description: "Please enter your name for this room.", variant: "default" });
        routerHook.push(`/join/${roomId}`);
        return;
    } else if (!finalPlayerId) {
         toast({ title: "Identity Error", description: "Could not establish player identity. Redirecting.", variant: "destructive" });
         routerHook.push(`/join/${roomId}`);
         return;
    }

    if (!localPlayerId && finalPlayerId.startsWith('anon_')) {
      localStorage.setItem('patternPartyPlayerId', finalPlayerId);
    }
    localStorage.setItem('patternPartyCurrentRoomId', roomId);

    setPlayerId(finalPlayerId);
    setPlayerName(finalPlayerName);
    setIsAuthenticated(finalIsAuthenticated);
  }, [roomId, toast, routerHook]);

  useEffect(() => {
    if (!roomId || !playerId || !playerName) return;

    const roomRefVal = ref(database, `rooms/${roomId}`);
    const playerRefForSetup = ref(database, `rooms/${roomId}/players/${playerId}`);
    const playerOnlineStatusRef = child(playerRefForSetup, 'isOnline');
    const playerConnectionsRef = ref(database, '.info/connected');


    const onRoomValueChange = onValue(roomRefVal, (snapshot) => {
      if (!snapshot.exists()) {
        setError("Room not found or has been deleted.");
        setRoom(null);
        toast({ title: "Room Error", description: "This room no longer exists.", variant: "destructive" });
        localStorage.removeItem('patternPartyCurrentRoomId');
        routerHook.push('/');
        setIsLoading(false);
        return;
      }

      const roomDataFromSnapshot = snapshot.val() as Room;
        const processedRoomData: Room = {
          id: roomDataFromSnapshot.id || roomId,
          hostId: roomDataFromSnapshot.hostId,
          players: roomDataFromSnapshot.players || {},
          gameState: roomDataFromSnapshot.gameState || 'waiting',
          createdAt: roomDataFromSnapshot.createdAt,
          config: roomDataFromSnapshot.config || { roundTimeoutSeconds: 90, totalRounds: 3, maxWordLength: 20 },
          drawingData: roomDataFromSnapshot.drawingData || [],
          guesses: roomDataFromSnapshot.guesses || [],
          currentRoundNumber: roomDataFromSnapshot.currentRoundNumber || 0,
          currentTurnInRound: roomDataFromSnapshot.currentTurnInRound === undefined ? 0 : roomDataFromSnapshot.currentTurnInRound,
          playerOrderForCurrentRound: roomDataFromSnapshot.playerOrderForCurrentRound || [],
          currentDrawerId: roomDataFromSnapshot.currentDrawerId === undefined ? null : roomDataFromSnapshot.currentDrawerId,
          currentPattern: roomDataFromSnapshot.currentPattern === undefined ? null : roomDataFromSnapshot.currentPattern,
          roundStartedAt: roomDataFromSnapshot.roundStartedAt === undefined ? null : roomDataFromSnapshot.roundStartedAt,
          roundEndsAt: roomDataFromSnapshot.roundEndsAt === undefined ? null : roomDataFromSnapshot.roundEndsAt,
          wordSelectionEndsAt: roomDataFromSnapshot.wordSelectionEndsAt === undefined ? null : roomDataFromSnapshot.wordSelectionEndsAt,
          selectableWords: roomDataFromSnapshot.selectableWords || [],
          revealedPattern: roomDataFromSnapshot.revealedPattern === undefined ? [] : roomDataFromSnapshot.revealedPattern,
          usedWords: roomDataFromSnapshot.usedWords || [],
          correctGuessersThisRound: roomDataFromSnapshot.correctGuessersThisRound || [],
          lastRoundScoreChanges: roomDataFromSnapshot.lastRoundScoreChanges === undefined ? null : roomDataFromSnapshot.lastRoundScoreChanges,
          aiSketchDataUri: roomDataFromSnapshot.aiSketchDataUri === undefined ? null : roomDataFromSnapshot.aiSketchDataUri,
          activeGuesserCountAtTurnStart: roomDataFromSnapshot.activeGuesserCountAtTurnStart === undefined ? 0 : roomDataFromSnapshot.activeGuesserCountAtTurnStart,
          turnProcessingState: roomDataFromSnapshot.turnProcessingState === undefined ? null : roomDataFromSnapshot.turnProcessingState,
        };
        setRoom(processedRoomData);
        setError(null);
        if(isLoading) setIsLoading(false);

    }, (err) => {
      console.error("Firebase onValue error:", err);
      setError("Failed to load room data.");
      setIsLoading(false);
      toast({ title: "Connection Error", description: "Could not connect to the room.", variant: "destructive" });
    });

    let connectedListener: any;
    if (playerName && playerId) {
      connectedListener = onValue(playerConnectionsRef, (snap) => {
        if (snap.val() === true) {
          get(playerRefForSetup).then(playerSnap => {
            let nameForFirebaseUpdate = playerName.trim();
            const wasPlayerNodeExisting = playerSnap.exists();
            let existingPlayerData: Player | null = null;

            if (wasPlayerNodeExisting) {
                existingPlayerData = playerSnap.val() as Player;
                if (existingPlayerData.name && !nameForFirebaseUpdate && !isAuthenticated) {
                    nameForFirebaseUpdate = existingPlayerData.name;
                } else if (isAuthenticated && authPlayerId === playerId && existingPlayerData.name && nameForFirebaseUpdate !== existingPlayerData.name) {
                } else if (isAuthenticated && authPlayerId === playerId && existingPlayerData.name && !nameForFirebaseUpdate){
                    nameForFirebaseUpdate = existingPlayerData.name;
                }
            }
            nameForFirebaseUpdate = nameForFirebaseUpdate || "Player";

            const updatesForPlayer: Partial<Player> = {
                name: nameForFirebaseUpdate,
                isOnline: true,
                isAnonymous: !isAuthenticated,
            };
            if (!wasPlayerNodeExisting) {
                updatesForPlayer.score = 0;
                updatesForPlayer.referralRewardsThisSession = 0;
                updatesForPlayer.isHost = !room?.hostId;
            }

            update(playerRefForSetup, updatesForPlayer ).then(() => {
                onDisconnect(playerOnlineStatusRef).set(false);
                if (!wasPlayerNodeExisting) {
                    addSystemMessage(`[[SYSTEM_JOINED]]`, nameForFirebaseUpdate);
                }
            });
          });
        }
      });
    }

    return () => {
      off(roomRefVal, 'value', onRoomValueChange);
      if (connectedListener && playerConnectionsRef) {
        off(playerConnectionsRef, 'value', connectedListener);
      }
      if (playerOnlineStatusRef) {
        onDisconnect(playerOnlineStatusRef).cancel();
      }
    };
  }, [roomId, playerId, playerName, isAuthenticated, toast, addSystemMessage, authPlayerId, routerHook, isLoading]);

  useEffect(() => {
    if (!room || !room.players || !playerId ) {
        prevPlayersRef.current = room?.players ? JSON.parse(JSON.stringify(room.players)) : undefined;
        return;
    }

    const currentPlayers = room.players;
    const previousPlayers = prevPlayersRef.current || {};

    Object.keys(currentPlayers).forEach(pId => {
        const currentPlayerInfo = currentPlayers[pId];
        const prevPlayerInfo = previousPlayers[pId];

        if (!currentPlayerInfo || !currentPlayerInfo.name) return;

        if (pId === playerId) {
          if (playerName !== currentPlayerInfo.name && isAuthenticated && authPlayerId === pId) {
              setPlayerName(currentPlayerInfo.name);
              localStorage.setItem('drawlyUserDisplayName', currentPlayerInfo.name);
          }
          return;
        }

        if (!prevPlayerInfo && currentPlayerInfo.isOnline) {
            toast({
                title: `${currentPlayerInfo.name} Joined!`,
                description: `Welcome to the room, ${currentPlayerInfo.name}!`,
                variant: "default",
                duration: 3000,
            });
        } else if (prevPlayerInfo && currentPlayerInfo.isOnline !== prevPlayerInfo.isOnline) {
            toast({
                title: `${currentPlayerInfo.name} is now ${currentPlayerInfo.isOnline ? "Online" : "Offline"}`,
                variant: currentPlayerInfo.isOnline ? "default" : "destructive",
                duration: 2500,
            });
        }
    });
    prevPlayersRef.current = JSON.parse(JSON.stringify(currentPlayers));
  }, [room?.players, playerId, toast, playerName, isAuthenticated, authPlayerId]);


  useEffect(() => {
    if (!room || room.gameState !== 'drawing' || room.hostId !== playerId || !room.roundEndsAt || processingTurnEndRef.current) {
        if (roundTimerRef.current) {
            clearTimeout(roundTimerRef.current);
            roundTimerRef.current = null;
        }
        return;
    }

    const now = Date.now();
    const timeLeftMs = room.roundEndsAt - now;
    const callInstanceId = `timerEffect_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[${callInstanceId}] Timer effect evaluating. Time left: ${timeLeftMs}ms. Client lock: ${processingTurnEndRef.current}`);


    if (timeLeftMs <= 0) {
        console.log(`[${callInstanceId}] Timer already expired or due. Calling endCurrentDrawingTurn.`);
        if (!processingTurnEndRef.current) {
             endCurrentDrawingTurn("Timer ran out!");
        } else {
             console.log(`[${callInstanceId}] Timer expired, but client lock is true. Skipping endCurrentDrawingTurn call.`);
        }
    } else {
        if (roundTimerRef.current) {
            clearTimeout(roundTimerRef.current);
        }
        roundTimerRef.current = setTimeout(() => {
            console.log(`[${callInstanceId}] setTimeout triggered. Client lock: ${processingTurnEndRef.current}`);
            if (!processingTurnEndRef.current) {
                 get(ref(database, `rooms/${roomId}`)).then(snap => { // Re-fetch latest room state
                    if (snap.exists()) {
                        const latestRoomData = snap.val() as Room;
                        if (latestRoomData.gameState === 'drawing' &&
                            latestRoomData.hostId === playerId &&
                            latestRoomData.roundEndsAt &&
                            Date.now() >= latestRoomData.roundEndsAt) {
                           console.log(`[${callInstanceId}] setTimeout: Conditions met. Calling endCurrentDrawingTurn.`);
                           endCurrentDrawingTurn("Timer ran out!");
                        } else {
                           console.log(`[${callInstanceId}] setTimeout: Conditions NOT met after re-fetch. GameState: ${latestRoomData.gameState}, IsHost: ${latestRoomData.hostId === playerId}, RoundEndsAt: ${latestRoomData.roundEndsAt}`);
                        }
                    }
                 });
            } else {
                console.log(`[${callInstanceId}] setTimeout: Client lock is true. Skipping endCurrentDrawingTurn call.`);
            }
            roundTimerRef.current = null;
        }, timeLeftMs);
        console.log(`[${callInstanceId}] Timer set for ${timeLeftMs}ms.`);
    }

    return () => {
        if (roundTimerRef.current) {
            console.log(`[${callInstanceId}] Clearing timer on effect cleanup.`);
            clearTimeout(roundTimerRef.current);
            roundTimerRef.current = null;
        }
    };
  }, [room?.gameState, room?.roundEndsAt, room?.hostId, playerId, endCurrentDrawingTurn, roomId]);


  useEffect(() => {
    if (room?.gameState === 'round_end' && playerId === room?.hostId) {
        const NEXT_TURN_DELAY_SECONDS = 5;
        setRoundEndCountdown(NEXT_TURN_DELAY_SECONDS);

        const countdownInterval = setInterval(() => {
            setRoundEndCountdown(prev => (prev ? prev - 1 : null));
        }, 1000);

        const nextRoundTimer = setTimeout(async () => {
            clearInterval(countdownInterval);
            setRoundEndCountdown(null);

            const currentRoomSnap = await get(ref(database, `rooms/${roomId}`));
            if (currentRoomSnap.exists()) {
                const currentRoomState = currentRoomSnap.val() as Room;
                 if (currentRoomState.gameState === 'round_end') {
                    await advanceGameToNextStep('round_ended');
                }
            }
        }, NEXT_TURN_DELAY_SECONDS * 1000);

        return () => {
            clearTimeout(nextRoundTimer);
            clearInterval(countdownInterval);
            setRoundEndCountdown(null);
        };
    } else if (room?.gameState !== 'round_end') {
        setRoundEndCountdown(null);
    }
  }, [room?.gameState, room?.hostId, playerId, advanceGameToNextStep, roomId]);


  useEffect(() => {
    if (room?.gameState === 'word_selection' && room?.hostId === playerId && room?.wordSelectionEndsAt && !room?.currentPattern) {
      const now = Date.now();
      const timeLeftMs = room.wordSelectionEndsAt - now;
      let timer: NodeJS.Timeout | null = null;

      const timeoutIdentifier = `${room.currentDrawerId}_${room.wordSelectionEndsAt}`;

      if (timeLeftMs <= 0) {
        if (lastProcessedTimeoutRef.current !== timeoutIdentifier) {
            get(ref(database, `rooms/${roomId}`)).then(snap => {
                if (snap.exists()) {
                    const latestRoomData = snap.val() as Room;
                    if (latestRoomData.gameState === 'word_selection' &&
                        latestRoomData.hostId === playerId &&
                        !latestRoomData.currentPattern &&
                        latestRoomData.wordSelectionEndsAt && Date.now() >= latestRoomData.wordSelectionEndsAt
                        ) {
                        lastProcessedTimeoutRef.current = timeoutIdentifier;
                        const drawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                        toast({ title: "Word Selection Timed Out", description: `${drawerName} didn't choose a word. Next turn...`, variant: "default" });
                        addSystemMessage(`${drawerName} didn't choose. Next turn!`);
                        advanceGameToNextStep('drawer_timed_out_selection');
                    }
                }
            });
        }
      } else {
        timer = setTimeout(() => {
          if (lastProcessedTimeoutRef.current !== timeoutIdentifier) {
           get(ref(database, `rooms/${roomId}`)).then(snap => {
             if (snap.exists()) {
                 const latestRoomData = snap.val() as Room;
                 if (latestRoomData.gameState === 'word_selection' &&
                     latestRoomData.hostId === playerId &&
                     !latestRoomData.currentPattern &&
                     latestRoomData.wordSelectionEndsAt &&
                     Date.now() >= latestRoomData.wordSelectionEndsAt
                     ) {
                    lastProcessedTimeoutRef.current = timeoutIdentifier;
                    const currentDrawerName = latestRoomData.currentDrawerId && latestRoomData.players[latestRoomData.currentDrawerId] ? latestRoomData.players[latestRoomData.currentDrawerId].name : "The drawer";
                    toast({ title: "Word Selection Timed Out", description: `${currentDrawerName} didn't choose a word. Next turn...`, variant: "default" });
                    addSystemMessage(`${currentDrawerName} didn't choose. Next turn!`);
                    advanceGameToNextStep('drawer_timed_out_selection');
                 }
             }
            });
           }
        }, timeLeftMs);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [room?.gameState, room?.hostId, playerId, room?.wordSelectionEndsAt, room?.currentPattern, room?.currentDrawerId, room?.players, advanceGameToNextStep, toast, roomId, addSystemMessage]);

  const handleManualCloseToast = useCallback((toastUniqueId: string) => {
    setToastMessages(prevToasts => prevToasts.filter(t => t.uniqueId !== toastUniqueId));
    if (toastTimeoutsRef.current[toastUniqueId]) {
        clearTimeout(toastTimeoutsRef.current[toastUniqueId]);
        delete toastTimeoutsRef.current[toastUniqueId];
    }
  }, []);

  useEffect(() => {
    if (!memoizedGuesses || memoizedGuesses.length === 0 || !playerId) return;

    const latestGuess = memoizedGuesses[memoizedGuesses.length - 1];
    if (!latestGuess) return;

    const potentialToastId = `toast-${latestGuess.timestamp}-${latestGuess.playerId}-${(latestGuess.text || "").substring(0,10)}`;


    if (
        latestGuess.playerId !== playerId &&
        latestGuess.playerId !== 'system' &&
        !(latestGuess.text || "").startsWith('[[SYSTEM_')
    ) {

        setToastMessages(prevToasts => {
            if (prevToasts.some(t => t.timestamp === latestGuess.timestamp && t.playerId === latestGuess.playerId && t.text === latestGuess.text)) {
                return prevToasts;
            }

            toastIdCounter.current +=1;
            const newToastIdWithCounter = `${potentialToastId}-${toastIdCounter.current}`;
            const newToastMessage = { ...latestGuess, uniqueId: newToastIdWithCounter };

            let updatedToasts = [newToastMessage, ...prevToasts];
            let removedToasts: Array<Guess & { uniqueId: string }> = [];

            if (updatedToasts.length > TOAST_MAX_COUNT) {
                removedToasts = updatedToasts.slice(TOAST_MAX_COUNT);
                updatedToasts = updatedToasts.slice(0, TOAST_MAX_COUNT);
            }

            removedToasts.forEach(rt => {
                if (toastTimeoutsRef.current[rt.uniqueId]) {
                    clearTimeout(toastTimeoutsRef.current[rt.uniqueId]);
                    delete toastTimeoutsRef.current[rt.uniqueId];
                }
            });

            const timeoutId = setTimeout(() => {
                setToastMessages(currentToasts => currentToasts.filter(t => t.uniqueId !== newToastIdWithCounter));
                if (toastTimeoutsRef.current[newToastIdWithCounter]) {
                    delete toastTimeoutsRef.current[newToastIdWithCounter];
                }
            }, 3000);
            toastTimeoutsRef.current[newToastIdWithCounter] = timeoutId;

            return updatedToasts;
        });
    }
  }, [memoizedGuesses, playerId]);

  useEffect(() => {
    return () => {
        Object.values(toastTimeoutsRef.current).forEach(clearTimeout);
        toastTimeoutsRef.current = {};
    }
  }, []);

  useEffect(() => {
    if (room?.gameState === 'game_over' &&
        playerId === room?.hostId &&
        room.players &&
        room.config &&
        platformSettings.referralProgramEnabled &&
        !isLoadingPlatformSettings) {
      if (!gameOverProcessedRef.current) {
        gameOverProcessedRef.current = true;

        const totalPlayersInGame = Object.keys(room.players).length;
        const totalConfiguredRounds = room.config.totalRounds;

        const fullGameCompleted = (room.currentRoundNumber > totalConfiguredRounds) || (room.currentRoundNumber === totalConfiguredRounds && (room.currentTurnInRound || 0) >= (room.playerOrderForCurrentRound?.length || 0) -1);


        Object.values(room.players).forEach(async (p) => {
          if (p.id && !p.isAnonymous) {
            const userProfileRef = ref(database, `users/${p.id}`);
            const userProfileSnap = await get(userProfileRef);

            if (userProfileSnap.exists()) {
              const userProfile = userProfileSnap.val() as UserProfile;
              if (userProfile.referredBy && userProfile.referredBy !== p.id) {
                const referrerId = userProfile.referredBy;
                const referrerProfileSnap = await get(ref(database, `users/${referrerId}`));

                if (referrerProfileSnap.exists()) {
                  const referrerName = referrerProfileSnap.val().displayName || "Referrer";

                  let actualReward = 0;
                  if (!fullGameCompleted && !(room.currentRoundNumber > totalConfiguredRounds) ) {
                      console.log(`[ReferralReward] Game for ${p.name} (referred) did not complete all ${totalConfiguredRounds} rounds. Current round: ${room.currentRoundNumber}. No reward.`);
                  } else if (totalPlayersInGame < MIN_PLAYERS_FOR_REWARD) {
                      console.log(`[ReferralReward] Game for ${p.name} (referred) had ${totalPlayersInGame} players, less than min ${MIN_PLAYERS_FOR_REWARD}. No reward.`);
                  } else if (totalConfiguredRounds < MIN_ROUNDS_FOR_REWARD) {
                      console.log(`[ReferralReward] Game for ${p.name} (referred) had ${totalConfiguredRounds} rounds configured, less than min ${MIN_ROUNDS_FOR_REWARD}. No reward.`);
                  } else {
                      const calculatedReward = REFERRAL_REWARD_BASE_RATE * totalPlayersInGame * totalConfiguredRounds * 1;
                      actualReward = Math.min(calculatedReward, MAX_REWARD_PER_GAME);
                  }

                  if (actualReward > 0) {
                    try {
                      await runTransaction(ref(database, `users/${referrerId}/totalEarnings`), (currentEarnings) => {
                        return (currentEarnings || 0) + actualReward;
                      });

                      const transactionsRef = ref(database, `transactions/${referrerId}`);
                      const newTransaction: Transaction = {
                        date: serverTimestamp() as number,
                        description: `Reward from ${p.name} (Played ${totalConfiguredRounds} rounds with ${totalPlayersInGame} players)`,
                        amount: actualReward,
                        type: 'earning',
                        status: 'Earned',
                        currency: referrerProfileSnap.val().currency || 'INR',
                      };
                      await push(transactionsRef, newTransaction);

                      const roomPlayerReferrerRef = ref(database, `rooms/${roomId}/players/${referrerId}/referralRewardsThisSession`);
                      await runTransaction(roomPlayerReferrerRef, (currentRoomRewards) => (currentRoomRewards || 0) + actualReward);

                      addSystemMessage(`[[SYSTEM_REFERRAL_REWARD]]${referrerName} earned ${referrerProfileSnap.val().currency === 'USD' ? '$' : '₹'}${actualReward.toFixed(2)} because ${p.name} completed a full game!`);

                    } catch (e) {
                      console.error("Error awarding dynamic referral reward:", e);
                      toast({title: "Referral Reward Error", description: `Failed to process reward for ${referrerName}.`, variant: "destructive"})
                    }
                  } else {
                      console.log(`[ReferralReward] Referrer ${referrerName} for player ${p.name} earned no reward based on game engagement criteria.`);
                  }
                }
              }
            }
          }
        });
      }
    } else if (room?.gameState !== 'game_over') {
      gameOverProcessedRef.current = false;
    }
  }, [room?.gameState, room?.players, playerId, room?.hostId, room?.config, room?.currentRoundNumber, room?.currentTurnInRound, room?.playerOrderForCurrentRound, roomId, addSystemMessage, toast, platformSettings.referralProgramEnabled, isLoadingPlatformSettings]);


  if (isLoading || isLoadingPlatformSettings || !playerId || !playerName) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-xl text-foreground">Loading Room...</span></div>;
  if (error) return <div className="text-center text-destructive p-8 bg-destructive/10 border border-destructive/20 rounded-md h-screen flex flex-col justify-center items-center"><AlertCircle className="mx-auto h-12 w-12 mb-4" /> <h2 className="text-2xl font-semibold mb-2">Error Loading Room</h2><p>{error}</p><Button onClick={() => routerHook.push('/')} className="mt-4">Go Home</Button></div>;
  if (!room || !room.config) return <div className="text-center p-8 h-screen flex flex-col justify-center items-center">Room data is not available or incomplete. <Link href="/" className="text-primary hover:underline">Go Home</Link></div>;

  const isCurrentPlayerDrawing = room.currentDrawerId === playerId;
  const currentDrawerName = room.currentDrawerId && room.players[room.currentDrawerId] ? room.players[room.currentDrawerId].name : "Someone";
  const hasPlayerGuessedCorrectly = (room.correctGuessersThisRound || []).includes(playerId);

  const getStartButtonInfo = () => {
    if (!room) return null;
    if (room.gameState === 'waiting') return { text: 'Start Game', icon: <Play className="h-5 w-5" /> };
    if (room.gameState === 'game_over') return { text: 'Play Again', icon: <RotateCcw className="h-5 w-5" /> };
    return null;
  };
  const startButtonInfo = getStartButtonInfo();


  return (
    <>
    <div className="max-w-md mx-auto border border-black flex flex-col select-none overflow-hidden" style={{ height: "100vh", maxHeight: "900px", minHeight: "700px" }}>
      <Dialog open={isSettingsDialogOpenLocal} onOpenChange={setIsSettingsDialogOpenLocal}>
        <MobileTopBar
            room={room}
            playerId={playerId}
            isSettingsDialogOpen={isSettingsDialogOpenLocal}
            setIsSettingsDialogOpen={setIsSettingsDialogOpenLocal}
            onDrawerLetterClick={handleDrawerLetterClick}
            isLeavingRoom={isLeavingRoom}
            authPlayerId={authPlayerId}
            isAuthenticated={isAuthenticated}
        />
        <SettingsDialogContent
            onCopyLink={handleCopyLink}
            onLeaveRoom={handleLeaveRoom}
            isLeavingRoom={isLeavingRoom}
            isAuthenticated={isAuthenticated}
            authPlayerId={authPlayerId}
        />
      </Dialog>

      <div className={cn(
          "flex-grow flex flex-col gap-1 p-1 min-h-0 overflow-y-auto",
          isMobile && "pb-16"
      )}>

        <div className="h-3/5 w-full flex-shrink-0 relative">
          <DrawingCanvas
            drawingData={memoizedDrawingData}
            onDraw={handleDraw}
            currentDrawerId={room.currentDrawerId}
            playerId={playerId}
            isDrawingEnabled={isCurrentPlayerDrawing && room.gameState === 'drawing'}
            clearCanvas={handleClearCanvas}
            currentDrawerName={currentDrawerName}
            gameState={room.gameState}
            isHost={room.hostId === playerId}
            onStartGame={manageGameStart}
            startButtonInfo={startButtonInfo}
            canStartGame={(room.gameState === 'waiting' || room.gameState === 'game_over') && Object.values(room.players || {}).filter((p: Player)=>p.isOnline).length >= MIN_PLAYERS_TO_START_GAME}
            isStartingNextRoundOrGame={isStartingNextRoundOrGame}
            aiSketchDataUri={room.aiSketchDataUri}
            onDrawWithAI={isCurrentPlayerDrawing ? handleDrawWithAI : undefined}
            isGeneratingAISketch={isGeneratingAISketch}
          />
          {toastMessages.length > 0 && (
            <div className="absolute bottom-2 right-2 flex flex-col-reverse gap-2 z-20">
              {toastMessages.map((message) => (
                <div
                  key={message.uniqueId}
                  className={cn(
                    "relative p-2 rounded-md shadow-lg text-xs max-w-[150px] sm:max-w-[180px] animate-in fade-in duration-300 break-words overflow-wrap-break-word",
                    message.isCorrect ? "bg-green-100 text-green-700 border border-green-300" : "bg-card text-card-foreground border border-border"
                  )}
                >
                  <span className="font-semibold">{message.playerName}:</span> {message.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-grow flex flex-row gap-1 min-h-0 w-full">
            <div className="w-1/2 h-full">
                <PlayerList
                players={playersArray}
                currentPlayerId={room.currentDrawerId}
                playerId={playerId}
                hostId={room.hostId}
                correctGuessersThisRound={room.correctGuessersThisRound || []}
                isMinimized={isPlayerListMinimized}
                setIsMinimized={setIsPlayerListMinimized}
                referralProgramEnabled={platformSettings.referralProgramEnabled}
                />
            </div>
            <div className="w-1/2 h-full">
                <ChatArea
                guesses={memoizedGuesses}
                gameState={room.gameState}
                playerId={playerId}
                currentDrawerId={room.currentDrawerId}
                correctGuessersThisRound={room.correctGuessersThisRound}
                referralProgramEnabled={platformSettings.referralProgramEnabled}
                />
            </div>
        </div>
      </div>

      <div
        className={cn(
          "p-1 border-t bg-background w-full",
          isMobile
            ? "fixed bottom-0 left-0 right-0 z-30"
            : "flex-shrink-0"
        )}
      >
          <GuessInput onGuessSubmit={handleGuessSubmit} disabled={isSubmittingGuess} isSubmittingGuess={isSubmittingGuess} />
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
            room={room}
            players={playersArray}
            isHost={room.hostId === playerId}
            onPlayAgain={manageGameStart}
            canPlayAgain={Object.values(room.players || {}).filter(p=>p.isOnline).length >= MIN_PLAYERS_TO_START_GAME}
            roundEndCountdown={roundEndCountdown}
            isStartingNextRoundOrGame={isStartingNextRoundOrGame}
        />
    )}

    <AlertDialog open={isRevealConfirmDialogOpen} onOpenChange={(open) => {
        setIsRevealConfirmDialogOpenLocal(open);
        if (!open) setLetterToRevealInfo(null);
    }}>
      {letterToRevealInfo && (
        <RevealConfirmDialogContent
            letterChar={letterToRevealInfo.char}
            onCancel={() => {
                setIsRevealConfirmDialogOpenLocal(false);
                setLetterToRevealInfo(null);
            }}
            onConfirm={handleConfirmLetterRevealByDrawer}
            isRevealingLetter={isRevealingLetter}
        />
      )}
    </AlertDialog>
    </>
  );
}

const generateFallbackWords = (count: number, maxWordLength?: number, previouslyUsedWords?: string[]): string[] => {
    const defaultFallbackWordsLarge = [
        "Apple", "House", "Star", "Car", "Tree", "Book", "Sun", "Moon", "Chair", "Guitar",
        "Lamp", "Phone", "Key", "Door", "Clock", "Shoes", "Hat", "Banana", "Orange", "Grape",
        "Bread", "Cheese", "Pizza", "Cloud", "Pencil", "Brush", "Plane", "Train", "Boat",
        "Ball", "Box", "Cup", "Fish", "Duck", "Kite", "Drum", "Cake", "Sock", "Fork",
        "Spoon", "Plate", "Plant", "Flower", "Dog", "Cat", "Bird", "Mouse", "Bear", "Lion",
        "Tiger", "Snake", "Spider", "Ant", "Bee", "Ladybug", "Butterfly", "Snail", "Frog",
        "Shirt", "Pants", "Dress", "Socks", "Scarf", "Gloves", "Ring", "Necklace", "Watch",
        "Table", "Bed", "Sofa", "Mirror", "Window", "Stairs", "Bridge", "Road", "River",
        "Mountain", "Volcano", "Island", "Beach", "Forest", "Desert", "Rainbow", "Anchor",
        "Balloon", "Candle", "Camera", "Computer", "Dice", "Earrings", "Feather", "Flag",
        "Fountain", "Hammer", "Helmet", "Igloo", "Jacket", "Ladder", "Magnet", "Medal",
        "Microphone", "Notebook", "Octopus", "Pear", "Pineapple", "Pyramid", "Quilt",
        "Robot", "Rocket", "Sailboat", "Scissors", "Shovel", "Skateboard", "Suitcase",
        "Swing", "Sword", "Telescope", "Tent", "Trophy", "Trumpet", "Umbrella", "Unicorn",
        "Vase", "Violin", "Wallet", "Wheel", "Whistle", "Yacht", "Zebra", "Zipper"
    ];
    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    let finalWords: string[] = [];
    const localUsedWords = new Set((previouslyUsedWords || []).map(w => w.toLowerCase()));

    for (const fb of shuffleArray(defaultFallbackWordsLarge)) {
        if (finalWords.length >= count) break;
        const fbLower = fb.toLowerCase();
        if (!localUsedWords.has(fbLower) &&
            !finalWords.map(w => w.toLowerCase()).includes(fbLower) &&
            (maxWordLength ? fb.length <= maxWordLength : true)
        ) {
            finalWords.push(fb);
        }
    }

    const absolutePads = ["Pencil", "Paper", "Note", "Clip", "Pin", "Item", "Thing", "Object", "Icon", "Symbol"];
    let padIdx = 0;
    while(finalWords.length < count){
        const baseWord = absolutePads[padIdx % absolutePads.length];
        let potentialWord = baseWord;
        let attempt = 0;
        while(finalWords.map(w=>w.toLowerCase()).includes(potentialWord.toLowerCase()) || localUsedWords.has(potentialWord.toLowerCase())) {
            attempt++;
            potentialWord = baseWord + attempt;
            if (attempt > 10) {
                potentialWord = baseWord + Math.floor(Math.random()*1000);
                if(finalWords.map(w=>w.toLowerCase()).includes(potentialWord.toLowerCase()) || localUsedWords.has(potentialWord.toLowerCase())){
                   potentialWord = baseWord + "X" + Math.floor(Math.random()*1000);
                }
                break;
            }
        }
         if (maxWordLength ? potentialWord.length <= maxWordLength : true) {
             finalWords.push(potentialWord);
         } else {
            const shortBase = baseWord.substring(0, Math.min(baseWord.length, (maxWordLength || 20) - 2));
            finalWords.push(shortBase + Math.floor(Math.random()*10));
         }
        padIdx++;
    }
    return finalWords.slice(0, count);
};
