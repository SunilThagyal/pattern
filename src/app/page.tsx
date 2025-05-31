
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Paintbrush, Users, Zap } from 'lucide-react';
import Image from 'next/image';
import { APP_NAME } from '@/lib/config';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-full max-w-3xl animate-in fade-in duration-500">
      <Image 
        src="/placehold.jpg" 
        alt={`${APP_NAME} game banner`}
        width={300} 
        height={200} 
        className="mb-8 rounded-lg shadow-xl"
        data-ai-hint="abstract art party"
      />
      <h1 className="text-5xl font-extrabold tracking-tight mb-4">
        Welcome to <span className="text-primary">{APP_NAME}</span>!
      </h1>
      <p className="text-lg text-muted-foreground mb-10 max-w-xl">
        Unleash your inner artist! Draw, challenge your friends, and guess your way to victory in this exciting real-time multiplayer game, now with AI-powered word suggestions and sketch assistance!
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 w-full max-w-md">
        <Link href="/create-room" passHref>
          <Button size="lg" className="w-full py-8 text-lg shadow-lg hover:shadow-xl transition-shadow">
            <Paintbrush className="mr-2 h-6 w-6" /> Create New Room
          </Button>
        </Link>
        <Link href="/join" passHref>
          <Button variant="secondary" size="lg" className="w-full py-8 text-lg shadow-lg hover:shadow-xl transition-shadow">
            <Users className="mr-2 h-6 w-6" /> Join Existing Room
          </Button>
        </Link>
      </div>

      <div className="mt-8 w-full">
        <h2 className="text-2xl font-semibold mb-6">How to Play</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Paintbrush className="mr-2 text-primary" />Draw</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>One player gets a word to draw (or use AI sketch!). Get creative!</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Zap className="mr-2 text-accent" />Guess</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Other players race to guess the drawing. Type your guesses quickly!</CardDescription>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><Users className="mr-2 text-primary" />Score</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Earn points for correct guesses and for your drawing skills!</CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

