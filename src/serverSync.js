// Firestore版 serverSync.js
import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  onSnapshot,
  query,
  orderBy 
} from 'firebase/firestore';

// リアルタイム更新のリスナー
let realtimeUnsubscribe = null;

// サーバーから予約データを読み込む
export const loadFromServer = async () => {
  console.log('🔄 Firestoreから予約データを読み込んでいます...');
  
  try {
    const reservationsRef = collection(db, 'reservations');
    const snapshot = await getDocs(reservationsRef);
    
    const data = {};
    snapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    
    console.log(`✅ Firestoreから ${snapshot.size} 日分のデータを読み込みました`);
    return data;
  } catch (error) {
    console.error('❌ Firestore読み込みエラー:', error);
    return {};
  }
};

// サーバーにデータを保存
export const saveToServer = async (data) => {
  console.log('💾 Firestoreにデータを保存中...');
  
  try {
    // 各日付のデータを個別に保存
    for (const [dateKey, dateData] of Object.entries(data)) {
      if (dateKey === 'customer-db' || dateKey.length === 4) continue; // 顧客DBと年データはスキップ
      
      const docRef = doc(db, 'reservations', dateKey);
      await setDoc(docRef, dateData, { merge: true });
    }
    
    console.log('✅ Firestoreへの保存完了');
    return true;
  } catch (error) {
    console.error('❌ Firestore保存エラー:', error);
    return false;
  }
};

// 顧客データベースを保存
export const saveCustomerDatabaseToServer = async (customerDb) => {
  console.log('👥 顧客データをFirestoreに保存中...');
  
  try {
    for (const customer of customerDb) {
      const docRef = doc(db, 'customers', customer.id);
      await setDoc(docRef, customer);
    }
    
    console.log('✅ 顧客データの保存完了');
    return true;
  } catch (error) {
    console.error('❌ 顧客データ保存エラー:', error);
    return false;
  }
};

// スタッフ休みデータを保存
export const saveStaffHolidaysToServer = async (staffHolidays) => {
  console.log('🏖️ スタッフ休みをFirestoreに保存中...');
  
  try {
    const docRef = doc(db, 'settings', 'staffHolidays');
    await setDoc(docRef, { holidays: staffHolidays });
    
    console.log('✅ スタッフ休みの保存完了');
    return true;
  } catch (error) {
    console.error('❌ スタッフ休み保存エラー:', error);
    return false;
  }
};

// スタッフ休みデータを読み込む
export const loadStaffHolidaysFromServer = async () => {
  console.log('📅 スタッフ休み情報を読み込んでいます...');
  
  try {
    const docRef = doc(db, 'settings', 'staffHolidays');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`✅ スタッフ休み情報を読み込みました: ${Object.keys(data.holidays || {}).length}日分`);
      return data.holidays || {};
    } else {
      console.log('⚠️ スタッフ休みデータが見つかりません');
      return {};
    }
  } catch (error) {
    console.error('❌ スタッフ休み読み込みエラー:', error);
    return {};
  }
};

// リアルタイム更新を開始
export const startRealtimeSync = (callback) => {
  console.log('🔄 リアルタイム更新を開始しました');
  
  const reservationsRef = collection(db, 'reservations');
  
  realtimeUnsubscribe = onSnapshot(reservationsRef, (snapshot) => {
    const data = {};
    snapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    
    console.log('🔄 リアルタイム更新: データが変更されました');
    callback(data);
  }, (error) => {
    console.error('❌ リアルタイム更新エラー:', error);
  });
};

// リアルタイム更新を停止
export const stopRealtimeSync = () => {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    realtimeUnsubscribe = null;
    console.log('🛑 リアルタイム更新を停止しました');
  }
};

// セルの編集中マーク（Firestoreでは不要だが互換性のために残す）
export const markCellAsEditing = () => {
  // Firestoreではリアルタイム同期があるため、編集中マークは不要
  return Promise.resolve();
};
