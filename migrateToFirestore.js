// Firestoreへのデータ移行スクリプト
import { db } from './firebaseConfig.js';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// データファイルのパス
const DATA_JSON_PATH = path.join(__dirname, 'data.json');
const CUSTOMER_DB_PATH = path.join(__dirname, 'src/customerDatabase.js');
const STAFF_HOLIDAYS_PATH = path.join(__dirname, 'staffHolidays.json');

// データ移行関数
async function migrateToFirestore() {
  console.log('🔄 Firestoreへのデータ移行を開始します...');

  try {
    // 1. 予約データ（data.json）を移行
    console.log('📅 予約データを移行中...');
    const dataJson = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf8'));
    
    // バッチ処理で一括アップロード
    let batch = writeBatch(db);
    let batchCount = 0;
    
    for (const [dateKey, dateData] of Object.entries(dataJson)) {
      if (dateKey === 'customer-db' || dateKey.length === 4) continue; // 顧客DBと年データはスキップ
      
      const docRef = doc(db, 'reservations', dateKey);
      batch.set(docRef, dateData);
      batchCount++;
      
      // Firestoreのバッチ制限は500件なので、400件ごとにコミット
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  ✅ ${batchCount}件の予約データをアップロードしました`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
    
    // 残りをコミット
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ ${batchCount}件の予約データをアップロードしました`);
    }
    
    console.log('✅ 予約データの移行完了！');

    // 2. 顧客データベースを移行
    console.log('👥 顧客データを移行中...');
    const customerDbContent = fs.readFileSync(CUSTOMER_DB_PATH, 'utf8');
    const customerDbMatch = customerDbContent.match(/export const customerDatabase = (\[[\s\S]*?\]);/);
    
    if (customerDbMatch) {
      const customerDatabase = JSON.parse(customerDbMatch[1]);
      
      batch = writeBatch(db);
      batchCount = 0;
      
      for (const customer of customerDatabase) {
        const docRef = doc(db, 'customers', customer.id);
        batch.set(docRef, customer);
        batchCount++;
        
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`  ✅ ${batchCount}件の顧客データをアップロードしました`);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ ${batchCount}件の顧客データをアップロードしました`);
      }
      
      console.log('✅ 顧客データの移行完了！');
    }

    // 3. スタッフ休みデータを移行
    console.log('🏖️ スタッフ休みデータを移行中...');
    const staffHolidays = JSON.parse(fs.readFileSync(STAFF_HOLIDAYS_PATH, 'utf8'));
    
    const staffHolidaysRef = doc(db, 'settings', 'staffHolidays');
    await setDoc(staffHolidaysRef, { holidays: staffHolidays });
    
    console.log('✅ スタッフ休みデータの移行完了！');

    console.log('🎉 全てのデータ移行が完了しました！');
    
  } catch (error) {
    console.error('❌ データ移行エラー:', error);
  }
}

// 実行
migrateToFirestore();
