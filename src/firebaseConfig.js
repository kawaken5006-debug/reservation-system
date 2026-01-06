// Firebase設定
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPkeSTfjPbs8HCyZBpfRJ29BlocCkq6BQ",
  authDomain: "rihacure.firebaseapp.com",
  projectId: "rihacure",
  storageBucket: "rihacure.firebasestorage.app",
  messagingSenderId: "229599758408",
  appId: "1:229599758408:web:61fb08574bf90c8263f07d"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firestoreを取得
export const db = getFirestore(app);
