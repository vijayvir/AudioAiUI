import React from 'react';
// import Button from '../atoms/Button';

interface HeroProps {
  className?: string;
}

const Hero: React.FC<HeroProps> = ({ className = '' }) => {
  return (
    <section className={`bg-gray-900 py-4 lg:py-4 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Main Heading */}
          <h1 className="sm:text-5xl font-bold text-white mb-8 leading-tight animate-fade-in">
            <span className="block">The AudioAI platform for</span>
            <span className="sm:text-3xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              internal business purposes
            </span>
          </h1>
          
          {/* Description */}
          <p className="text-xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed animate-fade-in animate-delay-200">
            Build with the most accurate, realistic, and cost-effective APIs for speech-to-text. Trusted by 200,000+ AI builders and leading enterprises. Available in real-time
            and batch, cloud and self-hosted.
          </p>
          
          {/* CTA Buttons */}
          {/* <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-fade-in animate-delay-300">
            <Button 
              variant="primary" 
              size="lg"
              className="!bg-white !text-gray-900 hover:!bg-gray-100 hover:!text-gray-900 font-semibold px-8 py-4 text-lg"
            >
              Sign Up Free
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 font-semibold px-8 py-4 text-lg"
            >
              Playground
            </Button>
          </div> */}
        </div>
      </div>
    </section>
  );
};

export default Hero;