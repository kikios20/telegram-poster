import { motion } from 'framer-motion'

export function Logo({ size = 40, className = '' }) {
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]"
      >
        <defs>
          <linearGradient id={`logoGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#39ff14">
              <animate 
                attributeName="stop-color" 
                values="#39ff14;#00ff88;#39ff14" 
                dur="3s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#00ff88">
              <animate 
                attributeName="stop-color" 
                values="#00ff88;#39ff14;#00ff88" 
                dur="3s" 
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          <filter id={`glow-${size}`}>
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          stroke={`url(#logoGrad-${size})`}
          strokeWidth="2"
          fill="none"
          filter={`url(#glow-${size})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        
        <motion.path
          d="M12 12 L12 28 M12 20 L20 12 M12 20 L20 28"
          stroke={`url(#logoGrad-${size})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#glow-${size})`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        />
        
        <motion.path
          d="M20 12 L20 28 M20 20 L28 12 M20 20 L28 28"
          stroke={`url(#logoGrad-${size})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#glow-${size})`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        />
        
        <motion.circle
          cx="20"
          cy="20"
          r="2"
          fill="#39ff14"
          filter={`url(#glow-${size})`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: 'spring' }}
        >
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </motion.circle>
      </svg>
    </motion.div>
  )
}

export function LogoText({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Logo size={36} />
      <span 
        className="text-2xl font-bold tracking-tight"
        style={{
          background: 'linear-gradient(135deg, #39ff14 0%, #00ff88 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 30px rgba(57, 255, 20, 0.3)',
        }}
      >
        KIKIO
      </span>
    </div>
  )
}
