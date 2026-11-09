import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isGuard: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName: string, requestedRole: UserRole) => Promise<void>;
  loginAsDemoGuard: () => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BOOTSTRAP_ADMIN_EMAIL = 'alvindelacruz917@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoGuard, setDemoGuard] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('demo_guard_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Fetch or create user profile in Firestore
  const syncUserProfile = async (firebaseUser: User) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const isBootstrapped = firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        // If bootstrapped admin, ensure role is ADMIN
        if (isBootstrapped && data.role !== 'ADMIN') {
          const updated: UserProfile = { ...data, role: 'ADMIN' };
          await setDoc(userRef, updated, { merge: true });
          setUserProfile(updated);
        } else {
          setUserProfile(data);
        }
      } else {
        // Create initial profile
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          role: isBootstrapped ? 'ADMIN' : 'GUARD',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error('Failed to sync user profile:', err);
      // Fallback in-memory profile if firestore write temporarily restricted
      const isBootstrapped = firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      setUserProfile({
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || firebaseUser.email || 'Admin',
        email: firebaseUser.email || '',
        role: isBootstrapped ? 'ADMIN' : 'GUARD',
        status: 'ACTIVE'
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setDemoGuard(null);
        localStorage.removeItem('demo_guard_user');
        await syncUserProfile(currentUser);
      } else {
        if (!demoGuard) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogleHandler = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmailHandler = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Email sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmailHandler = async (
    email: string, 
    pass: string, 
    fullName: string, 
    requestedRole: UserRole
  ) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (fullName) {
        await updateProfile(res.user, { displayName: fullName });
      }
      const isBootstrapped = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      const newProfile: UserProfile = {
        uid: res.user.uid,
        fullName: fullName || email.split('@')[0],
        email: email,
        role: isBootstrapped ? 'ADMIN' : requestedRole,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', res.user.uid), newProfile);
      setUserProfile(newProfile);
    } catch (err: any) {
      console.error('Sign-up failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoGuard = () => {
    const demoProfile: UserProfile = {
      uid: 'guard_demo_session_01',
      fullName: 'Officer Marcus Reyes',
      email: 'guard.reyes@school.edu',
      role: 'GUARD',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    setDemoGuard(demoProfile);
    setUserProfile(demoProfile);
    localStorage.setItem('demo_guard_user', JSON.stringify(demoProfile));
  };

  const signOutUserHandler = async () => {
    setLoading(true);
    try {
      if (user) {
        await signOut(auth);
      }
      setDemoGuard(null);
      localStorage.removeItem('demo_guard_user');
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const currentRole = userProfile?.role || (demoGuard ? 'GUARD' : null);
  const isAdmin = currentRole === 'ADMIN';
  const isGuard = currentRole === 'GUARD' || currentRole === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: userProfile || demoGuard,
        role: currentRole,
        loading,
        isAdmin,
        isGuard,
        signInWithGoogle: signInWithGoogleHandler,
        signInWithEmail: signInWithEmailHandler,
        signUpWithEmail: signUpWithEmailHandler,
        loginAsDemoGuard,
        signOutUser: signOutUserHandler
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
