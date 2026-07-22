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

  let currentNewsContext = null; // 뉴스 상태 저장용 전역 변수
  let chatHistory = []; // 멀티턴 대화 기록 저장용 전역 변수

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

      // 2. 상황에 따른 System Instruction 동적 조립
      let systemPrompt = "당신은 친절한 AI 관광 및 일상 비서 'TourAgent'입니다.\n사용자가 한국어로 물으면 한국어로, 영어로 물으면 영어로 대답하세요.\n음성 비서이므로 안내 데스크 직원이나 라디오 아나운서처럼 자연스러운 구어체로 2~3문장 이내로 짧고 명확하게 대답하세요.\n절대 '*', '#', 이모지, 이모티콘 등 읽을 수 없는 특수기호나 마크다운 서식을 사용하지 마세요.\n\n";
      
      // 사용자가 뉴스를 선택하는 표현을 썼는지 검사 (정규식: 첫 번째, 두 번째, 1번, 2번 등)
      const isSelection = question.match(/(첫|두|세|1|2|3|일|이|삼)[\s]*(번째|번)/) || question.includes("자세히") || question.includes("그 뉴스");

      // Case B: 뉴스 컨텍스트가 유지되고 있고, 사용자가 특정 뉴스를 선택한 경우
      if (currentNewsContext && currentNewsContext.length > 0 && !matchedSpot && isSelection) {
        const ordinalPrefixes = ["첫 번째", "두 번째", "세 번째"];
        systemPrompt += `[방금 사용자에게 안내한 뉴스 목록]\n`;
        currentNewsContext.forEach((item, idx) => {
          const prefix = ordinalPrefixes[idx] || `${idx + 1}번째`;
          systemPrompt += `${prefix} 뉴스\n- 제목: ${item.speakableTitle}\n- 상세내용: ${item.detailedSummary}\n\n`;
        });
        systemPrompt += `[지시사항]\n사용자의 최근 질문이 위 3개의 뉴스 중 특정 뉴스를 선택하는 것이라면, 해당 뉴스의 '상세내용'을 아나운서처럼 자연스럽고 친절하게 읽어주세요. (제목은 이미 안내했으니 상세내용 위주로 풀어주세요)\n만약 사용자가 전혀 상관없는 질문을 했다면 뉴스 목록은 무시하고 질문에 알맞게 대답하세요.`;
      }
      // Case A: 명시적인 새로운 뉴스 요청 ("뉴스 알려줘" 등)
      else if (question.includes("뉴스") && !matchedSpot) {
        try {
          const datesRes = await fetch('https://kjwtuat.github.io/tinynews/data/index.json');
          if (!datesRes.ok) throw new Error("날짜 정보를 가져올 수 없습니다.");
          const dates = await datesRes.json();
          
          if (dates.length > 0) {
            const newsRes = await fetch(`https://kjwtuat.github.io/tinynews/data/${dates[0]}.json`);
            if (!newsRes.ok) throw new Error("뉴스 데이터를 가져올 수 없습니다.");
            const newsItems = await newsRes.json();
            
            // 상위 3개 뉴스만 컨텍스트에 저장
            currentNewsContext = newsItems.slice(0, 3);
            
            const ordinalPrefixes = ["첫 번째", "두 번째", "세 번째"];
            systemPrompt += `[오늘의 주요 뉴스 제목 (최신 데이터)]\n`;
            currentNewsContext.forEach((item, idx) => {
              const prefix = ordinalPrefixes[idx] || `${idx + 1}번째`;
              systemPrompt += `${prefix} 소식입니다. ${item.speakableTitle}\n`;
            });
            systemPrompt += `\n[지시사항]\n위 주요 뉴스 제목들을 첫 번째, 두 번째, 세 번째 소식 순서대로 아나운서처럼 자연스럽게 브리핑해주고, 마지막에 "자세히 듣고 싶은 뉴스가 있다면 '첫 번째', '두 번째' 등 순서나 제목을 말씀해 주세요."라고 덧붙이세요. 뉴스의 세부 내용은 아직 절대 말하지 마세요.`;
          } else {
            systemPrompt += "현재 등록된 뉴스가 없습니다. 이 상황을 사용자에게 자연스럽게 설명해주세요.";
            currentNewsContext = null;
          }
        } catch (error) {
          console.error("뉴스 Fetch 에러:", error);
          systemPrompt += "뉴스 서버에 접속하는 중 오류가 발생했습니다. 이 상황을 사용자에게 자연스럽게 설명해주세요.";
          currentNewsContext = null;
        }
      }
      // Case C: 관광지가 매칭되었거나 일반 대화인 경우
      else {
        currentNewsContext = null; // 뉴스가 아닌 다른 화제이므로 뉴스 컨텍스트 초기화
        if (matchedSpot) {
          systemPrompt += `[관광지 공식 참고 자료]\n`;
          systemPrompt += `이름: ${matchedSpot.name}\n`;
          systemPrompt += `한국어 소개: ${matchedSpot.descKo}\n`;
          systemPrompt += `영어 소개: ${matchedSpot.descEn}\n\n`;
          systemPrompt += `[지시사항]\n위 [관광지 공식 참고 자료]를 최우선으로 바탕으로 사용자의 질문에 대답하세요.\n자료에 없는 내용이라면 일반 지식으로 자연스럽게 대답하세요.`;
        } else {
          systemPrompt += "[지시사항]\n사용자의 질문에 친절하게 2~3문장 이내로 짧게 대답해주세요.";
        }
      }

      // 대화 기록에 사용자 질문 추가
      chatHistory.push({ role: "user", parts: [{ text: question }] });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: chatHistory
        })
      });

      if (!response.ok) throw new Error('API 호출 실패');
      
      const data = await response.json();
      const rawAnswer = data.candidates[0].content.parts[0].text;
      
      // 대화 기록에 AI 답변 추가
      chatHistory.push({ role: "model", parts: [{ text: rawAnswer }] });
      
      // 대화 기록 길이 제한 (최대 20개 = 10턴 유지)
      if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
      }
      
      // 시각적, 청각적 깔끔함을 위해 불필요한 마크다운 특수기호(*, #) 및 이모지 강제 제거
      const answer = rawAnswer.replace(/[*\#]/g, '').trim();

      responseText.textContent = answer;
      speakText(answer); // 응답을 음성으로 출력
    } catch (error) {
      console.error(error);
      responseText.textContent = "답변을 가져오는 중 오류가 발생했습니다. API Key를 확인해 주세요.";
      // API 실패 시 턴이 꼬이지 않도록 마지막 사용자 질문 롤백
      if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
        chatHistory.pop();
      }
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
