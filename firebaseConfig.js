import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCJHCDV0hXcwgL9vDGktmgX2H6tDVLDt5g",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "kasif-cmms.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "kasif-cmms",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "kasif-cmms.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "71758897017",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:71758897017:web:809096fe37d40ed951d9a8",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-NT00HWMLT7"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);