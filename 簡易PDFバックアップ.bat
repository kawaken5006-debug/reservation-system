@echo off
REM 予約表PDF簡易バックアップ
REM 予約システムとブラウザを開いて、手動でPDF保存を促す

echo ========================================
echo 予約表PDF バックアップ
echo ========================================
echo.
echo 1. ブラウザで予約システムを開きます...
echo 2. 「印刷用ページを開く」ボタンをクリックしてください
echo 3. PDFとして保存してください
echo.
echo 保存先フォルダを開きます...
echo.

REM 保存先フォルダを開く
start "" "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ"

REM 今日の日付でサブフォルダを作成
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
    set YEAR=%%a
    set MONTH=%%b
    set DAY=%%c
)

REM 年・月フォルダを作成
if not exist "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ\%YEAR%年" (
    mkdir "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ\%YEAR%年"
)

if not exist "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ\%YEAR%年\%MONTH%月" (
    mkdir "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ\%YEAR%年\%MONTH%月"
)

REM 今日の保存先フォルダを開く
start "" "C:\Users\kawak\OneDrive\ドキュメント\予約表PDFバックアップ\%YEAR%年\%MONTH%月"

REM 2秒待つ
timeout /t 2 /nobreak >nul

REM ブラウザで予約システムを開く
start "" "http://192.168.0.59:3000"

echo.
echo ========================================
echo 手順
echo ========================================
echo 1. ブラウザが開きます
echo 2. 画面を下にスクロール
echo 3. 「📄 印刷用ページを開く」をクリック
echo 4. 「🖨️ 印刷 / PDF保存」をクリック
echo 5. 「PDFに保存」を選択
echo 6. 開いたフォルダに保存
echo.
echo 推奨ファイル名: 予約表_%YEAR%年%MONTH%月%DAY%日.pdf
echo ========================================
echo.

pause
