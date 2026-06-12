import { useState } from 'react';

export default function FlipCard({ front, back, className = '' }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flip-card ${flipped ? 'flipped' : ''} ${className}`}
      onClick={() => setFlipped((prev) => !prev)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div className="flip-card-inner">
        {/* Front Face */}
        <div className="flip-card-front glass backdrop-blur-md border border-white/10 p-8 flex flex-col items-center justify-center text-center gap-5 transition-all duration-200 hover:border-white/15">
          {front}
        </div>

        {/* Back Face */}
        <div className="flip-card-back surface-raised backdrop-blur-md p-8 flex flex-col items-center justify-center text-center gap-4 border-l-2 border-l-accent/30">
          {back}
        </div>
      </div>
    </div>
  );
}
