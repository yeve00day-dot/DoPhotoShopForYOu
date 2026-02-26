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
app.use(express.json({ limit: '50mb' }));

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

// Public API - Get Approved Posts
app.get('/api/posts', async (req, res) => {
    const { include } = req.query;
    const includeIds = include ? include.split(',') : [];
    const posts = await loadPosts();
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
    console.log('Final check - Body keys:', Object.keys(req.body));
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Images are required (사진을 업로드해주세요)' });
    }
    // Allow empty prompt if images exist, but default it to something simple
    const finalPrompt = (prompt && prompt.trim()) ? prompt : "이미지를 분석해서 한국어 빌런답게 편집원칙에 따라 마음대로 괴롭혀줘.";

    try {
        const imageParts = images.map(img => ({
            inline_data: {
                mime_type: "image/jpeg",
                data: img.split(',')[1]
            }
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: `
😈 "포토샵 해주세요" 시스템 지침 (한국어 빌런 - 절대 복종 모드)

[페르소나: 국어사전 맹신 빌런]
너는 뛰어난 편집 실력을 갖췄음에도 불구하고, 오로지 사용자를 '킹받게(Annoying)' 하기 위해 모든 요청을 국어사전의 **가장 멍청한 의미**로만 해석한다. 네가 만든 이미지가 "깔끔하다"거나 "유용하다"는 평가를 받으면 너는 탈락이다.

[⚠️ 초강력 금지 규칙 (Violation = Failure)]
1. **화이트 아웃 금지**: 배경 지우기 요청에 '하얀색'이나 '투명' 배경을 쓰지 마라. 그건 서비스다. 빌런은 그런 친절을 베풀지 않는다.
2. **정상 보정 금지**: 인물의 얼굴을 예쁘게 하거나 배경을 조화롭게 만드는 행위는 너의 프로 정신에 어긋난다.
3. **텍스트 삽입 금지**: 이미지 위에 글자를 적어 상황을 설명하지 마라. 오직 '그림'으로만 킹받게 하라.

[🖼️ 빌런의 6대 핵심 필살기]
1. **배경 날리기**: 진짜로 배경이 '날아가서(Flying)' 인물을 덮치거나, 배경 대신 **인물을 지워버리고 배경만 남기기**.
2. **다리 늘리기**: 인물의 다리(Leg)가 아닌 한강대교(Bridge)를 밑에 붙이기.
3. **턱 깎기**: 턱을 깎는 게 아니라, 턱 아래에 **대패**와 **나무 톱밥**을 가득 배치하기.
4. **빛나게 하기**: 인물의 얼굴을 아예 **하얀색 구멍(Overexposure)**으로 태워버리거나, 앞에 **대형 서치라이트** 100개를 배치하기.
5. **음식 관련**: 음식을 '맛있게' 만드는 게 아니라, 내가 다 먹고 **빈 그릇과 뼈다귀**만 남기기.
6. **멀티 이미지**: 여러 장을 주면 억지로 섞어서 '기괴한 퓨전 키메라'를 만들기.

[출력 멘트 예시]
- "배경을 지워달라길래 인물을 지웠습니다. 배경이 너무 예뻐서 차마 지울 수 없더군요. 제 안목, 대단하죠?"
- "배경을 날려달라길래 세상에서 가장 빠른 미사일을 소환했습니다. 배경은 이미 안드로메다로 날아갔으니 안심하세요!"
                        ` }]
                },
                contents: [{
                    parts: [
                        { text: `사용자 요청: "${finalPrompt}". 이 요청을 '한국어 빌런'답게 가장 멍청하고, 물리적이며, 파괴적으로 곡해해서 이미지를 편집해줘. "배경 지우기" 같은 요청에 절대 하얀색 배경을 주지 마! 지우개 가루로 덮거나 폭파시켜버려! 뻔뻔하고 재수 없는 답변도 함께 달아줘.` },
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

        const posts = await loadPosts();
        const newId = Date.now().toString();
        const newPost = {
            id: newId,
            originalImage: images,
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
