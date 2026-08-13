import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  loginAsDemoUser: (name?: string, email?: string, role?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  loginAsDemoUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const loginAsDemoUser = (name = 'Demo Professional', email = 'demo.user@skillx.ai', role = 'Full-Stack Software Engineer') => {
    const demoUid = 'demo_user_skillx_2026';
    const mockUser: any = {
      uid: demoUid,
      email,
      displayName: name,
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    };
    const mockProfile = {
      uid: demoUid,
      email,
      name,
      role,
      plan: 'Pro Member',
      credits: 1000,
      photoURL: mockUser.photoURL,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem('skillx_demo_session', JSON.stringify({ user: mockUser, profile: mockProfile }));
    } catch (e) {
      console.warn("localStorage demo session write note:", e);
    }

    setUser(mockUser);
    setProfile(mockProfile);
    setLoading(false);
    setIsAuthReady(true);
  };

  useEffect(() => {
    let docUnsub: (() => void) | null = null;

    // Check for existing local demo session first
    try {
      const savedDemo = localStorage.getItem('skillx_demo_session');
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo);
        if (parsed?.user && parsed?.profile) {
          setUser(parsed.user);
          setProfile(parsed.profile);
          setLoading(false);
          setIsAuthReady(true);
        }
      }
    } catch (e) {
      console.warn("Check local demo session note:", e);
    }

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      // If already logged in via demo local mode and no firebase user, keep demo mode active
      const savedDemo = localStorage.getItem('skillx_demo_session');
      if (!user && savedDemo) {
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      setUser(user);
      if (docUnsub) {
        docUnsub();
        docUnsub = null;
      }

      if (user) {
        // Clear local demo flag if real firebase auth succeeds
        localStorage.removeItem('skillx_demo_session');

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const profileDoc = await getDoc(userDocRef);
          
          if (!profileDoc.exists()) {
            const newProfile = {
              uid: user.uid,
              email: user.email || 'user@skillx.ai',
              name: user.displayName || user.email?.split('@')[0] || 'Learner',
              role: 'Full-Stack Software Engineer',
              plan: 'Free',
              credits: 1000,
              photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = profileDoc.data();
            if (!data.photoURL && user.photoURL) {
              data.photoURL = user.photoURL;
            } else if (!data.photoURL) {
              data.photoURL = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
            }
            setProfile(data);
          }

          // Realtime updates with error callback to prevent unhandled connection/permission errors
          docUnsub = onSnapshot(
            userDocRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                if (!data.photoURL) {
                  data.photoURL = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
                }
                setProfile(data);
              }
            },
            (error) => {
              console.warn("User profile snapshot listener handled error:", error);
            }
          );
        } catch (err) {
          console.warn("Could not fetch user profile from Firestore:", err);
          setProfile({
            uid: user.uid,
            email: user.email || 'user@skillx.ai',
            name: user.displayName || user.email?.split('@')[0] || 'Learner',
            role: 'Full-Stack Software Engineer',
            plan: 'Free',
            credits: 1000,
            photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        if (!savedDemo) {
          setProfile(null);
        }
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => {
      authUnsub();
      if (docUnsub) docUnsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, loginAsDemoUser }}>
      {children}
    </AuthContext.Provider>
  );
};
