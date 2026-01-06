const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 設定
const RESERVATION_URL = 'http://192.168.0.59:3000';
const BACKUP_BASE_DIR = 'C:\\Users\\kawak\\OneDrive\\ドキュメント\\予約表PDFバックアップ'; // バックアップ先（変更可能）
const GENERATE_MONTHLY = true; // 月初に1ヶ月分を生成するか

// 日付フォーマット
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// フォルダ作成
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// 当日のPDFを保存
async function saveDailyPDF() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  // 保存先フォルダ
  const yearDir = path.join(BACKUP_BASE_DIR, `${year}年`);
  const monthDir = path.join(yearDir, `${month}月`);
  ensureDir(monthDir);
  
  const fileName = `予約表_${year}年${month}月${day}日.pdf`;
  const filePath = path.join(monthDir, fileName);
  
  console.log(`📅 ${year}/${month}/${day}の予約表PDFを生成中...`);
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 予約表ページを開く
    await page.goto(RESERVATION_URL, { waitUntil: 'networkidle0' });
    
    // 日付を今日に設定（必要に応じて）
    // ここでは既に今日の日付が選択されていると仮定
    
    // 印刷用ページを生成するボタンをクリック
    // 実際のセレクタに合わせて調整が必要
    await page.evaluate(() => {
      // MonthlyPdfExportコンポーネントの当日分ボタンをクリック
      const buttons = Array.from(document.querySelectorAll('button'));
      const targetButton = buttons.find(btn => btn.textContent.includes('印刷用ページを開く'));
      if (targetButton) {
        targetButton.click();
      }
    });
    
    // 新しいページが開くのを待つ
    await page.waitForTimeout(2000);
    
    // 開かれたページを取得
    const pages = await browser.pages();
    const printPage = pages[pages.length - 1];
    
    // PDFとして保存
    await printPage.pdf({
      path: filePath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });
    
    await browser.close();
    
    console.log(`✅ PDF保存完了: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ PDF生成エラー:', error);
    throw error;
  }
}

// 1ヶ月分のPDFを保存（月初のみ）
async function saveMonthlyPDF() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  // 月初（1日）のみ実行
  if (today.getDate() !== 1 || !GENERATE_MONTHLY) {
    return null;
  }
  
  const yearDir = path.join(BACKUP_BASE_DIR, `${year}年`);
  ensureDir(yearDir);
  
  const fileName = `予約表_${year}年${month}月_全日.pdf`;
  const filePath = path.join(yearDir, fileName);
  
  console.log(`📅 ${year}年${month}月の1ヶ月分PDFを生成中...`);
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(RESERVATION_URL, { waitUntil: 'networkidle0' });
    
    // 年・月を設定して1ヶ月分ボタンをクリック
    await page.evaluate((y, m) => {
      // 年選択
      const yearSelect = Array.from(document.querySelectorAll('select')).find(s => 
        Array.from(s.options).some(opt => opt.text.includes('年'))
      );
      if (yearSelect) yearSelect.value = y;
      
      // 月選択
      const monthSelect = Array.from(document.querySelectorAll('select')).find(s => 
        Array.from(s.options).some(opt => opt.text.includes('月') && !opt.text.includes('年'))
      );
      if (monthSelect) monthSelect.value = m;
      
      // 1ヶ月分ボタンをクリック
      const buttons = Array.from(document.querySelectorAll('button'));
      const targetButton = buttons.find(btn => btn.textContent.includes('1ヶ月分を開く'));
      if (targetButton) {
        targetButton.click();
      }
    }, year, parseInt(month));
    
    await page.waitForTimeout(3000);
    
    const pages = await browser.pages();
    const printPage = pages[pages.length - 1];
    
    await printPage.pdf({
      path: filePath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });
    
    await browser.close();
    
    console.log(`✅ 1ヶ月分PDF保存完了: ${filePath}`);
    return filePath;
    
  } catch (error) {
    console.error('❌ 1ヶ月分PDF生成エラー:', error);
    throw error;
  }
}

// メイン実行
async function main() {
  console.log('========================================');
  console.log('予約表PDF自動バックアップ開始');
  console.log('========================================');
  console.log('実行日時:', new Date().toLocaleString('ja-JP'));
  console.log('バックアップ先:', BACKUP_BASE_DIR);
  console.log('');
  
  try {
    // 当日分を保存
    const dailyPath = await saveDailyPDF();
    console.log('');
    
    // 月初なら1ヶ月分も保存
    const monthlyPath = await saveMonthlyPDF();
    
    console.log('');
    console.log('========================================');
    console.log('✅ バックアップ完了');
    console.log('========================================');
    
    if (dailyPath) console.log('当日分:', dailyPath);
    if (monthlyPath) console.log('1ヶ月分:', monthlyPath);
    
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('❌ バックアップ失敗');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main();
}

module.exports = { saveDailyPDF, saveMonthlyPDF };