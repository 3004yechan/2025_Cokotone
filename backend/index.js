// Nodejs & Express & MongoDB 를 활용한 백엔드 서버 구축

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware 설정
app.use(cors()); // CORS 허용 (확장 프로그램에서 오는 요청을 받기 위해)
app.use(express.json()); // JSON 요청 본문을 파싱하기 위해

// --- 데이터베이스 연결 ---
mongoose.connect('mongodb://localhost:27017/web-helper')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error(err));

// --- 데이터베이스 스키마 및 모델 정의 ---
const analysisSchema = new mongoose.Schema({
  imageUrl: String,
  generatedAltText: String,
  createdAt: { type: Date, default: Date.now }
});
const Analysis = mongoose.model('Analysis', analysisSchema);


// --- API 엔드포인트 정의 ---
app.get('/', (req, res) => {
  res.send('AI 웹 도우미 백엔드 서버입니다.');
});

// 클라이언트(확장프로그램)로부터 이미지 분석 요청을 받는 엔드포인트
app.post('/analyze-image', async (req, res) => {
  const { imageUrl, pageContext } = req.body;

  console.log('Received image for analysis:', imageUrl);

  try {
    // (여기에 외부 AI API 호출 로직이 들어갑니다)
    // 예: const generatedText = await callToOpenAI(imageUrl, pageContext);
    
    // 지금은 가짜 응답을 생성합니다.
    const fakeGeneratedText = `"${imageUrl}"을 설명하는 AI 생성 텍스트`;

    // --- 데이터베이스에 분석 결과 저장 ---
    const newAnalysis = new Analysis({
      imageUrl: imageUrl,
      generatedAltText: fakeGeneratedText
    });
    await newAnalysis.save();
    console.log('💾 Analysis saved to DB');

    // 클라이언트에 결과 전송
    res.json({ altText: fakeGeneratedText });

  } catch (error) {
    console.error('Error during AI analysis:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});


// --- 서버 실행 ---
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});