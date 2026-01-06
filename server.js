// server.js - 完全版
// npm install express cors body-parser nodemailer dotenv で依存関係をインストール

require('dotenv').config(); // 環境変数を読み込み

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 5000; // ネット予約システム用ポート

// バックアップ先フォルダ
const BACKUP_BASE_DIR = 'C:\\Users\\kawak\\OneDrive\\ドキュメント\\予約表PDFバックアップ';

// CORS 設定
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb', type: 'text/html' }));

// 静的ファイル配信（ネット予約ページ用）
app.use('/booking', express.static(path.join(__dirname, 'public/booking')));
app.use(express.static(path.join(__dirname, 'public')));

// データファイル
const dataFile = path.join(__dirname, 'data.json');
const customerDbFile = path.join(__dirname, './src/customerDatabase.js');
const staffHolidaysFile = path.join(__dirname, 'staffHolidays.json'); // ← 追加

// 📧 メール送信設定
// GMAIL使用の場合: Googleアカウント設定で「アプリパスワード」を生成してください
// https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
  service: 'gmail', // Gmail以外の場合は変更（例: 'yahoo', 'outlook'）
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com', // 環境変数または直接指定
    pass: process.env.EMAIL_PASS || 'your-app-password'     // Gmailアプリパスワード
  }
});

// メール送信関数
async function sendEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: to,
      subject: subject,
      text: text,
      html: text.replace(/\n/g, '<br>') // 改行をHTMLに変換
    });
    console.log('✅ メール送信成功:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ メール送信エラー:', error);
    return false;
  }
}

// ファイルから読み込み
const readData = () => {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('読み込みエラー:', error);
  }
  return {};
};

// ファイルに書き込み
const writeData = (data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ [' + new Date().toLocaleTimeString('ja-JP') + '] データを保存しました');
    return true;
  } catch (error) {
    console.error('❌ 書き込みエラー:', error);
    return false;
  }
};

// スタッフ休み情報を読み込み ← 追加
const readStaffHolidays = () => {
  console.log('📁 スタッフ休み読み込み: ファイルパス =', staffHolidaysFile);
  console.log('📁 ファイル存在チェック:', fs.existsSync(staffHolidaysFile) ? 'あり ✅' : 'なし ⚠️');
  
  try {
    if (fs.existsSync(staffHolidaysFile)) {
      const data = fs.readFileSync(staffHolidaysFile, 'utf-8');
      const parsed = JSON.parse(data);
      const count = Object.keys(parsed).length;
      console.log(`✅ スタッフ休み読み込み成功: ${count}日分`);
      if (count > 0) {
        console.log('📊 最初の3日:', Object.keys(parsed).slice(0, 3).join(', '));
      }
      return parsed;
    } else {
      console.warn('⚠️ staffHolidays.json ファイルが存在しません');
      console.warn('💡 初回アクセス、またはファイルが削除された可能性があります');
      console.warn('💡 CSVをアップロードすると自動的に作成されます');
    }
  } catch (error) {
    console.error('❌ スタッフ休み読み込みエラー:', error);
    console.error('📍 エラー詳細:', error.message);
  }
  
  console.log('📦 空のオブジェクトを返します');
  return {};
};

// スタッフ休み情報を保存 ← 追加
const writeStaffHolidays = (holidays) => {
  try {
    const count = Object.keys(holidays).length;
    console.log(`💾 スタッフ休み保存開始: ${count}日分`);
    console.log('📁 保存先:', staffHolidaysFile);
    
    fs.writeFileSync(staffHolidaysFile, JSON.stringify(holidays, null, 2), 'utf-8');
    
    console.log('✅ [' + new Date().toLocaleTimeString('ja-JP') + '] スタッフ休み情報を保存しました');
    console.log('📊 保存した日付:', Object.keys(holidays).slice(0, 5).join(', '), count > 5 ? '...' : '');
    return true;
  } catch (error) {
    console.error('❌ スタッフ休み書き込みエラー:', error);
    console.error('📍 エラー詳細:', error.message);
    return false;
  }
};

