const TOKEN_ENDPOINT = 'https://defaulte6c9ec0984304a99bf15242bc089b4.09.environment.api.powerplatform.com/powervirtualagents/botsbyschema/cr309_luckybickyagent/directline/token?api-version=2022-03-01-preview';
const BASE_URL = 'https://directline.botframework.com/v3/directline';

let currentToken = '';
let currentConversationId = '';
let isConversationStarted = false;

async function getNewTokenAndConversation() {
    try {
        if (isConversationStarted) return;

        const tokenResponse = await fetch(TOKEN_ENDPOINT);
        if (!tokenResponse.ok) throw new Error('토큰 받기 실패');
        
        const tokenData = await tokenResponse.json();
        currentToken = tokenData.token;

        const startConversationResponse = await fetch(`${BASE_URL}/conversations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });

        if (!startConversationResponse.ok) throw new Error('대화 시작 실패');

        const conversationData = await startConversationResponse.json();
        currentConversationId = conversationData.conversationId;
        isConversationStarted = true;
    } catch (error) {
        console.error('초기화 오류:', error);
    }
}

function cleanBotResponse(text) {
    // AI 경고 메시지 제거
    const cleanedText = text.replace(/\r\nAI가 생성한 콘텐츠는 올바르지 않을 수 있습니다$/, '');
    
    // 따옴표 안의 텍스트 추출 시도
    const match = cleanedText.match(/"([^"]+)"/);
    if (match && match[1]) {
        return match[1];
    }
    // 매칭되지 않으면 정제된 텍스트 반환
    return cleanedText;
}

async function getBotResponse() {
    try {
        console.log('봇 응답 대기 중...');
        
        for(let attempt = 0; attempt < 20; attempt++) {
            console.log(`\n=== 응답 확인 시도 ${attempt + 1}/20 ===`);
            await new Promise(resolve => setTimeout(resolve, 2000));

            const response = await fetch(`${BASE_URL}/conversations/${currentConversationId}/activities`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            if (!response.ok) throw new Error('봇 응답 받기 실패');

            const data = await response.json();
            
            // 1. 전체 대화 내역 출력
            console.log('\n1. 전체 대화 내역:');
            data.activities.forEach((msg, index) => {
                console.log(`대화 ${index + 1}:`, {
                    발신자: msg.from?.name || msg.from?.role || 'unknown',
                    메시지: msg.text,
                    타입: msg.type
                });
            });

            // 2. 봇 메시지만 필터링
            const botMessages = data.activities.filter(msg => {
                return msg.from?.role === 'bot' && 
                       msg.type === 'message' &&
                       msg.text;
            });

            if (botMessages.length > 0) {
                const lastBotMessage = botMessages[botMessages.length - 1];
                
                // 3. 번역 결과 처리
                console.log('\n2. 번역 결과:');
                console.log('- AI 응답 원문:', lastBotMessage.text);
                const cleanedText = cleanBotResponse(lastBotMessage.text);
                console.log('- 최종 번역문:', cleanedText);
                
                document.getElementById('englishOutput').textContent = cleanedText;
                return;
            }
            
            console.log('\n아직 번역 결과가 없습니다. 다시 확인합니다...');
        }

        console.log('\n번역 결과를 받지 못했습니다.');
        document.getElementById('englishOutput').textContent = '번역 결과를 받지 못했습니다.';
        
    } catch (error) {
        console.error('번역 처리 중 오류:', error);
        document.getElementById('englishOutput').textContent = '번역 중 오류가 발생했습니다.';
    }
}

async function translateText() {
    const koreanInput = document.getElementById('koreanInput').value.trim();
    if (!koreanInput) {
        console.log('입력된 텍스트가 없습니다.');
        return;
    }

    try {
        // 매 번역 요청마다 새로운 대화 시작
        isConversationStarted = false;
        console.log('새로운 대화 세션 시작...');
        await getNewTokenAndConversation();

        console.log('번역 요청:', koreanInput);

        const translationRequest = `"${koreanInput}" 내용을 영어로 번역해줘`;
        
        const response = await fetch(`${BASE_URL}/conversations/${currentConversationId}/activities`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'message',
                from: { id: 'user' },
                text: translationRequest,
                locale: 'ko-KR',
                timestamp: new Date().toISOString(),
                channelId: 'directline'
            })
        });

        if (!response.ok) {
            console.error('메시지 전송 실패:', response.status);
            throw new Error('메시지 전송 실패');
        }

        console.log('번역 요청 전송 완료, 응답 대기 중...');
        await getBotResponse();

    } catch (error) {
        console.error('번역 처리 중 오류 발생:', error);
        document.getElementById('englishOutput').textContent = '번역 중 오류가 발생했습니다.';
        isConversationStarted = false;
    }
}

// DOM이 완전히 로드된 후에 이벤트 리스너를 설정
document.addEventListener('DOMContentLoaded', function() {
    getNewTokenAndConversation();
    
    const translateBtn = document.getElementById('translateBtn');
    const koreanInput = document.getElementById('koreanInput');
    
    if (translateBtn) {
        translateBtn.addEventListener('click', translateText);
    } else {
        console.error('번역 버튼을 찾을 수 없습니다.');
    }
    
    if (koreanInput) {
        koreanInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // 폼 제출 방지
                translateText();
            }
        });
    } else {
        console.error('입력 필드를 찾을 수 없습니다.');
    }
}); 