import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Droplets, Leaf, Camera, ArrowLeft, TrendingUp, CheckCircle2, User } from 'lucide-react';

// Vercel公開用にFirebase設定を安全に初期化
const firebaseConfig = {
  apiKey: "anonymous",
  authDomain: "anonymous.firebaseapp.com",
  projectId: "anonymous",
  storageBucket: "anonymous.appspot.com",
  messagingSenderId: "anonymous",
  appId: "anonymous"
};

// エラーを防ぐために try-catch で囲む
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error", e);
}

const appId = 'my-plant-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [comparisonSelection, setComparisonSelection] = useState([]);
  const [loading, setLoading] = useState(true);

  // ログイン状態の管理
  useEffect(() => {
    if (!auth) {
      setUser({ uid: 'local-user' });
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch(() => setUser({ uid: 'local-user' }));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 以下、前回のコードと同じ ---
  // (文字数制限のため省略していますが、前回の App コンポーネントの中身をそのまま続けてください)
