// Common types for the application

export interface NavigationItem {
  label: string;
  href: string;
  isDropdown?: boolean;
  dropdownItems?: NavigationItem[];
}

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  isActive?: boolean;
}

export interface DemoSection {
  title: string;
  placeholder: string;
  buttonText: string;
  language: string;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: NavigationItem[];
  isOpen: boolean;
  onToggle: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  role?: string;
  tabIndex?: number;
}