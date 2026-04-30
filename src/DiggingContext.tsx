import React, { createContext, useContext, useState, useEffect } from 'react';
import { DiggingLogEntry, NodeType } from './types';
import { auth, isMock, mockSignIn, mockSignOut, saveLogToFirestore } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

interface DiggingContextType {
  log: DiggingLogEntry[];
  addToLog: (nodeId: string, nodeName: string, nodeType: NodeType) => void;
  clearLog: () => void;
  user: User | any | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  saveLog: () => Promise<void>;
}

const DiggingContext = createContext<DiggingContextType | undefined>(undefined);

export const DiggingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [log, setLog] = useState<DiggingLogEntry[]>([]);
  const [user, setUser] = useState<User | any | null>(null);

  useEffect(() => {
    if (!isMock && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    } else {
      // Mock auth state
      const savedUser = localStorage.getItem('mock_user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load local log on mount
  useEffect(() => {
    const saved = localStorage.getItem('local_digging_log');
    if (saved) {
      try {
        setLog(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse log', e);
      }
    }
  }, []);

  const login = async () => {
    if (isMock) {
      const res = await mockSignIn();
      setUser(res.user);
      localStorage.setItem('mock_user', JSON.stringify(res.user));
    } else if (auth) {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Login failed", error);
      }
    }
  };

  const logout = async () => {
    if (isMock) {
      await mockSignOut();
      setUser(null);
      localStorage.removeItem('mock_user');
    } else if (auth) {
      await signOut(auth);
    }
  };

  const addToLog = (nodeId: string, nodeName: string, nodeType: NodeType) => {
    setLog(prev => {
      if (prev.length > 0 && prev[prev.length - 1].nodeId === nodeId) {
        return prev;
      }
      const newEntry: DiggingLogEntry = {
        id: Math.random().toString(36).substring(7),
        nodeId,
        nodeName,
        nodeType,
        timestamp: Date.now(),
      };
      const newLog = [...prev, newEntry];
      localStorage.setItem('local_digging_log', JSON.stringify(newLog));
      return newLog;
    });
  };

  const clearLog = () => {
    setLog([]);
    localStorage.removeItem('local_digging_log');
  };

  const saveLog = async () => {
    if (!user) {
      alert("Please login to save your digging log.");
      return;
    }
    if (log.length === 0) {
      alert("Your log is empty.");
      return;
    }
    await saveLogToFirestore(user.uid, log);
    alert("당신만의 별자리가 저장되었습니다.");
  };

  return (
    <DiggingContext.Provider value={{ log, addToLog, clearLog, user, login, logout, saveLog }}>
      {children}
    </DiggingContext.Provider>
  );
};

export const useDigging = () => {
  const context = useContext(DiggingContext);
  if (context === undefined) {
    throw new Error('useDigging must be used within a DiggingProvider');
  }
  return context;
};
