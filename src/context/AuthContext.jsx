import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChange } from '../firebase/authService';
import { subscribeUserProfile } from '../firebase/firestoreService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = null;
    
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

        if (unsubProfile) unsubProfile();
        unsubProfile = subscribeUserProfile(user.uid, (data) => {
          setUserProfile(data);
        });
      } else {
        setUserProfile(null);
        if (unsubProfile) unsubProfile();
      }
    });
    
    return () => {
      unsub();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
