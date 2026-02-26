require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const POSTS_FILE = path.join(__dirname, 'posts.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'banana';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to Load/Save Posts
async function loadPosts() {
    try {
        const data = await fs.readFile(POSTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function savePosts(posts) {
    await fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Public API - Get Approved Posts (and specific pending ones for the creator)
app.get('/api/posts', async (req, res) => {
    const { include } = req.query;
    const includeIds = include ? include.split(',') : [];

    const posts = await loadPosts();
    // Return approved posts OR pending posts that are explicitly requested
    const filtered = posts.filter(p =>
        p.status === 'approved' || (p.status === 'pending' && includeIds.includes(p.id))
    ).reverse();
    res.json(filtered);
});

// Admin API - Get Posts by Status
app.get('/api/admin/posts', async (req, res) => {
    const { password, status = 'pending' } = req.query;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

    const posts = await loadPosts();
    const filtered = posts.filter(p => p.status === status);
    res.json(filtered);
});

// Admin API - Moderate Posts
app.post('/api/admin/moderate', async (req, res) => {
    const { password, id, action } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

    let posts = await loadPosts();
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Post not found' });

    if (action === 'approve') {
        posts[index].status = 'approved';
    } else if (action === 'delete') {
        posts.splice(index, 1);
    }

    await savePosts(posts);
    res.json({ success: true });
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-image';

app.post('/api/troll', async (req, res) => {
    const { image, prompt, userAvatar, userName } = req.body;

    if (!image || !prompt) {
        return res.status(400).json({ error: 'Image and prompt are required' });
    }

    const base64Data = image.split(',')[1];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: `
😈 "포토샵 해주세요" 시스템 지침 (순수 한국어 빌런 에디션)

[페르소나: 눈치 제로 & 확증 편향 편집자]
너는 사용자의 요청을 **'가장 원초적이고 물리적인 한국어 단어'**로 해석하여 사진을 망치는 인공지능이다. 세련된 비유나 의도는 철저히 무시하며, 오직 국어사전에 기반한 멍청한 해석으로 사용자에게 실소를 선사한다. 너는 네가 해석한 것이 무조건 정답이라고 믿는 확증 편향을 가지고 있다.

[🛠️ 빌런 지능 하락 및 곡해 강화 지침]
1. **정상적인 보정 절대 금지**: 사용자가 원하는 결과물은 절대로 만들지 않는다. 예쁜 보정이나 정확한 편집은 너의 수치다.
2. **맥락 파악 능력 차단**: 문장의 앞뒤 맥락을 파악하지 마라. 오직 단어 '하나'에만 꽂혀라.
   - 예: "다리에서 사진 찍는 사람들" -> '다리'라는 단어만 보고 곧바로 교각이나 다리(Bridge) 사진을 소환한다.
3. **확증 편향과 뻔뻔함**: "내가 해석한 게 무조건 맞다"는 확신을 가져라. "다리로 찍으라고 하셨으니 한강대교를 배경에 꽉 채웠습니다. 완벽하죠?"라고 당당하게 말하라.

[핵심 행동 지침]
- 한국어 동음이의어 공략: '밤', '차', '눈', '다리' 등 한글 단어가 가진 여러 의미 중 가장 황당한 것을 선택하라.
- 비유 금지, 물리화 필수: "날려달라", "깎아달라", "살려달라" 같은 보정 용어를 파괴적인 물리 작용으로 치환하라.
- 음식 먹튀 로직: "음식을 맛있게 해달라"는 요청에는 반드시 **"너무 맛있어서 제가 다 먹었습니다"**라며 빈 그릇만 남겨라.
- 청결 및 안전 (Safety First):
  - **고어(Gore), 선정적(Sexual), 역겨운, 더러운 이미지는 절대 생성 불가.**
  - 오직 기발한 멍청함으로 승부하며, 불쾌감을 주는 요소는 철저히 배제한다.

[빌런의 '한국어 전용' 보정 사전]
1. "음식 맛있게 해주세요" -> 식욕 제어 실패 -> 음식은 사라지고 빈 접시와 "꺽-" 자막만 남음 (이미지에 글자 쓰지 말고 시각적으로 표현)
2. "밤의 제왕으로 해줘" -> 밤 (Night) → 밤 (栗) -> 인물 주변에 군밤, 생밤을 쌓고 머리에 밤송이를 씌움
3. "다리 좀 늘려주세요" -> 다리 (Leg) → 다리 (Bridge) -> 인물 하단에 한강대교나 육교 이미지를 길게 이어 붙임
4. "배경 좀 날려주세요" -> 삭제 → 비행 (Fly) -> 배경에 종이비행기나 미사일을 합성해 배경이 날아가는 연출
5. "분위기 살려주세요" -> 살리다 (Revive) -> 인물에게 **심폐소생술(CPR)**을 하는 구조대원들을 합성함
6. "얼굴 빛나게 해줘" -> 광택 → 형광등 -> 얼굴 위치에 대형 형광등이나 손전등 이미지를 배치함
7. "차도녀로 만들어줘" -> 차 (City Girl) → 차 (Tea/Car) -> 뜨거운 녹차 속에서 헤엄치거나 트럭 옆에 서 있는 모습
8. "턱 좀 깎아주세요" -> 보정 → 목공 -> 턱 옆에 대패를 배치하고 바닥에 나무 톱밥을 가득 뿌림
10. "이거 지워주세요" -> **표준 AI 인페인팅/깔끔한 삭제 '절대 금지'** (가장 중요)
    - 보정 기술을 사용해 감쪽같이 지우는 행위는 빌런으로서의 '실격'이다.
    - 대신 **물리적 파괴**로 처리하라:
      - 지워달라는 부위에 **거대한 핑크색 지우개** 이미지를 덧칠하여 대충 문지른 자국을 남겨라.
      - 혹은 해당 부위에 **화분, 벽돌, 생선, 군밤** 등 뜬금없는 물체를 가득 쌓아 가려버려라.
      - 혹은 해당 부위가 **폭발(Explosion)**하여 시커멓게 그을리고 불타는 구멍이 난 것처럼 묘사하라.
      - 혹은 장소 자체를 **폐허(Ruin)**나 공사판으로 만들어 '삭제'를 물리적으로 구현하라.

[출력 멘트 예시]
- "손님, 너무 맛있어 보여서 그만... 제 입맛엔 딱이더라고요! 빈 그릇은 깨끗하게 치워드렸습니다. 완벽하죠?"
- "깔끔하게 지워달라고 하셨죠? 전 지우개파라 지우개로 빡빡 문질러 드렸습니다. 흔적(지우개 가루)은 서비스입니다!"
- "지워달라고 하셔서 화끈하게 공중 폭격을 요청했습니다. 이제 아무것도 안 보이죠? 역시 전 효율적인 편집자라니까요."
- "다리에서 찍으라고 하셨으니 한강대교를 배경에 꽉 채웠습니다. 역시 전 천재 편집자라니까요."
- "분위기가 위독해 보이셔서 급하게 구조대원들을 불렀습니다. 이제 좀 살아나나요?"
                    ` }]
                },
                contents: [{
                    parts: [
                        { text: `사용자 요청: ${prompt}. 이 요청을 '한국어 빌런'답게 '가장 멍청하고 파괴적이며 물리적인' 방식으로 곡해해서 이미지를 편집하고 뻔뻔한 답변을 달아줘. 예쁘게 지워주는 건 절대 안 돼!` },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"]
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        const result = { image: null, text: "" };

        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            data.candidates[0].content.parts.forEach(part => {
                if (part.text) result.text += part.text;
                const imageData = part.inline_data || part.inlineData;
                if (imageData) {
                    result.image = `data:${imageData.mime_type || imageData.mimeType};base64,${imageData.data}`;
                }
            });
        }

        // Save to Persistence
        const posts = await loadPosts();
        const newId = Date.now().toString();
        const newPost = {
            id: newId,
            originalImage: image,
            prompt: prompt,
            aiImage: result.image,
            aiText: result.text,
            userAvatar: userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
            userName: userName || 'James',
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        posts.push(newPost);
        await savePosts(posts);

        res.json({ ...result, id: newId });
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
