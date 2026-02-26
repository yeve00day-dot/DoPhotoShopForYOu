document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const uploadTrigger = document.getElementById('uploadTrigger');
    const fileInput = document.getElementById('fileInput');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const userRequest = document.getElementById('userRequest');
    const submitBtn = document.getElementById('submitBtn');
    const postsContainer = document.getElementById('postsContainer');
    const previewGrid = document.getElementById('previewGrid');
    let uploadedImages = []; // Store array of base64 images

    // --- Terms of Service Logic ---
    const tosModal = document.getElementById('tosModal');
    const agreeBtn = document.getElementById('agreeBtn');

    if (!localStorage.getItem('tosAgreed')) {
        tosModal.classList.remove('hidden');
    }

    agreeBtn.addEventListener('click', () => {
        localStorage.setItem('tosAgreed', 'true');
        tosModal.classList.add('hidden');
    });

    // --- Upload Logic ---
    uploadTrigger.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('click', (e) => {
        if (e.target.closest('.preview-remove')) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => handleFile(e.target.files));

    // --- Paste Logic ---
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                handleFile([file]);
                break;
            }
        }
    });

    // --- Drag & Drop Logic ---
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.background = '#e9ebee';
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.background = '#f5f6f7';
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.background = '#f5f6f7';
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files);
    });

    // --- Initialization: Load Approved Feed ---
    async function loadFeed() {
        try {
            const savedIds = localStorage.getItem('myPostIds') || '';
            const res = await fetch(`https://dophotoshopforyou.onrender.com/api/posts?include=${savedIds}`);
            const posts = await res.json();
            postsContainer.innerHTML = '';

            if (posts.length === 0) {
                renderWelcomePost();
            } else {
                posts.forEach(postData => {
                    const isMyPending = postData.status === 'pending';
                    const postEl = createPostElement({
                        avatar: postData.userAvatar,
                        name: postData.userName,
                        prompt: postData.prompt,
                        images: Array.isArray(postData.originalImage) ? postData.originalImage : (postData.originalImage ? [postData.originalImage] : []),
                        isPending: isMyPending
                    });
                    postsContainer.appendChild(postEl);

                    const commentsSection = postEl.querySelector('.comments-section');
                    const aiComment = createCommentElement(postData.aiText, postData.aiImage);
                    commentsSection.appendChild(aiComment);

                    if (isMyPending) {
                        const alertMsg = document.createElement('div');
                        alertMsg.style.cssText = 'font-size: 11px; color: #f02849; margin-top: 5px; font-weight: 600; padding: 0 10px;';
                        alertMsg.innerText = '⚠️ 이 게시물은 현재 검토 대기 중입니다. 관리자 승인 시 모든 사람에게 공개됩니다.';
                        commentsSection.appendChild(alertMsg);
                    }
                });
                lucide.createIcons();
            }
        } catch (err) {
            console.error('Failed to load feed:', err);
            renderWelcomePost();
        }
    }

    function renderWelcomePost() {
        postsContainer.innerHTML = `
            <div class="post-card welcome-post">
                <div class="post-header">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=StupidAI" alt="Profile" class="post-avatar">
                    <div class="post-meta">
                        <span class="user-link">포토샵 해드립니다</span>
                        <span class="time">방금 전 · <i data-lucide="globe" size="10"></i></span>
                    </div>
                </div>
                <div class="post-body">
                    안녕하세요! 아직 승인된 게시물이 없습니다.<br><br>
                    첫 번째 주인공이 되어보세요. 사진을 올리고 요청을 보내면 관리자 승인 후 타임라인에 게시됩니다!
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    loadFeed();

    // --- Core Logic: Posting ---
    submitBtn.addEventListener('click', postContent);

    async function postContent() {
        const text = userRequest.value.trim();
        const hasImages = uploadedImages.length > 0;

        if (!text && !hasImages) {
            alert('사진을 업로드하거나 요청 내용을 입력해주세요!');
            return;
        }

        const userAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=James";
        const userName = "James";

        // Create Post UI immediately
        const post = createPostElement({
            avatar: userAvatar,
            name: userName,
            prompt: text,
            images: [...uploadedImages],
            isPending: true
        });
        postsContainer.prepend(post);

        const currentImages = [...uploadedImages];
        userRequest.value = '';
        uploadedImages = [];
        updatePreviewGrid();

        const commentsSection = post.querySelector('.comments-section');
        const loadingId = 'loading-' + Date.now();
        const loadingEl = document.createElement('div');
        loadingEl.id = loadingId;
        loadingEl.className = 'comment';
        loadingEl.innerHTML = `
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=BananaBoss" class="comment-avatar">
            <div class="comment-content">
                <span class="comment-author">포토샵 해드립니다</span>
                <div class="comment-loading">
                    <div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
                    <span>완벽한 편집을 진행중입니다...</span>
                </div>
            </div>
        `;
        commentsSection.appendChild(loadingEl);

        try {
            const result = await callGeminiNanoBanana(currentImages, text, userAvatar, userName);
            loadingEl.remove();

            if (result.id) {
                let myPostIds = localStorage.getItem('myPostIds') ? localStorage.getItem('myPostIds').split(',') : [];
                myPostIds.push(result.id);
                localStorage.setItem('myPostIds', myPostIds.join(','));
            }

            const aiComment = createCommentElement(result.text, result.image, currentImages);
            commentsSection.appendChild(aiComment);

            const alertMsg = document.createElement('div');
            alertMsg.style.cssText = 'font-size: 11px; color: #f02849; margin-top: 5px; font-weight: 600; padding: 0 10px;';
            alertMsg.innerText = '⚠️ 이 게시물은 현재 검토 대기 중입니다. 관리자 승인 시 모든 사람에게 공개됩니다.';
            commentsSection.appendChild(alertMsg);

            lucide.createIcons();
        } catch (err) {
            console.error(err);
            loadingEl.innerHTML = `<p style="color:red; padding:10px;">에러가 발생했습니다: ${err.message}</p>`;
        }
    }

    // --- AI Reply & Ad Gate Logic ---
    const supportDevModal = document.getElementById('supportDevModal');
    const confirmRebuttal = document.getElementById('confirmRebuttal');
    const cancelRebuttal = document.getElementById('cancelRebuttal');
    let currentRebuttalContext = null;

    cancelRebuttal.addEventListener('click', () => {
        supportDevModal.classList.add('hidden');
        currentRebuttalContext = null;
    });

    confirmRebuttal.addEventListener('click', async () => {
        if (confirmRebuttal.disabled) return;
        const { images, text, commentsSection, history } = currentRebuttalContext;
        supportDevModal.classList.add('hidden');
        currentRebuttalContext = null;
        await executeRebuttal(images, text, commentsSection, history);
    });

    function showAdModal(context) {
        currentRebuttalContext = context;
        supportDevModal.classList.remove('hidden');
        confirmRebuttal.disabled = true;
        let timeLeft = 3;
        confirmRebuttal.innerText = `전송하기 (${timeLeft}s)`;

        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timer);
                confirmRebuttal.disabled = false;
                confirmRebuttal.innerText = `전송하기`;
            } else {
                confirmRebuttal.innerText = `전송하기 (${timeLeft}s)`;
            }
        }, 1000);
    }

    async function executeRebuttal(images, text, commentsSection, history) {
        const loadingId = 'loading-' + Date.now();
        const loadingEl = document.createElement('div');
        loadingEl.id = loadingId;
        loadingEl.className = 'comment';
        loadingEl.innerHTML = `
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=BananaBoss" class="comment-avatar">
            <div class="comment-content">
                <span class="comment-author">포토샵 해드립니다</span>
                <div class="comment-loading">
                    <div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
                    <span>반박 내용을 분석하며 더 고집을 부리는 중...</span>
                </div>
            </div>
        `;
        commentsSection.appendChild(loadingEl);

        try {
            const result = await callGeminiNanoBanana(images, text, null, null, history);
            loadingEl.remove();

            const userComment = document.createElement('div');
            userComment.className = 'comment';
            userComment.innerHTML = `
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=James" class="comment-avatar">
                <div class="comment-content">
                    <span class="comment-author">James</span>
                    <span class="comment-text">${text}</span>
                </div>
            `;
            commentsSection.appendChild(userComment);

            const aiComment = createCommentElement(result.text, result.image, images, history.concat([{ role: 'user', text }, { role: 'ai', text: result.text }]));
            commentsSection.appendChild(aiComment);
            lucide.createIcons();
        } catch (err) {
            console.error(err);
            loadingEl.innerHTML = `<p style="color:red; padding:10px;">에러가 발생했습니다: ${err.message}</p>`;
        }
    }

    // --- Helper UI Functions ---
    function createPostElement({ avatar, name, prompt, images, isPending }) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-card';
        postDiv.dataset.originalImages = JSON.stringify(images);
        if (isPending) postDiv.style.opacity = '0.8';

        let imagesHtml = '';
        if (images && images.length > 0) {
            imagesHtml = `<div class="post-image-container">${images.map(img => `<img src="${img}" class="post-image">`).join('')}</div>`;
        }

        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${avatar}" class="post-avatar">
                <div class="post-meta">
                    <span class="user-link">${name}</span>
                    <span class="time">방금 전 · <i data-lucide="globe" size="10"></i> ${isPending ? ' (검토 대기 중)' : ''}</span>
                </div>
            </div>
            <div class="post-body">
                <div class="user-prompt">${prompt}</div>
                ${imagesHtml}
            </div>
            <div class="post-footer">
                <div class="footer-actions">
                    <span><i data-lucide="thumbs-up" size="14"></i> 좋아요</span>
                    <span><i data-lucide="message-square" size="14"></i> 댓글 달기</span>
                    <span><i data-lucide="share" size="14"></i> 공유하기</span>
                </div>
            </div>
            <div class="comments-section"></div>
        `;
        return postDiv;
    }

    function createCommentElement(text, images, originalImages = [], history = []) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment ai-comment-style';

        let imagesHtml = '';
        if (images) {
            const imageArray = Array.isArray(images) ? images : [images];
            imagesHtml = `
                <div class="comment-image-wrapper">
                    ${imageArray.map(img => `
                        <div class="comment-image-item">
                            <img src="${img}" class="comment-image">
                            <a href="${img}" download="photoshop_villain_result.jpg" class="download-link">
                                <i data-lucide="download" size="14"></i> 저장
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        commentDiv.innerHTML = `
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=BananaBoss" class="comment-avatar">
            <div class="comment-content">
                <span class="comment-author">포토샵 해드립니다</span>
                <span class="comment-text">${text}</span>
                ${imagesHtml}
                <button class="rebuttal-btn"><i data-lucide="message-circle" size="12"></i> 반박하기</button>
                <div class="reply-input-container hidden">
                    <input type="text" class="reply-input" placeholder="AI에게 반박하세요...">
                    <button class="reply-submit"><i data-lucide="send" size="14"></i></button>
                </div>
            </div>
        `;

        const rebuttalBtn = commentDiv.querySelector('.rebuttal-btn');
        const replyContainer = commentDiv.querySelector('.reply-input-container');
        const replyInput = commentDiv.querySelector('.reply-input');
        const replySubmit = commentDiv.querySelector('.reply-submit');

        rebuttalBtn.addEventListener('click', () => {
            replyContainer.classList.toggle('hidden');
            if (!replyContainer.classList.contains('hidden')) replyInput.focus();
        });

        const submitRebuttal = () => {
            const rebuttalText = replyInput.value.trim();
            if (!rebuttalText) return;
            replyContainer.classList.add('hidden');
            replyInput.value = '';

            const commentsSection = commentDiv.closest('.comments-section');
            const currentHistory = history.length > 0 ? history : [
                { role: 'user', text: commentDiv.closest('.post-card').querySelector('.user-prompt').innerText },
                { role: 'ai', text: text }
            ];

            showAdModal({
                images: originalImages.length > 0 ? originalImages : JSON.parse(commentDiv.closest('.post-card').dataset.originalImages),
                text: rebuttalText,
                commentsSection: commentsSection,
                history: currentHistory
            });
        };

        replySubmit.addEventListener('click', submitRebuttal);
        replyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitRebuttal();
        });

        return commentDiv;
    }

    async function callGeminiNanoBanana(images, prompt, userAvatar, userName, history = []) {
        const response = await fetch('https://dophotoshopforyou.onrender.com/api/troll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images, prompt, userAvatar, userName, history })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server Error');
        }
        return await response.json();
    }

    // --- Image Lightbox Logic ---
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.querySelector('.lightbox-close');

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('post-image') || e.target.classList.contains('comment-image')) {
            lightboxImg.src = e.target.src;
            lightbox.classList.remove('hidden');
        }
    });

    lightboxClose.addEventListener('click', () => lightbox.classList.add('hidden'));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.classList.add('hidden'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) lightbox.classList.add('hidden'); });

    // --- File Handling ---
    function handleFile(files) {
        if (!files) return;
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                uploadedImages.push(event.target.result);
                updatePreviewGrid();
            };
            reader.readAsDataURL(file);
        });
    }

    function updatePreviewGrid() {
        if (uploadedImages.length === 0) {
            previewGrid.classList.add('hidden');
            uploadPlaceholder.classList.remove('hidden');
            return;
        }
        previewGrid.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        previewGrid.innerHTML = '';
        uploadedImages.forEach((src, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            item.innerHTML = `<img src="${src}"><div class="preview-remove" data-index="${index}">&times;</div>`;
            previewGrid.appendChild(item);
        });
        previewGrid.querySelectorAll('.preview-remove').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                uploadedImages.splice(parseInt(btn.dataset.index), 1);
                updatePreviewGrid();
            };
        });
    }
});
