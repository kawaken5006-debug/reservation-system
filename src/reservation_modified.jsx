import { CustomerDatabaseUpload } from './customerDatabaseWithCSV';
import { StaffHolidayUpload } from './staffHolidayUpload';
import { NameSearch } from './nameSearch';
import { MonthlyPdfExport } from './MonthlyPdfExport';
import { 
  loadFromServer, 
  saveToServer, 
  saveStaffHolidaysToServer, 
  loadStaffHolidaysFromServer, 
  saveCustomerDatabaseToServer,
  startRealtimeSync,
  stopRealtimeSync,
  markCellAsEditing
} from './serverSync';
import { customerDatabase } from './customerDatabase';
import React, { useState } from 'react';

export default function ReservationSheet() {
  // ひらがな→カタカナ変換
  const hiraganaToKatakana = (str) => {
    return str.replace(/[\u3041-\u3096]/g, (match) => {
      const chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  };

  // カタカナ→ひらがな変換
  const katakanaToHiragana = (str) => {
    return str.replace(/[\u30a1-\u30f6]/g, (match) => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  };

  // 日付フォーマット関数を先に定義
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 曜日に応じた時間枠を取得
  const getTimeSlotsForDay = (date) => {
    const dayOfWeek = date.getDay(); // 0=日曜, 6=土曜
    
    if (dayOfWeek === 0) {
      // 日曜日の時間枠
      return [
        { time: '8:30', cols: 11 },
        { time: '9:15', cols: 11 },
        { time: '10:00', cols: 11 },
        { time: '10:45', cols: 11 },
        { time: '11:30', cols: 11 },
        { time: '12:15', cols: 11 },
        { time: '13:00', cols: 11 },
        { time: '13:45', cols: 11 },
        { time: '14:30', cols: 11 },
        { time: '15:15', cols: 11 },
        { time: '16:00', cols: 11 },
        { time: '16:45', cols: 5 },
      ];
    } else if (dayOfWeek === 6) {
      // 土曜日の時間枠
      return [
        { time: '9:00', cols: 11 },
        { time: '9:45', cols: 11 },
        { time: '10:30', cols: 11 },
        { time: '11:15', cols: 11 },
        { time: '11:45', cols: 11 },
        { time: '12:30', cols: 5 },
        { time: '15:00', cols: 11 },
        { time: '15:45', cols: 11 },
        { time: '16:30', cols: 11 },
        { time: '17:15', cols: 11 },
        { time: '18:00', cols: 11 },
        { time: '18:30', cols: 11 },
        { time: '19:15', cols: 5 },
      ];
    } else {
      // 平日の時間枠
      return [
        { time: '9:00', cols: 11 },
        { time: '9:45', cols: 11 },
        { time: '10:30', cols: 11 },
        { time: '11:15', cols: 11 },
        { time: '11:45', cols: 11 },
        { time: '12:30', cols: 5 },
        { time: '15:00', cols: 11 },
        { time: '15:45', cols: 11 },
        { time: '16:30', cols: 11 },
        { time: '17:15', cols: 11 },
        { time: '18:00', cols: 11 },
        { time: '18:45', cols: 11 },
        { time: '19:30', cols: 11 },
        { time: '20:15', cols: 5 },
      ];
    }
  };
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [copyButtonState, setCopyButtonState] = useState('📋');
  const [isMenuOpen, setIsMenuOpen] = useState(false); // ハンバーガーメニュー開閉状態
  const [isReservationListExpanded, setIsReservationListExpanded] = useState(false); // 予約リスト展開状態
  const [isEditingHolidays, setIsEditingHolidays] = useState(false); // スタッフ休み編集モード
  const [editingHolidaysText, setEditingHolidaysText] = useState(''); // 編集中の休みテキスト
  const [isCancelHistoryExpanded, setIsCancelHistoryExpanded] = useState(false); // キャンセル履歴展開状態
  const [isTicketExpiryExpanded, setIsTicketExpiryExpanded] = useState(false); // 回数券期限切れリスト展開状態
  const [isTicketSearchLoading, setIsTicketSearchLoading] = useState(false); // 回数券検索ローディング状態
  const [editingTreatmentCell, setEditingTreatmentCell] = useState(null); // 編集中の施術セル（この日の予約）
  const [editingStaffCell, setEditingStaffCell] = useState(null); // 編集中の担当セル
  const [tempTreatmentMenus, setTempTreatmentMenus] = useState({}); // 施術メニューの一時編集データ
  const [treatmentMenusModified, setTreatmentMenusModified] = useState({}); // 施術メニューの変更フラグ
  const [ticketFilterConditions, setTicketFilterConditions] = useState({
    maxRemaining: 3,        // 残り回数（これ以下）
    remainingEnabled: true, // 残り回数フィルター有効/無効
    periodType: 'within',   // 'within': 以内, 'outside': 以上
    periodDays: 30,         // 日数
    periodEnabled: true,    // 日数フィルター有効/無効
    visitedRangeStart: '',     // 来院した期間開始日
    visitedRangeEnd: '',       // 来院した期間終了日
    visitedRangeEnabled: false, // 来院した期間フィルター有効/無効
    notVisitedRangeStart: '',  // 来院していない期間開始日
    notVisitedRangeEnd: '',    // 来院していない期間終了日
    notVisitedRangeEnabled: false, // 来院していない期間フィルター有効/無効
    ticketOwnership: 'all', // 'hasTicket': 回数券持ちのみ, 'noTicket': 回数券なしのみ, 'all': 全員
    reviewFilter: 'all', // 'yes': 口コミ○のみ, 'no': 口コミ×のみ, 'all': すべて
    reviewEnabled: false // 口コミフィルター有効/無効
  });
  const timeSlots = getTimeSlotsForDay(selectedDate);
  
  // 顧客データベースを状態として管理
  const [customerDb, setCustomerDb] = useState(customerDatabase);
  
  // スタッフ休み情報を状態として管理
  const [staffHolidays, setStaffHolidays] = useState({});
  
  // Store all data by date
  const [allDataByDate, setAllDataByDate] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [isRealtimeUpdating, setIsRealtimeUpdating] = useState(false); // リアルタイム更新中フラグ
  const lastSaveTimestamp = React.useRef(0); // 最終保存時刻
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openCompletedDropdown, setOpenCompletedDropdown] = useState(null);
  const [openMemo, setOpenMemo] = useState(null);
  const [editingCancelIndex, setEditingCancelIndex] = useState(null);
  const [editingCancelData, setEditingCancelData] = useState(null);
  const [activeTicketIndexes, setActiveTicketIndexes] = useState({}); // 各顧客のアクティブな回数券インデックスを管理
  const [ticketTypeSelections, setTicketTypeSelections] = useState({}); // 各顧客の回数券種類選択状態
  
  // 回数券データを顧客DBに保存する形式
  // customerDb[id].tickets = [{ name: '骨', count: 8, used: [] }, ...]

  // Get current date key
  const dateKey = formatDate(selectedDate);
  
  // Get or initialize data for current date
  const currentDateData = allDataByDate[dateKey] || {
    data: {},
    duplicates: {},
    idDuplicates: {}, // ID重複チェック用
    newPatients: {},
    repeatPatients: {},
    rakuPatients: {},
    oralButtons: {},
    partialButtons: {},
    completedStatus: {},
    cancelHistory: [],
    memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {} // 施術実施メニュー
  };
  
  // Extract current date's data
  const data = currentDateData.data;
  const duplicates = currentDateData.duplicates;
  const idDuplicates = currentDateData.idDuplicates || {}; // ID重複チェック用
  const newPatients = currentDateData.newPatients;
  const repeatPatients = currentDateData.repeatPatients;
  const rakuPatients = currentDateData.rakuPatients || {};
  const oralButtons = currentDateData.oralButtons;
  const partialButtons = currentDateData.partialButtons;
  const completedStatus = currentDateData.completedStatus;
  const cancelHistory = currentDateData.cancelHistory || [];
  const memoTexts = currentDateData.memoTexts || {};
  const reviewData = currentDateData.reviewData || {};
  const treatmentMenus = currentDateData.treatmentMenus || {};
  
  // Helper function to update current date's data
  const updateCurrentDateData = (field, updater) => {
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {}, // ID重複チェック用
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
      };
      
      const fieldData = currentData[field];
      const newFieldData = typeof updater === 'function' ? updater(fieldData) : updater;
      
      return {
        ...prev,
        [dateKey]: {
          ...currentData,
          [field]: newFieldData
        }
      };
    });
  };
  
  const setData = (updater) => {
    updateCurrentDateData('data', updater);
  };
  const setDuplicates = (updater) => updateCurrentDateData('duplicates', updater);
  const setIdDuplicates = (updater) => updateCurrentDateData('idDuplicates', updater); // ID重複チェック用
  const setNewPatients = (updater) => updateCurrentDateData('newPatients', updater);
  const setRepeatPatients = (updater) => updateCurrentDateData('repeatPatients', updater);
  const setRakuPatients = (updater) => updateCurrentDateData('rakuPatients', updater);
  const setOralButtons = (updater) => updateCurrentDateData('oralButtons', updater);
  const setPartialButtons = (updater) => updateCurrentDateData('partialButtons', updater);
  const setCompletedStatus = (updater) => updateCurrentDateData('completedStatus', updater);
  const setCancelHistory = (updater) => updateCurrentDateData('cancelHistory', updater);
  const setMemoTexts = (updater) => updateCurrentDateData('memoTexts', updater);
  const setReviewData = (updater) => updateCurrentDateData('reviewData', updater);
  const setTreatmentMenus = (updater) => updateCurrentDateData('treatmentMenus', updater);

  const getCellKey = (time, col, field) => `${time}-${col}-${field}`;
  
  // 施術メニューの選択肢
  const treatmentMenuOptions = [
    '骨楽', '60骨楽', '骨', '60骨', '楽', '60楽', '産後', '初診自費', '再診自費', 
    '初再診保険', '保険セット', '鍼灸', '柔整', '償還鍼', '学生　骨楽', '学生骨', '美顔', '事故'
  ];
  
  // 初期化時にサーバーからデータを復元
  React.useEffect(() => {
    const init = async () => {
      try {
        console.log('🔄 初期化開始...');
        
        // 予約データ読み込み
        const data = await loadFromServer();
        if (data && Object.keys(data).length > 0) {
          setAllDataByDate(data);
          console.log('✅ 予約データ読み込み完了:', Object.keys(data).length, '日分');
        } else {
          console.log('📊 予約データは空です');
        }
        
        // ネット予約データ読み込み（サーバーAPIから）
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('./firebaseConfig');
          
          const webBookingsSnapshot = await getDocs(collection(db, 'webBookings'));
          const webBookings = [];
          webBookingsSnapshot.forEach(doc => {
            webBookings.push({ id: doc.id, ...doc.data() });
          });
          
          if (webBookings.length > 0) {
            console.log('🌐 ネット予約データ:', webBookings.length, '件');
            console.log('🔍 DEBUG: webBookings配列:', webBookings);
            console.log('🔍 DEBUG: 最初の予約:', webBookings[0]);
            
            // customerDbの現在値を取得（クロージャ問題回避）
            setCustomerDb(currentCustomerDb => {
              console.log('🔍 DEBUG: setCustomerDb呼び出し開始');
              setAllDataByDate(prev => {
                console.log('🔍 DEBUG: setAllDataByDate呼び出し開始');
                console.log('🔍 DEBUG: 既存データ日数:', Object.keys(prev).length);
                const newData = { ...prev };
                
                webBookings.forEach(booking => {
                  console.log('🔍 DEBUG: 予約処理開始:', booking.id, booking.name, booking.date, booking.time);
                  const dateKey = booking.date;
                  if (!newData[dateKey]) {
                  newData[dateKey] = {
                    data: {},
                    duplicates: {},
                    idDuplicates: {},
                    newPatients: {},
                    repeatPatients: {},
                    rakuPatients: {},
                    oralButtons: {},
                    partialButtons: {},
                    completedStatus: {},
                    cancelHistory: [],
                    memoTexts: {},
                    reviewData: {},
                    treatmentMenus: {}
                  };
                }
                
                // 既に追加済みかチェック（ID+時間で重複チェック）
                const existingBookings = Object.keys(newData[dateKey].data)
                  .filter(key => key.endsWith('-id') && key.startsWith(booking.time))
                  .map(key => newData[dateKey].data[key]?.id)
                  .filter(Boolean);
                
                if (existingBookings.includes(booking.id)) {
                  console.log(`⏭️ スキップ（重複）: ${booking.date} ${booking.time} ${booking.name} (${booking.id})`);
                  
                  // 🔧 重複でも施術メニューが未設定なら設定する
                  const existingCol = Object.keys(newData[dateKey].data)
                    .find(key => key.endsWith('-id') && key.startsWith(booking.time) && newData[dateKey].data[key]?.id === booking.id);
                  
                  if (existingCol) {
                    const colMatch = existingCol.match(/-(\d+)-/);
                    if (colMatch) {
                      const col = parseInt(colMatch[1]);
                      const cellKey = `${booking.time}-${col}`;
                      
                      // 施術メニューが未設定の場合のみ設定
                      if (!newData[dateKey].treatmentMenus[cellKey] || newData[dateKey].treatmentMenus[cellKey].length === 0) {
                        if (booking.isNewPatient) {
                          newData[dateKey].treatmentMenus[cellKey] = ['新'];
                          console.log(`📋 重複予約の施術メニュー設定: 新 (${cellKey})`);
                        } else if (booking.treatment === 'raku') {
                          newData[dateKey].treatmentMenus[cellKey] = ['楽'];
                          console.log(`📋 重複予約の施術メニュー設定: 楽 (${cellKey})`);
                        }
                      }
                    }
                  }
                  
                  return; // この時間帯に既に同じIDの予約がある
                }
                
                // 空き枠を探す
                let col = 0;
                while (newData[dateKey].data[`${booking.time}-${col}-name`]?.name) {
                  col++;
                  if (col > 20) break; // 無限ループ防止
                }
                
                // ネット予約を追加
                const customerInfo = currentCustomerDb[booking.id];
                const autoStaff = customerInfo?.staff || '未'; // 既存顧客なら担当を取得、なければ「未」
                
                newData[dateKey].data[`${booking.time}-${col}-id`] = { id: booking.id };
                newData[dateKey].data[`${booking.time}-${col}-name`] = { name: booking.name };
                newData[dateKey].data[`${booking.time}-${col}-staff`] = { staff: autoStaff };
                
                console.log(`📝 ネット予約の担当: ID=${booking.id}, 担当=${autoStaff}`);
                
                // 新規予約の場合、newPatientsにも登録（ピンク枠表示用）
                if (booking.isNewPatient) {
                  const newPatientKey = `${booking.time}-${col}-name`;
                  newData[dateKey].newPatients[newPatientKey] = true;
                  console.log(`🆕 新規予約マーク: ${newPatientKey}`, booking);
                } else {
                  console.log(`⚠️ 新規ではない予約:`, booking);
                }
                
                // メモにネット予約情報を追加
                const memoKey = `${booking.time}-${col}-memo`;
                let memoText = `【ネット予約】\nID: ${booking.id}\n電話: ${booking.phone}\nメール: ${booking.email || 'なし'}\n施術: ${booking.treatment}\n予約日時: ${new Date(booking.bookingDate).toLocaleString('ja-JP')}`;
                
                if (booking.isNewPatient) {
                  memoText = `【新規・ネット予約】\nID: ${booking.id}\n電話: ${booking.phone}\nメール: ${booking.email || 'なし'}\n施術: ${booking.treatment}\n予約日時: ${new Date(booking.bookingDate).toLocaleString('ja-JP')}`;
                }
                
                newData[dateKey].memoTexts[memoKey] = memoText;
                
                // 🔧 施術メニュー自動選択 & 新患・楽の状態設定
                const cellKey = `${booking.time}-${col}`;
                const nameKey = `${booking.time}-${col}-name`;
                console.log(`🔍 DEBUG: booking.treatment = "${booking.treatment}"`);
                console.log(`🔍 DEBUG: booking.isNewPatient = ${booking.isNewPatient}`);
                
                if (booking.isNewPatient) {
                  // 新規の場合は「新」を設定
                  newData[dateKey].treatmentMenus[cellKey] = ['新'];
                  newData[dateKey].newPatients[nameKey] = true;
                  console.log(`📋 施術メニュー自動選択: 新 (${cellKey})`);
                  console.log(`🆕 新患フラグ設定: ${nameKey}`);
                } else if (booking.treatment === 'raku') {
                  // 楽トレの場合は「楽」を設定
                  newData[dateKey].treatmentMenus[cellKey] = ['楽'];
                  newData[dateKey].rakuPatients[nameKey] = true;
                  console.log(`📋 施術メニュー自動選択: 楽 (${cellKey})`);
                  console.log(`🔵 楽フラグ設定: ${nameKey}`);
                } else {
                  console.log(`⚠️ 施術メニュー自動選択なし: treatment="${booking.treatment}" (${cellKey})`);
                }
                
                // 新規予約の場合、次の時間枠（下の枠）も確保（2枠分）
                if (booking.isNewPatient) {
                  // 現在の時間のインデックスを取得
                  const times = ['9:00', '9:45', '10:30', '11:15', '11:45', '15:00', '15:45', '16:30', '17:15', '18:00', '18:45', '19:30', '20:15'];
                  const currentTimeIndex = times.findIndex(t => t === booking.time);
                  
                  if (currentTimeIndex !== -1 && currentTimeIndex < times.length - 1) {
                    const nextTime = times[currentTimeIndex + 1];
                    
                    // 次の時間枠にID「1」と「楽トレ　枠」を挿入（ピンク枠にはしない）
                    newData[dateKey].data[`${nextTime}-${col}-id`] = { id: '1' };
                    newData[dateKey].data[`${nextTime}-${col}-name`] = { name: '楽トレ　枠' };
                    newData[dateKey].data[`${nextTime}-${col}-staff`] = { staff: '' };
                    console.log(`📌 新規予約2枠目確保（楽トレ　枠）: ${nextTime}-${col}`);
                  }
                }
                
                console.log(`📝 ネット予約追加: ${booking.date} ${booking.time} ${booking.name}${booking.isNewPatient ? '【新規】' : ''}`);
              });
              
              console.log('🔍 DEBUG: 全予約処理完了。更新後のデータ日数:', Object.keys(newData).length);
              console.log('🔍 DEBUG: 更新されたデータ:', newData);
              return newData;
              });
              
              // customerDbは変更しないのでそのまま返す
              return currentCustomerDb;
            });
            
            console.log('✅ ネット予約を予約表に反映しました');
            
            // 🔧 ネット予約をFirestoreに即座に保存（リアルタイム更新対策）
            // 保存開始時点でタイムスタンプを記録（リアルタイム更新をブロック）
            lastSaveTimestamp.current = Date.now();
            console.log('💾 ネット予約データをFirestoreに保存中...');
            // setAllDataByDateの完了を待つため、少し遅延
            setTimeout(async () => {
              try {
                // 最新のallDataByDateを取得して保存
                setAllDataByDate(currentData => {
                  saveToServer(currentData);
                  return currentData;
                });
                console.log('✅ ネット予約データの保存完了');
              } catch (err) {
                console.error('❌ 保存エラー:', err);
              }
            }, 100);
          } else {
            console.log('📊 ネット予約データはありません');
          }
        } catch (error) {
          console.error('❌ ネット予約読み込みエラー:', error);
          console.error('💡 サーバーが起動しているか確認してください');
        }
        
        // スタッフ休み読み込み
        console.log('🔄 スタッフ休み情報を読み込んでいます...');
        const holidays = await loadStaffHolidaysFromServer();
        
        console.log('📦 読み込み結果:', holidays);
        console.log('📊 データ件数:', Object.keys(holidays).length);
        
        if (holidays && Object.keys(holidays).length > 0) {
          setStaffHolidays(holidays);
          console.log('✅ スタッフ休み情報を設定しました');
          const todayKey = formatDate(selectedDate);
          console.log('📅 今日(' + todayKey + ')のスタッフ休み:', holidays[todayKey] || 'なし');
        } else {
          console.warn('⚠️ スタッフ休み情報が空です');
          console.warn('💡 CSVファイルをアップロードしてください');
          // 空でも設定（状態を明確にする）
          setStaffHolidays({});
        }
        
        console.log('✅ 初期化完了');
      } catch (error) {
        console.error('❌ 初期化エラー:', error);
        console.error('📍 エラー詳細:', error.message);
      } finally {
        setInitialized(true);
      }
    };
    if (!initialized) {
      init();
    }
  }, [initialized]);

  // データが変更されたときにサーバーに保存（自動保存は無効化）
  // 手動保存（Enter or onBlur）のみ
  /*
  React.useEffect(() => {
    if (!initialized || isRealtimeUpdating) return;
    
    const timer = setTimeout(() => {
      console.log('💾 1秒間入力がなかったため保存します');
      saveToServer(allDataByDate);
    }, 1000);
    
    return () => {
      clearTimeout(timer);
    };
  }, [allDataByDate, initialized, isRealtimeUpdating]);
  */

  // リアルタイム更新を開始
  React.useEffect(() => {
    if (!initialized) return;
    
    console.log('🚀 リアルタイム更新機能を起動しました（1秒間隔）');
    
    startRealtimeSync((serverData) => {
      // 保存直後5秒間はリアルタイム同期をスキップ
      const timeSinceLastSave = Date.now() - lastSaveTimestamp.current;
      if (timeSinceLastSave < 5000) {
        console.log('⏭️ リアルタイム更新スキップ（保存直後 ' + Math.round(timeSinceLastSave/1000) + '秒）');
        return;
      }
      
      console.log('📥 サーバーから更新を受信 - 完全上書き');
      
      // デバッグ: 今日の日付のデータを確認
      const todayData = serverData[dateKey];
      if (todayData && todayData.data) {
        const id1Keys = Object.keys(todayData.data).filter(k => 
          k.includes('-id') && todayData.data[k]?.id === '1'
        );
        if (id1Keys.length > 0) {
        }
      }
      
      // リアルタイム更新中フラグをON
      setIsRealtimeUpdating(true);
      
      // サーバーのデータで完全に上書き（マージしない）
      setAllDataByDate(serverData);
      
      // フラグをOFFに戻す（次のレンダリング後）
      setTimeout(() => {
        setIsRealtimeUpdating(false);
      }, 100);
    });
    
    return () => {
      console.log('🛑 リアルタイム更新を停止しました');
      stopRealtimeSync();
    };
  }, [initialized]);

  // ドロップダウンの外側をクリックしたら閉じる
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown) {
        // クリックされた要素がドロップダウン内かチェック
        const clickedElement = event.target;
        
        // ドロップダウン内かチェック（data属性で判定）
        const isDropdownContent = clickedElement.closest('[data-dropdown="true"]');
        
        // ドロップダウン内でない場合のみ閉じる
        if (!isDropdownContent) {
          setOpenDropdown(null);
        }
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [openDropdown]);

  // メモの外側をクリックしたら閉じる
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMemo) {
        // クリックされた要素がメモポップアップまたはメモボタン内かチェック
        const clickedElement = event.target;
        const isMemoPopup = clickedElement.closest('[data-memo-popup="true"]');
        
        // メモポップアップ内でない場合のみ閉じる
        if (!isMemoPopup) {
          // 未保存チェック
          const memoKey = openMemo;
          const timeColMatch = memoKey.match(/^(.+)-(\d+)-memo$/);
          if (timeColMatch) {
            const time = timeColMatch[1];
            const col = timeColMatch[2];
            const cellKey = `${time}-${col}`;
            
            if (treatmentMenusModified[cellKey]) {
              if (!window.confirm('施術メニューが保存されていません。\n保存せずに閉じますか？')) {
                return;
              }
              // 未保存のまま閉じる場合、変更フラグとtempデータをクリア
              setTreatmentMenusModified(prev => {
                const updated = { ...prev };
                delete updated[cellKey];
                return updated;
              });
              setTempTreatmentMenus(prev => {
                const updated = { ...prev };
                delete updated[cellKey];
                return updated;
              });
            }
          }
          setOpenMemo(null);
        }
      }
    };

    if (openMemo) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [openMemo, treatmentMenusModified]);

  // 回数券フィルター変更時にローディング表示
  React.useEffect(() => {
    if (!isTicketExpiryExpanded) {
      setIsTicketSearchLoading(false);
      return;
    }
    
    setIsTicketSearchLoading(true);
    
    // フィルタリング処理が完了するまでローディングを表示
    const timer = setTimeout(() => {
      setIsTicketSearchLoading(false);
    }, 800); // 800ms後にローディング終了（重い計算の場合を考慮）
    
    return () => clearTimeout(timer);
  }, [isTicketExpiryExpanded, ticketFilterConditions]);


  // 担当の正規化（大文字小文字、半角全角を区別しない）
  const normalizeStaff = (staff) => {
    if (!staff) return '';
    // 全角英字を半角に変換
    return staff.toUpperCase().replace(/[Ａ-Ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  };

  // 予約リストをコピー
  const copyReservationList = () => {
    const list = getReservationList();
    if (list.length === 0) {
      alert('予約がありません');
      return;
    }
    
    let text = 'ID\t名前\t担当\n';
    list.forEach(item => {
      text += `${item.id}\t${item.name}\t${item.staff || ''}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
      setCopyButtonState('✅');
      setTimeout(() => {
        setCopyButtonState('📋');
      }, 2000);
    }).catch(err => {
      console.error('コピーエラー:', err);
      setCopyButtonState('❌');
      setTimeout(() => {
        setCopyButtonState('📋');
      }, 2000);
    });
  };

  // 稼働率の集計
  const calculateOccupancy = () => {
    let totalSlots = 0;
    let filledSlots = 0;
    
    timeSlots.forEach(slot => {
      const slotCount = slot.cols;
      totalSlots += slotCount;
      
      for (let col = 0; col < slotCount; col++) {
        const idKey = getCellKey(slot.time, col, 'id');
        if (data[idKey]?.id) {
          filledSlots++;
        }
      }
    });
    
    const rate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    return { total: totalSlots, filled: filledSlots, rate };
  };
  
  const occupancy = calculateOccupancy();
  // 午前午後の集計（午後は15時から）
  const calculateAMPM = () => {
    let amCount = 0;
    let pmCount = 0;
    
    timeSlots.forEach(slot => {
      const hour = parseInt(slot.time.split(':')[0]);
      const isAM = hour < 15;
      
      for (let col = 0; col < slot.cols; col++) {
        const idKey = getCellKey(slot.time, col, 'id');
        const nameKey = getCellKey(slot.time, col, 'name');
        
        if (data[idKey]?.id) {
          const name = data[nameKey]?.name || '';
          // 楽トレを除外（「楽トレ」が含まれるものすべて）
          if (!name.includes('楽トレ')) {
            if (isAM) {
              amCount++;
            } else {
              pmCount++;
            }
          }
        }
      }
    });
    
    return { am: amCount, pm: pmCount };
  };
  
  const ampm = calculateAMPM();

  // 最終予約日からの日数を計算
  const getDaysSinceLastVisit = (customerId) => {
    if (!customerId || !allDataByDate) return null;
    
    const today = new Date(dateKey);
    let lastVisitDate = null;
    
    // 全ての日付データを確認
    Object.keys(allDataByDate).forEach(date => {
      const dateData = allDataByDate[date];
      if (!dateData?.data) return;
      
      // その日付の全てのセルをチェック
      Object.keys(dateData.data).forEach(key => {
        if (key.includes('-id')) {
          const cellData = dateData.data[key];
          if (cellData?.id === customerId) {
            const visitDate = new Date(date);
            // 今日より前で、最も新しい日付を記録
            if (visitDate < today && (!lastVisitDate || visitDate > lastVisitDate)) {
              lastVisitDate = visitDate;
            }
          }
        }
      });
    });
    
    if (!lastVisitDate) return null;
    
    // 日数を計算
    const diffTime = today - lastVisitDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };
  
  // 最終予約日の表示テキストを生成
  const getLastVisitText = (customerId) => {
    const days = getDaysSinceLastVisit(customerId);
    
    if (days === null) {
      return '初回';
    } else if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days >= 30) {
      return '1ヶ月以上';
    } else {
      return `${days}日前`;
    }
  };


  // 前回の施術メニューを取得
  const getLastTreatmentMenus = (customerId) => {
    if (!customerId || !allDataByDate) return null;
    
    const today = new Date(dateKey);
    let lastTreatmentDate = null;
    let lastTreatmentMenus = null;
    
    // 全ての日付データを確認（今日より前）
    Object.keys(allDataByDate).forEach(date => {
      // customer-dbなどは除外
      if (date === 'customer-db') return;
      
      const dateData = allDataByDate[date];
      if (!dateData?.data || !dateData?.treatmentMenus) return;
      
      // 日付をパース
      const parts = date.split('-');
      let year, month, day;
      
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
        } else {
          year = new Date().getFullYear();
          month = parseInt(parts[0]) - 1;
          day = parseInt(parts[1]);
        }
      } else {
        return;
      }
      
      const visitDate = new Date(year, month, day);
      visitDate.setHours(0, 0, 0, 0);
      
      // 今日より前の日付のみ対象
      if (visitDate >= today) return;
      
      // その日付の全てのセルをチェック
      Object.keys(dateData.data).forEach(key => {
        if (key.includes('-id')) {
          const cellData = dateData.data[key];
          if (cellData?.id === customerId) {
            // このセルの施術メニューを取得
            const keyParts = key.split('-');
            const timeIndex = keyParts.length - 3;
            const time = keyParts[timeIndex];
            const col = keyParts[keyParts.length - 2];
            const cellKey = `${time}-${col}`;
            const menus = dateData.treatmentMenus[cellKey];
            
            // 施術メニューがあり、かつ最も新しい日付の場合
            if (menus && menus.length > 0 && (!lastTreatmentDate || visitDate > lastTreatmentDate)) {
              lastTreatmentDate = visitDate;
              lastTreatmentMenus = menus;
            }
          }
        }
      });
    });
    
    return lastTreatmentMenus;
  };

  // 担当別の集計
  const calculateStaffSummary = () => {
    const staffData = {};
    for (const key in data) {
      if (key.endsWith('-id') && data[key].id) {
        const nameKey = key.replace('-id', '-name');
        const staffKey = key.replace('-id', '-staff');
        const name = data[nameKey]?.name || '';
        const staff = normalizeStaff(data[staffKey]?.staff || '');
        
        // 楽トレを除外（「楽トレ」が含まれるものすべて）
        if (name && !name.includes('楽トレ')) {
          if (!staffData[staff || '未配置']) {
            staffData[staff || '未配置'] = 0;
          }
          staffData[staff || '未配置']++;
        }
      }
    }
    
    return Object.entries(staffData).sort((a, b) => {
      if (a[0] === '未配置') return 1;
      if (b[0] === '未配置') return -1;
      return a[0].localeCompare(b[0]);
    });
  };
  
  const staffSummary = calculateStaffSummary();
  
  // 担当別の施術メニュー集計
  const calculateStaffTreatmentSummary = () => {
    const staffTreatmentData = {};
    
    // 各セルをチェック
    for (const key in data) {
      if (key.endsWith('-id') && data[key].id) {
        const parts = key.split('-');
        const time = parts.slice(0, -2).join('-');
        const col = parts[parts.length - 2];
        const cellKey = `${time}-${col}`;
        
        const staffKey = getCellKey(time, col, 'staff');
        const staff = normalizeStaff(data[staffKey]?.staff || '未配置');
        const selectedMenus = (treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : [];
        
        if (!staffTreatmentData[staff]) {
          staffTreatmentData[staff] = {};
        }
        
        // 各メニューをカウント（個数付きメニューは個数分カウント）
        selectedMenus.forEach(menuItem => {
          // 個数付きメニュー（骨x2など）をパース
          let menu = menuItem;
          let count = 1;
          
          if (menuItem.includes('x')) {
            const match = menuItem.match(/^(.+)x(\d+)$/);
            if (match) {
              menu = match[1]; // メニュー名
              count = parseInt(match[2]); // 個数
            }
          }
          
          if (!staffTreatmentData[staff][menu]) {
            staffTreatmentData[staff][menu] = 0;
          }
          staffTreatmentData[staff][menu] += count;
        });
      }
    }
    
    // ソート
    return Object.entries(staffTreatmentData).sort((a, b) => {
      if (a[0] === '未配置') return 1;
      if (b[0] === '未配置') return -1;
      return a[0].localeCompare(b[0]);
    });
  };
  
  const staffTreatmentSummary = calculateStaffTreatmentSummary();

  const handleIdChange = (time, col, inputValue) => {
    const idKey = getCellKey(time, col, 'id');
    const nameKey = getCellKey(time, col, 'name');
    const staffKey = getCellKey(time, col, 'staff');
    
    // 編集中マークを設定
    markCellAsEditing(dateKey, idKey);
    
    const currentId = data[idKey]?.id || '';
    
    // 全角数字を半角に変換 + 数字以外を除外
    const value = inputValue
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9]/g, ''); // 数字以外を削除
    
    // 空の値で呼ばれた時: 既にIDが空ならスキップ
    if (!value && !currentId) {
      return;
    }
    
    if (!value) {
      
      // If ID is cleared, clear name and staff as well
      const clearedId = data[idKey]?.id;
      
      // この枠が楽の状態かチェック（削除する前にチェック）
      const isRakuCell = rakuPatients[nameKey] === true;
      
      // 直下の枠をチェック（楽の状態に関係なく、ID「1」と「楽トレ　枠」があれば削除候補）
      const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
      let shouldClearNextSlot = false;
      let nextTime, nextIdKey, nextNameKey, nextStaffKey;
      
      if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
        nextTime = timeSlots[currentTimeIndex + 1].time;
        nextIdKey = getCellKey(nextTime, col, 'id');
        nextNameKey = getCellKey(nextTime, col, 'name');
        nextStaffKey = getCellKey(nextTime, col, 'staff');
        
        const nextId = data[nextIdKey]?.id;
        const nextName = data[nextNameKey]?.name;
        
        // 直下の枠がID「1」と「楽トレ　枠」の場合、削除対象
        if (nextId === '1' && nextName === '楽トレ　枠') {
          shouldClearNextSlot = true;
        }
      }
      
      setAllDataByDate(prev => {
        const currentData = prev[dateKey] || {
          data: {},
          duplicates: {},
          idDuplicates: {},
          newPatients: {},
          repeatPatients: {},
          rakuPatients: {},
          oralButtons: {},
          partialButtons: {},
          completedStatus: {},
          cancelHistory: [],
          memoTexts: {},
          reviewData: {},
          treatmentMenus: {}
        };
        
        const updatedData = { ...currentData.data };
        delete updatedData[idKey];
        delete updatedData[nameKey];
        delete updatedData[staffKey];
        
        // 直下の枠も削除
        if (shouldClearNextSlot) {
          delete updatedData[nextIdKey];
          delete updatedData[nextNameKey];
          delete updatedData[nextStaffKey];
          console.log(`✅ 楽のID削除: 直下の枠（${nextTime}）のID「1」と「楽トレ　枠」も削除しました`);
        }
        
        return {
          ...prev,
          [dateKey]: {
            ...currentData,
            data: updatedData
          }
        };
      });
      
      // 楽の状態もクリア
      setRakuPatients(prev => {
        const updated = { ...prev };
        delete updated[nameKey];
        return updated;
      });
      
      setTimeout(() => checkDuplicates('', nameKey), 0);
      return;
    }
    
    // IDが変更された場合、既存の楽の状態をクリア
    setRakuPatients(prev => {
      const updated = { ...prev };
      delete updated[nameKey];
      return updated;
    });
    
    // IDを正規化して検索（ひらがな・カタカナ・大文字小文字を考慮）
    // valueは既に半角変換済み
    let customerInfo = customerDb[value]; // 完全一致を最初に試す
    
    if (!customerInfo) {
      // 完全一致しない場合、変換して検索
      const valueKatakana = hiraganaToKatakana(value);
      const valueHiragana = katakanaToHiragana(value);
      const valueLower = value.toLowerCase();
      const valueUpper = value.toUpperCase();
      
      // すべてのIDで検索
      for (const [id, info] of Object.entries(customerDb)) {
        const idKatakana = hiraganaToKatakana(id);
        const idHiragana = katakanaToHiragana(id);
        const idLower = id.toLowerCase();
        const idUpper = id.toUpperCase();
        
        if (id === value ||
            id === valueKatakana ||
            id === valueHiragana ||
            idKatakana === value ||
            idKatakana === valueKatakana ||
            idKatakana === valueHiragana ||
            idHiragana === value ||
            idHiragana === valueKatakana ||
            idHiragana === valueHiragana ||
            idLower === valueLower ||
            idUpper === valueUpper) {
          customerInfo = info;
          console.log(`✅ ID「${value}」を「${id}」として検出しました`);
          break;
        }
      }
    }
    
    const customerName = customerInfo?.name || '';
    const staffInitial = customerInfo?.staff || '';
    const isRaku = customerInfo?.isRaku || false;
    
    // 担当が1文字の場合は大文字に正規化
    const normalizedStaffInitial = staffInitial.length === 1 ? staffInitial.toUpperCase() : staffInitial;
    
    // 担当を決定：顧客DBに担当があれば必ず使用、なければ現在の値を保持
    const currentStaff = data[staffKey]?.staff || '';
    const finalStaff = normalizedStaffInitial || currentStaff;
    
    // 新規顧客（customerNameが空）の場合、名前とふりがなを入力
    let inputName = customerName;
    let inputFurigana = '';
    
    if (!customerName && value) {
      // 既にcustomerDbに登録されているかチェック（名前だけ空の場合もある）
      if (!customerInfo) {
        const nameInput = prompt(`新規顧客ID「${value}」の名前を入力してください:`);
        if (nameInput) {
          inputName = nameInput.trim();
          const furiganaInput = prompt(`「${inputName}」のふりがなを入力してください（省略可）:`);
          if (furiganaInput) {
            inputFurigana = furiganaInput.trim();
          }
          
          // customerDbに新規登録
          setCustomerDb(prev => {
            const updatedDb = {
              ...prev,
              [value]: {
                name: inputName,
                staff: finalStaff,
                furigana: inputFurigana,
                isRaku: false
              }
            };
            
            // サーバーにも保存
            saveCustomerDatabaseToServer(updatedDb);
            console.log(`➕ 新規顧客を登録: ID="${value}", 名前="${inputName}", ふりがな="${inputFurigana}"`);
            
            return updatedDb;
          });
        } else {
          // キャンセルされた場合はIDをクリア
          setAllDataByDate(prev => {
            const currentData = prev[dateKey] || {
              data: {},
              duplicates: {},
              idDuplicates: {},
              newPatients: {},
              repeatPatients: {},
              rakuPatients: {},
              oralButtons: {},
              partialButtons: {},
              completedStatus: {},
              cancelHistory: [],
              memoTexts: {},
              reviewData: {},
              treatmentMenus: {}
            };
            
            const updatedData = { ...currentData.data };
            delete updatedData[idKey];
            
            return {
              ...prev,
              [dateKey]: {
                ...currentData,
                data: updatedData
              }
            };
          });
          return;
        }
      }
    }
    
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
        reviewData: {},
        treatmentMenus: {}
      };
      
      return {
        ...prev,
        [dateKey]: {
          ...currentData,
          data: {
            ...currentData.data,
            [idKey]: { ...currentData.data[idKey], id: value },
            [nameKey]: { ...currentData.data[nameKey], name: inputName },
            [staffKey]: { ...currentData.data[staffKey], staff: finalStaff }
          }
        }
      };
    });
    
    // 楽の状態を復元（顧客データベースに保存されている場合のみ）
    if (isRaku) {
      setRakuPatients(prev => ({
        ...prev,
        [nameKey]: true
      }));
      console.log(`✅ ID「${value}」の楽状態を復元しました`);
      
      // 直下の予約枠にもID「1」を自動挿入
      const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
      if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
        const nextTime = timeSlots[currentTimeIndex + 1].time;
        const nextIdKey = getCellKey(nextTime, col, 'id');
        const nextNameKey = getCellKey(nextTime, col, 'name');
        const nextStaffKey = getCellKey(nextTime, col, 'staff');
        
        // 既存IDチェック
        const existingId = data[nextIdKey]?.id;
        if (!existingId || existingId.trim() === '') {
          setAllDataByDate(prev => {
            const currentData = prev[dateKey] || {
              data: {},
              duplicates: {},
              idDuplicates: {},
              newPatients: {},
              repeatPatients: {},
              rakuPatients: {},
              oralButtons: {},
              partialButtons: {},
              completedStatus: {},
              cancelHistory: [],
              memoTexts: {},
              reviewData: {},
              treatmentMenus: {}
            };
            
            return {
              ...prev,
              [dateKey]: {
                ...currentData,
                data: {
                  ...currentData.data,
                  [nextIdKey]: { ...currentData.data[nextIdKey], id: '1', _timestamp: Date.now() },
                  [nextNameKey]: { ...currentData.data[nextNameKey], name: '楽トレ　枠', _timestamp: Date.now() },
                  [nextStaffKey]: { ...currentData.data[nextStaffKey], staff: '', _timestamp: Date.now() }
                }
              }
            };
          });
          console.log(`✅ 楽復元: 直下の枠（${nextTime}）にID「1」と「楽トレ　枠」を自動挿入しました`);
        }
      }
    }
    
    // 前回の施術メニュー復元は、入力完了後（handleIdBlur）で行う
    
    if (inputName) {
      setTimeout(() => checkDuplicates(inputName, nameKey), 0);
    } else {
      setTimeout(() => checkDuplicates('', nameKey), 0);
    }
  };

  // 手動保存関数（Enter押下 or フォーカスアウト時）
  const handleManualSave = () => {
    if (initialized && !isRealtimeUpdating) {
      console.log(`💾 手動保存: ${currentDate}のみ`);
      saveToServer(allDataByDate, true, currentDate); // 現在の日付のみ保存
      lastSaveTimestamp.current = Date.now();
    }
  };
  
  // ID入力完了時の処理（施術メニュー復元）
  const handleIdBlur = (time, col) => {
    const idKey = getCellKey(time, col, 'id');
    const customerId = data[idKey]?.id;
    
    if (!customerId) return;
    
    // 前回の施術メニューを取得して自動設定
    const lastTreatmentMenus = getLastTreatmentMenus(customerId);
    if (lastTreatmentMenus && lastTreatmentMenus.length > 0) {
      const cellKey = `${time}-${col}`;
      
      // 既に施術メニューが設定されている場合はスキップ
      const currentMenus = treatmentMenus[cellKey];
      if (currentMenus && currentMenus.length > 0) {
        return;
      }
      
      setAllDataByDate(prev => {
        const currentData = prev[dateKey] || {
          data: {},
          duplicates: {},
          idDuplicates: {},
          newPatients: {},
          repeatPatients: {},
          rakuPatients: {},
          oralButtons: {},
          partialButtons: {},
          completedStatus: {},
          cancelHistory: [],
          memoTexts: {},
          reviewData: {},
          treatmentMenus: {}
        };
        
        return {
          ...prev,
          [dateKey]: {
            ...currentData,
            treatmentMenus: {
              ...currentData.treatmentMenus,
              [cellKey]: lastTreatmentMenus
            }
          }
        };
      });
      console.log(`✅ ID「${customerId}」の前回施術メニューを復元:`, lastTreatmentMenus);
    }
  };

  const handleStaffChange = (time, col, inputValue) => {
    // 全角英数字を半角に変換し、英数字以外を削除、大文字に統一、1文字に制限（IME対策）
    const value = inputValue
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      })
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 1);
    
    const key = getCellKey(time, col, 'staff');
    const idKey = getCellKey(time, col, 'id');
    const currentId = data[idKey]?.id;
    
    // 現在の値と同じ場合はスキップ
    const currentValue = data[key]?.staff || '';
    if (currentValue === value) {
      return;
    }
    
    // 編集中マークを設定
    markCellAsEditing(dateKey, key);
    
    // データを更新
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
        reviewData: {},
        treatmentMenus: {}
      };
      
      return {
        ...prev,
        [dateKey]: {
          ...currentData,
          data: {
            ...currentData.data,
            [key]: { ...currentData.data[key], staff: value }
          }
        }
      };
    });
    
    // IDが入力されている場合、顧客データベースも更新
    if (currentId && customerDb[currentId]) {
      setCustomerDb(prev => {
        const updated = {
          ...prev,
          [currentId]: {
            ...prev[currentId],
            staff: value
          }
        };
        
        // サーバーにも保存（非同期）
        saveCustomerDatabaseToServer(updated);
        
        return updated;
      });
    }
  };

  const handleNameChange = (time, col, value) => {
    const key = getCellKey(time, col, 'name');
    const idKey = getCellKey(time, col, 'id');
    const currentId = data[idKey]?.id;
    
    // 編集中マークを設定
    markCellAsEditing(dateKey, key);
    
    // データを更新
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
        reviewData: {},
        treatmentMenus: {}
      };
      
      return {
        ...prev,
        [dateKey]: {
          ...currentData,
          data: {
            ...currentData.data,
            [key]: { ...currentData.data[key], name: value }
          }
        }
      };
    });
    
    // 重複チェック
    checkDuplicates(value, key);
    
    // IDが入力されている場合、顧客データベースも更新
    if (currentId && customerDb[currentId]) {
      setCustomerDb(prev => {
        const updated = {
          ...prev,
          [currentId]: {
            ...prev[currentId],
            name: value
          }
        };
        
        // サーバーにも保存（非同期）
        saveCustomerDatabaseToServer(updated);
        
        return updated;
      });
      
      console.log(`✅ ID「${currentId}」の名前を「${value}」に更新しました`);
    }
  };
  
  // 文字数に応じてフォントサイズを動的に調整（セル幅60-70pxに収まるように）
  const calculateFontSize = (text) => {
    if (!text) return '24px';
    const length = text.length;
    
    // iPad判定（画面幅1024px以下）
    const isIPad = window.innerWidth <= 1024;
    
    if (isIPad) {
      // iPad用：少し小さめのフォントサイズ
      if (length <= 2) return '18px';
      if (length <= 3) return '15px';
      if (length <= 4) return '13px';
      if (length <= 5) return '11px';
      if (length <= 6) return '10px';
      if (length <= 7) return '9px';
      if (length <= 8) return '8px';
      return '7px';
    } else {
      // PC用：大きめのフォントサイズ
      if (length <= 2) return '24px';
      if (length <= 3) return '20px';
      if (length <= 4) return '17px';
      if (length <= 5) return '15px';
      if (length <= 6) return '13px';
      if (length <= 7) return '12px';
      if (length <= 8) return '11px';
      return '10px';
    }
  };

  const checkDuplicates = (name, currentKey) => {
    const newDuplicates = {};
    
    if (!name) {
      const nameCounts = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value.name && key !== currentKey) {
          nameCounts[value.name] = (nameCounts[value.name] || []).concat(key);
        }
      });
      
      Object.entries(nameCounts).forEach(([n, keys]) => {
        if (n === '楽トレ　枠') {
          // 楽トレ　枠は時間ごと（横列）にカウント
          const timeCounts = {};
          keys.forEach(k => {
            const parts = k.split('-');
            const time = parts.slice(0, -2).join('-'); // 時間を取得（例: "9:00"）
            timeCounts[time] = (timeCounts[time] || []).concat(k);
          });
          
          // 各時間で6枠以上あれば重複扱い
          Object.values(timeCounts).forEach(timeKeys => {
            if (timeKeys.length >= 6) {
              timeKeys.forEach(k => {
                newDuplicates[k] = true;
              });
            }
          });
        } else {
          // 通常の名前は2枠以上で重複
          if (keys.length >= 2) {
            keys.forEach(k => {
              newDuplicates[k] = true;
            });
          }
        }
      });
      
      setDuplicates(newDuplicates);
      checkIdDuplicates(); // ID重複チェックも実行
      return;
    }
    
    const positions = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value.name === name && key !== currentKey) {
        positions.push(key);
      }
    });
    
    positions.push(currentKey);
    
    if (name === '楽トレ　枠') {
      // 楽トレ　枠：同じ時間（横列）で6枠以上かぶったら重複扱い
      const currentParts = currentKey.split('-');
      const currentTime = currentParts.slice(0, -2).join('-'); // 時間を取得
      
      const sameTimePositions = positions.filter(pos => {
        const parts = pos.split('-');
        const time = parts.slice(0, -2).join('-');
        return time === currentTime;
      });
      
      if (sameTimePositions.length >= 6) {
        sameTimePositions.forEach(pos => {
          newDuplicates[pos] = true;
        });
      }
    } else {
      // 通常の名前：2枠以上で重複
      if (positions.length >= 2) {
        positions.forEach(pos => {
          newDuplicates[pos] = true;
        });
      }
    }
    
    Object.entries(duplicates).forEach(([key, value]) => {
      if (!positions.includes(key)) {
        const cellData = data[key];
        if (cellData?.name && cellData.name !== name) {
          if (cellData.name === '楽トレ　枠') {
            // 楽トレ　枠の時間ごと（横列）チェック
            const parts = key.split('-');
            const time = parts.slice(0, -2).join('-');
            const sameTimeCount = Object.entries(data).filter(
              ([k, v]) => {
                if (v.name !== '楽トレ　枠') return false;
                const kParts = k.split('-');
                const kTime = kParts.slice(0, -2).join('-');
                return kTime === time;
              }
            ).length;
            if (sameTimeCount >= 6) {
              newDuplicates[key] = true;
            }
          } else {
            // 通常の名前
            const sameNameCount = Object.entries(data).filter(
              ([k, v]) => v.name === cellData.name && v.name
            ).length;
            if (sameNameCount >= 2) {
              newDuplicates[key] = true;
            }
          }
        }
      }
    });
    
    setDuplicates(newDuplicates);
  };

  const checkStaffOverload = (time, col) => {
    const staffKey = getCellKey(time, col, 'staff');
    const currentStaff = data[staffKey]?.staff;
    
    if (!currentStaff) return false;
    
    // 正規化して比較（大文字小文字・全角半角を統一）
    const normalizedCurrentStaff = normalizeStaff(currentStaff);
    
    // Count how many times this staff appears in this time slot
    let staffCount = 0;
    const maxCols = 11;
    
    for (let c = 0; c < maxCols; c++) {
      const key = getCellKey(time, c, 'staff');
      const otherStaff = data[key]?.staff;
      if (otherStaff && normalizeStaff(otherStaff) === normalizedCurrentStaff) {
        staffCount++;
      }
    }
    
    return staffCount >= 3;
  };

  // ID重複チェック関数（大文字小文字・全角半角を正規化）
  const checkIdDuplicates = () => {
    // ID重複チェックを無効化：常に空のオブジェクトを設定
    setIdDuplicates({});
  };

  // 前の時間枠で同じ列に新患・再診・楽があるかチェック
  const checkPrevTimeSlotPatientType = (currentTimeIndex, col) => {
    if (currentTimeIndex <= 0) return { isNew: false, isRepeat: false, isRaku: false };
    
    const prevTime = timeSlots[currentTimeIndex - 1].time;
    const prevKey = getCellKey(prevTime, col, 'name');
    
    return {
      isNew: newPatients[prevKey] || false,
      isRepeat: repeatPatients[prevKey] || false,
      isRaku: rakuPatients[prevKey] || false
    };
  };

  const handleNewOrRepeat = (time, col, type) => {
    console.log(`🎯 handleNewOrRepeat呼び出し: type=${type}, time=${time}, col=${col}`);
    
    const key = getCellKey(time, col, 'name');
    const idKey = getCellKey(time, col, 'id');
    const currentId = data[idKey]?.id;
    
    console.log(`🎯 key=${key}, idKey=${idKey}, currentId=${currentId}`);
    
    if (type === '新') {
      // 直下の予約枠（次の時間枠）のIDに「1」を自動挿入
      const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
      
      let nextIdKey, nextNameKey, nextStaffKey, nextTime;
      let shouldInsertNextSlot = false;
      
      if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
        nextTime = timeSlots[currentTimeIndex + 1].time;
        nextIdKey = getCellKey(nextTime, col, 'id');
        nextNameKey = getCellKey(nextTime, col, 'name');
        nextStaffKey = getCellKey(nextTime, col, 'staff');
      }
      
      // 全ての更新を一度に実行
      setAllDataByDate(prev => {
        const currentData = prev[dateKey] || {
          data: {},
          duplicates: {},
          idDuplicates: {},
          newPatients: {},
          repeatPatients: {},
          rakuPatients: {},
          oralButtons: {},
          partialButtons: {},
          completedStatus: {},
          cancelHistory: [],
          memoTexts: {},
          reviewData: {},
          treatmentMenus: {}
        };
        
        // 新患の状態を設定
        const newNewPatients = {
          ...currentData.newPatients,
          [key]: true
        };
        
        // 下の枠はピンク枠にしない（楽トレ　枠用）
        
        const newRepeatPatients = { ...currentData.repeatPatients };
        delete newRepeatPatients[key];
        
        const newRakuPatients = { ...currentData.rakuPatients };
        delete newRakuPatients[key];
        
        // 直下の枠のデータを準備
        let newData = { ...currentData.data };
        
        if (nextIdKey) {
          const existingId = currentData.data[nextIdKey]?.id;
          
          if (!existingId || existingId.trim() === '') {
            newData[nextIdKey] = { id: '1', _timestamp: Date.now() };
            newData[nextNameKey] = { name: '楽トレ　枠', _timestamp: Date.now() };
            newData[nextStaffKey] = { staff: '', _timestamp: Date.now() };
            shouldInsertNextSlot = true;
            console.log(`✅ 新患: 直下の枠（${nextTime}）にID「1」と「楽トレ　枠」を挿入準備完了`);
          } else {
            console.log(`⚠️ 既存ID「${existingId}」があるため挿入をスキップしました`);
          }
        }
        
        const updatedData = {
          ...prev,
          [dateKey]: {
            ...currentData,
            data: newData,
            newPatients: newNewPatients,
            repeatPatients: newRepeatPatients,
            rakuPatients: newRakuPatients
          }
        };
        
        // サーバーに保存
        if (initialized && !isRealtimeUpdating) {
          console.log(`💾 新患の状態${shouldInsertNextSlot ? 'と直下の枠のデータ' : ''}を保存: ${dateKey}のみ`);
          if (shouldInsertNextSlot) {
            console.log(`📤 保存内容: nextIdKey=${nextIdKey}, ID=1, name=楽トレ　枠`);
          }
          saveToServer(updatedData, true, dateKey).then(() => {
            console.log('✅ サーバー保存完了');
          });
        }
        
        return updatedData;
      });
    } else if (type === '再') {
      setRepeatPatients(prev => ({
        ...prev,
        [key]: true
      }));
      setNewPatients(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      setRakuPatients(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } else if (type === '楽') {
      // 直下の予約枠（次の時間枠）のIDに「1」を自動挿入
      const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
      
      let nextIdKey, nextNameKey, nextStaffKey, nextTime;
      let shouldInsertNextSlot = false;
      
      if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
        nextTime = timeSlots[currentTimeIndex + 1].time;
        nextIdKey = getCellKey(nextTime, col, 'id');
        nextNameKey = getCellKey(nextTime, col, 'name');
        nextStaffKey = getCellKey(nextTime, col, 'staff');
        
      }
      
      // 全ての更新を一度に実行
      setAllDataByDate(prev => {
        const currentData = prev[dateKey] || {
          data: {},
          duplicates: {},
          idDuplicates: {},
          newPatients: {},
          repeatPatients: {},
          rakuPatients: {},
          oralButtons: {},
          partialButtons: {},
          completedStatus: {},
          cancelHistory: [],
          memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
        };
        
        // 楽の状態を設定
        const newRakuPatients = {
          ...currentData.rakuPatients,
          [key]: true
        };
        
        const newNewPatients = { ...currentData.newPatients };
        delete newNewPatients[key];
        
        const newRepeatPatients = { ...currentData.repeatPatients };
        delete newRepeatPatients[key];
        
        // 直下の枠のデータを準備
        let newData = { ...currentData.data };
        
        if (nextIdKey) {
          const existingId = currentData.data[nextIdKey]?.id;
          
          if (!existingId || existingId.trim() === '') {
            newData[nextIdKey] = { id: '1', _timestamp: Date.now() };
            newData[nextNameKey] = { name: '楽トレ　枠', _timestamp: Date.now() };
            newData[nextStaffKey] = { staff: '', _timestamp: Date.now() };
            shouldInsertNextSlot = true;
            console.log(`✅ 直下の枠（${nextTime}）にID「1」と「楽トレ　枠」を挿入準備完了`);
          } else {
            console.log(`⚠️ 既存ID「${existingId}」があるため挿入をスキップしました`);
          }
        }
        
        const updatedData = {
          ...prev,
          [dateKey]: {
            ...currentData,
            data: newData,
            rakuPatients: newRakuPatients,
            newPatients: newNewPatients,
            repeatPatients: newRepeatPatients
          }
        };
        
        // サーバーに保存
        if (initialized && !isRealtimeUpdating) {
          console.log(`💾 楽の状態${shouldInsertNextSlot ? 'と直下の枠のデータ' : ''}を保存: ${dateKey}のみ`);
          if (shouldInsertNextSlot) {
            console.log(`📤 保存内容: nextIdKey=${nextIdKey}, ID=1, name=楽トレ　枠`);
          }
          saveToServer(updatedData, true, dateKey).then(() => {
            console.log('✅ サーバー保存完了');
          });
        }
        
        return updatedData;
      });
      
      // 楽の状態を顧客データベースに保存
      if (currentId && customerDb[currentId]) {
        setCustomerDb(prev => {
          const updated = {
            ...prev,
            [currentId]: {
              ...prev[currentId],
              isRaku: true
            }
          };
          
          saveCustomerDatabaseToServer(updated);
          
          return updated;
        });
        
        console.log(`✅ ID「${currentId}」を楽として保存しました`);
      }
    } else if (type === '既') {
      // Clear all status for 既
      
      // 楽または新から既に変更する場合、直下の枠もクリア
      const wasRaku = rakuPatients[key] === true;
      const wasNew = newPatients[key] === true;
      
      setNewPatients(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      setRepeatPatients(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      setRakuPatients(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      
      // もし楽または新から既に変更した場合、直下の枠もクリア
      if (wasRaku || wasNew) {
        console.log(`✅ ${wasRaku ? '楽' : '新'}→既に変更: 直下の枠もクリアします`);
        
        const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
        if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
          const nextTime = timeSlots[currentTimeIndex + 1].time;
          const nextIdKey = getCellKey(nextTime, col, 'id');
          const nextNameKey = getCellKey(nextTime, col, 'name');
          const nextStaffKey = getCellKey(nextTime, col, 'staff');
          
          // 直下の枠がID「1」と「楽トレ　枠」の場合のみクリア
          const nextId = data[nextIdKey]?.id;
          const nextName = data[nextNameKey]?.name;
          
          
          if (nextId === '1' && nextName === '楽トレ　枠') {
            setAllDataByDate(prev => {
              const currentData = prev[dateKey] || {
                data: {},
                duplicates: {},
                idDuplicates: {},
                newPatients: {},
                repeatPatients: {},
                rakuPatients: {},
                oralButtons: {},
                partialButtons: {},
                completedStatus: {},
                cancelHistory: [],
                memoTexts: {},
                reviewData: {},
                treatmentMenus: {}
              };
              
              const updatedData = { ...currentData.data };
              delete updatedData[nextIdKey];
              delete updatedData[nextNameKey];
              delete updatedData[nextStaffKey];
              
              return {
                ...prev,
                [dateKey]: {
                  ...currentData,
                  data: updatedData
                }
              };
            });
            console.log(`✅ 楽→既: 直下の枠（${nextTime}）のID「1」と「楽トレ　枠」も削除しました`);
          }
        }
      }
      
      // 楽の状態を顧客データベースから削除
      if (currentId && customerDb[currentId]) {
        setCustomerDb(prev => {
          const updated = {
            ...prev,
            [currentId]: {
              ...prev[currentId],
              isRaku: false
            }
          };
          
          // サーバーにも保存
          saveCustomerDatabaseToServer(updated);
          
          return updated;
        });
        
        console.log(`✅ ID「${currentId}」の楽状態を解除しました`);
      }
    }
  };

  const handleOralClick = (time, col) => {
    const key = getCellKey(time, col, 'oral');
    setOralButtons(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePartialClick = (time, col) => {
    const key = getCellKey(time, col, 'partial');
    setPartialButtons(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleMemoClick = (time, col) => {
    const key = getCellKey(time, col, 'memo');
    const cellKey = `${time}-${col}`;
    
    if (openMemo === key) {
      // メモを閉じる前に未保存チェック
      if (treatmentMenusModified[cellKey]) {
        if (!window.confirm('施術メニューが保存されていません。\n保存せずに閉じますか？')) {
          return;
        }
        // 未保存のまま閉じる場合、変更フラグとtempデータをクリア
        setTreatmentMenusModified(prev => {
          const updated = { ...prev };
          delete updated[cellKey];
          return updated;
        });
        setTempTreatmentMenus(prev => {
          const updated = { ...prev };
          delete updated[cellKey];
          return updated;
        });
      }
      setOpenMemo(null);
    } else {
      // メモを開く: 現在の施術メニューを一時データにコピー
      const currentMenus = (treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : [];
      setTempTreatmentMenus(prev => ({
        ...prev,
        [cellKey]: [...currentMenus]
      }));
      setTreatmentMenusModified(prev => ({
        ...prev,
        [cellKey]: false
      }));
      setOpenMemo(key);
    }
  };

  const handleMemoChange = (time, col, value) => {
    const key = getCellKey(time, col, 'memo');
    setMemoTexts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 施術メニューを保存する関数
  const handleSaveTreatmentMenus = (time, col) => {
    const cellKey = `${time}-${col}`;
    const tempMenus = tempTreatmentMenus[cellKey];
    
    if (tempMenus === undefined) return; // 変更なし
    
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
        reviewData: {},
        treatmentMenus: {}
      };
      
      const updatedData = {
        ...prev,
        [dateKey]: {
          ...currentData,
          treatmentMenus: {
            ...(currentData.treatmentMenus || {}),
            [cellKey]: tempMenus
          }
        }
      };
      
      // サーバーに保存
      if (initialized && !isRealtimeUpdating) {
        saveToServer(updatedData, true, dateKey);
      }
      
      return updatedData;
    });
    
    // 変更フラグをクリア
    setTreatmentMenusModified(prev => ({
      ...prev,
      [cellKey]: false
    }));
  };

  // 患者IDの今後の予約を取得
  const getFutureReservations = (patientId) => {
    if (!patientId) return [];
    
    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0); // 時間をリセット
    const futureReservations = [];
    
    // 全ての日付のデータを走査
    Object.entries(allDataByDate).forEach(([dateKey, dateData]) => {
      // customer-db は除外
      if (dateKey === 'customer-db') return;
      
      // 日付をパース (例: "2025-12-11" または "12-11")
      const parts = dateKey.split('-');
      let year, month, day;
      
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // "2025-12-11" 形式
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
        } else {
          // "12-11" 形式 (年は現在の年)
          year = new Date().getFullYear();
          month = parseInt(parts[0]) - 1;
          day = parseInt(parts[1]);
        }
      } else if (parts.length === 4) {
        // "2025" のような年だけのキーは除外
        return;
      } else {
        return;
      }
      
      const reservationDate = new Date(year, month, day);
      reservationDate.setHours(0, 0, 0, 0);
      
      // 今日より未来の予約のみ
      if (reservationDate > today && dateData.data) {
        Object.entries(dateData.data).forEach(([key, value]) => {
          // IDのキーのみ処理 (例: "12-11-9:00-1-id")
          if (key.endsWith('-id') && value.id === patientId) {
            // キーから時間を抽出
            const keyParts = key.split('-');
            // 最後から2番目が列番号、3番目が時間
            const timeIndex = keyParts.length - 3;
            const time = keyParts[timeIndex];
            
            futureReservations.push({
              date: `${year}/${month + 1}/${day}`,
              time: time,
              sortKey: reservationDate.getTime(),
              fullDate: reservationDate // ジャンプ用の完全な日付オブジェクト
            });
          }
        });
      }
    });
    
    // 日付順にソート
    return futureReservations.sort((a, b) => a.sortKey - b.sortKey);
  };

  const handleEditCancel = (idx) => {
    setEditingCancelIndex(idx);
    setEditingCancelData({ ...cancelHistory[idx] });
  };

  const handleSaveCancel = (idx) => {
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
      };
      
      const updated = [...currentData.cancelHistory];
      updated[idx] = editingCancelData;
      
      const updatedData = {
        ...prev,
        [dateKey]: {
          ...currentData,
          cancelHistory: updated
        }
      };
      
      // 即座に保存
      if (initialized && !isRealtimeUpdating) {
        console.log('💾 キャンセル履歴編集: 保存');
        saveToServer(updatedData, true, dateKey);
      }
      
      return updatedData;
    });
    
    setEditingCancelIndex(null);
    setEditingCancelData(null);
  };

  const handleDeleteCancel = (idx) => {
    if (window.confirm('このキャンセル履歴を削除しますか？')) {
      setAllDataByDate(prev => {
        const currentData = prev[dateKey] || {
          data: {},
          duplicates: {},
          idDuplicates: {},
          newPatients: {},
          repeatPatients: {},
          rakuPatients: {},
          oralButtons: {},
          partialButtons: {},
          completedStatus: {},
          cancelHistory: [],
          memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
        };
        
        const updated = [...currentData.cancelHistory];
        updated.splice(idx, 1);
        
        const updatedData = {
          ...prev,
          [dateKey]: {
            ...currentData,
            cancelHistory: updated
          }
        };
        
        // 即座に保存
        if (initialized && !isRealtimeUpdating) {
          console.log('🗑️ キャンセル履歴削除: 保存');
          saveToServer(updatedData, true, dateKey);
        }
        
        return updatedData;
      });
    }
  };

  const handleCompletedClick = (time, col, status) => {
    const key = getCellKey(time, col, 'completed');
    
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
      };
      
      const updatedData = {
        ...prev,
        [dateKey]: {
          ...currentData,
          completedStatus: {
            ...currentData.completedStatus,
            [key]: status
          }
        }
      };
      
      // 即座に保存
      if (initialized && !isRealtimeUpdating) {
        saveToServer(updatedData, true, dateKey);
      }
      
      return updatedData;
    });
    
    setOpenCompletedDropdown(null);
  };

  const cancelReasons = [
    'また連絡',
    '体調不良',
    '仕事の都合',
    '急用',
    '予定変更',
    '連絡なし',
    '入力取り消し'
  ];

  const handleCancel = async (time, col, reason) => {
    const idKey = getCellKey(time, col, 'id');
    const nameKey = getCellKey(time, col, 'name');
    const staffKey = getCellKey(time, col, 'staff');
    const canceledId = data[idKey]?.id || '';
    const canceledName = data[nameKey]?.name || '';
    
    // 確認アラート
    const confirmMessage = reason === '入力取り消し' 
      ? `入力を取り消しますか？\nID: ${canceledId || '(なし)'}\n名前: ${canceledName || '(なし)'}`
      : `キャンセルしますか？\nID: ${canceledId || '(なし)'}\n名前: ${canceledName || '(なし)'}\n理由: ${reason}`;
    
    if (!window.confirm(confirmMessage)) {
      setOpenDropdown(null);
      return;
    }
    
    // ネット予約の場合、サーバーからも削除
    const memoKey = getCellKey(time, col, 'memo');
    const memoText = memoTexts[memoKey] || '';
    
    // メモから Web予約ID を抽出
    const webBookingIdMatch = memoText.match(/ID:\s*([^\n]+)/);
    const webBookingId = webBookingIdMatch ? webBookingIdMatch[1].trim() : null;
    
    if (webBookingId && (webBookingId.startsWith('WEB_') || memoText.includes('【ネット予約】') || memoText.includes('【新規・ネット予約】'))) {
      try {
        console.log('🗑️ ネット予約削除:', webBookingId);
        const response = await fetch(`http://localhost:5000/api/web-bookings/${webBookingId}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
          console.log('✅ サーバーから削除成功:', webBookingId);
        }
      } catch (error) {
        console.error('❌ サーバー削除エラー:', error);
      }
    }
    
    // 更新後のデータを構築
    setAllDataByDate(prev => {
      const currentData = prev[dateKey] || {
        data: {},
        duplicates: {},
        idDuplicates: {},
        newPatients: {},
        repeatPatients: {},
        rakuPatients: {},
        oralButtons: {},
        partialButtons: {},
        completedStatus: {},
        cancelHistory: [],
        memoTexts: {},
    reviewData: {}, // 口コミデータ
    treatmentMenus: {}
      };
      
      // データを空に設定（削除ではなく空文字を設定）
      const newData = { ...currentData.data };
      newData[idKey] = { id: '', _timestamp: Date.now() };
      newData[nameKey] = { name: '', _timestamp: Date.now() };
      newData[staffKey] = { staff: '', _timestamp: Date.now() };
      
      // もしキャンセルした枠が楽の状態だった場合、直下の枠もクリア
      const key = getCellKey(time, col, 'name');
      const isRakuCell = currentData.rakuPatients[key] === true;
      
      if (isRakuCell) {
        console.log(`✅ キャンセル: 楽の枠を検知`);
        
        const currentTimeIndex = timeSlots.findIndex(slot => slot.time === time);
        if (currentTimeIndex !== -1 && currentTimeIndex < timeSlots.length - 1) {
          const nextTime = timeSlots[currentTimeIndex + 1].time;
          const nextIdKey = getCellKey(nextTime, col, 'id');
          const nextNameKey = getCellKey(nextTime, col, 'name');
          const nextStaffKey = getCellKey(nextTime, col, 'staff');
          
          // 直下の枠がID「1」と「楽トレ　枠」の場合のみクリア
          const nextId = currentData.data[nextIdKey]?.id;
          const nextName = currentData.data[nextNameKey]?.name;
          
          
          if (nextId === '1' && nextName === '楽トレ　枠') {
            newData[nextIdKey] = { id: '', _timestamp: Date.now() };
            newData[nextNameKey] = { name: '', _timestamp: Date.now() };
            newData[nextStaffKey] = { staff: '', _timestamp: Date.now() };
            console.log(`✅ キャンセル: 直下の枠（${nextTime}）のID「1」と「楽トレ　枠」も削除しました`);
          }
        }
      }
      
      // 新患・再診・楽から削除
      const newNewPatients = { ...currentData.newPatients };
      delete newNewPatients[key];
      const newRepeatPatients = { ...currentData.repeatPatients };
      delete newRepeatPatients[key];
      const newRakuPatients = { ...currentData.rakuPatients };
      delete newRakuPatients[key];
      
      // ボタン状態から削除
      const newOralButtons = { ...currentData.oralButtons };
      delete newOralButtons[getCellKey(time, col, 'oral')];
      const newPartialButtons = { ...currentData.partialButtons };
      delete newPartialButtons[getCellKey(time, col, 'partial')];
      const newCompletedStatus = { ...currentData.completedStatus };
      delete newCompletedStatus[getCellKey(time, col, 'completed')];
      const newMemoTexts = { ...currentData.memoTexts };
      delete newMemoTexts[getCellKey(time, col, 'memo')];
      
      // キャンセル履歴に追加
      let newCancelHistory = [...currentData.cancelHistory];
      if (reason !== '入力取り消し' && (canceledId || canceledName)) {
        newCancelHistory.push({
          id: canceledId,
          name: canceledName,
          reason: reason,
          timestamp: new Date().toLocaleString('ja-JP')
        });
      }
      
      const updatedData = {
        ...prev,
        [dateKey]: {
          ...currentData,
          data: newData,
          newPatients: newNewPatients,
          repeatPatients: newRepeatPatients,
          rakuPatients: newRakuPatients,
          oralButtons: newOralButtons,
          partialButtons: newPartialButtons,
          completedStatus: newCompletedStatus,
          memoTexts: newMemoTexts,
          cancelHistory: newCancelHistory
        }
      };
      
      // 即座に保存
      if (initialized && !isRealtimeUpdating) {
        console.log('🗑️ キャンセル処理: データを空に設定して保存');
        saveToServer(updatedData, true, dateKey);
      }
      
      return updatedData;
    });
    
    setOpenDropdown(null);
    
    // Recalculate duplicates after canceling
    setTimeout(() => checkDuplicates('', nameKey), 0);
  };

  const handleDateChange = (e) => {
    setSelectedDate(new Date(e.target.value));
  };

    const getReservationList = () => {
    const list = [];
    for (const key in data) {
      if (key.endsWith('-id')) {
        const id = data[key].id;
        const nameKey = key.replace('-id', '-name');
        const staffKey = key.replace('-id', '-staff');
        const name = data[nameKey]?.name || '';
        const staff = data[staffKey]?.staff || '';
        
        // 時間と列番号を抽出
        const parts = key.split('-');
        const col = parts[parts.length - 2];
        const time = parts.slice(0, -2).join('-');
        
        if (id && name && name !== '楽トレ　枠') {
          list.push({ id, name, staff, time, col });
        }
      }
    }
    // 担当順にソート（正規化して比較）
    return list.sort((a, b) => {
      const staffA = normalizeStaff(a.staff);
      const staffB = normalizeStaff(b.staff);
      if (!staffA && !staffB) return 0;
      if (!staffA) return 1;
      if (!staffB) return -1;
      return staffA.localeCompare(staffB);
    });
  };

  const maxColumns = 11;

  return (
    <>
      <style>{`
        [data-dropdown="true"],
        [data-memo-popup="true"] {
          z-index: 99999 !important;
        }
      `}</style>
      
      {/* ハンバーガーメニュー */}
      <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
        {/* メニューボタン */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '50px',
            height: '50px',
            backgroundColor: '#FF9800',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10000
          }}
        >
          <div style={{ width: '28px', height: '3px', backgroundColor: 'white', borderRadius: '2px' }}></div>
          <div style={{ width: '28px', height: '3px', backgroundColor: 'white', borderRadius: '2px' }}></div>
          <div style={{ width: '28px', height: '3px', backgroundColor: 'white', borderRadius: '2px' }}></div>
        </button>

        {/* メニューパネル */}
        {isMenuOpen && (
          <>
            {/* 背景オーバーレイ */}
            <div
              onClick={() => setIsMenuOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 9998
              }}
            />
            
            {/* メニュー本体 */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '300px',
              height: '100vh',
              backgroundColor: 'white',
              boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
              zIndex: 9999,
              padding: '20px',
              overflowY: 'auto'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px',
                paddingTop: '50px'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>メニュー</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  style={{
                    width: '30px',
                    height: '30px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* メニュー項目 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={(e) => {
                    try {
                      // ボタンを無効化して連続クリックを防止
                      e.target.disabled = true;
                      e.target.style.backgroundColor = '#FF6B00';
                      e.target.innerHTML = '<span style="font-size:20px">⏳</span> <span>データ準備中...</span>';
                      
                      console.log('データ保存開始...');
                      console.log('allDataByDate:', Object.keys(allDataByDate).length, '件');
                      console.log('customerDb:', Object.keys(customerDb).length, '件');
                      
                      // データを保存
                      localStorage.setItem('allDataByDate', JSON.stringify(allDataByDate));
                      localStorage.setItem('customerDb', JSON.stringify(customerDb));
                      
                      console.log('データ保存完了');
                      console.log('📍 遷移先URL:', './ticket_search.html');
                      console.log('📍 現在のURL:', window.location.href);
                      
                      // 少し遅延を入れてボタンの変化を確認できるようにする
                      setTimeout(() => {
                        console.log('⏳ ページ遷移を実行...');
                        window.location.href = './ticket_search.html';
                        console.log('✅ ページ遷移コマンド実行完了（このログの後にページが切り替わります）');
                      }, 300);
                      
                    } catch (error) {
                      console.error('エラー詳細:', error);
                      alert('エラーが発生しました:\n' + error.message);
                      e.target.disabled = false;
                      e.target.style.backgroundColor = '#FF9800';
                      e.target.innerHTML = '<span style="font-size:20px">🎫</span> <span>回数券フォローアップ検索</span>';
                    }
                  }}
                  style={{
                    padding: '15px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🎫</span>
                  <span>回数券フォローアップ検索</span>
                </button>
                
                {/* 説明文 */}
                <div style={{ 
                  fontSize: '11px', 
                  color: '#666',
                  padding: '5px 10px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  ※ 検索ページに移動します。<br/>
                  ブラウザの「戻る」ボタンで予約表に戻れます。
                </div>

                {/* 将来的に他のメニュー項目を追加可能 */}
              </div>
            </div>
          </>
        )}
      </div>


      <NameSearch 
        customerDb={customerDb} 
        staffHolidays={staffHolidays} 
        dateKey={dateKey}
        allDataByDate={allDataByDate}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />
      
      <div style={{ padding: '5px', backgroundColor: '#f0f4f8', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>予約表管理システム</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>日付選択:</label>
          
          {/* 前の日へ */}
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            title="前の日"
          >
            ←
          </button>
          
          <input
            type="date"
            value={formatDate(selectedDate)}
            onChange={handleDateChange}
            style={{
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          
          {/* 次の日へ */}
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            title="次の日"
          >
            →
          </button>
          
          <span style={{ fontSize: '14px', color: '#777', marginLeft: '10px' }}>
            {selectedDate.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          
          {/* スタッフ休み情報の表示・編集 */}
          <div style={{
            marginLeft: '20px',
            padding: '8px 12px',
            backgroundColor: '#FFE0B2',
            border: '2px solid #FF9800',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#E65100' }}>
              🏖️ 本日の休み:
            </span>
            
            {!isEditingHolidays ? (
              <>
                <span style={{ fontSize: '14px', color: '#E65100', fontWeight: 'bold', flex: 1 }}>
                  {staffHolidays[dateKey] && staffHolidays[dateKey].length > 0 
                    ? staffHolidays[dateKey].join(', ') 
                    : 'なし'}
                </span>
                <button
                  onClick={() => {
                    setIsEditingHolidays(true);
                    setEditingHolidaysText(
                      staffHolidays[dateKey] && staffHolidays[dateKey].length > 0
                        ? staffHolidays[dateKey].join(' ')
                        : ''
                    );
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ 編集
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={editingHolidaysText}
                  onChange={(e) => setEditingHolidaysText(e.target.value)}
                  placeholder="スタッフ名をスペース区切り (例: A B C)"
                  style={{
                    flex: 1,
                    padding: '6px',
                    border: '2px solid #FF9800',
                    borderRadius: '3px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#E65100',
                  }}
                  autoFocus
                />
                <button
                  onClick={() => {
                    const newHolidays = editingHolidaysText
                      .trim()
                      .split(/\s+/)
                      .filter(s => s);
                    
                    setStaffHolidays(prev => {
                      const updated = { ...prev };
                      if (newHolidays.length > 0) {
                        updated[dateKey] = newHolidays;
                      } else {
                        delete updated[dateKey];
                      }
                      saveStaffHolidaysToServer(updated);
                      return updated;
                    });
                    
                    setIsEditingHolidays(false);
                    console.log(`✅ ${dateKey}の休み情報を更新: [${newHolidays.join(', ')}]`);
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  ✓ 保存
                </button>
                <button
                  onClick={() => {
                    setIsEditingHolidays(false);
                    setEditingHolidaysText('');
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  ✕ キャンセル
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '800px' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              {Array.from({ length: maxColumns }).map((_, col) => (
                <col key={col} style={{ width: 'auto' }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <th style={{ padding: '2px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '6px', width: '40px' }}>時間</th>
                {Array.from({ length: maxColumns }).map((_, col) => (
                  <th key={col} style={{ padding: '6px 2px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '6px', textAlign: 'center' }}>
                    {col + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(({ time, cols }, timeIndex) => (
                <React.Fragment key={time}>
                  <tr style={{ backgroundColor: '#f9f9f9', height: '30px' }}>
                    <td rowSpan={3} style={{ padding: '2px', border: '1px solid #ddd', fontWeight: 'bold', fontSize: '6px', textAlign: 'center', backgroundColor: '#ecf0f1', verticalAlign: 'middle' }}>
                      {time}
                    </td>
                    {Array.from({ length: maxColumns }).map((_, col) => {
                      if (col >= cols) {
                        return <td key={col} id={`${dateKey}-${time}-${col}`} style={{ padding: '4px', border: '1px solid #ddd', backgroundColor: '#f0f0f0', textAlign: 'center', fontSize: '6px', color: '#999' }}>利用不可</td>;
                      }
                      
                      const idKey = getCellKey(time, col, 'id');
                      const staffKey = getCellKey(time, col, 'staff');
                      const nameKey = getCellKey(time, col, 'name');
                      const isNewPatient = newPatients[nameKey];
                      const isRepeatPatient = repeatPatients[nameKey];
                      const isRakuPatient = rakuPatients[nameKey];
                      
                      // 前の時間枠もチェック
                      const prevSlotCheck = checkPrevTimeSlotPatientType(timeIndex, col);
                      const isPrevNew = prevSlotCheck.isNew;
                      const isPrevRepeat = prevSlotCheck.isRepeat;
                      const isPrevRaku = prevSlotCheck.isRaku;
                      
                      // 楽の場合は前の枠のみ囲む、新・再の場合は現在と前の枠を囲む
                      const shouldHighlight = isNewPatient || isRepeatPatient || isPrevNew || isPrevRepeat || isPrevRaku;
                      const borderColor = (isNewPatient || isPrevNew) ? '#FF1493' : ((isRepeatPatient || isPrevRepeat) ? '#FF9800' : (isPrevRaku ? '#2196F3' : '#ddd'));
                      const borderWidth = shouldHighlight ? '3px' : '1px';
                      
                      const isStaffOverloaded = checkStaffOverload(time, col);
                      
                      // 休みスタッフのチェック
                      const currentStaff = data[staffKey]?.staff || '';
                      const todayHolidays = staffHolidays[dateKey] || [];
                      const isStaffOnHoliday = currentStaff && todayHolidays.some(holidayStaff => 
                        normalizeStaff(holidayStaff) === normalizeStaff(currentStaff)
                      );
                      
                      return (
                        <td 
                          key={col} 
                          id={`${dateKey}-${time}-${col}`}
                          style={{
                            padding: '0',
                            border: '1px solid #ddd',
                            textAlign: 'center',
                            backgroundColor: col % 2 === 0 ? '#ffffff' : '#f9f9f9',
                            position: 'relative',
                          }}
                        >
                          {shouldHighlight && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              border: `${borderWidth} solid ${borderColor}`,
                              borderBottom: 'none',
                              pointerEvents: 'none',
                              zIndex: 1,
                            }} />
                          )}
                          <div style={{ 
                            display: 'flex', 
                            height: '100%',
                            position: 'relative',
                          }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="ID"
                              value={data[idKey]?.id || ''}
                              onChange={(e) => handleIdChange(time, col, e.target.value)}
                              onBlur={() => {
                                handleIdBlur(time, col);
                                handleManualSave();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleIdBlur(time, col);
                                  handleManualSave();
                                  e.target.blur();
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '3px 2px',
                                border: 'none',
                                borderRight: idDuplicates[idKey] ? '2px solid #FF6B6B' : '1px solid #ddd',
                                fontSize: '10px',
                                textAlign: 'center',
                                backgroundColor: idDuplicates[idKey] ? '#FFE6E6' : 'transparent',
                                outline: 'none',
                              }}
                            />
                            <input
                              type="text"
                              placeholder="担"
                              maxLength="1"
                              value={data[staffKey]?.staff || ''}
                              onChange={(e) => handleStaffChange(time, col, e.target.value)}
                              onBlur={handleManualSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleManualSave();
                                  e.target.blur();
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '3px 1px',
                                border: 'none',
                                fontSize: '10px',
                                textAlign: 'center',
                                backgroundColor: isStaffOnHoliday ? '#90CAF9' : (isStaffOverloaded ? '#ff6b6b' : 'transparent'),
                                color: (isStaffOnHoliday || isStaffOverloaded) ? 'white' : 'inherit',
                                fontWeight: (isStaffOnHoliday || isStaffOverloaded) ? 'bold' : 'normal',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={{ height: '30px' }}>
                    {Array.from({ length: maxColumns }).map((_, col) => {
                      if (col >= cols) {
                        return <td key={col} id={`${dateKey}-${time}-${col}`} style={{ padding: '2px', border: '1px solid #ddd', backgroundColor: '#f0f0f0' }}></td>;
                      }
                      
                      const key = getCellKey(time, col, 'name');
                      const isNewPatient = newPatients[key];
                      const isRepeatPatient = repeatPatients[key];
                      const isRakuPatient = rakuPatients[key];
                      
                      // 前の時間枠もチェック
                      const prevSlotCheck = checkPrevTimeSlotPatientType(timeIndex, col);
                      const isPrevNew = prevSlotCheck.isNew;
                      const isPrevRepeat = prevSlotCheck.isRepeat;
                      const isPrevRaku = prevSlotCheck.isRaku;
                      
                      // 楽の場合は前の枠のみ囲む、新・再の場合は現在と前の枠を囲む
                      const shouldHighlight = isNewPatient || isRepeatPatient || isPrevNew || isPrevRepeat || isPrevRaku;
                      const borderColor = (isNewPatient || isPrevNew) ? '#FF1493' : ((isRepeatPatient || isPrevRepeat) ? '#FF9800' : (isPrevRaku ? '#2196F3' : '#ddd'));
                      const borderWidth = shouldHighlight ? '3px' : '1px';
                      const isDuplicate = duplicates[key];
                      
                      const completedKey = getCellKey(time, col, 'completed');
                      const status = completedStatus[completedKey];
                      let nameBgColor = 'white';
                      if (status === '出済') {
                        nameBgColor = '#E1BEE7';
                      } else if (status === '来済') {
                        nameBgColor = '#FFE0B2';
                      } else if (status === '予済') {
                        nameBgColor = '#C8E6C9';
                      } else if (isDuplicate) {
                        nameBgColor = '#ffe6e6';
                      }
                      
                      return (
                        <td 
                          key={col}
                          id={`${dateKey}-${time}-${col}`}
                          style={{
                            padding: '0',
                            border: '1px solid #ddd',
                            textAlign: 'center',
                            backgroundColor: col % 2 === 0 ? '#ffffff' : '#f9f9f9',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          {shouldHighlight && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              border: `${borderWidth} solid ${borderColor}`,
                              borderTop: 'none',
                              pointerEvents: 'none',
                              zIndex: 1,
                            }} />
                          )}
                          {/* 口・部・追・切の小さな表示（名前欄の右上） */}
                          {(() => {
                            const oralKey = getCellKey(time, col, 'oral');
                            const partialKey = getCellKey(time, col, 'partial');
                            const reviewKey = `${time}-${col}`;
                            const review = reviewData[reviewKey] || {};
                            const hasReviewYes = review.status === 'yes';
                            
                            // 口コミ○の場合のロジック
                            let showOral = false;
                            if (hasReviewYes) {
                              // HPB, G, 紙のいずれかが「未」なら表示
                              const hasPending = review.hpb === 'pending' || review.g === 'pending' || review.paper === 'pending';
                              showOral = hasPending;
                            } else {
                              // 口コミ○でない場合は、口ボタンがクリックされていたら表示
                              showOral = oralButtons[oralKey] || false;
                            }
                            
                            const hasPartial = partialButtons[partialKey];
                            const hasBuiAdd = review.buiAdd || false;
                            const hasBuiCut = review.buiCut || false;
                            
                            if (!showOral && !hasPartial && !hasBuiAdd && !hasBuiCut) return null;
                            
                            return (
                              <div style={{
                                position: 'absolute',
                                top: '1px',
                                right: '2px',
                                display: 'flex',
                                gap: '2px',
                                zIndex: 10,
                                pointerEvents: 'none',
                              }}>
                                {showOral && (
                                  <span style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: '#9C27B0',
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                    lineHeight: '1',
                                  }}>
                                    口
                                  </span>
                                )}
                                {hasPartial && (
                                  <span style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: '#4CAF50',
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                    lineHeight: '1',
                                  }}>
                                    部
                                  </span>
                                )}
                                {hasBuiAdd && (
                                  <span style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: '#2E7D32',
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                    lineHeight: '1',
                                  }}>
                                    追
                                  </span>
                                )}
                                {hasBuiCut && (
                                  <span style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: '#D32F2F',
                                    backgroundColor: 'rgba(255,255,255,0.8)',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                    lineHeight: '1',
                                  }}>
                                    切
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          
                          <input
                            type="text"
                            placeholder="空"
                            value={data[key]?.name || ''}
                            onChange={(e) => handleNameChange(time, col, e.target.value)}
                            onBlur={handleManualSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleManualSave();
                                e.target.blur();
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0',
                              margin: '0',
                              border: isDuplicate ? '2px solid red' : 'none',
                              borderRadius: '0',
                              fontSize: calculateFontSize(data[key]?.name || ''),
                              textAlign: 'center',
                              backgroundColor: nameBgColor,
                              boxSizing: 'border-box',
                              display: 'block',
                              outline: isDuplicate ? '2px solid red' : 'none',
                              lineHeight: '30px',
                              height: '30px',
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={{ borderBottom: '2px solid #ddd', height: '40px' }}>
                    {Array.from({ length: maxColumns }).map((_, col) => {
                      if (col >= cols) {
                        return <td key={col} id={`${dateKey}-${time}-${col}`} style={{ padding: '2px', border: '1px solid #ddd', backgroundColor: '#f0f0f0' }}></td>;
                      }
                      
                      const key = getCellKey(time, col, 'name');
                      const isNewPatient = newPatients[key];
                      const isRepeatPatient = repeatPatients[key];
                      const isRakuPatient = rakuPatients[key];
                      const isExistingPatient = !isNewPatient && !isRepeatPatient && !isRakuPatient;
                      
                      // 前の時間枠もチェック
                      const prevSlotCheck = checkPrevTimeSlotPatientType(timeIndex, col);
                      const isPrevNew = prevSlotCheck.isNew;
                      const isPrevRepeat = prevSlotCheck.isRepeat;
                      const isPrevRaku = prevSlotCheck.isRaku;
                      
                      // 楽の場合は前の枠のみ囲む、新・再の場合は現在と前の枠を囲む
                      const shouldHighlight = isNewPatient || isRepeatPatient || isPrevNew || isPrevRepeat || isPrevRaku;
                      const borderColor = (isNewPatient || isPrevNew) ? '#FF1493' : ((isRepeatPatient || isPrevRepeat) ? '#FF9800' : (isPrevRaku ? '#2196F3' : '#ddd'));
                      const borderWidth = shouldHighlight ? '3px' : '1px';
                      
                      const patientType = isNewPatient ? '新' : (isRepeatPatient ? '再' : (isRakuPatient ? '楽' : '既'));
                      const completedKey = getCellKey(time, col, 'completed');
                      const status = completedStatus[completedKey];
                      const dropdownKey = getCellKey(time, col, 'cancel');
                      const isOpen = openDropdown === dropdownKey;
                      const memoKey = getCellKey(time, col, 'memo');
                      const isMemoOpen = openMemo === memoKey;
                      const hasMemo = memoTexts[memoKey] && memoTexts[memoKey].trim() !== '';
                      
                      return (
                        <td 
                          key={col}
                          id={`${dateKey}-${time}-${col}`}
                          style={{
                            padding: '2px',
                            border: '1px solid #ddd',
                            textAlign: 'center',
                            backgroundColor: col % 2 === 0 ? '#ffffff' : '#f9f9f9',
                            position: 'relative',
                          }}
                        >
                          {shouldHighlight && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              border: `${borderWidth} solid ${borderColor}`,
                              borderTop: 'none',
                              pointerEvents: 'none',
                              zIndex: 1,
                            }} />
                          )}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr',
                            gridTemplateRows: '1fr 1fr',
                            gap: '2px',
                            height: '100%',
                            position: 'relative',
                          }}>
                            {/* 左上: メモボタン */}
                            <button
                              data-memo-popup="true"
                              onClick={() => handleMemoClick(time, col)}
                              style={{
                                padding: '2px 1px',
                                backgroundColor: hasMemo ? '#FF9800' : '#BDBDBD',
                                color: hasMemo ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '11px',
                                fontWeight: hasMemo ? 'bold' : 'normal',
                                cursor: 'pointer',
                                position: 'relative',
                                zIndex: 2,
                                width: '100%',
                                overflow: 'hidden',
                              }}
                            >
                              📝
                            </button>
                            
                            {/* 右上: 出済・来済・予済のselect */}
                            <select
                              value={status || ''}
                              onChange={(e) => handleCompletedClick(time, col, e.target.value)}
                              style={{
                                padding: '2px 1px',
                                backgroundColor: status === '出済' ? '#2196F3' : (status === '来済' ? '#FFC107' : (status === '予済' ? '#4CAF50' : '#BBDEFB')),
                                color: status ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '9px',
                                fontWeight: status ? 'bold' : 'normal',
                                cursor: 'pointer',
                                position: 'relative',
                                zIndex: 2,
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              <option value="">選</option>
                              <option value="出済">出済</option>
                              <option value="来済">来済</option>
                              <option value="予済">予済</option>
                            </select>
                            
                            {/* 左下: 新・再・楽・既のselect */}
                            <select
                              value={patientType}
                              onChange={(e) => handleNewOrRepeat(time, col, e.target.value)}
                              style={{
                                padding: '2px 1px',
                                backgroundColor: patientType === '新' ? '#FF1493' : (patientType === '再' ? '#FF9800' : (patientType === '楽' ? '#2196F3' : '#9E9E9E')),
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                position: 'relative',
                                zIndex: 2,
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              <option value="既">既</option>
                              <option value="新">新</option>
                              <option value="再">再</option>
                              <option value="楽">楽</option>
                            </select>
                            
                            {/* 右下: Cancelボタン */}
                            <button
                              data-dropdown="true"
                              onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
                              style={{
                                padding: '2px 1px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                position: 'relative',
                                zIndex: 2,
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Cancel
                            </button>
                          </div>

                          {isMemoOpen && (
                            <div 
                              data-memo-popup="true"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '28px',
                                left: '0',
                                backgroundColor: '#FFFACD',
                                border: '2px solid #FFD700',
                                borderRadius: '8px',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                                zIndex: 9999,
                                minWidth: '200px',
                                padding: '8px',
                              }}
                            >
                              {/* 今後の予約リスト */}
                              {(() => {
                                const idKey = getCellKey(time, col, 'id');
                                const currentId = data[idKey]?.id;
                                const futureReservations = getFutureReservations(currentId);
                                
                                return futureReservations.length > 0 && (
                                  <div style={{
                                    marginBottom: '8px',
                                    padding: '6px',
                                    backgroundColor: '#E8F5E9',
                                    borderRadius: '4px',
                                    border: '1px solid #4CAF50',
                                  }}>
                                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: '#2E7D32' }}>
                                      📅 今後の予約 ({futureReservations.length}件)
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#333' }}>
                                      {futureReservations.map((res, idx) => (
                                        <div 
                                          key={idx} 
                                          onClick={() => {
                                            // 未保存チェック
                                            let canProceed = true;
                                            if (openMemo) {
                                              const memoKey = openMemo;
                                              const timeColMatch = memoKey.match(/^(.+)-(\d+)-memo$/);
                                              if (timeColMatch) {
                                                const time = timeColMatch[1];
                                                const col = timeColMatch[2];
                                                const cellKey = `${time}-${col}`;
                                                
                                                if (treatmentMenusModified[cellKey]) {
                                                  if (!window.confirm('施術メニューが保存されていません。\n保存せずに日付を移動しますか？')) {
                                                    canProceed = false;
                                                  } else {
                                                    // 変更を破棄
                                                    setTreatmentMenusModified(prev => {
                                                      const updated = { ...prev };
                                                      delete updated[cellKey];
                                                      return updated;
                                                    });
                                                    setTempTreatmentMenus(prev => {
                                                      const updated = { ...prev };
                                                      delete updated[cellKey];
                                                      return updated;
                                                    });
                                                  }
                                                }
                                              }
                                            }
                                            
                                            if (canProceed) {
                                              setSelectedDate(res.fullDate);
                                              setOpenMemo(null);
                                            }
                                          }}
                                          style={{ 
                                            marginBottom: '2px',
                                            cursor: 'pointer',
                                            padding: '2px 4px',
                                            borderRadius: '3px',
                                            transition: 'background-color 0.2s'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C8E6C9'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          {res.date} ({res.time}) 🔗
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              {/* 最終予約日情報 */}
                              {(() => {
                                const idKey = getCellKey(time, col, 'id');
                                const currentId = data[idKey]?.id;
                                if (!currentId) return null;
                                
                                const days = getDaysSinceLastVisit(currentId);
                                const lastVisitText = getLastVisitText(currentId);
                                
                                return (
                                  <div style={{
                                    padding: '6px',
                                    marginBottom: '6px',
                                    backgroundColor: (() => {
                                      if (days === null) return '#E8F5E9'; // 初回: 緑
                                      if (days >= 30) return '#FFEBEE'; // 1ヶ月以上: 赤
                                      if (days >= 14) return '#FFF3E0'; // 2週間以上: オレンジ
                                      return '#F5F5F5'; // それ以外: グレー
                                    })(),
                                    borderRadius: '4px',
                                    border: `1px solid ${(() => {
                                      if (days === null) return '#4CAF50';
                                      if (days >= 30) return '#F44336';
                                      if (days >= 14) return '#FF9800';
                                      return '#BDBDBD';
                                    })()}`,
                                  }}>
                                    <div style={{
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      color: (() => {
                                        if (days === null) return '#2E7D32';
                                        if (days >= 30) return '#C62828';
                                        if (days >= 14) return '#E65100';
                                        return '#424242';
                                      })(),
                                    }}>
                                      📅 最終予約: {lastVisitText}
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              {/* ふりがな編集 */}
                              {(() => {
                                const idKey = getCellKey(time, col, 'id');
                                const currentId = data[idKey]?.id;
                                if (!currentId) return null;
                                
                                const currentFurigana = customerDb[currentId]?.furigana || '';
                                const currentName = customerDb[currentId]?.name || '';
                                
                                return (
                                  <div style={{
                                    padding: '6px',
                                    marginBottom: '6px',
                                    backgroundColor: '#E3F2FD',
                                    borderRadius: '4px',
                                    border: '1px solid #2196F3',
                                  }}>
                                    <div style={{
                                      fontSize: '10px',
                                      color: '#1976D2',
                                      marginBottom: '4px',
                                      fontWeight: 'bold'
                                    }}>
                                      💬 ふりがな編集（ID: {currentId} / {currentName}）
                                    </div>
                                    <input
                                      type="text"
                                      value={currentFurigana}
                                      onChange={(e) => {
                                        const newFurigana = e.target.value;
                                        setCustomerDb(prev => {
                                          const updatedDb = {
                                            ...prev,
                                            [currentId]: {
                                              ...prev[currentId],
                                              furigana: newFurigana
                                            }
                                          };
                                          
                                          // サーバーに保存（デバウンス的に）
                                          saveCustomerDatabaseToServer(updatedDb);
                                          console.log(`✏️ ID「${currentId}」のふりがなを更新: "${newFurigana}"`);
                                          
                                          return updatedDb;
                                        });
                                      }}
                                      placeholder="ふりがなを入力..."
                                      style={{
                                        width: '100%',
                                        padding: '4px',
                                        border: '1px solid #2196F3',
                                        borderRadius: '3px',
                                        fontSize: '11px',
                                        backgroundColor: 'white'
                                      }}
                                    />
                                  </div>
                                );
                              })()}
                              
                              {/* 回数券管理 */}
                              {(() => {
                                const idKey = getCellKey(time, col, 'id');
                                const currentId = data[idKey]?.id;
                                if (!currentId) return null;
                                
                                // 新しいデータ構造: tickets は配列
                                // tickets: [{ name: '骨', count: 8, used: [] }, { name: '楽', count: 16, used: [] }]
                                const rawTickets = customerDb[currentId]?.tickets;
                                
                                // 古い形式を新しい形式に変換
                                let ticketsArray = [];
                                if (Array.isArray(rawTickets)) {
                                  ticketsArray = rawTickets;
                                } else if (rawTickets && typeof rawTickets === 'object' && rawTickets.count) {
                                  // 古い形式 { count: 8, used: [] } を新しい形式に変換
                                  ticketsArray = [{ name: '回数券', count: rawTickets.count, used: rawTickets.used || [] }];
                                  // 自動的に新形式に変換して保存
                                  setCustomerDb(prev => {
                                    const updatedDb = {
                                      ...prev,
                                      [currentId]: {
                                        ...prev[currentId],
                                        tickets: ticketsArray
                                      }
                                    };
                                    saveCustomerDatabaseToServer(updatedDb);
                                    return updatedDb;
                                  });
                                }
                                
                                const activeTicketIndex = activeTicketIndexes[currentId] || 0;
                                
                                const setActiveTicketIndex = (index) => {
                                  setActiveTicketIndexes(prev => ({
                                    ...prev,
                                    [currentId]: index
                                  }));
                                };
                                
                                return (
                                  <div style={{
                                    padding: '6px',
                                    marginBottom: '6px',
                                    backgroundColor: '#FFF9C4',
                                    borderRadius: '4px',
                                    border: '1px solid #FBC02D',
                                  }}>
                                    <div style={{
                                      fontSize: '10px',
                                      color: '#F57F17',
                                      marginBottom: '4px',
                                      fontWeight: 'bold',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <span>🎫 回数券管理</span>
                                    </div>
                                    
                                    {/* タブと追加ボタン */}
                                    <div style={{
                                      display: 'flex',
                                      gap: '4px',
                                      marginBottom: '6px',
                                      flexWrap: 'wrap',
                                      alignItems: 'center'
                                    }}>
                                      {/* 最新3枚をタブで表示 */}
                                      {ticketsArray.slice(-3).map((ticket, relativeIdx) => {
                                        // slice(-3)は最後の3つを取得するので、実際のインデックスを計算
                                        const startIndex = Math.max(0, ticketsArray.length - 3);
                                        const actualIdx = startIndex + relativeIdx;
                                        return (
                                          <button
                                            key={actualIdx}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveTicketIndex(actualIdx);
                                            }}
                                            style={{
                                              padding: '3px 8px',
                                              backgroundColor: activeTicketIndex === actualIdx ? '#F57F17' : '#FFE082',
                                              color: activeTicketIndex === actualIdx ? 'white' : '#F57F17',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '9px',
                                              cursor: 'pointer',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            {ticket.name} {actualIdx + 1}
                                          </button>
                                        );
                                      })}
                                      
                                      {/* 4枚以上ある場合、過去分をドロップダウンで表示 */}
                                      {ticketsArray.length > 3 && (
                                        <select
                                          value=""
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onTouchStart={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const idx = parseInt(e.target.value);
                                            if (!isNaN(idx)) {
                                              setActiveTicketIndex(idx);
                                            }
                                          }}
                                          style={{
                                            padding: '3px 6px',
                                            backgroundColor: '#E0E0E0',
                                            color: '#555',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '9px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                          }}
                                        >
                                          <option value="">📜 過去分</option>
                                          {ticketsArray.slice(0, -3).map((ticket, relativeIdx) => {
                                            const actualIdx = relativeIdx;
                                            return (
                                              <option key={actualIdx} value={actualIdx}>
                                                {ticket.name} {actualIdx + 1}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      )}
                                      
                                      {/* 回数券追加: 種類選択 → 回数選択 */}
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        {/* 種類選択 */}
                                        <select
                                          value={ticketTypeSelections[currentId] || ''}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onTouchStart={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const selectedType = e.target.value;
                                            setTicketTypeSelections(prev => ({
                                              ...prev,
                                              [currentId]: selectedType
                                            }));
                                          }}
                                          style={{
                                            padding: '3px 6px',
                                            backgroundColor: '#FBC02D',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '9px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                          }}
                                        >
                                          <option value="">種類選択</option>
                                          <option value="骨">骨</option>
                                          <option value="楽">楽</option>
                                          <option value="骨楽">骨楽</option>
                                          <option value="美">美</option>
                                        </select>
                                        
                                        {/* 回数選択（種類が選択されている場合のみ表示） */}
                                        {ticketTypeSelections[currentId] && (
                                          <>
                                            <select
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                const value = e.target.value;
                                                
                                                if (value === 'custom') {
                                                  // 「その他」選択時は何もしない（入力欄を表示）
                                                  return;
                                                }
                                                
                                                const count = parseInt(value);
                                                const name = ticketTypeSelections[currentId];
                                                
                                                if (!isNaN(count) && name) {
                                                  setCustomerDb(prev => {
                                                    const currentTickets = Array.isArray(prev[currentId]?.tickets) 
                                                      ? prev[currentId].tickets 
                                                      : [];
                                                    
                                                    const updatedDb = {
                                                      ...prev,
                                                      [currentId]: {
                                                        ...prev[currentId],
                                                        tickets: [
                                                          ...currentTickets,
                                                          { name, count, used: [] }
                                                        ]
                                                      }
                                                    };
                                                    
                                                    saveCustomerDatabaseToServer(updatedDb);
                                                    console.log(`🎫 ID「${currentId}」に${name}の${count}回回数券を追加`);
                                                    return updatedDb;
                                                  });
                                                  
                                                  // 追加したタブをアクティブに
                                                  setActiveTicketIndex(ticketsArray.length);
                                                  
                                                  // 種類選択をリセット
                                                  setTicketTypeSelections(prev => ({
                                                    ...prev,
                                                    [currentId]: ''
                                                  }));
                                                  
                                                  // 選択後にリセット
                                                  e.target.value = '';
                                                }
                                              }}
                                              style={{
                                                padding: '3px 6px',
                                                backgroundColor: '#FF9800',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '9px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                              }}
                                            >
                                              <option value="">回数選択</option>
                                              <option value="8">8回</option>
                                              <option value="10">10回</option>
                                              <option value="16">16回</option>
                                              <option value="24">24回</option>
                                              <option value="30">30回</option>
                                              <option value="50">50回</option>
                                              <option value="custom">その他（入力）</option>
                                            </select>
                                            
                                            {/* 任意回数入力欄 */}
                                            <input
                                              type="number"
                                              placeholder="回数"
                                              min="1"
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onTouchStart={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                              onKeyDown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === 'Enter') {
                                                  const count = parseInt(e.target.value);
                                                  const name = ticketTypeSelections[currentId];
                                                  
                                                  if (!isNaN(count) && count > 0 && name) {
                                                    setCustomerDb(prev => {
                                                      const currentTickets = Array.isArray(prev[currentId]?.tickets) 
                                                        ? prev[currentId].tickets 
                                                        : [];
                                                      
                                                      const updatedDb = {
                                                        ...prev,
                                                        [currentId]: {
                                                          ...prev[currentId],
                                                          tickets: [
                                                            ...currentTickets,
                                                            { name, count, used: [] }
                                                          ]
                                                        }
                                                      };
                                                      
                                                      saveCustomerDatabaseToServer(updatedDb);
                                                      console.log(`🎫 ID「${currentId}」に${name}の${count}回回数券を追加`);
                                                      return updatedDb;
                                                    });
                                                    
                                                    // 追加したタブをアクティブに
                                                    setActiveTicketIndex(ticketsArray.length);
                                                    
                                                    // 種類選択をリセット
                                                    setTicketTypeSelections(prev => ({
                                                      ...prev,
                                                      [currentId]: ''
                                                    }));
                                                    
                                                    // 入力欄をリセット
                                                    e.target.value = '';
                                                  }
                                                }
                                              }}
                                              style={{
                                                width: '50px',
                                                padding: '3px 4px',
                                                backgroundColor: 'white',
                                                color: '#333',
                                                border: '1px solid #FF9800',
                                                borderRadius: '3px',
                                                fontSize: '9px',
                                                textAlign: 'center'
                                              }}
                                            />
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* アクティブな回数券の内容 */}
                                    {ticketsArray.length > 0 && ticketsArray[activeTicketIndex] && (() => {
                                      const ticket = ticketsArray[activeTicketIndex];
                                      const usedDates = ticket.used || [];
                                      
                                      return (
                                        <>
                                          <div style={{
                                            fontSize: '10px',
                                            color: '#555',
                                            marginBottom: '6px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                          }}>
                                            <span>残り: <strong>{ticket.count - usedDates.length}</strong> / {ticket.count} 回</span>
                                            <button
                                              onMouseDown={(e) => e.stopPropagation()}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`「${ticket.name} ${activeTicketIndex + 1}」を削除しますか？`)) {
                                                  setCustomerDb(prev => {
                                                    const newTickets = [...(prev[currentId]?.tickets || [])];
                                                    newTickets.splice(activeTicketIndex, 1);
                                                    
                                                    const updatedDb = {
                                                      ...prev,
                                                      [currentId]: {
                                                        ...prev[currentId],
                                                        tickets: newTickets
                                                      }
                                                    };
                                                    
                                                    saveCustomerDatabaseToServer(updatedDb);
                                                    
                                                    // アクティブインデックスを調整
                                                    if (activeTicketIndex >= newTickets.length && newTickets.length > 0) {
                                                      setActiveTicketIndex(newTickets.length - 1);
                                                    } else if (newTickets.length === 0) {
                                                      setActiveTicketIndex(0);
                                                    }
                                                    
                                                    return updatedDb;
                                                  });
                                                }
                                              }}
                                              style={{
                                                padding: '2px 6px',
                                                backgroundColor: '#f44336',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '8px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              削除
                                            </button>
                                          </div>
                                          
                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: '0',
                                            border: '1px solid #ddd'
                                          }}>
                                            {Array.from({ length: ticket.count }, (_, index) => {
                                              const usedDate = usedDates[index];
                                              const isUsed = !!usedDate;
                                              
                                              return (
                                                <div
                                                  key={index}
                                                  onMouseDown={(e) => e.stopPropagation()}
                                                  onTouchStart={(e) => e.stopPropagation()}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isUsed) {
                                                      // 使用済みをクリック → 日付ピッカーで編集
                                                      const currentDate = usedDate;
                                                      
                                                      // 一時的な日付入力要素を作成
                                                      const input = document.createElement('input');
                                                      input.type = 'date';
                                                      input.value = currentDate;
                                                      input.style.position = 'fixed';
                                                      input.style.top = '50%';
                                                      input.style.left = '50%';
                                                      input.style.transform = 'translate(-50%, -50%)';
                                                      input.style.zIndex = '10000';
                                                      input.style.padding = '10px';
                                                      input.style.fontSize = '16px';
                                                      input.style.border = '2px solid #2196F3';
                                                      input.style.borderRadius = '8px';
                                                      input.style.backgroundColor = 'white';
                                                      input.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                                                      
                                                      // オーバーレイ作成
                                                      const overlay = document.createElement('div');
                                                      overlay.style.position = 'fixed';
                                                      overlay.style.top = '0';
                                                      overlay.style.left = '0';
                                                      overlay.style.width = '100%';
                                                      overlay.style.height = '100%';
                                                      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                                                      overlay.style.zIndex = '9999';
                                                      
                                                      // 削除ボタン作成
                                                      const deleteBtn = document.createElement('button');
                                                      deleteBtn.textContent = '削除';
                                                      deleteBtn.style.position = 'fixed';
                                                      deleteBtn.style.top = 'calc(50% + 50px)';
                                                      deleteBtn.style.left = 'calc(50% - 80px)';
                                                      deleteBtn.style.transform = 'translate(-50%, 0)';
                                                      deleteBtn.style.zIndex = '10000';
                                                      deleteBtn.style.padding = '8px 20px';
                                                      deleteBtn.style.fontSize = '14px';
                                                      deleteBtn.style.backgroundColor = '#f44336';
                                                      deleteBtn.style.color = 'white';
                                                      deleteBtn.style.border = 'none';
                                                      deleteBtn.style.borderRadius = '6px';
                                                      deleteBtn.style.cursor = 'pointer';
                                                      
                                                      // キャンセルボタン作成
                                                      const cancelBtn = document.createElement('button');
                                                      cancelBtn.textContent = 'キャンセル';
                                                      cancelBtn.style.position = 'fixed';
                                                      cancelBtn.style.top = 'calc(50% + 50px)';
                                                      cancelBtn.style.left = 'calc(50% + 80px)';
                                                      cancelBtn.style.transform = 'translate(-50%, 0)';
                                                      cancelBtn.style.zIndex = '10000';
                                                      cancelBtn.style.padding = '8px 20px';
                                                      cancelBtn.style.fontSize = '14px';
                                                      cancelBtn.style.backgroundColor = '#9E9E9E';
                                                      cancelBtn.style.color = 'white';
                                                      cancelBtn.style.border = 'none';
                                                      cancelBtn.style.borderRadius = '6px';
                                                      cancelBtn.style.cursor = 'pointer';
                                                      
                                                      document.body.appendChild(overlay);
                                                      document.body.appendChild(input);
                                                      document.body.appendChild(deleteBtn);
                                                      document.body.appendChild(cancelBtn);
                                                      
                                                      // すべての要素でイベント伝播を停止
                                                      [input, deleteBtn, cancelBtn].forEach(el => {
                                                        el.addEventListener('mousedown', (e) => e.stopPropagation());
                                                        el.addEventListener('touchstart', (e) => e.stopPropagation());
                                                        el.addEventListener('click', (e) => e.stopPropagation());
                                                      });
                                                      
                                                      // フォーカスして日付ピッカーを開く
                                                      setTimeout(() => {
                                                        input.focus();
                                                        input.showPicker?.();
                                                      }, 100);
                                                      
                                                      const cleanup = () => {
                                                        document.body.removeChild(overlay);
                                                        document.body.removeChild(input);
                                                        document.body.removeChild(deleteBtn);
                                                        document.body.removeChild(cancelBtn);
                                                      };
                                                      
                                                      // 日付変更時
                                                      input.addEventListener('change', () => {
                                                        const newDate = input.value;
                                                        if (newDate && newDate !== currentDate) {
                                                          if (window.confirm(`${index + 1}回目の使用日を\n${currentDate} → ${newDate}\nに変更しますか？`)) {
                                                            setCustomerDb(prev => {
                                                              const newTickets = [...(prev[currentId]?.tickets || [])];
                                                              const newUsed = [...newTickets[activeTicketIndex].used];
                                                              newUsed[index] = newDate;
                                                              newTickets[activeTicketIndex] = {
                                                                ...newTickets[activeTicketIndex],
                                                                used: newUsed
                                                              };
                                                              
                                                              const updatedDb = {
                                                                ...prev,
                                                                [currentId]: {
                                                                  ...prev[currentId],
                                                                  tickets: newTickets
                                                                }
                                                              };
                                                              saveCustomerDatabaseToServer(updatedDb);
                                                              console.log(`🎫 ID「${currentId}」の${ticket.name}${index + 1}回目を編集: ${currentDate} → ${newDate}`);
                                                              return updatedDb;
                                                            });
                                                            cleanup();
                                                          }
                                                        }
                                                      });
                                                      
                                                      // 削除ボタン
                                                      deleteBtn.addEventListener('click', () => {
                                                        if (window.confirm(`${index + 1}回目の使用記録（${currentDate}）を削除しますか？`)) {
                                                          setCustomerDb(prev => {
                                                            const newTickets = [...(prev[currentId]?.tickets || [])];
                                                            const newUsed = [...newTickets[activeTicketIndex].used];
                                                            newUsed.splice(index, 1);
                                                            newTickets[activeTicketIndex] = {
                                                              ...newTickets[activeTicketIndex],
                                                              used: newUsed
                                                            };
                                                            
                                                            const updatedDb = {
                                                              ...prev,
                                                              [currentId]: {
                                                                ...prev[currentId],
                                                                tickets: newTickets
                                                              }
                                                            };
                                                            saveCustomerDatabaseToServer(updatedDb);
                                                            return updatedDb;
                                                          });
                                                        }
                                                        cleanup();
                                                      });
                                                      
                                                      // キャンセルボタン
                                                      cancelBtn.addEventListener('click', cleanup);
                                                      
                                                      // オーバーレイクリックでキャンセル
                                                      overlay.addEventListener('click', cleanup);
                                                    } else {
                                                      // 未使用枠をクリック → 選択中の日付を自動刻印
                                                      const dateToUse = formatDate(selectedDate);
                                                      setCustomerDb(prev => {
                                                        const newTickets = [...(prev[currentId]?.tickets || [])];
                                                        const newUsed = [...newTickets[activeTicketIndex].used];
                                                        newUsed[index] = dateToUse;
                                                        newTickets[activeTicketIndex] = {
                                                          ...newTickets[activeTicketIndex],
                                                          used: newUsed
                                                        };
                                                        
                                                        const updatedDb = {
                                                          ...prev,
                                                          [currentId]: {
                                                            ...prev[currentId],
                                                            tickets: newTickets
                                                          }
                                                        };
                                                        saveCustomerDatabaseToServer(updatedDb);
                                                        console.log(`🎫 ID「${currentId}」の${ticket.name}${index + 1}回目を使用: ${dateToUse}`);
                                                        return updatedDb;
                                                      });
                                                    }
                                                  }}
                                                  style={{
                                                    padding: '8px 4px',
                                                    backgroundColor: isUsed ? '#4CAF50' : 'white',
                                                    color: isUsed ? 'white' : '#999',
                                                    borderRight: (index + 1) % 4 !== 0 ? '1px solid #ddd' : 'none',
                                                    borderBottom: index < ticket.count - 4 ? '1px solid #ddd' : 'none',
                                                    fontSize: '9px',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold'
                                                  }}
                                                >
                                                  {isUsed ? `✓ ${usedDate.slice(5).replace('-', '/')}` : `${index + 1}回目`}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
                              
                              {/* 口コミチェック機能 */}
                              {(() => {
                                const reviewKey = `${time}-${col}`;
                                const review = reviewData[reviewKey] || { status: null, hpb: null, g: null, paper: null };
                                
                                const handleReviewChange = (field, value) => {
                                  setReviewData(prev => ({
                                    ...prev,
                                    [reviewKey]: {
                                      ...review,
                                      [field]: value
                                    }
                                  }));
                                };
                                
                                return (
                                  <div style={{
                                    marginBottom: '8px',
                                    padding: '8px',
                                    backgroundColor: '#FFF9C4',
                                    border: '2px solid #FBC02D',
                                    borderRadius: '4px'
                                  }}>
                                    {/* 口コミステータス */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginBottom: review.status === 'yes' ? '8px' : '0'
                                    }}>
                                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#F57F17' }}>
                                        💬 口コミ:
                                      </span>
                                      <button
                                        onClick={() => handleReviewChange('status', review.status === 'yes' ? null : 'yes')}
                                        style={{
                                          padding: '4px 12px',
                                          backgroundColor: review.status === 'yes' ? '#4CAF50' : '#E0E0E0',
                                          color: review.status === 'yes' ? 'white' : '#666',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          minWidth: '40px'
                                        }}
                                      >
                                        ○
                                      </button>
                                      <button
                                        onClick={() => handleReviewChange('status', review.status === 'no' ? null : 'no')}
                                        style={{
                                          padding: '4px 12px',
                                          backgroundColor: review.status === 'no' ? '#F44336' : '#E0E0E0',
                                          color: review.status === 'no' ? 'white' : '#666',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          minWidth: '40px'
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                    
                                    {/* 口コミ○の場合のみ表示 */}
                                    {review.status === 'yes' && (
                                      <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid #FBC02D'
                                      }}>
                                        {/* HPB */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#F57F17', minWidth: '50px' }}>
                                            HPB:
                                          </span>
                                          <button
                                            onClick={() => handleReviewChange('hpb', review.hpb === 'done' ? null : 'done')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.hpb === 'done' ? '#4CAF50' : '#E0E0E0',
                                              color: review.hpb === 'done' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            済
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('hpb', review.hpb === 'pending' ? null : 'pending')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.hpb === 'pending' ? '#FF9800' : '#E0E0E0',
                                              color: review.hpb === 'pending' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            未
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('hpb', review.hpb === 'no' ? null : 'no')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.hpb === 'no' ? '#F44336' : '#E0E0E0',
                                              color: review.hpb === 'no' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                        
                                        {/* G */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#F57F17', minWidth: '50px' }}>
                                            G:
                                          </span>
                                          <button
                                            onClick={() => handleReviewChange('g', review.g === 'done' ? null : 'done')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.g === 'done' ? '#4CAF50' : '#E0E0E0',
                                              color: review.g === 'done' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            済
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('g', review.g === 'pending' ? null : 'pending')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.g === 'pending' ? '#FF9800' : '#E0E0E0',
                                              color: review.g === 'pending' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            未
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('g', review.g === 'no' ? null : 'no')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.g === 'no' ? '#F44336' : '#E0E0E0',
                                              color: review.g === 'no' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                        
                                        {/* 紙 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#F57F17', minWidth: '50px' }}>
                                            紙:
                                          </span>
                                          <button
                                            onClick={() => handleReviewChange('paper', review.paper === 'done' ? null : 'done')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.paper === 'done' ? '#4CAF50' : '#E0E0E0',
                                              color: review.paper === 'done' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            済
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('paper', review.paper === 'pending' ? null : 'pending')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.paper === 'pending' ? '#FF9800' : '#E0E0E0',
                                              color: review.paper === 'pending' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            未
                                          </button>
                                          <button
                                            onClick={() => handleReviewChange('paper', review.paper === 'no' ? null : 'no')}
                                            style={{
                                              padding: '3px 10px',
                                              backgroundColor: review.paper === 'no' ? '#F44336' : '#E0E0E0',
                                              color: review.paper === 'no' ? 'white' : '#666',
                                              border: 'none',
                                              borderRadius: '3px',
                                              fontSize: '10px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer',
                                              minWidth: '35px'
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              
                              {/* 部位追加・部位切チェックボックス */}
                              {(() => {
                                const reviewKey = `${time}-${col}`;
                                const review = reviewData[reviewKey] || {};
                                
                                const handleCheckChange = (field, checked) => {
                                  setReviewData(prev => ({
                                    ...prev,
                                    [reviewKey]: {
                                      ...review,
                                      [field]: checked
                                    }
                                  }));
                                };
                                
                                return (
                                  <div style={{
                                    marginBottom: '8px',
                                    padding: '6px',
                                    backgroundColor: '#E8F5E9',
                                    border: '1px solid #4CAF50',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                  }}>
                                    <label style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      color: '#2E7D32'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={review.buiAdd || false}
                                        onChange={(e) => handleCheckChange('buiAdd', e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                      />
                                      部位追加
                                    </label>
                                    
                                    <label style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      color: '#2E7D32'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={review.buiCut || false}
                                        onChange={(e) => handleCheckChange('buiCut', e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                      />
                                      部位切
                                    </label>
                                  </div>
                                );
                              })()}
                              
                              {/* 施術実施メニュー選択 */}
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                                  施術実施メニュー:
                                </div>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gap: '3px',
                                  marginBottom: '4px'
                                }}>
                                  {treatmentMenuOptions.map(menu => {
                                    const cellKey = `${time}-${col}`;
                                    // tempTreatmentMenusから取得（なければtreatmentMenusから）
                                    const selectedMenus = tempTreatmentMenus[cellKey] !== undefined 
                                      ? tempTreatmentMenus[cellKey] 
                                      : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                    
                                    // 個数付きメニュー（骨x2のような形式）を検出
                                    const needsCount = ['骨', '60骨', '鍼灸', '償還鍼', '美顔'].includes(menu);
                                    
                                    // 完全一致または「メニュー名x数字」形式のみを検出（骨楽などを除外）
                                    const selectedWithCount = selectedMenus.filter(m => {
                                      if (needsCount) {
                                        // 個数付きメニューの場合：「骨x2」のような形式または「骨」完全一致
                                        return m === menu || m.match(new RegExp(`^${menu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}x\\d+$`));
                                      } else {
                                        // 通常メニューの場合：完全一致のみ
                                        return m === menu;
                                      }
                                    });
                                    const isSelected = selectedWithCount.length > 0;
                                    
                                    // 個数を抽出（骨x2 → 2）
                                    let count = 1;
                                    if (isSelected && selectedWithCount[0].includes('x')) {
                                      const match = selectedWithCount[0].match(/x(\d+)/);
                                      if (match) count = parseInt(match[1]);
                                    }
                                    
                                    return (
                                      <div key={menu} style={{ position: 'relative' }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            
                                            if (needsCount && isSelected) {
                                              // 個数選択メニューで既に選択済みの場合は何もしない（個数ボタンで操作）
                                              return;
                                            }
                                            
                                            // tempTreatmentMenusを更新
                                            const current = tempTreatmentMenus[cellKey] !== undefined 
                                              ? tempTreatmentMenus[cellKey]
                                              : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                            
                                            let updated;
                                            if (needsCount) {
                                              // 個数付きメニュー：初回は「骨x1」形式で追加
                                              updated = [...current, `${menu}x1`];
                                            } else {
                                              // 通常メニュー：トグル
                                              updated = isSelected
                                                ? current.filter(m => m !== menu)
                                                : [...current, menu];
                                            }
                                            
                                            setTempTreatmentMenus(prev => ({
                                              ...prev,
                                              [cellKey]: updated
                                            }));
                                            
                                            setTreatmentMenusModified(prev => ({
                                              ...prev,
                                              [cellKey]: true
                                            }));
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '3px 2px',
                                            backgroundColor: isSelected ? '#2196F3' : '#f0f0f0',
                                            color: isSelected ? 'white' : '#333',
                                            border: `1px solid ${isSelected ? '#1976D2' : '#ddd'}`,
                                            borderRadius: '3px',
                                            fontSize: '9px',
                                            cursor: 'pointer',
                                            fontWeight: isSelected ? 'bold' : 'normal'
                                          }}
                                        >
                                          {menu}
                                        </button>
                                        
                                        {/* 個数選択ボタン */}
                                        {needsCount && isSelected && (
                                          <div style={{
                                            display: 'flex',
                                            gap: '1px',
                                            marginTop: '2px',
                                            justifyContent: 'center'
                                          }}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (count > 1) {
                                                  // 個数を減らす
                                                  const current = tempTreatmentMenus[cellKey] !== undefined
                                                    ? tempTreatmentMenus[cellKey]
                                                    : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                                  const updated = current.map(m => {
                                                    if (m === menu || m.match(new RegExp(`^${menu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}x\\d+$`))) {
                                                      return `${menu}x${count - 1}`;
                                                    }
                                                    return m;
                                                  });
                                                  setTempTreatmentMenus(prev => ({
                                                    ...prev,
                                                    [cellKey]: updated
                                                  }));
                                                  setTreatmentMenusModified(prev => ({
                                                    ...prev,
                                                    [cellKey]: true
                                                  }));
                                                }
                                              }}
                                              style={{
                                                padding: '1px 3px',
                                                backgroundColor: '#FF5722',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '2px',
                                                fontSize: '8px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              -
                                            </button>
                                            <span style={{
                                              fontSize: '8px',
                                              fontWeight: 'bold',
                                              minWidth: '12px',
                                              textAlign: 'center'
                                            }}>
                                              {count}
                                            </span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // 個数を増やす
                                                const current = tempTreatmentMenus[cellKey] !== undefined
                                                  ? tempTreatmentMenus[cellKey]
                                                  : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                                const updated = current.map(m => {
                                                  if (m === menu || m.match(new RegExp(`^${menu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}x\\d+$`))) {
                                                    return `${menu}x${count + 1}`;
                                                  }
                                                  return m;
                                                });
                                                setTempTreatmentMenus(prev => ({
                                                  ...prev,
                                                  [cellKey]: updated
                                                }));
                                                setTreatmentMenusModified(prev => ({
                                                  ...prev,
                                                  [cellKey]: true
                                                }));
                                              }}
                                              style={{
                                                padding: '1px 3px',
                                                backgroundColor: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '2px',
                                                fontSize: '8px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              +
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // 削除
                                                const current = tempTreatmentMenus[cellKey] !== undefined
                                                  ? tempTreatmentMenus[cellKey]
                                                  : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                                const updated = current.filter(m => {
                                                  const isMatch = m === menu || m.match(new RegExp(`^${menu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}x\\d+$`));
                                                  return !isMatch;
                                                });
                                                setTempTreatmentMenus(prev => ({
                                                  ...prev,
                                                  [cellKey]: updated
                                                }));
                                                setTreatmentMenusModified(prev => ({
                                                  ...prev,
                                                  [cellKey]: true
                                                }));
                                              }}
                                              style={{
                                                padding: '1px 3px',
                                                backgroundColor: '#9E9E9E',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '2px',
                                                fontSize: '8px',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              {/* 施術メニュー保存ボタン */}
                              <button
                                onClick={() => {
                                  handleSaveTreatmentMenus(time, col);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  backgroundColor: treatmentMenusModified[`${time}-${col}`] ? '#FF9800' : '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  marginBottom: '8px'
                                }}
                              >
                                {treatmentMenusModified[`${time}-${col}`] ? '💾 保存する（未保存）' : '✅ 保存済み'}
                              </button>
                              
                              <textarea
                                value={memoTexts[memoKey] || ''}
                                onChange={(e) => handleMemoChange(time, col, e.target.value)}
                                placeholder="メモを入力..."
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  padding: '4px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  resize: 'vertical',
                                }}
                              />
                              
                              <button
                                onClick={() => handleMemoClick(time, col)}
                                style={{
                                  marginTop: '4px',
                                  padding: '4px 8px',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  width: '100%',
                                }}
                              >
                                閉じる
                              </button>
                            </div>
                          )}

                          {isOpen && (
                            <div 
                              data-dropdown="true"
                              style={{
                                position: 'absolute',
                                top: '28px',
                                left: '0',
                                backgroundColor: 'white',
                                border: '2px solid #f44336',
                                borderRadius: '4px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                zIndex: 9999,
                                minWidth: '120px',
                              }}
                            >
                              {cancelReasons.map((reason, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => handleCancel(time, col, reason)}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    borderBottom: idx < cancelReasons.length - 1 ? '1px solid #eee' : 'none',
                                  }}
                                >
                                  {reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginTop: '30px' }}>
        <div style={{ padding: '6px 3px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'inline-block' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '3px', color: '#333', textAlign: 'center' }}>枠の稼働率</h2>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#2196F3', textAlign: 'center' }}>
            {occupancy.rate}%
          </div>
          <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '0 2px' }}>
            <p style={{ margin: '2px 0' }}>埋: {occupancy.filled} / {occupancy.total}</p>
            <p style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #ddd', fontSize: '10px', margin: '6px 0 2px 0' }}>
              <strong>午前:</strong> {ampm.am}件<br/>
              <strong>午後:</strong> {ampm.pm}件
            </p>
            <p style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #ddd', fontSize: '10px', margin: '6px 0 2px 0' }}>
              <strong>予済:</strong> {Object.values(completedStatus).filter(status => status === '予済').length}件<br/>
              <strong>予約率:</strong> {occupancy.filled > 0 ? Math.round((Object.values(completedStatus).filter(status => status === '予済').length / occupancy.filled) * 100) : 0}%
            </p>
            <p style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #ddd', fontSize: '10px', margin: '6px 0 2px 0' }}>
              <strong>キャン:</strong> {cancelHistory.filter(item => item.reason !== '入力取り消し').length}件<br/>
              <strong>キャン率:</strong> {occupancy.filled > 0 ? Math.round((cancelHistory.filter(item => item.reason !== '入力取り消し').length / (occupancy.filled + cancelHistory.filter(item => item.reason !== '入力取り消し').length)) * 100) : 0}%
            </p>
          </div>
        </div>

        <div style={{ padding: '4px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'inline-block', overflowX: 'auto' }}>
          {(() => {
            // 担当者リストを取得
            const staffList = staffTreatmentSummary
              .map(([staff]) => staff)
              .filter(staff => staff !== '未配置')
              .sort();
            
            return (
              <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: '#333', margin: 0, whiteSpace: 'nowrap' }}>この日の予約</h2>
            <button
              onClick={copyReservationList}
              style={{
                padding: '3px 6px',
                backgroundColor: copyButtonState === '✅' ? '#4CAF50' : (copyButtonState === '❌' ? '#f44336' : '#2196F3'),
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                minWidth: '40px',
                whiteSpace: 'nowrap'
              }}
            >
              {copyButtonState} {copyButtonState === '📋' ? 'コピー' : ''}
            </button>
          </div>
          <div style={{ display: 'inline-block' }}>
            <table data-stats-table style={{ borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '2px 3px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>ID</th>
                  <th style={{ padding: '2px 3px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>名前</th>
                  <th style={{ padding: '2px 3px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>担当</th>
                  <th style={{ padding: '2px 3px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>施術</th>
                </tr>
              </thead>
              <tbody>
                {getReservationList().slice(0, isReservationListExpanded ? undefined : 10).map((item, idx) => {
                  // 施術メニューを取得
                  const cellKey = `${item.time}-${item.col}`;
                  const menus = (treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : [];
                  const menuDisplay = menus.length > 0 ? menus.join(',') : '-';
                  
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '2px 3px', border: '1px solid #ddd', fontSize: '9px', whiteSpace: 'nowrap' }}>{item.id}</td>
                      <td style={{ padding: '2px 3px', border: '1px solid #ddd', fontSize: '9px', whiteSpace: 'nowrap' }}>{item.name}</td>
                      {editingStaffCell === cellKey ? (
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '9px', backgroundColor: '#fff3cd' }}>
                          <select
                            value={item.staff}
                            onChange={(e) => {
                              const staffKey = getCellKey(item.time, item.col, 'staff');
                              setAllDataByDate(prev => {
                                const currentData = prev[dateKey] || { data: {} };
                                return {
                                  ...prev,
                                  [dateKey]: {
                                    ...currentData,
                                    data: {
                                      ...currentData.data,
                                      [staffKey]: { staff: e.target.value }
                                    }
                                  }
                                };
                              });
                            }}
                            style={{
                              width: '100%',
                              fontSize: '9px',
                              padding: '2px',
                              border: '1px solid #2196F3',
                              borderRadius: '3px'
                            }}
                          >
                            <option value="">未配置</option>
                            {staffList.map(staff => (
                              <option key={staff} value={staff}>{staff}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingStaffCell(null)}
                            style={{
                              width: '100%',
                              marginTop: '2px',
                              padding: '2px',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            完了
                          </button>
                        </td>
                      ) : (
                        <td 
                          style={{ 
                            padding: '2px 3px', 
                            border: '1px solid #ddd', 
                            fontSize: '9px', 
                            whiteSpace: 'nowrap',
                            cursor: 'pointer'
                          }}
                          onClick={() => setEditingStaffCell(cellKey)}
                        >
                          {item.staff}
                        </td>
                      )}
                      {editingTreatmentCell === cellKey ? (
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '9px', backgroundColor: '#f0f8ff' }}>
                          <div style={{ minWidth: '200px' }}>
                            <div style={{ marginBottom: '4px', fontSize: '8px', fontWeight: 'bold', color: '#333' }}>
                              施術実施メニュー:
                            </div>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '2px',
                              marginBottom: '4px'
                            }}>
                              {treatmentMenuOptions.map(menu => {
                                // tempTreatmentMenusから取得
                                const selectedMenus = tempTreatmentMenus[cellKey] !== undefined
                                  ? tempTreatmentMenus[cellKey]
                                  : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                const needsCount = ['骨', '60骨', '鍼灸', '償還鍼', '美顔'].includes(menu);
                                const selectedWithCount = selectedMenus.filter(m => {
                                  if (needsCount) {
                                    return m === menu || m.match(new RegExp(`^${menu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}x\\d+$`));
                                  } else {
                                    return m === menu;
                                  }
                                });
                                const isSelected = selectedWithCount.length > 0;
                                let count = 1;
                                if (isSelected && selectedWithCount[0].includes('x')) {
                                  const match = selectedWithCount[0].match(/x(\d+)/);
                                  if (match) count = parseInt(match[1]);
                                }

                                return (
                                  <div key={menu} style={{ position: 'relative' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (needsCount && isSelected) return;

                                        // tempTreatmentMenusを更新
                                        const current = tempTreatmentMenus[cellKey] !== undefined
                                          ? tempTreatmentMenus[cellKey]
                                          : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);

                                        let updated;
                                        if (isSelected) {
                                          updated = current.filter(m => m !== menu);
                                        } else {
                                          updated = [...current, menu];
                                        }

                                        setTempTreatmentMenus(prev => ({
                                          ...prev,
                                          [cellKey]: updated
                                        }));
                                        
                                        setTreatmentMenusModified(prev => ({
                                          ...prev,
                                          [cellKey]: true
                                        }));
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '3px 2px',
                                        backgroundColor: isSelected ? '#4CAF50' : '#E8E8E8',
                                        color: isSelected ? 'white' : '#333',
                                        border: isSelected ? '1px solid #4CAF50' : '1px solid #ccc',
                                        borderRadius: '3px',
                                        fontSize: '7px',
                                        fontWeight: isSelected ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                    >
                                      {menu}
                                    </button>

                                    {needsCount && isSelected && (
                                      <div style={{
                                        display: 'flex',
                                        gap: '1px',
                                        marginTop: '2px',
                                        justifyContent: 'center'
                                      }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (count > 1) {
                                              const current = tempTreatmentMenus[cellKey] !== undefined
                                                ? tempTreatmentMenus[cellKey]
                                                : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                              const filtered = current.filter(m => !m.startsWith(menu));
                                              const newCount = count - 1;
                                              const updated = [...filtered, newCount === 1 ? menu : `${menu}x${newCount}`];
                                              setTempTreatmentMenus(prev => ({
                                                ...prev,
                                                [cellKey]: updated
                                              }));
                                              setTreatmentMenusModified(prev => ({
                                                ...prev,
                                                [cellKey]: true
                                              }));
                                            }
                                          }}
                                          style={{
                                            padding: '1px 3px',
                                            backgroundColor: '#FF5722',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            fontSize: '7px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          -
                                        </button>
                                        <span style={{ fontSize: '7px', fontWeight: 'bold', minWidth: '12px', textAlign: 'center' }}>
                                          {count}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const current = tempTreatmentMenus[cellKey] !== undefined
                                              ? tempTreatmentMenus[cellKey]
                                              : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                            const filtered = current.filter(m => !m.startsWith(menu));
                                            const updated = [...filtered, `${menu}x${count + 1}`];
                                            setTempTreatmentMenus(prev => ({
                                              ...prev,
                                              [cellKey]: updated
                                            }));
                                            setTreatmentMenusModified(prev => ({
                                              ...prev,
                                              [cellKey]: true
                                            }));
                                          }}
                                          style={{
                                            padding: '1px 3px',
                                            backgroundColor: '#2196F3',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            fontSize: '7px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          +
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const current = tempTreatmentMenus[cellKey] !== undefined
                                              ? tempTreatmentMenus[cellKey]
                                              : ((treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : []);
                                            const updated = current.filter(m => !m.startsWith(menu));
                                            setTempTreatmentMenus(prev => ({
                                              ...prev,
                                              [cellKey]: updated
                                            }));
                                            setTreatmentMenusModified(prev => ({
                                              ...prev,
                                              [cellKey]: true
                                            }));
                                          }}
                                          style={{
                                            padding: '1px 3px',
                                            backgroundColor: '#9E9E9E',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            fontSize: '7px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* 保存ボタン */}
                            <button
                              onClick={() => {
                                const time = cellKey.split('-')[0];
                                const col = cellKey.split('-')[1];
                                handleSaveTreatmentMenus(time, col);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px',
                                backgroundColor: treatmentMenusModified[cellKey] ? '#FF9800' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                marginBottom: '4px'
                              }}
                            >
                              {treatmentMenusModified[cellKey] ? '💾 保存する（未保存）' : '✅ 保存済み'}
                            </button>
                            
                            {/* 完了ボタン */}
                            <button
                              onClick={() => {
                                // 未保存チェック
                                if (treatmentMenusModified[cellKey]) {
                                  if (!window.confirm('施術メニューが保存されていません。\n保存せずに閉じますか？')) {
                                    return;
                                  }
                                  // 未保存のまま閉じる場合、変更をクリア
                                  setTreatmentMenusModified(prev => {
                                    const updated = { ...prev };
                                    delete updated[cellKey];
                                    return updated;
                                  });
                                  setTempTreatmentMenus(prev => {
                                    const updated = { ...prev };
                                    delete updated[cellKey];
                                    return updated;
                                  });
                                }
                                setEditingTreatmentCell(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '3px',
                                backgroundColor: '#607D8B',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                marginTop: '2px'
                              }}
                            >
                              完了
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td 
                          style={{ 
                            padding: '2px 3px', 
                            border: '1px solid #ddd', 
                            fontSize: '9px', 
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            backgroundColor: 'transparent'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 編集開始: 現在の施術メニューをtempにコピー
                            const currentMenus = (treatmentMenus && treatmentMenus[cellKey]) ? treatmentMenus[cellKey] : [];
                            setTempTreatmentMenus(prev => ({
                              ...prev,
                              [cellKey]: [...currentMenus]
                            }));
                            setTreatmentMenusModified(prev => ({
                              ...prev,
                              [cellKey]: false
                            }));
                            setEditingTreatmentCell(cellKey);
                          }}
                        >
                          {menuDisplay}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {getReservationList().length > 10 && (
            <button
              onClick={() => setIsReservationListExpanded(!isReservationListExpanded)}
              style={{
                marginTop: '4px',
                width: 'auto',
                padding: '3px 6px',
                backgroundColor: '#E3F2FD',
                color: '#2196F3',
                border: '1px solid #2196F3',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'block'
              }}
            >
              {isReservationListExpanded ? '▲ 折りたたむ' : `▼ 残り${getReservationList().length - 10}件`}
            </button>
          )}
              </>
            );
          })()}
        </div>

        <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'inline-block' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>新患・再診統計</h2>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
              <div>
                <strong style={{ color: '#FF1493' }}>新患数:</strong> {Object.values(newPatients).filter(v => v).length}件
              </div>
              <button
                onClick={() => {
                  const newPatientIds = Object.keys(newPatients).filter(key => newPatients[key]).map(key => {
                    const [time, col] = key.split('-');
                    const idKey = getCellKey(time, col, 'id');
                    return data[idKey]?.id;
                  }).filter(id => id);
                  if (newPatientIds.length === 0) {
                    alert('新患IDがありません');
                    return;
                  }
                  const text = newPatientIds.join('\n');
                  
                  // クリップボードAPIを試す
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                      alert('新患IDをコピーしました');
                    }).catch(err => {
                      console.error('コピーエラー:', err);
                      fallbackCopy(text);
                    });
                  } else {
                    // フォールバック: テキストエリアを使用
                    fallbackCopy(text);
                  }
                  
                  function fallbackCopy(text) {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand('copy');
                      alert('新患IDをコピーしました');
                    } catch (err) {
                      alert('コピーに失敗しました。手動でコピーしてください:\n' + text);
                    }
                    document.body.removeChild(textarea);
                  }
                }}
                style={{
                  padding: '3px 8px',
                  backgroundColor: '#FF1493',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                📋コピー
              </button>
            </div>
            <div style={{ fontSize: '10px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee', maxHeight: '80px', overflowY: 'auto' }}>
              <strong>新患ID:</strong><br/>
              {Object.keys(newPatients).filter(key => newPatients[key]).map(key => {
                const [time, col] = key.split('-');
                const idKey = getCellKey(time, col, 'id');
                return data[idKey]?.id;
              }).filter(id => id).join(', ') || 'なし'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
              <div>
                <strong style={{ color: '#FF9800' }}>再診数:</strong> {Object.values(repeatPatients).filter(v => v).length}件
              </div>
              <button
                onClick={() => {
                  const repeatPatientIds = Object.keys(repeatPatients).filter(key => repeatPatients[key]).map(key => {
                    const [time, col] = key.split('-');
                    const idKey = getCellKey(time, col, 'id');
                    return data[idKey]?.id;
                  }).filter(id => id);
                  if (repeatPatientIds.length === 0) {
                    alert('再診IDがありません');
                    return;
                  }
                  const text = repeatPatientIds.join('\n');
                  
                  // クリップボードAPIを試す
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                      alert('再診IDをコピーしました');
                    }).catch(err => {
                      console.error('コピーエラー:', err);
                      fallbackCopy(text);
                    });
                  } else {
                    // フォールバック: テキストエリアを使用
                    fallbackCopy(text);
                  }
                  
                  function fallbackCopy(text) {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand('copy');
                      alert('再診IDをコピーしました');
                    } catch (err) {
                      alert('コピーに失敗しました。手動でコピーしてください:\n' + text);
                    }
                    document.body.removeChild(textarea);
                  }
                }}
                style={{
                  padding: '3px 8px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                📋コピー
              </button>
            </div>
            <div style={{ fontSize: '10px', maxHeight: '80px', overflowY: 'auto' }}>
              <strong>再診ID:</strong><br/>
              {Object.keys(repeatPatients).filter(key => repeatPatients[key]).map(key => {
                const [time, col] = key.split('-');
                const idKey = getCellKey(time, col, 'id');
                return data[idKey]?.id;
              }).filter(id => id).join(', ') || 'なし'}
            </div>
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'inline-block' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>担当別集計</h2>
          <div style={{ overflowX: 'auto' }}>
            {(() => {
              // 担当者リストを取得（未配置を除く、アルファベット順）
              const staffList = staffTreatmentSummary
                .map(([staff]) => staff)
                .filter(staff => staff !== '未配置')
                .sort();
              
              if (staffList.length === 0) {
                return (
                  <div style={{ color: '#999', textAlign: 'center', padding: '15px', fontSize: '10px' }}>
                    施術実施データなし
                  </div>
                );
              }
              
              // 担当者ごとのデータをマップに変換
              const staffDataMap = {};
              staffTreatmentSummary.forEach(([staff, treatments]) => {
                staffDataMap[staff] = treatments;
              });
              
              return (
                <table data-stats-table style={{ 
                  borderCollapse: 'collapse',
                  fontSize: '10px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ 
                        padding: '4px 6px', 
                        border: '1px solid #ddd', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '10px'
                      }}>
                        施術
                      </th>
                      {staffList.map(staff => (
                        <th key={staff} style={{ 
                          padding: '4px 2px', 
                          border: '1px solid #ddd', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '10px'
                        }}>
                          {staff}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {treatmentMenuOptions.map(menu => {
                      return (
                        <tr key={menu}>
                          <td style={{ 
                            padding: '4px 6px', 
                            border: '1px solid #ddd',
                            fontSize: '10px',
                            whiteSpace: window.innerWidth <= 768 ? 'normal' : 'nowrap',
                            wordBreak: window.innerWidth <= 768 ? 'break-all' : 'normal'
                          }}>
                            {menu}
                          </td>
                          {staffList.map(staff => {
                            const treatments = staffDataMap[staff] || {};
                            const count = treatments[menu] || 0;
                            return (
                              <td key={staff} style={{ 
                                padding: '4px 2px', 
                                border: '1px solid #ddd', 
                                textAlign: 'center',
                                fontWeight: count > 0 ? 'bold' : 'normal',
                                color: count > 0 ? '#333' : '#ccc',
                                fontSize: '10px'
                              }}>
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor: '#fffacd', borderTop: '2px solid #333' }}>
                      <td style={{ 
                        padding: '4px 6px', 
                        border: '1px solid #ddd',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        人数
                      </td>
                      {staffList.map(staff => {
                        // staffSummaryから該当する担当者の人数を取得
                        const staffCount = staffSummary.find(([s]) => s === staff)?.[1] || 0;
                        return (
                          <td key={staff} style={{ 
                            padding: '4px 2px', 
                            border: '1px solid #ddd', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: '#333',
                            fontSize: '10px'
                          }}>
                            {staffCount}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {cancelHistory.length > 0 && (
          <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'inline-block' }}>
            <h2 style={{ fontSize: '6px', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>
              キャンセル履歴 ({cancelHistory.length}件)
            </h2>
            <table data-stats-table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '10px' }}>ID</th>
                  <th style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '10px' }}>名前</th>
                  <th style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '10px' }}>理由</th>
                  <th style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'left', fontWeight: 'bold', fontSize: '10px' }}>日時</th>
                  <th style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {(isCancelHistoryExpanded ? cancelHistory : cancelHistory.slice(0, 7)).map((item, displayIdx) => {
                  // 元の配列でのインデックスを計算
                  const actualIdx = displayIdx;
                  
                  return (
                  <tr key={actualIdx} style={{ borderBottom: '1px solid #ddd' }}>
                    {editingCancelIndex === actualIdx ? (
                      <>
                        <td style={{ padding: '2px', border: '1px solid #ddd' }}>
                          <input
                            type="text"
                            value={editingCancelData.id}
                            onChange={(e) => setEditingCancelData({...editingCancelData, id: e.target.value})}
                            style={{ width: '100%', fontSize: '10px', padding: '2px' }}
                          />
                        </td>
                        <td style={{ padding: '2px', border: '1px solid #ddd' }}>
                          <input
                            type="text"
                            value={editingCancelData.name}
                            onChange={(e) => setEditingCancelData({...editingCancelData, name: e.target.value})}
                            style={{ width: '100%', fontSize: '10px', padding: '2px' }}
                          />
                        </td>
                        <td style={{ padding: '2px', border: '1px solid #ddd' }}>
                          <select
                            value={editingCancelData.reason}
                            onChange={(e) => setEditingCancelData({...editingCancelData, reason: e.target.value})}
                            style={{ width: '100%', fontSize: '10px', padding: '2px' }}
                          >
                            {cancelReasons.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '10px' }}>{item.timestamp}</td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <button
                            onClick={() => handleSaveCancel(actualIdx)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '9px',
                              cursor: 'pointer',
                              marginRight: '2px'
                            }}
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditingCancelIndex(null);
                              setEditingCancelData(null);
                            }}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#9E9E9E',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '9px',
                              cursor: 'pointer',
                            }}
                          >
                            取消
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '10px' }}>{item.id}</td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '10px' }}>{item.name}</td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '10px' }}>{item.reason}</td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', fontSize: '10px' }}>{item.timestamp}</td>
                        <td style={{ padding: '2px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditCancel(actualIdx)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '9px',
                              cursor: 'pointer',
                              marginRight: '2px'
                            }}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteCancel(actualIdx)}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '9px',
                              cursor: 'pointer',
                            }}
                          >
                            削除
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {cancelHistory.length > 7 && (
              <button
                onClick={() => setIsCancelHistoryExpanded(!isCancelHistoryExpanded)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#E3F2FD',
                  color: '#2196F3',
                  border: '1px solid #2196F3',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {isCancelHistoryExpanded ? '▲ 折りたたむ' : `▼ 残り${cancelHistory.length - 7}件を表示`}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* 📁 データ管理セクション */}
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333', borderBottom: '2px solid #2196F3', paddingBottom: '8px' }}>
          📁 データ管理
        </h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <CustomerDatabaseUpload onDataLoaded={(newDatabase, shouldOverwrite) => {
              if (shouldOverwrite) {
                // 上書きモード:完全に新しいデータベースで置き換え
                // ただし、CSVに回数券情報がない場合は既存の回数券情報を保持
                const mergedDatabase = {};
                Object.entries(newDatabase).forEach(([id, data]) => {
                  mergedDatabase[id] = {
                    ...data,
                    // CSVに回数券情報がなく、既存DBに回数券がある場合は保持
                    tickets: (data.tickets && data.tickets.length > 0) 
                      ? data.tickets 
                      : (customerDb[id]?.tickets || [])
                  };
                });
                setCustomerDb(mergedDatabase);
                console.log('✅ 顧客データベースを上書きしました:', Object.keys(mergedDatabase).length, '件');
              } else {
                // マージモード:新規IDは追加、既存IDは空の項目のみ補完
                setCustomerDb(prev => {
                  const updatedDb = { ...prev };
                  let newCount = 0;
                  let updateCount = 0;
                  let skipCount = 0;
                  
                  Object.entries(newDatabase).forEach(([id, data]) => {
                    if (!prev[id]) {
                      // 新規IDのみ追加
                      updatedDb[id] = data;
                      newCount++;
                      console.log(`➕ ID「${id}」を新規追加 - 名前="${data.name}", 担当="${data.staff}", ふりがな="${data.furigana || ''}"`);
                    } else {
                      // 既存IDの場合、空の項目のみ補完
                      let updated = false;
                      const updatedData = { ...prev[id] };
                      
                      // 名前が空なら補完
                      if ((!prev[id].name || prev[id].name.trim() === '') && data.name) {
                        updatedData.name = data.name;
                        updated = true;
                        console.log(`🔄 ID「${id}」の名前を補完 - "${data.name}"`);
                      }
                      
                      // 担当が空なら補完
                      if ((!prev[id].staff || prev[id].staff.trim() === '') && data.staff) {
                        updatedData.staff = data.staff;
                        updated = true;
                        console.log(`🔄 ID「${id}」の担当を補完 - "${data.staff}"`);
                      }
                      
                      // ふりがなが空なら補完
                      if ((!prev[id].furigana || prev[id].furigana.trim() === '') && data.furigana) {
                        updatedData.furigana = data.furigana;
                        updated = true;
                        console.log(`🔄 ID「${id}」のふりがなを補完 - "${data.furigana}"`);
                      }
                      
                      // 回数券情報が空なら補完
                      if ((!prev[id].tickets || prev[id].tickets.length === 0) && data.tickets && data.tickets.length > 0) {
                        updatedData.tickets = data.tickets;
                        updated = true;
                        console.log(`🔄 ID「${id}」の回数券情報を補完 - ${data.tickets.length}枚`);
                      }
                      
                      if (updated) {
                        updatedDb[id] = updatedData;
                        updateCount++;
                      } else {
                        skipCount++;
                      }
                    }
                  });
                  
                  console.log(`✅ 読み込み完了: 新規追加 ${newCount}件 / 項目補完 ${updateCount}件 / スキップ ${skipCount}件`);
                  
                  // サーバーにも保存
                  saveCustomerDatabaseToServer(updatedDb);
                  
                  return updatedDb;
                });
              }
            }} />
          </div>
          
          <div style={{ flex: 1, minWidth: '300px' }}>
            <StaffHolidayUpload onDataLoaded={(holidays) => {
              // 既存データとマージ（新しい日付を追加、既存日付は上書き）
              setStaffHolidays(prev => {
                const merged = { ...prev, ...holidays };
                const newDates = Object.keys(holidays).filter(date => !prev[date]);
                const updateDates = Object.keys(holidays).filter(date => prev[date]);
                
                console.log(`✅ スタッフ休み情報を更新:`);
                console.log(`  - 新規日付: ${newDates.length}件`);
                console.log(`  - 更新日付: ${updateDates.length}件`);
                console.log(`  - 合計: ${Object.keys(merged).length}日分`);
                
                if (newDates.length > 0) {
                  console.log(`📅 新規追加された日付:`, newDates.sort());
                }
                if (updateDates.length > 0) {
                  console.log(`🔄 更新された日付:`, updateDates.sort());
                }
                
                saveStaffHolidaysToServer(merged);
                return merged;
              });
            }} />
          </div>
        </div>
        
        {/* 当日PDF出力 */}
        <MonthlyPdfExport 
          allDataByDate={allDataByDate}
          customerDb={customerDb}
          staffHolidays={staffHolidays}
          selectedDate={selectedDate}
          formatDate={formatDate}
        />
        
      </div>
    </div>
    </>
  );
}