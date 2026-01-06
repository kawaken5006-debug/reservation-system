@echo off
REM 予約表PDF自動バックアップスクリプト
REM 毎日実行してPDFを自動保存します

echo ========================================
echo 予約表PDF 自動バックアップ
echo ========================================
echo.

REM プロジェクトフォルダに移動（実際のパスに変更してください）
cd /d C:\Users\kawak\OneDrive\デスクトップ\reservation-system

REM Node.jsスクリプトを実行
node auto-pdf-backup.js

echo.
echo ========================================
echo バックアップ処理完了
echo ========================================
echo.

REM ログファイルに記録
echo %date% %time% - バックアップ実行 >> D:\予約表PDFバックアップ\backup_log.txt

pause
