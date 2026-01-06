import React, { useState } from 'react';

export const MonthlyPdfExport = ({ allDataByDate, customerDb, staffHolidays, selectedDate, formatDate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // 曜日取得
  const getDayOfWeek = (date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  };

  // 1ヶ月分の日付リストを取得
  const getMonthDates = (year, month) => {
    const dates = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  // 曜日に応じた時間枠を取得
  const getTimeSlotsForDay = (date) => {
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      return [
        { time: '8:30', cols: 11 }, { time: '9:15', cols: 11 }, { time: '10:00', cols: 11 },
        { time: '10:45', cols: 11 }, { time: '11:30', cols: 11 }, { time: '12:15', cols: 11 },
        { time: '13:00', cols: 11 }, { time: '13:45', cols: 11 }, { time: '14:30', cols: 11 },
        { time: '15:15', cols: 11 }, { time: '16:00', cols: 11 }, { time: '16:45', cols: 5 },
      ];
    } else if (dayOfWeek === 6) {
      return [
        { time: '9:00', cols: 11 }, { time: '9:45', cols: 11 }, { time: '10:30', cols: 11 },
        { time: '11:15', cols: 11 }, { time: '11:45', cols: 11 }, { time: '12:30', cols: 5 },
        { time: '15:00', cols: 11 }, { time: '15:45', cols: 11 }, { time: '16:30', cols: 11 },
        { time: '17:15', cols: 11 }, { time: '18:00', cols: 11 }, { time: '18:30', cols: 11 },
        { time: '19:15', cols: 5 },
      ];
    } else {
      return [
        { time: '9:00', cols: 11 }, { time: '9:45', cols: 11 }, { time: '10:30', cols: 11 },
        { time: '11:15', cols: 11 }, { time: '11:45', cols: 11 }, { time: '12:30', cols: 5 },
        { time: '15:00', cols: 11 }, { time: '15:45', cols: 11 }, { time: '16:30', cols: 11 },
        { time: '17:15', cols: 11 }, { time: '18:00', cols: 11 }, { time: '18:45', cols: 11 },
        { time: '19:30', cols: 11 }, { time: '20:15', cols: 5 },
      ];
    }
  };

  // 印刷用のウィンドウを開く（当日のみ）
  const generatePrintablePDF = () => {
    setIsGenerating(true);
    
    try {
      const date = selectedDate;
      const dateKey = formatDate(date);
      const dayOfWeek = getDayOfWeek(date);
      const dateData = allDataByDate[dateKey] || { data: {} };
      const data = dateData.data || {};
      const timeSlots = getTimeSlotsForDay(date);
      const holidays = staffHolidays[dateKey] || [];
      
      // 午前・午後に分割
      const morningSlots = timeSlots.filter(slot => parseInt(slot.time.split(':')[0]) < 14);
      const afternoonSlots = timeSlots.filter(slot => parseInt(slot.time.split(':')[0]) >= 14);
      
      // 新しいウィンドウでHTMLを生成
      const printWindow = window.open('', '_blank');
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>予約表_${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      .page-break { page-break-after: always; }
      button { display: none; }
    }
    body { 
      font-family: 'メイリオ', 'Meiryo', 'MS ゴシック', sans-serif; 
      margin: 0; 
      padding: 20px;
    }
    h1 { 
      text-align: center; 
      font-size: 18px; 
      margin: 10px 0;
    }
    .holiday { 
      text-align: center; 
      color: #E65100; 
      font-weight: bold; 
      margin: 5px 0;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
      font-size: 11px;
    }
    th, td { 
      border: 1px solid #333; 
      padding: 6px 3px; 
      text-align: center;
      vertical-align: middle;
    }
    th { 
      background-color: #2c3e50; 
      color: white; 
      font-weight: bold;
    }
    .time-col { 
      background-color: #f0f0f0; 
      font-weight: bold;
      width: 60px;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 30px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      font-weight: bold;
    }
    .print-button:hover {
      background-color: #1976D2;
    }
    @media print {
      .print-button { display: none; }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
  
  ${createPageHTML(date, dayOfWeek, morningSlots, data, holidays, '午前')}
  
  ${afternoonSlots.length > 0 ? `
  <div class="page-break"></div>
  ${createPageHTML(date, dayOfWeek, afternoonSlots, data, holidays, '午後')}
  ` : ''}
</body>
</html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setIsGenerating(false);
      alert('✅ 印刷用ページを開きました\n\n「🖨️ 印刷 / PDF保存」ボタンをクリックして、\n印刷またはPDF保存を選択してください。');
      
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert(`❌ PDF生成に失敗しました: ${error.message}`);
      setIsGenerating(false);
    }
  };

  // 1ヶ月分の印刷用ページを開く
  const generateMonthlyPrintablePDF = () => {
    setIsGenerating(true);
    
    try {
      const dates = getMonthDates(selectedYear, selectedMonth);
      
      // 新しいウィンドウでHTMLを生成
      const printWindow = window.open('', '_blank');
      
      let allPagesHTML = '';
      
      dates.forEach((date, index) => {
        const dateKey = formatDate(date);
        const dayOfWeek = getDayOfWeek(date);
        const dateData = allDataByDate[dateKey] || { data: {} };
        const data = dateData.data || {};
        const timeSlots = getTimeSlotsForDay(date);
        const holidays = staffHolidays[dateKey] || [];
        
        // 午前・午後に分割
        const morningSlots = timeSlots.filter(slot => parseInt(slot.time.split(':')[0]) < 14);
        const afternoonSlots = timeSlots.filter(slot => parseInt(slot.time.split(':')[0]) >= 14);
        
        // 午前ページ
        if (index > 0) {
          allPagesHTML += '<div class="page-break"></div>';
        }
        allPagesHTML += createPageHTML(date, dayOfWeek, morningSlots, data, holidays, '午前');
        
        // 午後ページ
        if (afternoonSlots.length > 0) {
          allPagesHTML += '<div class="page-break"></div>';
          allPagesHTML += createPageHTML(date, dayOfWeek, afternoonSlots, data, holidays, '午後');
        }
      });
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>予約表_${selectedYear}年${selectedMonth}月</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      .page-break { page-break-after: always; }
      button { display: none; }
    }
    body { 
      font-family: 'メイリオ', 'Meiryo', 'MS ゴシック', sans-serif; 
      margin: 0; 
      padding: 20px;
    }
    h1 { 
      text-align: center; 
      font-size: 18px; 
      margin: 10px 0;
    }
    .holiday { 
      text-align: center; 
      color: #E65100; 
      font-weight: bold; 
      margin: 5px 0;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
      font-size: 11px;
    }
    th, td { 
      border: 1px solid #333; 
      padding: 6px 3px; 
      text-align: center;
      vertical-align: middle;
    }
    th { 
      background-color: #2c3e50; 
      color: white; 
      font-weight: bold;
    }
    .time-col { 
      background-color: #f0f0f0; 
      font-weight: bold;
      width: 60px;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 30px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      font-weight: bold;
      z-index: 1000;
    }
    .print-button:hover {
      background-color: #1976D2;
    }
    @media print {
      .print-button { display: none; }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ 印刷 / PDF保存（${dates.length}日分×2ページ）</button>
  
  ${allPagesHTML}
</body>
</html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setIsGenerating(false);
      alert(`✅ 印刷用ページを開きました\n\n${selectedYear}年${selectedMonth}月の全${dates.length}日分（約${dates.length * 2}ページ）\n\n「🖨️ 印刷 / PDF保存」ボタンをクリックして、\n印刷またはPDF保存を選択してください。`);
      
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert(`❌ PDF生成に失敗しました: ${error.message}`);
      setIsGenerating(false);
    }
  };
  
  // ページHTMLを生成
  const createPageHTML = (date, dayOfWeek, timeSlots, data, holidays, period) => {
    const maxCols = 11;
    
    let tableRows = '';
    timeSlots.forEach(({ time, cols }) => {
      let row = `<tr><td class="time-col">${time}</td>`;
      
      for (let col = 0; col < maxCols; col++) {
        if (col < cols) {
          const nameKey = `${time}-${col}-name`;
          const staffKey = `${time}-${col}-staff`;
          
          const name = data[nameKey]?.name || '';
          const staff = data[staffKey]?.staff || '';
          
          let cellContent = '';
          if (name) {
            cellContent = staff ? `${name}<br>(${staff})` : name;
          }
          row += `<td>${cellContent}</td>`;
        } else {
          row += '<td></td>';
        }
      }
      
      row += '</tr>';
      tableRows += row;
    });
    
    return `
      <h1>${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}（${dayOfWeek}）${period}</h1>
      ${holidays.length > 0 ? `<div class="holiday">休み: ${holidays.join(', ')}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th>時間</th>
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
            <th>7</th><th>8</th><th>9</th><th>10</th><th>11</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  };

  return (
    <div style={{
      padding: '8px',
      backgroundColor: '#E3F2FD',
      borderRadius: '4px',
      marginTop: '10px',
      border: '2px solid #2196F3'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: '#1565C0', fontSize: '12px', flex: 1 }}>
          📄 予約表PDF出力
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '4px 8px',
            backgroundColor: '#2196F3',
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
          {/* 当日分 */}
          <div style={{ marginBottom: '15px', paddingBottom: '12px', borderBottom: '1px solid #90CAF9' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1976D2', fontSize: '11px' }}>当日分</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>
                {selectedDate.getFullYear()}年{selectedDate.getMonth()+1}月{selectedDate.getDate()}日（{getDayOfWeek(selectedDate)}）
              </div>
              
              <button
                onClick={generatePrintablePDF}
                disabled={isGenerating}
                style={{
                  padding: '6px 12px',
                  backgroundColor: isGenerating ? '#999' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? '⏳ 生成中...' : '📄 印刷用ページを開く'}
              </button>
            </div>
            <p style={{ fontSize: '10px', color: '#555', marginTop: '4px', marginBottom: '0' }}>
              💡 午前・午後でA4横向き1ページずつ（計2ページ）
        </p>
      </div>
      
      {/* 1ヶ月分 */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', color: '#1976D2', fontSize: '11px' }}>1ヶ月分</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
          {/* 年選択 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>年:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{
                padding: '4px',
                border: '2px solid #2196F3',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
          </div>
          
          {/* 月選択 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>月:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{
                padding: '4px',
                border: '2px solid #2196F3',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}月</option>
              ))}
            </select>
          </div>
          
          {/* 1ヶ月分生成ボタン */}
          <button
            onClick={generateMonthlyPrintablePDF}
            disabled={isGenerating}
            style={{
              padding: '6px 12px',
              backgroundColor: isGenerating ? '#999' : '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {isGenerating ? '⏳ 生成中...' : '📅 1ヶ月分を開く'}
          </button>
        </div>
        <p style={{ fontSize: '10px', color: '#555', marginTop: '4px', marginBottom: '0' }}>
          💡 選択した月の全日分（1日〜末日）を一括で印刷用ページに表示します。<br/>
          例: 12月 → 31日×2ページ = 約62ページ
        </p>
      </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPdfExport;