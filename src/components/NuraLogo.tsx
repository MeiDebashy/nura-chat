import React from 'react';
import { motion } from 'motion/react';

export const NuraLogo = () => {
  // SVG Path definitions
  // We want two lines curving up from the bottom to meet in the center
  // Center is 100, 100
  
  // Left line: Starts at roughly 50, 150. Curves to 100, 100.
  // Disconnected state: Ends at 92, 105
  // Connected state: Ends at 100, 100
  
  const leftLineVariants = {
    disconnected: {
      d: "M 60 160 C 60 130, 80 120, 92 108",
    },
    connected: {
      d: "M 60 160 C 60 130, 80 120, 100 100",
    }
  };

  const rightLineVariants = {
    disconnected: {
        d: "M 140 160 C 140 130, 120 120, 108 108",
    },
    connected: {
        d: "M 140 160 C 140 130, 120 120, 100 100",
    }
  };

  return (
    <div className="relative flex items-center justify-center w-[400px] md:w-[500px] h-[280px] md:h-[350px]">
      
      {/* Ambient Glow Behind */}
      <motion.div 
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [0.8, 1, 0.8] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-cyan-500/10 blur-[80px] rounded-[100%]"
      />

      <svg
        viewBox="0 40 200 140"
        className="w-full h-full relative z-10"
        style={{ filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.3))' }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(6, 182, 212, 0)" />
            <stop offset="50%" stopColor="#22d3ee" /> {/* Cyan-400 */}
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
          
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Left Line */}
        <motion.path
          variants={leftLineVariants}
          initial="disconnected"
          animate="connected"
          transition={{ 
            duration: 4, 
            ease: "easeInOut", 
            repeat: Infinity, 
            repeatType: "reverse",
            repeatDelay: 0.5 
          }}
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          filter="url(#softGlow)"
        />

        {/* Right Line */}
        <motion.path
          variants={rightLineVariants}
          initial="disconnected"
          animate="connected"
          transition={{ 
            duration: 4, 
            ease: "easeInOut", 
            repeat: Infinity, 
            repeatType: "reverse",
            repeatDelay: 0.5 
          }}
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          filter="url(#softGlow)"
        />
        
        {/* Center Fusion Point - Only appears when connected */}
        <motion.circle
            cx="100"
            cy="100"
            r="4"
            fill="white"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
                duration: 4, 
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 0.5
            }}
            filter="url(#softGlow)"
        />
        
         {/* Extra subtle glow ring appearing at connection */}
         <motion.circle
            cx="100"
            cy="100"
            r="15"
            stroke="#22d3ee"
            strokeWidth="1"
            fill="none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.5, 0], scale: 1.5 }}
            transition={{ 
                duration: 4, 
                times: [0, 0.5, 1],
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 0.5
            }}
        />
      </svg>
    </div>
  );
};
