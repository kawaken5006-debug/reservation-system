// Firestore版 serverSync.js（最適化版）
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

// サーバーにデータを保存（最適化版：特定の日付のみ保存）
export const saveToServer = async (allData, skipMerge = false, specificDateKey = null) => {
  try {
    // 特定の日付のみ保存する場合（高速）
    if (specificDateKey) {
      console.log(`💾 Firestore保存: ${specificDateKey}のみ`);
      if (allData[specificDateKey]) {
        const docRef = doc(db, 'reservations', specificDateKey);
        await setDoc(docRef, allData[specificDateKey], { merge: !skipMerge });
        console.log(`✅ ${specificDateKey} 保存完了`);
      }
      return true;
    }
    
    // 全日付保存（初回読み込み時のみ）
    console.log('💾 Firestoreに全データを保存中...');
    for (const [dateKey, dateData] of Object.entries(allData)) {
      if (dateKey === 'customer-db' || dateKey.length === 4) continue;
      
      const docRef = doc(db, 'reservations', dateKey);
      await setDoc(docRef, dateData, { merge: !skipMerge });
    }
    console.log('✅ Firestoreへの保存完了');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore保存エラー:', error);
    return false;
  }
};

// 顧客データベースを保存（全件）
export const saveCustomerDatabaseToServer = async (customerDb) => {
  console.log('👥 顧客データをFirestoreに保存中...');
  console.log('📊 保存対象:', Object.keys(customerDb).length, '件');
  
  try {
    let successCount = 0;
    for (const [customerId, customerData] of Object.entries(customerDb)) {
      const docRef = doc(db, 'customers', customerId);
      
      // ticketsが含まれていない場合は除外して保存
      const dataToSave = { ...customerData };
      if (!customerData.tickets) {
        delete dataToSave.tickets;
      }
      
      // merge: true で既存のpasswordとticketsを保持
      await setDoc(docRef, dataToSave, { merge: true });
      successCount++;
    }
    
    console.log(`✅ 顧客データの保存完了: ${successCount}件`);
    return true;
  } catch (error) {
    console.error('❌ 顧客データ保存エラー:', error);
    return false;
  }
};

// 特定の顧客1件だけ保存（高速）
export const saveCustomerToServer = async (customerId, customerData) => {
  console.log(`💾 顧客保存: ID=${customerId}`);
  
  try {
    const docRef = doc(db, 'customers', customerId);
    await setDoc(docRef, customerData);
    console.log(`✅ ID=${customerId} 保存完了`);
    return true;
  } catch (error) {
    console.error(`❌ ID=${customerId} 保存エラー:`, error);
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
      console.log(`✅ スタッフ休み情報を読み込みました`);
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

// 顧客データベースを読み込む
export const loadCustomerDatabaseFromServer = async () => {
  console.log('👥 顧客データをFirestoreから読み込んでいます...');
  
  try {
    const customersRef = collection(db, 'customers');
    const snapshot = await getDocs(customersRef);
    
    const customerDb = {};
    snapshot.forEach((doc) => {
      customerDb[doc.id] = doc.data();
    });
    
    console.log(`✅ 顧客データ読み込み完了: ${snapshot.size}件`);
    return customerDb;
  } catch (error) {
    console.error('❌ 顧客データ読み込みエラー:', error);
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
  return Promise.resolve();
};