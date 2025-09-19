import React, { useState } from 'react';
import Button from '../atoms/Button';
import Icon from '../atoms/Icon';
import type { NavigationItem } from '../../types';

interface NavigationProps {
  items: NavigationItem[];
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ items, className = '' }) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleDropdownToggle = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label);
  };

  const handleItemClick = (item: NavigationItem) => {
    if (!item.isDropdown) {
      // Handle navigation
      console.log(`Navigate to: ${item.href}`);
    }
  };

  return (
    <nav className={`flex items-center space-x-8 ${className}`} role="navigation">
      {items.map((item) => (
        <div key={item.label} className="relative">
          {item.isDropdown ? (
            <>
              <button
                className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors duration-200 py-2"
                onClick={() => handleDropdownToggle(item.label)}
                aria-expanded={openDropdown === item.label}
                aria-haspopup="true"
              >
                <span>{item.label}</span>
                <Icon 
                  name="chevronDown" 
                  size={16} 
                  className={`transition-transform duration-200 ${
                    openDropdown === item.label ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              {/* Dropdown Menu */}
              {openDropdown === item.label && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="py-2">
                    {item.dropdownItems?.map((dropdownItem) => (
                      <a
                        key={dropdownItem.label}
                        href={dropdownItem.href}
                        className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors duration-200"
                        onClick={() => {
                          handleItemClick(dropdownItem);
                          setOpenDropdown(null);
                        }}
                      >
                        {dropdownItem.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <a
              href={item.href}
              className="text-gray-300 hover:text-white transition-colors duration-200 py-2"
              onClick={(e) => {
                e.preventDefault();
                handleItemClick(item);
              }}
            >
              {item.label}
            </a>
          )}
        </div>
      ))}
      
      {/* Auth Buttons */}
      <div className="flex items-center space-x-4 ml-8">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-gray-300 hover:text-white"
        >
          Log In
        </Button>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:text-white hover:border-gray-500">
          Get A Demo
        </Button>
        <Button variant="primary" size="sm">
          Sign Up Free
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;