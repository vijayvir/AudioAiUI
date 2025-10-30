import React, { memo } from 'react';
import Icon from '../atoms/Icon';
import type { FeatureCard as FeatureCardType } from '../../types';

interface FeatureCardProps extends FeatureCardType {
  onClick?: () => void;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = memo(({
  title,
  description,
  icon,
  isActive = false,
  onClick,
  className = ''
}) => {
  return (
    <div
      className={`
        relative p-4 sm:p-6 rounded-xl border transition-all duration-300 cursor-pointer group
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
        transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 animate-fade-in
        ${isActive 
          ? 'bg-gray-800 border-blue-500 shadow-lg shadow-blue-500/20' 
          : 'bg-gray-900 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
        }
        ${className}
      `}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-pressed={isActive}
      aria-describedby={`${title.toLowerCase().replace(/\s+/g, '-')}-description`}
    >
      {/* Icon */}
      <div className={`
        inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg mb-3 sm:mb-4 transition-all duration-300
        ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'}
      `}>
        <Icon name={icon} size={20} className="sm:w-6 sm:h-6" aria-hidden />
      </div>
      
      {/* Content */}
      <div>
        <h3 className={`
          text-base sm:text-lg font-semibold mb-2 transition-colors
          ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}
        `}>
          {title}
        </h3>
        <p 
          id={`${title.toLowerCase().replace(/\s+/g, '-')}-description`}
          className={`
            text-sm leading-relaxed transition-colors
            ${isActive ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300'}
          `}
        >
          {description}
        </p>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </div>
  );
});

FeatureCard.displayName = 'FeatureCard';

export default FeatureCard;