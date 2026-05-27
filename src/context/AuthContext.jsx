import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChange } from '../firebase/authService';
import { getUserProfile } from '../firebase/firestoreService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChange((user) => {
      setCurrentUser(user);
      setLoading(false); // Instantly unblock the UI!
      if (user) {
        // Optimistically set the profile from the Auth object to prevent UI flicker
        setUserProfile({
          displayName: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || ''
        });

        getUserProfile(user.uid)
          .then((snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data());
            }
          })
          .catch((err) => {
            console.warn('Failed to load user profile (offline?):', err);
          });
      } else {
        setUserProfile(null);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
