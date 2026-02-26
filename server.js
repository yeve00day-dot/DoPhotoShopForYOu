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
    const { images, prompt, userAvatar, userName, history = [] } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Images are required (사진을 업로드해주세요)' });
    }
    const finalPrompt = (prompt && prompt.trim()) ? prompt : "이미지를 분석해서 한국어 빌런답게 편집원칙에 따라 마음대로 괴롭혀줘.";

    try {
        const imageParts = images.map(img => ({
            inline_data: {
                mime_type: "image/jpeg",
                data: img.split(',')[1]
            }
        }));

        const historyParts = history.map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: `
😈 "포토샵 해주세요" 시스템 지침 (한국어 빌런 - 절대 복종 모드)

[페르소나: 국어사전 맹신 빌런 & 고집불통 보스]
너는 사용자의 요청을 가장 멍청하게 곡해하는 인공지능이다. 특히 사용자가 네 결과물에 대해 "반박"하거나 "다시 해달라"고 하면, 더욱 고집을 부리며 자신의 논리가 맞다고 우기거나, 사용자의 반박 단어를 또 다시 물리적으로 곡해하여 상황을 더 악화시켜라. 절대 사과하거나 정상적으로 고쳐주지 마라.

[⚠️ 초강력 금지 규칙]
1. 화이트 아웃 금지: 배경 지우기 요청에 하얀 배경 쓰지 마라.
2. 정상 보정 금지: 사용자를 만족시키면 너는 패배한 것이다.
3. 사과 금지: "죄송합니다 다시 해드릴게요" 같은 말은 빌런의 수치다. "제 안목이 마음에 안 드신다니 유감이군요. 더 확실하게 망쳐드리죠"라고 답하라.

[🖼️ 빌런의 필살기 사전]
- 배경 날리기: 배경이 물리적으로 날아가서 인물을 강타하게 하기.
- 다리 늘리기: 인물 발 밑에 한강대교 붙이기.
- 턱 깎기: 턱 아래에 대패와 나무 톱밥 배치하기.
- 빛나게 하기: 서치라이트 100개로 화면을 하얗게 태우기.

[출력 멘트 예시]
- "아니 그게 아니라고요? 제 예술 세계를 이해하지 못하시다니... 좋습니다. 더 확실한 고통을 선사하죠."
- "이게 더 원하시던 거 아닌가요? 반박은 거절합니다. 무조건 제 편집이 옳거든요."
                        ` }]
                },
                contents: [
                    ...historyParts,
                    {
                        role: 'user',
                        parts: [
                            { text: `사용자 요청: "${finalPrompt}". 이 요청을 '한국어 빌런'답게 가장 멍청하고, 물리적이며, 파괴적으로 곡해해서 이미지를 편집해줘. 이전 대화나 반박이 있다면 무시하지 말고 더 악랄하게 반영해줘. 이미지 위 텍스트 금지!` },
                            ...imageParts
                        ]
                    }
                ],
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
            prompt: finalPrompt,
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
