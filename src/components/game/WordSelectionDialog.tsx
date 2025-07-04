
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Lightbulb, Edit3 } from 'lucide-react';

const MinimalTimerDisplay = ({ targetTime, defaultSeconds }: { targetTime?: number | null, defaultSeconds: number }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!targetTime || targetTime <= Date.now()) {
      setTimeLeft(Math.max(0, defaultSeconds)); return;
    }
    const calculateTimeLeft = () => setTimeLeft(Math.max(0, Math.floor((targetTime - Date.now()) / 1000)));
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [targetTime, defaultSeconds]);

  if (timeLeft === null) return <div className="text-xs font-bold">...</div>;
  return <div className="rounded-full border border-black bg-white w-8 h-8 flex items-center justify-center text-[10px] font-bold">{timeLeft}</div>;
};


interface WordSelectionDialogProps {
  isOpen: boolean;
  maxWordLength: number;
  selectableWords: string[];
  onConfirmWord: (word: string) => void;
  isSubmittingWord: boolean;
  wordSelectionEndsAt: number | null;
}

export function WordSelectionDialog({
  isOpen,
  maxWordLength,
  selectableWords,
  onConfirmWord,
  isSubmittingWord,
  wordSelectionEndsAt,
}: WordSelectionDialogProps) {
  const [customWordInput, setCustomWordInput] = useState('');
  const [localSubmittingWord, setLocalSubmittingWord] = useState<string | null>(null);


  const handleSuggestedWordClick = (word: string) => {
    if (isSubmittingWord) return;
    setLocalSubmittingWord(word);
    onConfirmWord(word); 
  };

  const handleCustomWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWordInput.trim() || isSubmittingWord) return;
    setLocalSubmittingWord('__custom__');
    onConfirmWord(customWordInput.trim());
    // setCustomWordInput(''); // Keep input for a moment so loader shows on it
  };

  useEffect(() => {
    if (!isSubmittingWord) {
      setLocalSubmittingWord(null);
      if (localSubmittingWord === '__custom__') setCustomWordInput(''); // Clear after submission ends
    }
  }, [isSubmittingWord, localSubmittingWord]);


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Controlled by parent via conditional rendering */ }}>
      <DialogContent className="sm:max-w-[480px] shadow-xl border-border/80 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Lightbulb className="text-yellow-400" /> Choose a word to draw
          </DialogTitle>
          <DialogDescription>
            Select one of the suggested words or enter your own custom word below. Max word length: {maxWordLength} chars.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
            {(selectableWords || []).map(word => (
              <Button
                key={word}
                variant="secondary"
                className="text-base sm:text-lg px-4 py-2 sm:px-6 sm:py-3"
                onClick={() => handleSuggestedWordClick(word)}
                disabled={isSubmittingWord}
              >
                {isSubmittingWord && localSubmittingWord === word ? <Loader2 className="animate-spin mr-2" /> : null}
                {word}
              </Button>
            ))}
            {(selectableWords || []).length === 0 && <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" />Loading AI suggestions...</p>}
          </div>
          <form onSubmit={handleCustomWordSubmit} className="space-y-3">
            <label htmlFor="customWord" className="text-base sm:text-md font-medium text-foreground">Or enter your custom word:</label>
            <div className="flex gap-2">
              <Input
                id="customWord"
                type="text"
                value={customWordInput}
                onChange={(e) => setCustomWordInput(e.target.value)}
                placeholder={`Max ${maxWordLength} chars`}
                maxLength={maxWordLength}
                className="flex-grow"
                disabled={isSubmittingWord}
              />
              <Button type="submit" disabled={isSubmittingWord || !customWordInput.trim()}>
                {isSubmittingWord && localSubmittingWord === '__custom__' ? <Loader2 className="animate-spin mr-2" /> : <Edit3 className="mr-2 h-4 w-4" />}
                Draw This
              </Button>
            </div>
          </form>
        </div>
        {wordSelectionEndsAt && (
          <div className="text-center mt-2 text-sm">
            <MinimalTimerDisplay targetTime={wordSelectionEndsAt} defaultSeconds={15} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
