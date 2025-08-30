// popup.js로부터 메시지를 받으면 실행
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
      // 1. alt 속성이 없는 첫 번째 이미지를 찾는다.
      const image = document.querySelector('img:not([alt]), img[alt=""]');
      
      if (image) {
        const imageUrl = image.src;
        console.log('Found image:', imageUrl);
  
        // 2. 백엔드 서버에 분석 요청을 보낸다.
        fetch('http://localhost:3000/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            imageUrl: imageUrl,
            pageContext: document.body.innerText.slice(0, 2000) // 페이지 텍스트 일부를 컨텍스트로 제공
          }),
        })
        .then(response => response.json())
        .then(data => {
          console.log('AI Response:', data.altText);
          // 3. AI가 생성한 텍스트를 이미지의 alt 속성에 추가
          image.alt = data.altText;
          alert('이미지 분석 완료: ' + data.altText);
        })
        .catch(error => console.error('Error:', error));
      } else {
        alert('분석할 이미지를 찾을 수 없습니다.');
      }
    }
  });