import React, { useState } from 'react';
import { saveStaffHolidaysToServer } from './serverSync';

export const StaffHolidayUpload = ({ onDataLoaded }) => {
  const [fileName, setFileName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileUpload = async (e) => {  // ← async追加
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {  // ← async追加
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        const holidayData = {};

        console.log('📄 スタッフ休み CSV全体の行数:', lines.length);
        console.log('📄 最初の5行:', lines.slice(0, 5));

        // 最初の行がヘッダーかどうか判定
        const firstLine = lines[0]?.trim();
        const firstLineParts = firstLine?.split(',').map(col => col.trim().replace(/"/g, ''));
        const hasHeader = firstLineParts && (firstLineParts[0] === '日付' || firstLineParts[0] === 'date');
        const startIndex = hasHeader ? 1 : 0;

        console.log('📋 ヘッダー行の有無:', hasHeader ? 'あり' : 'なし');

        // CSVの各行を処理
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',').map(col => col.trim().replace(/"/g, ''));
          let date = parts[0];
          
          // スタッフ名が2列目以降にある場合と、1列目だけの場合の両方に対応
          let staffList;
          if (parts.length > 1) {
            // 複数列形式: 日付,スタッフ1,スタッフ2,...
            staffList = parts.slice(1).filter(s => s);
          } else {
            // 単一列形式: 日付だけ（スタッフ名は日付に含まれる想定）
            // 例: "2025-11-15 A B" または "2025-11-15,A,B" のような形式
            const dateAndStaff = date.split(/[\s,]+/);
            date = dateAndStaff[0];
            staffList = dateAndStaff.slice(1).filter(s => s);
          }

          // 日付の正規化: スラッシュをハイフンに変換（2025/11/15 → 2025-11-15）
          if (date) {
            date = date.replace(/\//g, '-');
          }

          console.log(`📝 行${i}: 日付="${date}", 休みスタッフ=[${staffList.join(', ')}]`);

          if (date && staffList.length > 0) {
            holidayData[date] = staffList;
          }
        }

        console.log('✅ 読み込み完了:', Object.keys(holidayData).length, '件');
        console.log('📊 休み情報:', holidayData);

        setFileName(file.name);
        
        // ← ここが重要！サーバーに保存
        const saved = await saveStaffHolidaysToServer(holidayData);
        
        if (saved) {
          console.log('✅ サーバーに保存しました');
          // 親コンポーネントにも通知（React stateを更新）
          onDataLoaded(holidayData);
          alert(`✅ ${file.name} を読み込みました。\n${Object.keys(holidayData).length} 日分のスタッフ休み情報を追加しました。\n\n※既存の日付は上書きされます。\n※サーバーに保存されました。`);
        } else {
          console.error('❌ サーバー保存に失敗しました');
          alert(`⚠️ データは読み込みましたが、サーバーへの保存に失敗しました。\n手動で保存するか、もう一度アップロードしてください。`);
        }
        
      } catch (error) {
        console.error('❌ エラー:', error);
        alert(`❌ CSV ファイルの読み込みに失敗しました: ${error.message}`);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div style={{
      padding: '8px',
      backgroundColor: '#FFF3E0',
      borderRadius: '4px',
      marginBottom: '10px',
      border: '2px solid #FF9800'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#E65100', fontSize: '12px', flex: 1 }}>
          📅 スタッフ休み CSV
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '4px 8px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            fontSize: '11px',
            cursor: 'pointer',
            marginLeft: '10px',
          }}
        >
          {isExpanded ? '▲ 閉じる' : '▼ 詳細'}
        </button>
      </div>
      
      {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{
                padding: '6px',
                border: '1px solid #FF9800',
                borderRadius: '4px',
                flex: 1,
                fontSize: '12px',
              }}
            />
            {fileName && (
              <span style={{ color: '#E65100', fontWeight: 'bold', fontSize: '11px' }}>
                ✅ {fileName}
              </span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: '#555', marginTop: '6px', marginBottom: '0' }}>
            📝 CSV 形式: 各行に「日付 スタッフ名(スペース区切り)」(例: 2025-01-15 A B C)
          </p>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '4px', marginBottom: '0' }}>
            💡 日付形式: YYYY-MM-DD または YYYY/MM/DD (例: 2025-01-15 A B)
          </p>
          <p style={{ fontSize: '10px', color: '#1976D2', marginTop: '4px', marginBottom: '0', fontWeight: 'bold' }}>
            ℹ️ 新しい日付は追加、既存の日付は上書きされます。
          </p>
        </div>
      )}
    </div>
  );
};

export default StaffHolidayUpload;