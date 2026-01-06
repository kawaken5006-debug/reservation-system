// 予約データの保存・復元機能

// localStorage キー
const STORAGE_KEY = 'reservationData';
const LAST_SAVED_KEY = 'lastSavedTime';

// 予約データを localStorage に保存
export const saveReservationData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LAST_SAVED_KEY, new Date().toLocaleString('ja-JP'));
    console.log('✅ 予約データを保存しました');
    return true;
  } catch (error) {
    console.error('❌ 保存エラー:', error);
    return false;
  }
};

// localStorage から予約データを復元
export const loadReservationData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const lastSaved = localStorage.getItem(LAST_SAVED_KEY);
    
    if (data) {
      console.log(`✅ 予約データを復元しました (最終保存: ${lastSaved})`);
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('❌ 復元エラー:', error);
    return null;
  }
};

// 予約データをクリア
export const clearReservationData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_SAVED_KEY);
    console.log('✅ 予約データをクリアしました');
    return true;
  } catch (error) {
    console.error('❌ クリアエラー:', error);
    return false;
  }
};

// 予約データをダウンロード（バックアップ用）
export const downloadReservationData = (data) => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reservation_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('✅ 予約データをダウンロードしました');
  } catch (error) {
    console.error('❌ ダウンロードエラー:', error);
  }
};

// 予約データをアップロード（復元用）
export const uploadReservationData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        saveReservationData(data);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
    reader.readAsText(file);
  });
};
