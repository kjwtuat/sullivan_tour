import { tourData } from './tourData.js';

const micBtn = document.getElementById('mic-btn');
const transcriptText = document.getElementById('transcript-text');
const transcriptBox = document.getElementById('transcript-box');
const responseBox = document.getElementById('response-box');
const responseText = document.getElementById('response-text');
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');

// API Key 관리
let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
if (geminiApiKey) {
  apiKeyInput.value = geminiApiKey;
}

saveKeyBtn.addEventListener('click', () => {
  geminiApiKey = apiKeyInput.value.trim();
  if (geminiApiKey) {
    localStorage.setItem('gemini_api_key', geminiApiKey);
    alert('API Key가 저장되었습니다.');
  } else {
    localStorage.removeItem('gemini_api_key');
    alert('API Key가 삭제되었습니다.');
  }
});

let audioCtx = null;

function playMicSound(isStart) {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'sine'; // 맑은 비프음
  const now = audioCtx.currentTime;
  
  if (isStart) {
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
  } else {
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
  }
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.02); // 볼륨을 0.1에서 0.4로 증가
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  
  osc.start(now);
  osc.stop(now + 0.2);
}

let loadingSoundInterval = null;

function startLoadingSound() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  // 0.4초 간격으로 물방울/생각하는 느낌의 가벼운 '톡' 소리 재생
  loadingSoundInterval = setInterval(() => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    const now = audioCtx.currentTime;
    
    // 맑고 경쾌한 방울(Ping) 소리
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01); // 선명한 볼륨
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2); // 맑은 여운을 위해 조금 길게
    
    osc.start(now);
    osc.stop(now + 0.2);
  }, 1000); // 1초 간격으로 변경
}

function stopLoadingSound() {
  if (loadingSoundInterval) {
    clearInterval(loadingSoundInterval);
    loadingSoundInterval = null;
  }
}

