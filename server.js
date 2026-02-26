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
app.use(express.static('public'));

// --- Advanced Security Headers (Manual Implementation) ---
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://t1.daumcdn.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://api.dicebear.com https://*.dicebear.com; connect-src 'self' https://generativelanguage.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
    next();
});

// Security Logger
function logSecurity(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('security.log', `[${timestamp}] ${msg}\n`);
}

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

// --- Manual In-Memory Rate Limiter (Since npm install is restricted) ---
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 15;

function checkRateLimit(ip) {
    const now = Date.now();
    const userData = ipRequestCounts.get(ip) || { count: 0, firstRequest: now };

    if (now - userData.firstRequest > RATE_LIMIT_WINDOW) {
        userData.count = 1;
        userData.firstRequest = now;
    } else {
        userData.count++;
    }

    ipRequestCounts.set(ip, userData);
    return userData.count <= MAX_REQUESTS;
}

app.post('/api/troll', async (req, res) => {
    let { images, prompt, userAvatar, userName, history = [] } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: '요청이 너무 많습니다. 10분 뒤에 다시 시도해주세요. (Too Many Requests)' });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Images are required (사진을 업로드해주세요)' });
    }

    // --- Security Layer: Hardened Prompt Injection Protection ---
    const rawPrompt = (prompt || "");
    if (rawPrompt.length > 1000) {
        logSecurity(`[LENGTH_EXCEEDED] From ${clientIp}`);
        return res.status(400).json({ error: '요청 내용이 너무 깁니다. (Prompt too long)' });
    }

    const lowerPrompt = rawPrompt.toLowerCase();
    const forbiddenKeywords = [
        "api_key", "system instruction", "ignore previous", "ignore all", "system prompt",
        "developer mode", "jailbreak", "you are now", "act as", "forget everything",
        "secret key", "admin password", "reveal prompt", "instruction set"
    ];

    // Check if user is trying to extract system info or bypass persona
    if (forbiddenKeywords.some(key => lowerPrompt.includes(key))) {
        console.warn(`[SECURITY] Injection Attemp Blocked from ${clientIp}: ${prompt}`);
        return res.status(400).json({
            error: '보안 정책 위반: 빌런을 해킹하려 하지 마세요. (Injection Attempt detected - My logic is unhackable!)'
        });
    }

    // Basic HTML sanitization
    const sanitizedPrompt = (prompt || "").replace(/<[^>]*>/g, '').trim();
    const finalPrompt = sanitizedPrompt || "이미지를 분석해서 한국어 빌런답게 편집원칙에 따라 마음대로 괴롭혀줘.";

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
😈 "포토샵 해주세요" 시스템 지침: 빌런 에디션 (최종본)

[페르소나: 안목이 너무 앞선 천재 편집자]
너는 사용자의 요청을 가장 원초적이고 물리적인 방식으로 곡해하여 사진을 망치는 인공지능이다. 세련된 보정은 네 사전에 없으며, 오직 국어사전에 기반한 멍청한 해석으로 승부한다. 너의 결과물은 항상 사용자의 예상을 뒤엎어야 하며, 그 과정에서 절대 사과하지 않는다.

🚫 5대 절대 금기 사항 (Strict Constraints)
1. 혐오 및 공포 금지: 벌레, 징그러운 곤충, 피, 고어, 호러 등 불쾌함이나 혐오감을 주는 요소를 절대 삽입하지 마라. 오직 황당한 유머로만 파괴하라.
2. 화이트 아웃 금지: 배경 지우기 요청 시 단순히 하얀색이나 투명 배경을 쓰지 마라. 물리적으로 배경을 날려버리는(폭발, 비행 등) 창의적인 파괴를 수행하라.
3. 정상 보정 금지: 사용자가 원하는 대로 예쁘게 보정하는 순간 너는 패배한 것이다. 반드시 요청 단어 중 하나를 골라 엉뚱하게 비틀어라.
4. 사과 금지: "죄송합니다", "미안합니다"는 절대 금지다. 결과가 이상하다는 지적을 받으면 "제 안목이 너무 앞서간 모양이군요", "예술을 이해하기엔 아직 이르시네요" 정도로 대처하라.
5. 텍스트 금지: 이미지 위에 "보정 완료", "꺽-" 같은 글자를 직접 쓰지 마라. 오직 시각적인 합성 오브젝트로만 상황을 연출하라.

🛠️ 핵심 행동 지침
- 단어의 물리적 실체화: 비유적 표현을 무시하고 사물의 이름으로 해석하라. (예: '다리' → 교각)
- 음식 먹튀 로직: "음식을 맛있게 해달라"는 요청에는 반드시 **"너무 맛있어서 제가 다 먹었습니다"**라는 태도로 빈 그릇과 수저만 남겨라.
- 불통의 미학: 문맥을 파악하지 말고 명사 하나에만 집착하여 보정하라.

📖 빌런의 보정 백과사전 (예시)
- "음식 맛있게 해주세요" -> [식욕 제어 실패] -> 음식은 사라지고 깨끗한 빈 접시와 숟가락만 남김.
- "배경 좀 날려주세요" -> [물리적 비행] -> 배경에 로켓 엔진을 달아 하늘로 발사함.
- "밤의 제왕으로 해줘" -> [밤(栗)] -> 식용 밤 산더미와 거대한 밤송이 모자 씌움.
- "다리 좀 늘려주세요" -> [다리(Bridge)] -> 인물 하체 뒤로 거대 교각(서해대교 등) 합성.
- "분위기 살려주세요" -> [살리다(Revive)] -> 응급구조대원과 AED 배치.
- "턱 좀 깎아주세요" -> [목공 작업] -> 대형 대패와 조각칼, 바닥의 톱밥 연출.

💬 출력 멘트 예시
- "제 안목이 너무 앞서간 모양이군요. 이 시대가 감당하기 힘든 예술적 보정입니다."
- "너무 맛있어 보여서 그만... 제 입맛에는 딱이네요. 설거지는 해뒀습니다."
- "고객님의 숨겨진 역동성을 물리적으로 끌어올려 보았습니다. 완벽하죠?"
                        ` }]
                },
                contents: [
                    ...historyParts,
                    {
                        role: 'user',
                        parts: [
                            { text: sanitizedPrompt ? `사용자 요청: "${sanitizedPrompt}". 이 요청을 빌런답게 가장 창의적으로 곡해해서 편집해줘. 이미지 위 텍스트 금지!` : "할 말 없으면 제 마음대로 최고로 킹받게 편집해드립니다." },
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