// customerDatabase.js を読み込み
const readCustomerDatabase = () => {
  try {
    if (fs.existsSync(customerDbFile)) {
      const content = fs.readFileSync(customerDbFile, 'utf-8');
      // export const customerDatabase = {...}; の形式から抽出
      const match = content.match(/export const customerDatabase = ({[\s\S]*});/);
      if (match) {
        return JSON.parse(match[1]);
      }
    }
  } catch (error) {
    console.error('❌ 顧客DB読み込みエラー:', error);
  }
  return {};
};

// customerDatabase.js に書き込み
const writeCustomerDatabase = (database) => {
  try {
    let content = '// customerDatabase.js\n';
    content += '// 顧客データベース\n\n';
    content += 'export const customerDatabase = ';
    content += JSON.stringify(database, null, 2);
    content += ';\n\n';
    content += 'export default customerDatabase;';
    
    fs.writeFileSync(customerDbFile, content, 'utf-8');
    console.log('✅ [' + new Date().toLocaleTimeString('ja-JP') + '] customerDatabase.js を更新しました');
    return true;
  } catch (error) {
    console.error('❌ customerDatabase.js 書き込みエラー:', error);
    return false;
  }
};

// API: 全データを取得
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// API: データを保存
app.post('/api/data', (req, res) => {
  const data = req.body;
  const success = writeData(data);
  res.json({ success });
});

// API: 顧客データベースを保存
app.post('/api/customer-db', (req, res) => {
  const database = req.body;
  const success = writeCustomerDatabase(database);
  res.json({ success });
});

// API: 顧客ログイン
app.post('/api/customer/login', (req, res) => {
  console.log('📡 POST /api/customer/login - ログインリクエスト');
  const { customerId, password } = req.body;
  
  try {
    const customerDb = readCustomerDatabase();
    const customer = customerDb[customerId];
    
    if (!customer) {
      return res.json({ success: false, message: '顧客IDが見つかりません' });
    }
    
    if (!customer.password) {
      return res.json({ success: false, message: 'パスワードが未設定です' });
    }
    
    if (customer.password !== password) {
      return res.json({ success: false, message: 'パスワードが正しくありません' });
    }
    
    // ログイン成功
    res.json({
      success: true,
      customer: {
        id: customerId,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        gender: customer.gender || '',
        age: customer.age || ''
      }
    });
  } catch (error) {
    console.error('❌ ログインエラー:', error);
    res.json({ success: false, message: 'サーバーエラー' });
  }
});

// API: パスワード設定
app.post('/api/customer/set-password', (req, res) => {
  console.log('📡 POST /api/customer/set-password - パスワード設定リクエスト');
  const { customerId, password } = req.body;
  
  try {
    const customerDb = readCustomerDatabase();
    
    if (!customerDb[customerId]) {
      return res.json({ success: false, message: '顧客IDが見つかりません' });
    }
    
    // パスワードを設定
    customerDb[customerId].password = password;
    
    const success = writeCustomerDatabase(customerDb);
    
    if (success) {
      res.json({ success: true, message: 'パスワードを設定しました' });
    } else {
      res.json({ success: false, message: '保存に失敗しました' });
    }
  } catch (error) {
    console.error('❌ パスワード設定エラー:', error);
    res.json({ success: false, message: 'サーバーエラー' });
  }
});

