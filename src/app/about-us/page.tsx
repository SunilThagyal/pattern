
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { APP_NAME } from '@/lib/config';
import { Info } from 'lucide-react';

export default function AboutUsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <Info className="mr-3 h-8 w-8 text-primary" />
            About {APP_NAME}
          </CardTitle>
          <CardDescription>Learn more about our game and mission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            Welcome to {APP_NAME}! We are passionate about creating fun, engaging, and creative
            multiplayer experiences for everyone. Our goal is to bring people together through
            the joy of drawing and guessing.
          </p>
          <p>
            {APP_NAME} was born from a simple idea: to make a classic drawing game accessible
            to anyone, anywhere, with a modern twist. We've incorporated AI features to enhance
            gameplay and provide unique challenges.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">Our Vision</h2>
          <p>
            We envision a world where creativity and social interaction go hand-in-hand.
            {APP_NAME} aims to be a platform where friends, families, and even new acquaintances
            can connect, laugh, and showcase their artistic (or not-so-artistic!) talents.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">What We Offer</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Real-time multiplayer drawing and guessing games.</li>
            <li>Easy room creation and joining.</li>
            <li>Fun AI-powered features like word suggestions and AI sketches.</li>
            <li>A vibrant and friendly community.</li>
          </ul>
          <p className="pt-4">
            Thank you for playing {APP_NAME}. We are constantly working to improve the game
            and add new features. Your feedback is always welcome!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
