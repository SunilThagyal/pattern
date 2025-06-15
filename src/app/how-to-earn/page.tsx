
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { APP_NAME, REFERRAL_REWARD_BASE_RATE, MIN_PLAYERS_FOR_REWARD, MIN_ROUNDS_FOR_REWARD, MAX_REWARD_PER_GAME } from '@/lib/config';
import { Gift, Users, Play, DollarSign, ArrowRight, Home, Info } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `How to Earn Rewards with ${APP_NAME}`,
  description: `Learn how to earn real rewards with ${APP_NAME}'s referral program. Invite friends, play together, and get paid!`,
  keywords: `earn money, referral program, ${APP_NAME} rewards, play and earn, online game earnings, referral bonus, how to make money online`,
};

export default function HowToEarnPage() {
  const usdToInrRate = 83; 
  const referralRewardBaseRateUSD = (REFERRAL_REWARD_BASE_RATE / usdToInrRate).toFixed(4); 

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8 max-w-3xl">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="text-center border-b border-border pb-6">
          <div className="flex justify-center mb-4">
            <DollarSign className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-extrabold text-primary">
            Earn Rewards with {APP_NAME}!
          </CardTitle>
          <CardDescription className="text-md md:text-lg text-muted-foreground mt-2">
            Discover how you can turn your creativity and social connections into real rewards.
            Play fun games, invite friends, and watch your earnings grow!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 text-foreground pt-6">

          <section className="p-6 bg-secondary/30 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-accent">
              <Gift className="mr-3 h-7 w-7" /> The {APP_NAME} Referral Program
            </h2>
            <p className="mb-4 text-muted-foreground">
              Our referral program is the primary way to earn rewards. It's simple: invite friends to join {APP_NAME},
              and when they sign up using your referral link and play qualifying games, you earn!
            </p>
            <ol className="list-decimal list-inside space-y-4 pl-4">
              <li>
                <strong className="text-foreground">Get Your Unique Referral Link:</strong>
                <ul className="list-disc list-inside pl-5 mt-1.5 text-sm text-muted-foreground space-y-1">
                  <li>First, <Link href="/auth?action=signup" className="text-primary hover:underline font-medium">sign up or log in</Link> to {APP_NAME}.</li>
                  <li>Once logged in, visit your <Link href="/" className="text-primary hover:underline font-medium">Homepage</Link> (you'll see your code there) or the <Link href="/earnings" className="text-primary hover:underline font-medium">Earnings Dashboard</Link>.</li>
                  <li>Your unique 5-character referral code will be displayed. You can copy a direct referral link.</li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Share Your Link:</strong>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Share your referral link with friends, family, on social media, or anywhere you connect with potential players!
                </p>
              </li>
              <li>
                <strong className="text-foreground">You Earn When They Play & Qualify:</strong>
                <p className="text-sm text-muted-foreground mt-1.5">
                  You earn a reward when a user you referred (the "referee"):
                </p>
                <ul className="list-disc list-inside pl-5 mt-1.5 space-y-1 text-sm text-muted-foreground">
                  <li>Signs up using your referral link (or enters your code during signup).</li>
                  <li>Completes a full game session.</li>
                  <li>The game session must have at least <strong>{MIN_PLAYERS_FOR_REWARD} players</strong>.</li>
                  <li>The game must be configured for at least <strong>{MIN_ROUNDS_FOR_REWARD} rounds</strong>.</li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Reward Calculation (Example):</strong>
                <p className="text-sm text-muted-foreground mt-1.5">
                  You earn approximately <strong>₹{REFERRAL_REWARD_BASE_RATE.toFixed(2)} (or ~${referralRewardBaseRateUSD})</strong> for *each player* in *each round* of a qualifying game completed by your referee.
                  The maximum you can earn from a single game completed by one referee is <strong>₹{MAX_REWARD_PER_GAME.toFixed(2)} (or ~${(MAX_REWARD_PER_GAME/usdToInrRate).toFixed(2)} USD)</strong>.
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  <em>Example:</em> If your referred friend plays a 3-round game with 4 players, and all conditions are met, you could earn:
                  (₹{REFERRAL_REWARD_BASE_RATE.toFixed(2)} × 4 players × 3 rounds) = ₹{(REFERRAL_REWARD_BASE_RATE * 4 * 3).toFixed(2)}, this amount is then capped at the maximum of ₹{MAX_REWARD_PER_GAME.toFixed(2)} if it exceeds it.
                </p>
              </li>
            </ol>
            <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="text-sm font-medium text-primary flex items-center">
                    <Info className="mr-2 h-5 w-5" /> Important Note:
                </p>
                <p className="text-xs text-primary/80 mt-1.5">
                    The referral program's availability and specific terms are subject to change. The program can be temporarily disabled by administrators. Always check the homepage or your earnings dashboard for the most current status and details. Rewards are subject to verification.
                </p>
            </div>
          </section>

          <section className="p-6 bg-muted/30 rounded-lg shadow-inner">
            <h2 className="text-2xl font-semibold mb-3 flex items-center text-foreground">
              <Play className="mr-3 h-7 w-7 text-primary" /> Earning by Playing (Directly)
            </h2>
            <p className="text-muted-foreground">
              Currently, direct earnings from simply playing games (without referrals) are not a feature. Our primary reward mechanism is through the referral program described above.
              We are always exploring new ways to reward our players, so stay tuned for future updates!
            </p>
          </section>

          <section className="p-6 bg-card border border-border/50 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-green-600">
              <DollarSign className="mr-3 h-7 w-7" /> Withdrawing Your Earnings
            </h2>
            <p className="mb-3 text-muted-foreground">
              Once your earnings accumulate, you can request a withdrawal.
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4 text-muted-foreground">
              <li>Visit your <Link href="/earnings" className="text-primary hover:underline font-medium">Earnings Dashboard</Link> to see your balance and request withdrawals.</li>
              <li>A minimum balance is typically required (e.g., ₹50 INR or equivalent in USD).</li>
              <li>Available withdrawal methods (like UPI, Paytm, Bank Transfer for India; PayPal for others) will be shown on the withdrawal page based on your profile's country.</li>
              <li>Withdrawal requests are reviewed and processed by administrators. This may take a few business days.</li>
            </ul>
             <Link href="/earnings" passHref className="mt-6 block">
               <Button variant="default" size="lg" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                 Go to My Earnings <ArrowRight className="ml-2 h-5 w-5" />
               </Button>
             </Link>
          </section>

          <section className="text-center pt-8 border-t border-border mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Ready to Start Earning?</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              The more friends you invite who actively play {APP_NAME}, the more you can earn!
              Sign up today to get your unique referral link and start sharing.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/auth?action=signup" passHref>
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg px-8 py-3 text-base">
                  Sign Up & Get Your Referral Link
                </Button>
              </Link>
              <Link href="/" passHref>
                <Button variant="outline" size="lg" className="px-8 py-3 text-base">
                  <Home className="mr-2 h-5 w-5" /> Back to Game Lobby
                </Button>
              </Link>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

