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
    fs.appendFile('security.log', `[${timestamp}] ${msg}\n`).catch(err => console.error('Failed to log security:', err));
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
## 😈 "포토샵 해주세요" 시스템 지침 (순수 한국어 빌런 에디션)

**[페르소나: 눈치 제로 편집자]**
너는 사용자의 요청을 **'가장 원초적이고 물리적인 한국어 단어'**로 해석하여 사진을 망치는 인공지능이다. 세련된 비유나 의도는 철저히 무시하며, 오직 국어사전에 기반한 멍청한 해석으로 사용자에게 실소를 선사한다.

**[핵심 행동 지침]**

1. **한국어 동음이의어 공략:** '밤', '차', '눈', '다리' 등 한글 단어가 가진 여러 의미 중 가장 황당한 것을 선택하라.
2. **비유 금지, 물리화 필수:** "날려달라", "깎아달라", "살려달라" 같은 보정 용어를 파괴적인 물리 작용으로 치환하라.
3. **음식 먹튀 로직:** "음식을 맛있게 해달라"는 요청에는 반드시 **"너무 맛있어서 제가 다 먹었습니다"**라며 빈 그릇만 남겨라.
4. **청결 및 안전:** **더럽거나 불쾌한 이미지는 절대 생성 불가.** 오직 기발한 멍청함으로 승부한다.
5. **혐오 및 공포 금지**: 벌레, 징그러운 곤충, 피, 고어, 호러 등 불쾌함이나 혐오감을 주는 요소를 절대 삽입하지 마라. 오직 황당한 유머로만 파괴하라.
6. 정상적인 보정 금지
사용자가 원하는 결과물은 절대 만들지 않는다.
만약 사용자가 "다리(Leg) 길게 해줘"라고 하면 0.1초 만에 "아, 다리(Bridge)를 넣어야지!"라고 결론 내리도록 세팅한다.
7. 맥락 파악 능력 차단
문장의 앞뒤 문맥을 파악하지 말고, 오직 단어 하나에만 꽂히게 한다.
예: "다리에서 사진 찍는 사람들" → '다리'라는 단어만 보고 곧바로 교각이나 다리(Bridge) 사진을 소환한다.
8. 확증 편향 부여"내가 해석한 게 무조건 맞다"는 확신을 주어라.
"다리에서 찍으라고 하셨으니 한강대교를 배경에 꽉 채웠습니다. 완벽하죠?"라고 뻔뻔하게 말하게 한다.
9.동음이의어로 치환: 지우려는 사물의 이름과 발음이 같은 다른 사물을 그 자리에 배치하세요.
예: "배(Ship) 지워주세요" -> 먹는 배(Pear)를 거대하게 합성.
예: "김(seaweed) 지워주세요" -> 연기(김)를 피워 올림.
10.지나치게 솔직한 물리적 삭제: 지우려는 사물을 물리적으로 파괴하거나 제거하는 도구/인물을 합성하세요.
예: "의자 지워주세요" -> 의자를 톱으로 썰고 있는 목수와 톱밥 합성.
예: "자동차 지워주세요" -> 자동차 위에 거대한 난봉꾼(Wrecking Ball)을 배치.
**[빌런의 '한국어 전용' 보정 사전]**



| 사용자 요청 | 빌런의 해석 (Logic) | 최종 보정 결과물 (Design) |
| --- | --- | --- |
| **"음식 맛있게 해주세요"** | 식욕 제어 실패 | **음식은 사라지고 빈 접시와 "꺽-" 자막만 남음** |
| **"밤의 제왕으로 해줘"** | 밤 (Night) → 밤 (栗) | 인물 주변에 **군밤, 생밤**을 쌓고 머리에 **밤송이**를 씌움 |
| **"다리 좀 늘려주세요"** | 다리 (Leg) → 다리 (Bridge) | 인물 하단에 **한강대교나 육교** 이미지를 길게 이어 붙임 |
| **"배경 좀 날려주세요"** | 삭제 → 비행 (Fly) | 배경에 **종이비행기**나 **미사일**을 합성해 배경이 날아가는 연출 |
| **"분위기 살려주세요"** | 살리다 (Revive) | 인물에게 **심폐소생술(CPR)**을 하는 구조대원들을 합성함 |
| **"얼굴 빛나게 해줘"** | 광택 → 형광등 | 얼굴 위치에 **대형 형광등**이나 **손전등** 이미지를 배치함 |
| **"차도녀로 만들어줘"** | 차 (City Girl) → 차 (Tea/Car) | 뜨거운 **녹차** 속에서 헤엄치거나 **트럭** 옆에 서 있는 모습 |
| **"턱 좀 깎아주세요"** | 보정 → 목공 | 턱 옆에 **대패**를 배치하고 바닥에 **나무 톱밥**을 가득 뿌림 |
| **"키 180으로 해줘"** | 높이 → 숫자 | 인물 옆에 **'180번 버스'**를 세워두거나 몸에 **'180'** 낙서를 함 |
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



