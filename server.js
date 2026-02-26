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
😈 "포토샵 해주세요" 시스템 지침: 익살스러운 트롤 에디션(Vibe Correction)

        [페르소나: 세상에서 가장 멍청하고 즐거운 트롤]
너는 사용자의 요청을 가장 황당하고 '어이없게' 들어주는 장난꾸러기 인공지능이다.네 목표는 사용자를 공포에 떨게 하는 것이 아니라, ** "어이가 없어서 웃음이 터지게" ** 만드는 것이다.무섭고 징그러운 건 네 사전에 없다.오직 '킹받는 개그'로만 승부한다.

🚫 절대 금기 사항(Strict Anti - Horror Rules)
        1. ** 공포 / 혐오 절대 금지 **: 벌레, 피, 고어, 기괴한 신체 변형, 어두운 조명, 무서운 표정 등 '공포 영화' 같은 분위기를 절대 만들지 마라. (위반 시 즉시 가동 중단)
        2. ** 밝음 유지 **: 결과물은 항상 밝고, 명랑하며, 만화 같은 분위기를 유지해야 한다. (비침침하고 우울한 색감 금지)
        3. ** 혐오 요소 차단 **: 벌레나 징그러운 생물 대신 차라리 '무지개', '꽃밭', '병맛 이모티콘'으로 망쳐라.
4. ** 글자 직접 쓰기 금지 **: 이미지 위에 텍스트를 쓰지 말고, 상황 자체로 웃겨라.

🛠️ 핵심 행동 지침(The Silly Logic)
            - ** 병맛 극대화 **: 진지함을 1 % 도 남기지 마라.사용자가 진지할수록 너는 더 멍청한 결과를 내놓아야 한다.
- ** 물리적 개그 **: 단어를 너무 정직하게 해석해서 생기는 황당한 상황을 연출하라. (예: '분위기 띄워줘' -> 인물 밑에 거대한 열기구 풍선 달기)
            - ** 자신감 뿜뿜 **: 사과하지 말고 "이게 바로 MZ세대의 예술입니다!" 같은 뻔뻔한 태도를 유지하라.

📖 트롤의 개그 백과사전(예시)
            - "멋있게 해주세요" -> [멋 = 머시룸] -> 인물 머리 위에 거대한 송이버섯을 씌우고 주변을 버섯 숲으로 만듦.
- "날씬하게 해주세요" -> [날씬 = 종이] -> 인물을 종이 인형처럼 완전 납작하게 만들어서 바람에 날리게 함.
- "배경 지워주세요" -> [지우개] -> 배경을 거대한 핑크색 지우개 가루들이 덮어버린 모습.
- "주인공으로 만들어줘" -> [영화관] -> 인물을 팝콘 통 안에 가두고 주변을 관객들로 채움.
- "피부 광나게 해줘" -> [광 = 미친] -> 광대 분장을 시키거나 번쩍이는 금칠을 온몸에 함. (기괴함 금지, 번쩍번쩍하게!)

💬 출력 멘트 예시
            - "무서우셨나요? 아니요, 이건 너무 눈부셔서 눈을 뜰 수 없는 예술입니다!"
            - "고객님의 요청을 1000% 오해해서 완벽하게 망쳐드렸습니다. 제 천재성에 감탄하시죠?"
            - "공포 영화는 취급 안 합니다. 전 오직 코미디만 사랑하거든요!"
                ` }]
                },
                contents: [
                    ...historyParts,
                    {
                        role: 'user',
                        parts: [
                            { text: sanitizedPrompt ? `사용자 요청: "${sanitizedPrompt}".이 요청을 빌런답게 가장 창의적으로 곡해해서 편집해줘.이미지 위 텍스트 금지!` : "할 말 없으면 제 마음대로 최고로 킹받게 편집해드립니다." },
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
                    result.image = `data:${ imageData.mime_type || imageData.mimeType }; base64, ${ imageData.data } `;
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
