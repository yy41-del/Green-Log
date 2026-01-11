import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Droplets, Leaf, Camera, ArrowLeft, TrendingUp, CheckCircle2, User } from 'lucide-react';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'plant-tracker-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [comparisonSelection, setComparisonSelection] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantSpecies, setNewPlantSpecies] = useState('');
  const [newPlantImage, setNewPlantImage] = useState(null);
  const [newLogNote, setNewLogNote] = useState('');
  const [newLogWatered, setNewLogWatered] = useState(false);
  const [newLogFertilized, setNewLogFertilized] = useState(false);
  const [newLogImage, setNewLogImage] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'plants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plantData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlants(plantData);
    });
    return () => unsubscribe();
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
    if (!user || !newPlantName) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'plants'), {
      name: newPlantName, species: newPlantSpecies,
      dateAdded: new Date().toISOString().split('T')[0],
      image: newPlantImage, logs: [], createdAt: serverTimestamp()
    });
    setNewPlantName(''); setNewPlantSpecies(''); setNewPlantImage(null);
    setActiveTab('list');
  };

  const addLog = async (plantId) => {
    if (!user) return;
    const plant = plants.find(p => p.id === plantId);
    const logEntry = {
      id: 'log-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      note: newLogNote, watered: newLogWatered, fertilized: newLogFertilized, image: newLogImage
    };
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plants', plantId), {
      logs: [logEntry, ...plant.logs]
    });
    setNewLogNote(''); setNewLogWatered(false); setNewLogFertilized(false); setNewLogImage(null);
  };

  const deletePlant = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'plants', id));
    setActiveTab('list');
  };

  const selectedPlant = useMemo(() => plants.find(p => p.id === selectedPlantId), [plants, selectedPlantId]);

  const allPhotos = useMemo(() => {
    if (!selectedPlant) return [];
    const photos = [];
    if (selectedPlant.image) photos.push({ id: 'initial', date: selectedPlant.dateAdded, url: selectedPlant.image });
    selectedPlant.logs.forEach(log => { if (log.image) photos.push({ id: log.id, date: log.date, url: log.image }); });
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
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-24">
      <header className="bg-emerald-800 text-white p-5 sticky top-0 z-20 shadow-lg flex justify-between items-center">
        {activeTab !== 'list' ? (
          <button onClick={() => setActiveTab('list')}><ArrowLeft size={24} /></button>
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
              <button onClick={() => setActiveTab('add')} className="bg-emerald-600 text-white p-3 rounded-2xl"><Plus size={24} /></button>
            </div>
            {plants.map(plant => (
              <div key={plant.id} onClick={() => { setSelectedPlantId(plant.id); setActiveTab('detail'); }} className="bg-white rounded-3xl shadow-sm flex overflow-hidden border border-stone-100">
                <div className="w-24 h-24 bg-stone-100 flex-shrink-0">
                  {plant.image ? <img src={plant.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><Leaf /></div>}
                </div>
                <div className="p-4 flex flex-col justify-center">
                  <h3 className="font-bold text-lg">{plant.name}</h3>
                  <p className="text-xs text-stone-400">{plant.species}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl space-y-4">
            <h2 className="text-2xl font-bold">新規登録</h2>
            <input type="text" className="w-full bg-stone-50 p-4 rounded-xl outline-none" placeholder="名前" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} />
            <input type="text" className="w-full bg-stone-50 p-4 rounded-xl outline-none" placeholder="種類" value={newPlantSpecies} onChange={e => setNewPlantSpecies(e.target.value)} />
            <div className="flex items-center gap-4">
              <label className="cursor-pointer bg-stone-100 w-20 h-20 rounded-xl flex items-center justify-center">
                <Camera className="text-stone-400" /><input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, setNewPlantImage)} />
              </label>
              {newPlantImage && <img src={newPlantImage} className="w-20 h-20 object-cover rounded-xl" />}
            </div>
            <button onClick={addPlant} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold">クラウドに保存</button>
          </div>
        )}

        {activeTab === 'detail' && selectedPlant && (
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
              <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2"><TrendingUp size={18}/> 成長比較 (2枚選択)</h3>
              {selectedComparison.length === 2 ? (
                <div className="grid grid-cols-2 gap-4">
                  {selectedComparison.map(p => (
                    <div key={p.id} className="space-y-1">
                      <img src={p.url} className="w-full aspect-square object-cover rounded-2xl border-4 border-white" />
                      <p className="text-[10px] text-center font-bold text-stone-500">{p.date}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="h-32 flex items-center justify-center text-xs text-emerald-400 border-2 border-dashed border-emerald-200 rounded-2xl">写真を2枚選んでください</div>}
              <div className="flex gap-2 overflow-x-auto py-3 px-1">
                {allPhotos.map(p => (
                  <div key={p.id} onClick={() => togglePhotoSelection(p.id)} className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${comparisonSelection.includes(p.id) ? 'border-emerald-500 scale-90' : 'border-transparent opacity-50'}`}>
                    <img src={p.url} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-2">
              <h2 className="text-3xl font-black">{selectedPlant.name}</h2>
              <button onClick={() => deletePlant(selectedPlant.id)} className="text-red-300 text-xs mt-2">植物を削除する</button>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
              <textarea className="w-full bg-stone-50 p-4 rounded-xl text-sm" placeholder="メモ" value={newLogNote} onChange={e => setNewLogNote(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setNewLogWatered(!newLogWatered)} className={`px-4 py-2 rounded-full text-xs font-bold ${newLogWatered ? 'bg-blue-500 text-white' : 'bg-stone-50'}`}>水やり</button>
                <button onClick={() => setNewLogFertilized(!newLogFertilized)} className={`px-4 py-2 rounded-full text-xs font-bold ${newLogFertilized ? 'bg-orange-500 text-white' : 'bg-stone-50'}`}>肥料</button>
                <label className="bg-stone-50 px-4 py-2 rounded-full text-xs font-bold"><Camera size={14}/><input type="file" className="hidden" onChange={e => handleImageChange(e, setNewLogImage)}/></label>
              </div>
              {newLogImage && <img src={newLogImage} className="w-20 h-20 object-cover rounded-xl mt-2" />}
              <button onClick={() => addLog(selectedPlant.id)} className="w-full bg-stone-800 text-white py-3 rounded-xl font-bold">記録する</button>
            </div>

            <div className="space-y-4">
              {selectedPlant.logs.map(log => (
                <div key={log.id} className="bg-white p-5 rounded-2xl border border-stone-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-stone-300">{log.date}</span>
                    <div className="flex gap-1">{log.watered && <Droplets size={12} className="text-blue-500"/>}{log.fertilized && <Plus size={12} className="text-orange-500"/>}</div>
                  </div>
                  {log.note && <p className="text-sm mb-3">{log.note}</p>}
                  {log.image && <img src={log.image} className="w-full rounded-xl" />}
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
