
"use client"; // Add this directive

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { APP_NAME } from '@/lib/config';
import { Mail, Home } from 'lucide-react';
import Link from 'next/link';

export default function ContactUsPage() {
  // Basic form submission handler (does not actually send email)
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    alert('Thank you for your message! This is a placeholder and your message has not been sent.');
    // In a real app, you would handle form submission here (e.g., send to an API)
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <Mail className="mr-3 h-8 w-8 text-primary" />
            Contact Us
          </CardTitle>
          <CardDescription>
            Have questions, feedback, or need support? Reach out to the {APP_NAME} team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" type="text" placeholder="Regarding..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="Your message here..." rows={5} required />
            </div>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
          <div className="mt-8 text-center text-muted-foreground">
            <p className="text-sm">
              Alternatively, you can email us directly at: <a href="mailto:drawly.devifyo.com" className="text-primary hover:underline">drawly.devifyo.com</a>
            </p>
          </div>
          <div className="mt-8 text-center">
            <Link href="/" passHref>
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Back to Game Lobby
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
