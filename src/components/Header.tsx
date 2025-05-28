import Logo from './Logo';

export default function Header() {
  return (
    <header className="py-4 px-6 border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Logo />
        {/* Navigation links can be added here if needed */}
      </div>
    </header>
  );
}