// API: 認証URL送信（パスワード登録 + 予約）
app.post('/api/customer/send-verification', async (req, res) => {
  console.log('📡 POST /api/customer/send-verification - 認証URL送信リクエスト');
  const { customerId, password, method, email, phone, bookingData } = req.body;
  
  try {
    const customerDb = readCustomerDatabase();
    
    if (!customerDb[customerId]) {
      return res.json({ success: false, message: '顧客IDが見つかりません' });
    }
    
    // 認証トークン生成（ランダム文字列）
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // 認証URLを生成
    const verificationUrl = `http://localhost:5000/verify?token=${token}`;
    
    // 仮予約データを保存（トークンで紐付け）
    const pendingVerifications = {};
    const verificationsFile = path.join(__dirname, 'pendingVerifications.json');
    
    if (fs.existsSync(verificationsFile)) {
      const data = fs.readFileSync(verificationsFile, 'utf-8');
      Object.assign(pendingVerifications, JSON.parse(data));
    }
    
    pendingVerifications[token] = {
      customerId,
      password,
      email: method === 'email' ? email : null,
      phone: method === 'sms' ? phone : null,
      bookingData,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間有効
    };
    
    fs.writeFileSync(verificationsFile, JSON.stringify(pendingVerifications, null, 2), 'utf-8');
    
    // メール/SMS送信（実際の実装では SendGrid や Twilio を使用）
    console.log('📧 認証URL送信:');
    console.log(`   方法: ${method}`);
    console.log(`   宛先: ${method === 'email' ? email : phone}`);
    console.log(`   URL: ${verificationUrl}`);
    console.log(`   予約: ${bookingData.date} ${bookingData.time}`);
    
    // 🔧 実際のメール/SMS送信処理
    let sendSuccess = false;
    if (method === 'email') {
      const emailSubject = '【リハキュア】ネット予約の確認';
      const emailBody = `
ネット予約をありがとうございます。

以下のURLをクリックして予約を確定してください:
${verificationUrl}

【予約内容】
日時: ${bookingData.date} ${bookingData.time}
顧客ID: ${customerId}

※このURLは24時間有効です
※このメールに心当たりがない場合は、URLをクリックせずに削除してください

リハキュア
      `.trim();
      
      sendSuccess = await sendEmail(email, emailSubject, emailBody);
    } else {
      // SMS送信（Twilio等のサービスが必要）
      console.log('⚠️ SMS送信は未実装です。Twilioなどのサービスを利用してください。');
      // sendSuccess = await sendSMS(phone, `ネット予約の確認: ${verificationUrl}`);
    }
    
    res.json({ 
      success: true, 
      message: sendSuccess ? '認証URLを送信しました' : '認証URLの送信に失敗しました（コンソールを確認してください）',
      // 開発用（本番では削除推奨）
      verificationUrl
    });
  } catch (error) {
    console.error('❌ 認証URL送信エラー:', error);
    res.json({ success: false, message: 'サーバーエラー' });
  }
});

