import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { initUserDoc } from './firestoreService';

export const signUpWithEmail = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await initUserDoc(cred.user.uid, {
    displayName,
    email,
    photoURL: cred.user.photoURL || '',
  });
  return cred.user;
};

export const signInWithEmail = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const signInWithGoogle = async () => {
  const cred = await signInWithPopup(auth, googleProvider);
  await initUserDoc(cred.user.uid, {
    displayName: cred.user.displayName,
    email: cred.user.email,
    photoURL: cred.user.photoURL || '',
  });
  return cred.user;
};

export const signOut = () => firebaseSignOut(auth);

export const onAuthStateChange = (callback) => onAuthStateChanged(auth, callback);