// Web Speech API 지원 확인
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  transcriptText.innerHTML = "죄송합니다. 현재 브라우저가 Web Speech API를 지원하지 않습니다.<br>Chrome 또는 Edge 브라우저를 사용해 주세요.";
  transcriptText.classList.remove('placeholder');
  transcriptText.style.color = '#ef4444'; // Error Red
  micBtn.disabled = true;
  micBtn.style.opacity = '0.5';
  micBtn.style.cursor = 'not-allowed';
} else {
  const recognition = new SpeechRecognition();
  recognition.continuous = false; // 말을 멈추면 자동으로 인식 종료 (자연스러운 질의응답)
  recognition.interimResults = true; // 실시간 중간 결과 반환
  recognition.lang = 'ko-KR'; // 한국어 설정 (원하는 경우 'en-US' 등 변경 가능)

  let isListening = false;
  let finalTranscript = '';

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    if (finalTranscript === '') {
      transcriptText.textContent = '듣고 있습니다...';
      transcriptText.classList.add('placeholder');
    }
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    transcriptText.classList.remove('placeholder');
    
    // 최종 텍스트와 실시간 텍스트를 함께 표시
    if (finalTranscript || interimTranscript) {
      transcriptText.innerHTML = 
        `<span>${finalTranscript}</span>` + 
        `<span class="interim-text">${interimTranscript}</span>`;
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    if (event.error === 'not-allowed') {
      transcriptText.textContent = "마이크 접근이 거부되었습니다. 권한을 허용해 주세요.";
      transcriptText.style.color = '#ef4444';
    }
    isListening = false;
    micBtn.classList.remove('listening');
  };

  // 모바일 기기 감지 (User-Agent 기반)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // TTS (Text-to-Speech) 함수
  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 기존 재생 중인 음성 취소
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    
    // PC와 스마트폰의 기본 TTS 엔진 속도 해석이 다르므로 분기 처리
    if (isMobile) {
      utterance.rate = 1.2; // 스마트폰은 엔진 특성상 기본 속도가 빨라서 1.2로 하향
    } else {
      utterance.rate = 1.8; // PC는 1.8배속
    }
    
    window.speechSynthesis.speak(utterance);
  }

  // Gemini API 호출 함수
  async function askGemini(question) {
    if (!geminiApiKey) {
      responseText.textContent = "Gemini API Key를 먼저 상단에 입력하고 저장해 주세요.";
      responseBox.style.display = 'flex';
      return;
    }

    micBtn.classList.add('loading'); // 마이크 버튼 로딩 애니메이션
    startLoadingSound(); // 대기 효과음 시작
    responseText.textContent = "Gemini가 답변을 생각하는 중입니다...";
    responseBox.style.display = 'flex';

    try {
      // 1. 사용자 질문에서 유적지 이름 검색 (RAG 로직 향상)
      let matchedSpot = null;
      let matchedLength = 0;

      for (const spot of tourData) {
        // A. 괄호를 제외한 핵심 이름 덩어리가 통째로 포함된 경우 ("불국사 석축")
        const cleanName = spot.name.replace(/\([^)]*\)/g, '').trim(); 
        if (cleanName.length >= 2 && question.includes(cleanName)) {
          if (cleanName.length > matchedLength) {
            matchedSpot = spot;
            matchedLength = cleanName.length;
          }
        }
        
        // B. 띄어쓰기나 괄호로 구분된 개별 단어가 포함된 경우 ("청운교", "백운교", "목어")
        const words = spot.name.split(/[\s(),/]+/).filter(w => w.trim().length >= 2);
        for (const word of words) {
          const keyword = word.trim();
          // 일반적인 단어(예: '및', '경주' 등) 필터링 생략: 관광지에 특화된 데이터이므로 단어가 매칭되면 우선 사용
          if (question.includes(keyword)) {
            if (keyword.length > matchedLength) {
              matchedSpot = spot;
              matchedLength = keyword.length;
            }
          }
        }
      }

      // 2. 프롬프트 동적 조립
      let prompt = "";
      if (matchedSpot) {
        prompt += `[관광지 공식 참고 자료]\n`;
        prompt += `이름: ${matchedSpot.name}\n`;
        prompt += `한국어 소개: ${matchedSpot.descKo}\n`;
        prompt += `영어 소개: ${matchedSpot.descEn}\n\n`;
        prompt += `[사용자 질문]\n${question}\n\n`;
        prompt += `[지시사항]\n`;
        prompt += `위 [관광지 공식 참고 자료]를 최우선으로 바탕으로 사용자의 질문에 대답해.\n`;
        prompt += `자료에 없는 내용이라면 일반 지식으로 자연스럽게 대답해.\n`;
        prompt += `사용자가 한국어로 물으면 한국어로, 영어로 물으면 영어로 대답하고, 음성 비서이므로 2~3문장 이내로 친절하게 말해.`;
      } else {
        // 일반 대화 프롬프트
        prompt = question + "\n(도우미로서 친절하게 2~3문장 이내로 짧게 대답해.)";
      }
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error('API 호출 실패');
      
      const data = await response.json();
      const answer = data.candidates[0].content.parts[0].text;
      
      responseText.textContent = answer;
      speakText(answer); // 응답을 음성으로 출력
    } catch (error) {
      console.error(error);
      responseText.textContent = "답변을 가져오는 중 오류가 발생했습니다. API Key를 확인해 주세요.";
    } finally {
      stopLoadingSound(); // 대기 효과음 종료
      micBtn.classList.remove('loading');
    }
  }

  recognition.onend = () => {
    if (isListening) {
      playMicSound(false); // 마이크 꺼짐 효과음 (침묵 감지로 인한 자동 종료 시에도 발생)
    }
    isListening = false;
    micBtn.classList.remove('listening');

    // 마이크 인식이 끝났고 인식된 텍스트가 있다면 Gemini에게 질문
    if (finalTranscript.trim() !== '') {
      askGemini(finalTranscript.trim());
    }
  };

  // 마이크 버튼 클릭 이벤트
  micBtn.addEventListener('click', () => {
    if (isListening) {
      // 듣고 있는 중이면 중지
      recognition.stop();
      if (!finalTranscript) {
        transcriptText.textContent = '마이크를 누르고 말씀해 주세요...';
        transcriptText.classList.add('placeholder');
      }
    } else {
      // 새로 시작
      if (window.speechSynthesis) window.speechSynthesis.cancel(); // 새로운 질문을 하면 기존 답변 읽던 것 중단
      stopLoadingSound(); // 혹시 로딩음이 실행 중이면 중단
      playMicSound(true); // 마이크 켜짐 효과음
      finalTranscript = ''; 
      transcriptText.textContent = '연결 중...';
      transcriptText.classList.add('placeholder');
      transcriptText.style.color = ''; // Reset error color if any
      responseBox.style.display = 'none'; // 답변 박스 숨김
      
      try {
        recognition.start();
      } catch(e) {
        // 이미 시작된 경우 방어
        console.error(e);
      }
    }
  });
}
