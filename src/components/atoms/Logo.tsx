import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  className = '' 
}) => {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <span className="text-2xl font-bold text-white">AudioAI</span>
    </div>
  );
};

export default Logo;