export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
export const WS_BASE_URL: string = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000';
export const API_TOKEN: string | undefined = import.meta.env.VITE_API_TOKEN;

export const DEFAULT_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese'
];