import React, { useMemo, useReducer } from 'react';
import { TranscriptionContext, reducer, initialState } from './transcription';

export const TranscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
};

export default TranscriptionProvider;

