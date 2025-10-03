import React, { createContext } from 'react';
import type { SessionRecord } from '../types/api';

export type State = {
  sessions: SessionRecord[];
  currentSessionId?: string;
  language: string;
};

export type Action =
  | { type: 'add_session'; payload: SessionRecord }
  | { type: 'set_current'; payload?: string }
  | { type: 'update_transcript'; payload: { id: string; transcript?: string; translation?: string } }
  | { type: 'set_language'; payload: string };

export const initialState: State = {
  sessions: [],
  language: 'English',
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add_session':
      return {
        ...state,
        sessions: [action.payload, ...state.sessions].slice(0, 50),
        currentSessionId: action.payload.id,
      };
    case 'set_current':
      return { ...state, currentSessionId: action.payload };
    case 'update_transcript':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.id
            ? {
                ...s,
                transcript: action.payload.transcript ?? s.transcript,
                translation: action.payload.translation ?? s.translation,
              }
            : s,
        ),
      };
    case 'set_language':
      return { ...state, language: action.payload };
    default:
      return state;
  }
}

export const TranscriptionContext = createContext<
  { state: State; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

