import React, { useState } from 'react';
import FeatureCard from '../molecules/FeatureCard';
import type { FeatureCard as FeatureCardType } from '../../types';

interface FeatureGridProps {
  className?: string;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ className = '' }) => {
  const [activeFeature, setActiveFeature] = useState<string>('speech-to-text');

  const features: FeatureCardType[] = [
    {
      id: 'speech-to-text',
      title: 'Speech to Text',
      description: 'Convert audio to text with industry-leading accuracy and speed. Support for 100+ languages and real-time streaming.',
      icon: 'microphone'
    },
    {
      id: 'text-to-speech',
      title: 'Text to Speech',
      description: 'Generate natural-sounding speech from text with customizable voices, emotions, and speaking styles.',
      icon: 'speaker'
    },
    {
      id: 'voice-agent',
      title: 'Voice Agent',
      description: 'Build conversational AI agents that can understand, process, and respond to voice interactions naturally.',
      icon: 'robot'
    },
    {
      id: 'audio-intelligence',
      title: 'Audio Intelligence',
      description: 'Extract insights from audio with sentiment analysis, topic detection, and advanced audio understanding.',
      icon: 'brain'
    }
  ];

  const handleFeatureClick = (featureId: string) => {
    setActiveFeature(featureId);
  };

  return (
    <section className={`bg-gray-900 py-4 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              {...feature}
              isActive={activeFeature === feature.id}
              onClick={() => handleFeatureClick(feature.id)}
              className={`h-full animate-fade-in animate-delay-${(index + 1) * 100}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;