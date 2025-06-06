
"use client";

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSimulatedAuth = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!email.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please enter both email and password.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    // Simulate backend validation / user creation
    setTimeout(() => {
      const nameParts = email.split('@');
      const dummyNameFromEmail = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "User" + Math.floor(Math.random() * 1000);
      const dummyUid = `uid_${Math.random().toString(36).substr(2, 9)}`;

      localStorage.setItem('drawlyAuthStatus', 'loggedIn');
      localStorage.setItem('drawlyUserDisplayName', dummyNameFromEmail);
      localStorage.setItem('drawlyUserUid', dummyUid);
      
      toast({ title: "Success!", description: `Welcome, ${dummyNameFromEmail}! You are now logged in.`});
      router.push('/'); 
      setIsLoading(false);
    }, 1000); 
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Login or Sign Up</CardTitle>
          <CardDescription className="text-center">
            Join {APP_NAME} to save your progress and use referral features.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSimulatedAuth}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-lg">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="text-base py-6"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-lg">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="text-base py-6"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Login / Sign Up
                </>
              )}
            </Button>
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                Maybe later? Back to Home
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
