import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SchoolSettings } from '../types';

interface SettingsContextType {
  settings: SchoolSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'St. Augustine International Academy',
  timezone: 'Asia/Manila',
  openingTime: '07:00',
  lateCutoff: '07:45',
  closingTime: '17:00',
  schoolDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const settingsRef = doc(db, 'school_settings', 'global');

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...snapshot.data() } as SchoolSettings);
        } else {
          // Initialize default document
          setDoc(settingsRef, DEFAULT_SETTINGS).catch((e) => {
            console.warn('Initial settings write warning:', e);
          });
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Settings listener error, using defaults:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    const settingsRef = doc(db, 'school_settings', 'global');
    const merged = { ...settings, ...newSettings };
    try {
      await setDoc(settingsRef, merged, { merge: true });
      setSettings(merged);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_settings/global');
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
