import { motion } from 'motion/react';

// A single large pink glow that follows the mouse cursor
export const AlgorithmicBackground = ({ mouseX, mouseY }: { mouseX: any; mouseY: any }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Main glow that follows the mouse */}
      <motion.div
        className="absolute rounded-full"
        style={{
          x: mouseX,
          y: mouseY,
          width: 600,
          height: 600,
          marginLeft: -300,
          marginTop: -300,
          background: 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, rgba(236,72,153,0.1) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Subtle secondary glow for depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          x: mouseX,
          y: mouseY,
          width: 900,
          height: 900,
          marginLeft: -450,
          marginTop: -450,
          background: 'radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
};
