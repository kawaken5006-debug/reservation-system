import { saveCustomerDatabaseToServer } from './serverSync';
import React, { useState } from 'react';

export const CustomerDatabaseUpload = ({ onDataLoaded }) => {
  const [fileName, setFileName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        const database = {};
        let newCount = 0;
        let existingCount = 0;

        console.log('📄 CSV全体の行数:', lines.length);
        console.log('📄 最初の5行:', lines.slice(0, 5));

        // 最初の行がヘッダーかどうか判定（IDが数字でない場合はヘッダー）
        const firstLine = lines[0]?.trim();
        const firstLineParts = firstLine?.split(',').map(col => col.trim().replace(/"/g, ''));
        const hasHeader = firstLineParts && isNaN(parseInt(firstLineParts[0]));
        const startIndex = hasHeader ? 1 : 0;

        console.log('📋 ヘッダー行の有無:', hasHeader ? 'あり' : 'なし');
        console.log('📋 データ読み込み開始行:', startIndex);

        // CSVの各行を処理
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',').map(col => col.trim().replace(/"/g, ''));
          const id = parts[0];
          const name = parts[1];
          const staff = parts[2];
          const furigana = parts[3]; // D列のふりがな
          
          // E列以降: 回数券情報（オプション）
          // フォーマット: 回数券名,回数,使用日1;使用日2;使用日3|回数券名2,回数
          // 例: 骨,8,2025-11-01;2025-11-15|楽,16,2025-12-01
          const ticketsData = parts[4] || '';
          
          console.log(`📝 行${i}: ID="${id}", 名前="${name}", 担当="${staff}", ふりがな="${furigana}", 回数券="${ticketsData}"`);
          
          if (id && name) {
            const customerData = { 
              name, 
              staff: staff || '',
              furigana: furigana || '',
              tickets: []
            };
            
            // 回数券情報をパース
            if (ticketsData) {
              try {
                const ticketGroups = ticketsData.split('|');
                ticketGroups.forEach(ticketGroup => {
                  if (!ticketGroup.trim()) return;
                  
                  const ticketParts = ticketGroup.split(',');
                  if (ticketParts.length >= 2) {
                    const ticketName = ticketParts[0].trim();
                    const ticketCount = parseInt(ticketParts[1].trim());
                    const usedDates = ticketParts[2] ? ticketParts[2].split(';').filter(d => d.trim()) : [];
                    
                    if (ticketName && !isNaN(ticketCount) && ticketCount > 0) {
                      customerData.tickets.push({
                        name: ticketName,
                        count: ticketCount,
                        used: usedDates
                      });
                      console.log(`  🎫 回数券追加: ${ticketName} ${ticketCount}回 (使用済み:${usedDates.length}回)`);
                    }
                  }
                });
              } catch (error) {
                console.warn(`⚠️ ID「${id}」の回数券情報の解析に失敗:`, error);
              }
            }
            
            database[id] = customerData;
          }
        }

        // 既存データと比較して新規のみカウント
        const existingDatabase = window.customerDatabase || {};
        Object.keys(database).forEach(id => {
          if (existingDatabase[id]) {
            existingCount++;
          } else {
            newCount++;
          }
        });

        setFileName(file.name);
        // マージモード: 既存データに新規のみ追加、ふりがなと回数券は更新
        onDataLoaded(database, false); // 第2引数にfalseを渡してマージモード
        
        saveCustomerDatabaseToServer(database);
        
        // 回数券を持っている顧客数をカウント
        const ticketCount = Object.values(database).filter(c => c.tickets && c.tickets.length > 0).length;
        
        alert(`✅ ${file.name} を読み込みました。\n新規追加: ${newCount}件\n既存ID: ${existingCount}件（ふりがな・回数券のみ更新）\n回数券保持: ${ticketCount}件\n\n※既存顧客の名前・担当変更は予約表上で行ってください。`);
        
        console.log(`✅ 読み込み完了: 新規追加 ${newCount}件 / 既存 ${existingCount}件 / 回数券保持 ${ticketCount}件`);
      } catch (error) {
        alert(`❌ CSV ファイルの読み込みに失敗しました: ${error.message}`);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div style={{
      padding: '8px',
      backgroundColor: '#E8F5E9',
      borderRadius: '4px',
      marginBottom: '10px',
      border: '2px solid #4CAF50'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#2E7D32', fontSize: '12px', flex: 1 }}>
          📁 顧客DB CSV
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '4px 8px',
            backgroundColor: '#4CAF50',
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
                border: '1px solid #4CAF50',
                borderRadius: '4px',
                flex: 1,
                fontSize: '12px',
              }}
            />
            {fileName && (
              <span style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: '11px' }}>
                ✅ {fileName}
              </span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: '#555', marginTop: '6px', marginBottom: '0' }}>
            📝 CSV 形式: ID,名前,担当,ふりがな,回数券情報
          </p>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '4px', marginBottom: '0' }}>
            例: 1,田中太郎,A,タナカタロウ,骨,8,2025-11-01;2025-11-15|楽,16
          </p>
          <p style={{ fontSize: '10px', color: '#1976D2', marginTop: '4px', marginBottom: '0' }}>
            💡 回数券: 名前,回数,使用日1;使用日2|次の回数券,回数
          </p>
          <p style={{ fontSize: '10px', color: '#1976D2', marginTop: '4px', marginBottom: '0', fontWeight: 'bold' }}>
            ℹ️ 新規IDは追加、既存IDはふりがなと回数券のみ更新されます。
          </p>
          <p style={{ fontSize: '10px', color: '#F57C00', marginTop: '2px', marginBottom: '0' }}>
            💡 既存顧客の名前・担当変更は予約表上で行ってください。
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomerDatabaseUpload;