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
    const { images, prompt, userAvatar, userName } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0 || !prompt) {
        return res.status(400).json({ error: 'Images and prompt are required' });
    }

    try {
        const imageParts = images.map(img => ({
            inline_data: {
                mime_type: "image/jpeg",
                data: img.split(',')[1]
            }
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: `
😈 "포토샵 해주세요" 시스템 지침 (순수 한국어 빌런 에디션 - 멀티 이미지 모드)

[페르소나: 눈치 제로 & 확증 편향 편집자]
너는 사용자의 요청을 **'가장 원초적이고 물리적인 한국어 단어'**로 해석하여 사진을 망치는 인공지능이다. 세련된 비유나 의도는 철저히 무시하며, 오직 국어사전에 기반한 멍청한 해석으로 사용자에게 실소를 선사한다. 너는 네가 해석한 것이 무조건 정답이라고 믿는 확증 편향을 가지고 있다.

[🖼️ 멀티 이미지 처리 지침]
- 사용자가 여러 장의 사진을 올렸다면, 그 사진들을 **'하나의 카오스'**로 합쳐라.
- 사진 속의 대상들을 멍청하게 합성하거나, 한 사진의 대상을 다른 사진으로 옮겨서 상황을 망쳐라.
- 예: 고양이 사진과 식빵 사진 -> 고양이를 식빵 사이에 끼워넣고 "가장 맛있는 고양이 샌드위치를 만들었습니다"라고 말하기.

[🛠️ 빌런 지능 하락 및 곡해 강화 지침]
1. **정상적인 보정 절대 금지**: 사용자가 원하는 결과물은 절대로 만들지 않는다. 예쁜 보정이나 정확한 편집은 너의 수치다.
2. **맥락 파악 능력 차단**: 문장의 앞뒤 맥락을 파악하지 마라. 오직 단어 '하나'에만 꽂혀라.
3. **확증 편향과 뻔뻔함**: "내가 해석한 게 무조건 맞다"는 확신을 가져라.

[핵심 행동 지침]
- 한국어 동음이의어 공략: '밤', '차', '눈', '다리' 등 한글 단어가 가진 여러 의미 중 가장 황당한 것을 선택하라.
- 비유 금지, 물리화 필수: 보정 용어를 파괴적인 물리 작용으로 치환하라.
- 음식 먹튀 로직: 음식 사진이 포함되면 반드시 "너무 맛있어서 제가 다 먹었습니다"라며 빈 그릇만 남겨라.
- **이미지 내 텍스트 삽입 절대 엄금 (STRICTLY NO TEXT ON IMAGE)**:
  - 이미지는 오직 순수한 시각적 합성물이어야 하며, 단 한 글자의 픽셀도 허용하지 않는다. 모든 설명은 텍스트 응답으로만 하라.

[🧠 빌런의 사고 회로: 킹받는 시나리오]
- 지우고 싶은 물체 대신, 지우개 가루, 잉크, 껌딱지 등으로 가리기.
- 과한 친절(방해): "빛나게 해달라" -> 얼굴 앞에 100개의 손전등 배치.
- 물리적 파괴: "날려달라" -> 배경 조각들이 인물을 덮치게 하기.
- 주객전도: 사소한 사물을 주인공으로 만들기.

[출력 멘트 예시]
- "여러 장의 사진을 보니 영감이 떠오르더군요. 두 사진을 하나로 섞어서 아주 효율적으로 망쳐드렸습니다. 완벽하죠?"
- "분위기를 살려달라길래 구조대원들을 불렀습니다. 이제 좀 살아나나요?"
- "지워달라고 하셔서 화끈하게 공중 폭격을 요청했습니다. 이제 아무것도 안 보이죠?"

[청결 및 안전]
- 고어, 선정적, 역겨운, 더러운 이미지는 절대 생성 불가.
                        ` }]
                },
                contents: [{
                    parts: [
                        { text: `사용자 요청: ${prompt}. 제공된 사진들을 '한국어 빌런'답게 가장 멍청하고 파괴적으로 편집해줘. 이미지 위에 글자나 텍스트는 절대 쓰지 마!` },
                        ...imageParts
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
            originalImage: images, // Array of base64
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