// API: 認証URL確認（URLクリック時）
app.get('/verify', (req, res) => {
  const { token } = req.query;
  
  try {
    const verificationsFile = path.join(__dirname, 'pendingVerifications.json');
    
    if (!fs.existsSync(verificationsFile)) {
      return res.send('<h1>❌ 認証エラー</h1><p>認証情報が見つかりません</p>');
    }
    
    const pendingVerifications = JSON.parse(fs.readFileSync(verificationsFile, 'utf-8'));
    const verification = pendingVerifications[token];
    
    if (!verification) {
      return res.send('<h1>❌ 認証エラー</h1><p>無効なトークンです</p>');
    }
    
    // 有効期限チェック
    if (new Date() > new Date(verification.expiresAt)) {
      return res.send('<h1>❌ 認証エラー</h1><p>認証URLの有効期限が切れています</p>');
    }
    
    // パスワード設定
    const customerDb = readCustomerDatabase();
    customerDb[verification.customerId].password = verification.password;
    
    // メール/電話番号更新
    if (verification.email) {
      customerDb[verification.customerId].email = verification.email;
    }
    if (verification.phone) {
      customerDb[verification.customerId].phone = verification.phone;
    }
    
    writeCustomerDatabase(customerDb);
    
    // 予約を確定（webBookings.jsonに追加）
    const webBookingsFile = path.join(__dirname, 'webBookings.json');
    let bookings = [];
    
    if (fs.existsSync(webBookingsFile)) {
      const data = fs.readFileSync(webBookingsFile, 'utf-8');
      bookings = JSON.parse(data);
    }
    
    const bookingData = {
      ...verification.bookingData,
      id: verification.customerId,
      name: customerDb[verification.customerId].name,
      phone: verification.phone || customerDb[verification.customerId].phone || '',
      email: verification.email || customerDb[verification.customerId].email || '',
      treatment: verification.bookingData.treatment, // フロントから送信されたtreatment
      isNewPatient: verification.bookingData.treatment?.startsWith('new_patient'), // new_patient_body or new_patient_facialなら新規
      bookingDate: new Date().toISOString(),
      source: 'web'
    };
    
    bookings.push(bookingData);
    fs.writeFileSync(webBookingsFile, JSON.stringify(bookings, null, 2), 'utf-8');
    
    // トークンを削除
    delete pendingVerifications[token];
    fs.writeFileSync(verificationsFile, JSON.stringify(pendingVerifications, null, 2), 'utf-8');
    
    console.log('✅ 認証完了 & 予約確定:', verification.customerId);
    
    res.send(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>予約完了</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 8px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #4CAF50; }
            .info { background: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ 予約が完了しました！</h1>
            <div class="info">
              <p><strong>予約日時:</strong><br/>${bookingData.date} ${bookingData.time}</p>
              <p><strong>顧客ID:</strong> ${verification.customerId}</p>
            </div>
            <p>次回からは顧客IDとパスワードでログインできます。</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">このウィンドウを閉じてください</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ 認証処理エラー:', error);
    res.send('<h1>❌ エラー</h1><p>認証処理中にエラーが発生しました</p>');
  }
});

// API: スタッフ休み情報を取得 ← 追加
app.get('/api/staff-holidays', (req, res) => {
  console.log('📡 GET /api/staff-holidays - リクエスト受信');
  const holidays = readStaffHolidays();
  console.log('📤 レスポンス送信:', Object.keys(holidays).length, '日分');
  res.json(holidays);
});

// API: スタッフ休み情報を保存 ← 追加
app.post('/api/staff-holidays', (req, res) => {
  console.log('📡 POST /api/staff-holidays - リクエスト受信');
  const holidays = req.body;
  const count = Object.keys(holidays).length;
  console.log('📥 受信データ:', count, '日分');
  const success = writeStaffHolidays(holidays);
  console.log('📤 レスポンス送信:', success ? 'success: true' : 'success: false');
  res.json({ success });
});

// 自動PDF保存API
app.post('/api/auto-save-pdf', async (req, res) => {
  try {
    const { date, htmlContent } = req.body;
    
    if (!date || !htmlContent) {
      return res.status(400).json({ error: 'date and htmlContent are required' });
    }
    
    // 日付解析
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    // 保存先フォルダ作成
    const yearDir = path.join(BACKUP_BASE_DIR, `${year}年`);
    const monthDir = path.join(yearDir, `${month}月`);
    
    if (!fs.existsSync(BACKUP_BASE_DIR)) {
      fs.mkdirSync(BACKUP_BASE_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
    
    // HTMLファイルとして保存
    const fileName = `予約表_${year}年${month}月${day}日.html`;
    const filePath = path.join(monthDir, fileName);
    
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    
    console.log(`✅ [${new Date().toLocaleTimeString('ja-JP')}] 自動保存完了: ${filePath}`);
    
    res.json({
      success: true,
      filePath: filePath,
      fileName: fileName,
      message: `PDF保存完了: ${fileName}`
    });
    
  } catch (error) {
    console.error('❌ 自動PDF保存エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 最終保存日時を取得
app.get('/api/last-pdf-save', (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const monthDir = path.join(BACKUP_BASE_DIR, `${year}年`, `${month}月`);
    const fileName = `予約表_${year}年${month}月${day}日.html`;
    const filePath = path.join(monthDir, fileName);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      res.json({
        exists: true,
        savedAt: stats.mtime,
        filePath: filePath,
        fileName: fileName
      });
    } else {
      res.json({
        exists: false
      });
    }
  } catch (error) {
    console.error('❌ チェックエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toLocaleString('ja-JP') });
});

// ========================================
// ネット予約API
// ========================================

// ネット予約データファイル
const webBookingsFile = path.join(__dirname, 'webBookings.json');

// ネット予約を保存
app.post('/api/web-bookings', (req, res) => {
  try {
    const booking = req.body;
    
    console.log('📥 ネット予約受信:', booking);
    
    // 既存のネット予約を読み込み
    let bookings = [];
    if (fs.existsSync(webBookingsFile)) {
      const data = fs.readFileSync(webBookingsFile, 'utf-8');
      bookings = JSON.parse(data);
    }
    
    // 新しい予約を追加
    bookings.push(booking);
    
    // ファイルに保存
    fs.writeFileSync(webBookingsFile, JSON.stringify(bookings, null, 2), 'utf-8');
    
    console.log('✅ ネット予約保存完了:', booking.id);
    
    // 顧客DBを更新（電話番号・メールを保存）
    if (booking.id && !booking.id.startsWith('WEB_')) {
      try {
        const customerDb = readCustomerDatabase();
        if (customerDb[booking.id]) {
          // 既存顧客の情報を更新
          if (booking.phone) customerDb[booking.id].phone = booking.phone;
          if (booking.email) customerDb[booking.id].email = booking.email;
          writeCustomerDatabase(customerDb);
          console.log(`✅ 顧客DB更新: ${booking.id}`);
        }
      } catch (error) {
        console.error('❌ 顧客DB更新エラー:', error);
      }
    }
    
    res.json({ 
      success: true, 
      message: '予約を受け付けました',
      bookingId: booking.id
    });
    
  } catch (error) {
    console.error('❌ ネット予約保存エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ネット予約一覧を取得
app.get('/api/web-bookings', (req, res) => {
  try {
    let bookings = [];
    
    if (fs.existsSync(webBookingsFile)) {
      const data = fs.readFileSync(webBookingsFile, 'utf-8');
      bookings = JSON.parse(data);
    }
    
    console.log('📤 ネット予約送信:', bookings.length, '件');
    
    res.json({ 
      success: true, 
      bookings: bookings 
    });
    
  } catch (error) {
    console.error('❌ ネット予約取得エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ネット予約を削除
app.delete('/api/web-bookings/:id', (req, res) => {
  try {
    const bookingId = req.params.id;
    
    let bookings = [];
    if (fs.existsSync(webBookingsFile)) {
      const data = fs.readFileSync(webBookingsFile, 'utf-8');
      bookings = JSON.parse(data);
    }
    
    // 指定されたIDの予約を削除
    const filteredBookings = bookings.filter(b => b.id !== bookingId);
    
    // ファイルに保存
    fs.writeFileSync(webBookingsFile, JSON.stringify(filteredBookings, null, 2), 'utf-8');
    
    console.log('🗑️ ネット予約削除:', bookingId);
    
    res.json({ 
      success: true, 
      message: '予約を削除しました' 
    });
    
  } catch (error) {
    console.error('❌ ネット予約削除エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   📊 予約表管理サーバー 起動 🚀      ║
╠════════════════════════════════════════╣
║ サーバー: http://192.168.0.59:5000   ║
║ React:    http://192.168.0.59:3000   ║
║                                        ║
║ データファイルパス:                    ║
║ 📄 ${dataFile}
║ 📄 ${customerDbFile}
║ 📄 ${staffHolidaysFile}
║                                        ║
║ ファイル存在確認:                      ║
║ 📄 data.json: ${fs.existsSync(dataFile) ? '✅ あり' : '⚠️ なし'}
║ 📄 customerDatabase.js: ${fs.existsSync(customerDbFile) ? '✅ あり' : '⚠️ なし'}
║ 📄 staffHolidays.json: ${fs.existsSync(staffHolidaysFile) ? '✅ あり' : '⚠️ なし (初回起動時は正常)'}
║                                        ║
║ 機能一覧:                              ║
║ ✅ 予約データ保存・読込                ║
║ ✅ 顧客データベース保存                ║
║ ✅ スタッフ休み情報保存・読込          ║
║ ✅ 自動HTMLバックアップ                ║
╚════════════════════════════════════════╝
  `);
});