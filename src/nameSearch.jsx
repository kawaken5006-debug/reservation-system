import React, { useState, useRef } from 'react';

export const NameSearch = ({ customerDb, staffHolidays, dateKey, allDataByDate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [size, setSize] = useState({ width: 332, height: 500 }); // 8.8cm = 332px
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [copiedId, setCopiedId] = useState(null); // コピー済みIDを記録
  const searchTimerRef = useRef(null); // デバウンス用タイマー

  // 最終予約日からの日数を計算（メモ化）
  const [lastVisitCache, setLastVisitCache] = useState({});

  // コンポーネントのクリーンアップ時にタイマーをクリア
  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // 最終予約日からの日数を計算（キャッシュ付き）
  const getDaysSinceLastVisit = (customerId) => {
    // キャッシュチェック
    if (lastVisitCache[customerId] !== undefined) {
      return lastVisitCache[customerId];
    }
    
    if (!allDataByDate) return null;
    
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
    
    let days = null;
    if (lastVisitDate) {
      // 日数を計算
      const diffTime = today - lastVisitDate;
      days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // キャッシュに保存
    setLastVisitCache(prev => ({ ...prev, [customerId]: days }));
    
    return days;
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
  
  // 顧客の予約履歴を取得（最新3件）
  const getReservationHistory = (customerId) => {
    if (!allDataByDate) return [];
    
    const reservations = [];
    
    // 全ての日付データを確認
    Object.keys(allDataByDate).forEach(date => {
      if (date === 'customer-db' || date === '2025' || date.length === 4) return;
      
      const dateData = allDataByDate[date];
      if (!dateData?.data) return;
      
      // その日付の全てのセルをチェック
      Object.keys(dateData.data).forEach(key => {
        if (key.includes('-id')) {
          const cellData = dateData.data[key];
          const cellId = typeof cellData === 'object' ? cellData.id : cellData;
          
          if (cellId === customerId) {
            // 時刻と列を抽出 (例: "9:00-1-id" -> time="9:00", col="1")
            const parts = key.split('-');
            const time = parts[0];
            const col = parts[1];
            
            reservations.push({ date, time, col });
          }
        }
      });
    });
    
    // 日付でソート（新しい順）
    reservations.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
    
    // 最新3件を返す
    return reservations.slice(0, 3);
  };

  // ドラッグ開始
  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setDragOffset({
        x: clientX - position.x,
        y: clientY - position.y
      });
    }
  };

  // タッチ開始（スマホ・タブレット用）
  const handleTouchStart = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragOffset({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  // リサイズ開始
  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setResizeStart({
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height
    });
  };

  // リサイズタッチ開始（スマホ・タブレット用）
  const handleResizeTouchStart = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    const touch = e.touches[0];
    setResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: size.width,
      height: size.height
    });
  };

  // ドラッグ中
  const handleMouseMove = (e) => {
    if (isDragging) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPosition({
        x: clientX - dragOffset.x,
        y: clientY - dragOffset.y
      });
    } else if (isResizing) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - resizeStart.x;
      const deltaY = clientY - resizeStart.y;
      setSize({
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(300, resizeStart.height + deltaY)
      });
    }
  };

  // タッチ移動（スマホ・タブレット用）
  const handleTouchMove = (e) => {
    if (isDragging || isResizing) {
      e.preventDefault(); // スクロールを防止
      const touch = e.touches[0];
      
      if (isDragging) {
        setPosition({
          x: touch.clientX - dragOffset.x,
          y: touch.clientY - dragOffset.y
        });
      } else if (isResizing) {
        const deltaX = touch.clientX - resizeStart.x;
        const deltaY = touch.clientY - resizeStart.y;
        setSize({
          width: Math.max(300, resizeStart.width + deltaX),
          height: Math.max(300, resizeStart.height + deltaY)
        });
      }
    }
  };

  // ドラッグ・リサイズ終了
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // タッチ終了（スマホ・タブレット用）
  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // グローバルイベントリスナー
  React.useEffect(() => {
    if (isDragging || isResizing) {
      // マウスイベント
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // タッチイベント
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, isResizing, dragOffset, resizeStart]);

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

  const handleSearch = (value) => {
    setSearchTerm(value);
    
    // 既存のタイマーをクリア（デバウンス）
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    if (!value.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // 1文字の場合は漢字以外は検索しない（2文字以上、または漢字1文字で検索開始）
    if (value.trim().length < 2) {
      // 漢字が含まれているかチェック
      const hasKanji = /[\u4e00-\u9faf]/.test(value);
      if (!hasKanji) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
    }

    // 300ms後に検索実行（デバウンス時間を少し延長）
    searchTimerRef.current = setTimeout(() => {
      // 検索語を正規化（カタカナとひらがな両方で検索）
      const searchKatakana = hiraganaToKatakana(value);
      const searchHiragana = katakanaToHiragana(value);
      const searchLower = value.toLowerCase();

      const results = Object.entries(customerDb).filter(([id, info]) => {
        const name = info.name || '';
        const nameLower = name.toLowerCase();
        const nameKatakana = hiraganaToKatakana(name);
        const nameHiragana = katakanaToHiragana(name);
        
        // ふりがな（D列）も検索対象に含める
        const furigana = info.furigana || '';
        const furiganaLower = furigana.toLowerCase();
        const furiganaKatakana = hiraganaToKatakana(furigana);
        const furiganaHiragana = katakanaToHiragana(furigana);
        
        // IDもひらがな・カタカナ変換して検索
        const idKatakana = hiraganaToKatakana(id);
        const idHiragana = katakanaToHiragana(id);
        const idLower = id.toLowerCase();

        // 検索条件のチェック
        return nameLower.includes(searchLower) ||
               name.includes(value) ||
               nameKatakana.includes(searchKatakana) ||
               nameHiragana.includes(searchHiragana) ||
               furiganaLower.includes(searchLower) ||
               furigana.includes(value) ||
               furiganaKatakana.includes(searchKatakana) ||
               furiganaHiragana.includes(searchHiragana) ||
               id.includes(value) ||
               idLower.includes(searchLower) ||
               idKatakana.includes(searchKatakana) ||
               idHiragana.includes(searchHiragana);
      }).map(([id, info]) => ({
        id,
        name: info.name,
        staff: info.staff,
        furigana: info.furigana
      }));

      setSearchResults(results);
      setShowResults(results.length > 0);
    }, 300);
  };

  const handleCopyId = (id) => {
    // フォールバック方式を優先（より確実）
    const textarea = document.createElement('textarea');
    textarea.value = id;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        // コピー成功時、状態を更新
        setCopiedId(id);
        // 1秒後に元に戻す
        setTimeout(() => setCopiedId(null), 1000);
      } else {
        alert(`❌ コピーに失敗しました。ID: ${id}`);
      }
    } catch (err) {
      document.body.removeChild(textarea);
      alert(`❌ コピーに失敗しました。ID: ${id}`);
      console.error('コピーエラー:', err);
    }
  };

  // フローティングボタン
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px', // leftからrightに変更
          zIndex: 1000000,
          padding: '12px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '25px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
        }}
      >
        🔍 顧客検索
      </button>
    );
  }

  // ポップアップウィンドウ
  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        backgroundColor: 'white',
        border: '2px solid #2196F3',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        zIndex: 1000000,
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'none', // タッチ操作を最適化
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* ヘッダー（ドラッグ可能） */}
      <div
        className="drag-handle"
        style={{
          padding: '12px',
          backgroundColor: '#2196F3',
          color: 'white',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>🔍 顧客検索</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>(ドラッグで移動)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              if (isExpanded) {
                setSize({ width: 400, height: 500 });
              } else {
                setSize({ width: 600, height: 700 });
              }
              setIsExpanded(!isExpanded);
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 5px',
            }}
            title={isExpanded ? '縮小' : '拡大'}
          >
            {isExpanded ? '🗗' : '🗖'}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setSearchTerm('');
              setSearchResults([]);
              setShowResults(false);
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 5px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 検索ボックス */}
      <div style={{ padding: '12px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="名前・ふりがな・IDで検索..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            style={{
              width: '100%',
              padding: '10px 40px 10px 12px',
              border: '2px solid #2196F3',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
              fontWeight: '500',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSearchResults([]);
                setShowResults(false);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
              }}
            >
              ✕
            </button>
          )}
        </div>
        
        {/* 休みスタッフ情報 */}
        {staffHolidays && dateKey && staffHolidays[dateKey] && staffHolidays[dateKey].length > 0 && (
          <div style={{
            marginTop: '10px',
            padding: '6px 10px',
            backgroundColor: '#FFE0B2',
            border: '2px solid #FF9800',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#E65100' }}>
              🏖️ 本日の休み:
            </span>
            <span style={{ fontSize: '12px', color: '#E65100', fontWeight: 'bold' }}>
              {staffHolidays[dateKey].join(', ')}
            </span>
          </div>
        )}
        
        <p style={{ fontSize: '11px', color: '#666', margin: '8px 0 0 0' }}>
          💡 漢字は1文字から、その他は2文字以上で検索
        </p>
      </div>

      {/* 検索結果 */}
      {showResults && searchResults.length > 0 && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          borderTop: '1px solid #eee',
        }}>
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f5f5f5',
            fontWeight: 'bold',
            fontSize: '12px',
            color: '#666',
            position: 'sticky',
            top: 0,
          }}>
            検索結果: {searchResults.length}件
          </div>
          
          {searchResults.map((result, index) => (
            <div
              key={result.id}
              style={{
                padding: '12px',
                borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E3F2FD'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9f9f9'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                  {result.name}
                  {result.furigana && (
                    <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px', fontWeight: 'normal' }}>
                      ({result.furigana})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span>ID: {result.id}</span>
                  {result.staff && <span style={{ color: '#2196F3' }}>担当: {result.staff}</span>}
                  {/* 最終予約日からの日数 */}
                  <span style={{ 
                    fontSize: '11px', 
                    color: (() => {
                      const days = getDaysSinceLastVisit(result.id);
                      if (days === null) return '#4CAF50'; // 初回: 緑
                      if (days >= 30) return '#FF5722'; // 1ヶ月以上: 赤
                      if (days >= 14) return '#FF9800'; // 2週間以上: オレンジ
                      return '#666'; // それ以外: グレー
                    })(),
                    fontWeight: 'bold',
                  }}>
                    📅 {getLastVisitText(result.id)}
                  </span>
                </div>
                
                {/* 予約履歴リンク */}
                {(() => {
                  const history = getReservationHistory(result.id);
                  if (history.length === 0) return null;
                  
                  return (
                    <div style={{ 
                      marginTop: '6px', 
                      fontSize: '11px', 
                      color: '#666',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px'
                    }}>
                      <span style={{ fontWeight: 'bold' }}>予約:</span>
                      {history.map((res, idx) => (
                        <a
                          key={idx}
                          href={`#${res.date}-${res.time}-${res.col}`}
                          onClick={(e) => {
                            e.preventDefault();
                            
                            // 日付を変更
                            const dateInput = document.querySelector('input[type="date"]');
                            
                            if (dateInput) {
                              // Reactのネイティブ値設定（より確実な方法）
                              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                window.HTMLInputElement.prototype,
                                'value'
                              ).set;
                              nativeInputValueSetter.call(dateInput, res.date);
                              
                              // Reactのイベントを発火
                              const inputEvent = new Event('input', { bubbles: true });
                              dateInput.dispatchEvent(inputEvent);
                            }
                            
                            // リトライ機能付きでセルを探す
                            const targetId = `${res.date}-${res.time}-${res.col}`;
                            let retryCount = 0;
                            const maxRetries = 20;
                            
                            const findAndFocus = () => {
                              retryCount++;
                              const targetCell = document.getElementById(targetId);
                              
                              if (targetCell) {
                                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                
                                const input = targetCell.querySelector('input');
                                if (input) {
                                  input.focus();
                                  input.select();
                                }
                              } else if (retryCount < maxRetries) {
                                setTimeout(() => requestAnimationFrame(findAndFocus), 50);
                              }
                            };
                            
                            setTimeout(findAndFocus, 200);
                          }}
                          style={{
                            color: '#2196F3',
                            textDecoration: 'none',
                            padding: '2px 6px',
                            backgroundColor: '#E3F2FD',
                            borderRadius: '3px',
                            fontWeight: 'bold'
                          }}
                        >
                          {res.date.slice(5)} {res.time}
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => handleCopyId(result.id)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: copiedId === result.id ? '#4CAF50' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minWidth: '70px',
                }}
              >
                {copiedId === result.id ? '✓ コピー済' : '📋 コピー'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showResults && searchResults.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
          該当する顧客が見つかりませんでした
        </div>
      )}

      {!showResults && searchTerm !== '' && searchTerm.trim().length === 1 && !/[\u4e00-\u9faf]/.test(searchTerm) && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
          もう1文字入力してください（漢字は1文字でもOK）
        </div>
      )}

      {!showResults && searchTerm === '' && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
          名前やふりがなを入力して検索してください
        </div>
      )}
      
      {/* リサイズハンドル（右下の角） */}
      <div
        onMouseDown={handleResizeMouseDown}
        onTouchStart={handleResizeTouchStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '24px',
          height: '24px',
          cursor: 'nwse-resize',
          backgroundColor: '#2196F3',
          borderBottomRightRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          userSelect: 'none',
          touchAction: 'none',
        }}
        title="ドラッグしてリサイズ"
      >
        ⋰
      </div>
    </div>
  );
};