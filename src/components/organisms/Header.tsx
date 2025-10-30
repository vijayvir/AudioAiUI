import React, { useState } from 'react';
import Logo from '../atoms/Logo';
import Navigation from '../molecules/Navigation';
import Button from '../atoms/Button';
import type { NavigationItem } from '../../types';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigationItems: NavigationItem[] = [
    {
      label: 'Products',
      href: '#',
      isDropdown: true,
      dropdownItems: [
        { label: 'Speech-to-Text', href: '/speech-to-text' },
        { label: 'Text-to-Speech', href: '/text-to-speech' },
        { label: 'Voice Agent', href: '/voice-agent' },
        { label: 'Audio Intelligence', href: '/audio-intelligence' }
      ]
    },
    {
      label: 'Solutions',
      href: '#',
      isDropdown: true,
      dropdownItems: [
        { label: 'Contact Centers', href: '/solutions/contact-centers' },
        { label: 'Media & Entertainment', href: '/solutions/media' },
        { label: 'Conversational AI', href: '/solutions/conversational-ai' }
      ]
    },
    {
      label: 'Resources',
      href: '#',
      isDropdown: true,
      dropdownItems: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Blog', href: '/blog' },
        { label: 'Case Studies', href: '/case-studies' },
        { label: 'Community', href: '/community' }
      ]
    },
    {
      label: 'Devs',
      href: '#',
      isDropdown: true,
      dropdownItems: [
        { label: 'API Reference', href: '/api' },
        { label: 'SDKs', href: '/sdks' },
        { label: 'Playground', href: '/playground' },
        { label: 'GitHub', href: 'https://github.com/audioai' }
      ]
    },
    { label: 'Enterprise', href: '/enterprise' },
    { label: 'Pricing', href: '/pricing' }
  ];

  return (
    <header className={`bg-gray-900 border-b border-gray-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Logo />
          </div>
          
          {/* Navigation - Hidden on mobile */}
          <div className="hidden lg:block">
            <Navigation items={navigationItems} />
          </div>
          
          {/* Mobile menu button - Visible on mobile */}
          <div className="lg:hidden">
            <button
              type="button"
              className="text-gray-300 hover:text-white focus:outline-none focus:text-white transition-colors duration-200"
              aria-label="Toggle main menu"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-800">
            <div className="px-4 py-4 space-y-4">
              {navigationItems.map((item) => (
                <div key={item.label}>
                  <a
                    href={item.href}
                    className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                  {item.dropdownItems && (
                    <div className="ml-4 mt-2 space-y-2">
                      {item.dropdownItems.map((dropdownItem) => (
                        <a
                          key={dropdownItem.label}
                          href={dropdownItem.href}
                          className="block text-sm text-gray-400 hover:text-gray-300 transition-colors duration-200 py-1"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {dropdownItem.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-4 border-t border-gray-800 space-y-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-gray-300 hover:text-white justify-start"
                >
                  Log In
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                >
                  Get A Demo
                </Button>
                <Button variant="primary" size="sm" className="w-full">
                  Sign Up Free
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm">
        <span className="inline-flex items-center">
          Nova-3 now expands to three new languages
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </header>
  );
};

export default Header;