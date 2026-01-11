import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Droplets, Leaf, Camera, ArrowLeft, TrendingUp, CheckCircle2, User } from 'lucide-react';

// --- ブラウザで直接動くためのFirebase自動設定 ---
// 注: 本来は __firebase_config から読み込みますが、
// 公開環境でエラーにならないよう、ダミーまたは空の設定で初期化をガードします。
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "anonymous",
      authDomain: "anonymous.firebaseapp.com",
      projectId: "anonymous",
      storageBucket: "anonymous.appspot.com",
      messagingSenderId: "anonymous",
      appId: "anonymous"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-plant-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [comparisonSelection, setComparisonSelection] = useState([]);
  const [loading, setLoading] = useState(true);

  // フォーム用
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantSpecies, setNewPlantSpecies] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [newLogNote, setNewLogNote] = useState('');
  const [newLogWatered, setNewLogWatered] = useState(false);
  const [newLogFertilized, setNewLogFertilized] = useState(false);
  const [newLogImage, setNewLogImage] = useState(null);

  // 1. ログイン処理 (エラー回避付き)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 開発環境のトークンがない場合は匿名ログイン
        await signInAnonymously(auth);
      } catch (error) {
        console.warn("Auth info: Running in local/preview mode without Firebase connection.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || { uid: 'guest-user' }); // ログイン失敗時も動くように
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. データ取得 (Firestoreが使えない場合は空リスト)
  useEffect(() => {
    if (!user) return;
    try {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, 'plants');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const plantData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlants(plantData);
      }, (err) => {
        console.error("Firestore access denied. Using local storage mode.");
      });
      return () => unsubscribe();
    } catch (e) {
      console.log("Firebase connection not established yet.");
    }
  }, [user]);

  const handleImageChange = (e, callback) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const addPlant = async () => {
    if (!newPlantName) return;
    const newPlant = {
      name: newPlantName, species: newPlantSpecies,
      dateAdded: new Date().toISOString().split('T')[0],
      image: newPlantImage, logs: [], createdAt: serverTimestamp ? serverTimestamp() : new Date()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'plants'), newPlant);
    } catch (e) {
      // データベースが繋がらない場合のローカル保存フォールバック
      setPlants([...plants, { id: Date.now().toString(), ...newPlant }]);
    }
    setNewPlantName(''); setNewPlantSpecies(''); setNewPlantImage(null);
    setActiveTab('list');
  };

  const addLog = async (plantId) => {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;
    const logEntry = {
      id: 'log-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      note: newLogNote, watered: newLogWatered, fertilized: newLogFertilized, image: newLogImage
    };

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plants', plantId), {
        logs: [logEntry, ...(plant.logs || [])]
      });
    } catch (e) {
      setPlants(plants.map(p => p.id === plantId ? { ...p, logs: [logEntry, ...(p.logs || [])] } : p));
    }
    setNewLogNote(''); setNewLogWatered(false); setNewLogFertilized(false); setNewLogImage(null);
  };

  const deletePlant = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plants', id));
    } catch (e) {
      setPlants(plants.filter(p => p.id !== id));
    }
    setActiveTab('list');
  };

  const selectedPlant = useMemo(() => plants.find(p => p.id === selectedPlantId), [plants, selectedPlantId]);

  const allPhotos = useMemo(() => {
    if (!selectedPlant) return [];
    const photos = [];
    if (selectedPlant.image) photos.push({ id: 'initial', date: selectedPlant.dateAdded, url: selectedPlant.image });
    (selectedPlant.logs || []).forEach(log => { if (log.image) photos.push({ id: log.id, date: log.date, url: log.image }); });
    return photos.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedPlant]);

  const togglePhotoSelection = (photoId) => {
    if (comparisonSelection.includes(photoId)) {
      setComparisonSelection(comparisonSelection.filter(id => id !== photoId));
    } else {
      setComparisonSelection(comparisonSelection.length >= 2 ? [comparisonSelection[1], photoId] : [...comparisonSelection, photoId]);
    }
  };

  const selectedComparison = useMemo(() => {
    return allPhotos.filter(p => comparisonSelection.includes(p.id)).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [allPhotos, comparisonSelection]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-24 font-sans">
      <header className="bg-emerald-800 text-white p-5 sticky top-0 z-20 shadow-lg flex justify-between items-center">
        {activeTab !== 'list' ? (
          <button onClick={() => { setActiveTab('list'); setComparisonSelection([]); }}><ArrowLeft size={24} /></button>
        ) : (
          <div className="flex items-center gap-2"><Leaf size={20} /><h1 className="text-xl font-bold">GreenLog</h1></div>
        )}
        <User size={18} />
      </header>

      <main className="max-w-md mx-auto p-4">
        {activeTab === 'list' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">マイガーデン</h2>
              <button onClick={() => setActiveTab('add')} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg"><Plus size={24} /></button>
            </div>
            {plants.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-stone-200 text-stone-400">
                <Leaf className="mx-auto mb-2 opacity-20" size={48} />
                <p>植物を登録しましょう</p>
              </div>
            ) : (
              plants.map(plant => (
                <div key={plant.id} onClick={() => { setSelectedPlantId(plant.id); setActiveTab('detail'); }} className="bg-white rounded-3xl shadow-sm flex overflow-hidden border border-stone-100 mb-4">
                  <div className="w-24 h-24 bg-stone-100 flex-shrink-0">
                    {plant.image ? <img src={plant.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><Leaf /></div>}
                  </div>
                  <div className="p-4 flex flex-col justify-center">
                    <h3 className="font-bold text-lg">{plant.name}</h3>
                    <p className="text-xs text-emerald-600 font-bold">{plant.species || '種類不明'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl space-y-4">
            <h2 className="text-2xl font-bold">新規登録</h2>
            <div className="space-y-4">
              <input type="text" className="w-full bg-stone-50 p-4 rounded-xl outline-none border border-stone-100" placeholder="名前" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
              <input type="text" className="w-full bg-stone-50 p-4 rounded-xl outline-none border border-stone-100" placeholder="種類" value={newPlantSpecies} onChange={e => setNewPlantSpecies(e.target.value)} />
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-stone-100 w-20 h-20 rounded-xl flex items-center justify-center border-2 border-dashed border-stone-200">
                  <Camera className="text-stone-400" /><input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, setNewPlantImage)} />
                </label>
                {newPlantImage && <img src={newPlantImage} className="w-20 h-20 object-cover rounded-xl" />}
              </div>
              <button onClick={addPlant} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg">登録する</button>
            </div>
          </div>
        )}

        {activeTab === 'detail' && selectedPlant && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* 比較機能 */}
            <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
              <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2 text-sm"><TrendingUp size={16}/> 成長比較 (2枚選んでください)</h3>
              {selectedComparison.length === 2 ? (
                <div className="grid grid-cols-2 gap-4">
                  {selectedComparison.map((p, idx) => (
                    <div key={p.id} className="space-y-1">
                      <img src={p.url} className="w-full aspect-[3/4] object-cover rounded-2xl border-4 border-white shadow-sm" />
                      <p className="text-[10px] text-center font-bold text-stone-500">{idx === 0 ? '以前' : '現在'} ({p.date})</p>
                    </div>
                  ))}
                </div>
              ) : <div className="h-32 flex items-center justify-center text-xs text-emerald-400 border-2 border-dashed border-emerald-200 rounded-2xl">写真を2枚選択して比較できます</div>}
              <div className="flex gap-2 overflow-x-auto py-3 px-1 no-scrollbar">
                {allPhotos.map(p => (
                  <div key={p.id} onClick={() => togglePhotoSelection(p.id)} className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${comparisonSelection.includes(p.id) ? 'border-emerald-500 scale-90 ring-4 ring-emerald-500/20' : 'border-transparent opacity-50'}`}>
                    <img src={p.url} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-end px-2">
              <div>
                <h2 className="text-3xl font-black">{selectedPlant.name}</h2>
                <p className="text-emerald-600 font-bold">{selectedPlant.species}</p>
              </div>
              <button onClick={() => { if(confirm('削除しますか？')) deletePlant(selectedPlant.id) }} className="p-2 text-stone-300"><Trash2 size={18}/></button>
            </div>

            {/* 記録フォーム */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4">
              <textarea className="w-full bg-stone-50 p-4 rounded-xl text-sm border-none outline-none" placeholder="今日のメモ..." value={newLogNote} onChange={e => setNewLogNote(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setNewLogWatered(!newLogWatered)} className={`px-4 py-2 rounded-full text-xs font-bold transition ${newLogWatered ? 'bg-blue-500 text-white' : 'bg-stone-50 text-stone-400'}`}>水やり</button>
                <button onClick={() => setNewLogFertilized(!newLogFertilized)} className={`px-4 py-2 rounded-full text-xs font-bold transition ${newLogFertilized ? 'bg-orange-500 text-white' : 'bg-stone-50 text-stone-400'}`}>肥料</button>
                <label className="bg-stone-50 px-4 py-2 rounded-full text-xs font-bold text-stone-400 cursor-pointer"><Camera size={14}/><input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, setNewLogImage)}/></label>
              </div>
              {newLogImage && <img src={newLogImage} className="w-20 h-20 object-cover rounded-xl mt-2 border-2 border-white shadow" />}
              <button onClick={() => addLog(selectedPlant.id)} className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold shadow-lg">記録を保存</button>
            </div>

            {/* タイムライン */}
            <div className="space-y-4">
              {(selectedPlant.logs || []).map(log => (
                <div key={log.id} className="bg-white p-5 rounded-2xl border border-stone-50 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-stone-300 tracking-widest">{log.date}</span>
                    <div className="flex gap-1">{log.watered && <Droplets size={12} className="text-blue-500"/>}{log.fertilized && <Plus size={12} className="text-orange-500"/>}</div>
                  </div>
                  {log.note && <p className="text-sm text-stone-600 mb-3 leading-relaxed">{log.note}</p>}
                  {log.image && <img src={log.image} className="w-full rounded-xl border border-stone-50" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
