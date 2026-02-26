document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const uploadTrigger = document.getElementById('uploadTrigger');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const userRequest = document.getElementById('userRequest');
    const submitBtn = document.getElementById('submitBtn');
    const postsContainer = document.getElementById('postsContainer');

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
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFile);

    // --- Paste Logic ---
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                handleFile({ target: { files: [file] } });
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
        const file = e.dataTransfer.files[0];
        if (file) handleFile({ target: { files: [file] } });
    });

    // --- Initialization: Load Approved Feed ---
    async function loadFeed() {
        try {
            // Get IDs from LocalStorage to include my pending posts
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
                        image: postData.originalImage,
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
        const image = imagePreview.src;
        const hasImage = !imagePreview.classList.contains('hidden');

        if (!text && !hasImage) {
            alert('사진을 업로드하거나 요청 내용을 입력해주세요!');
            return;
        }

        const userAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=James";
        const userName = "James";

        // 1. Create Post UI immediately (Session-only pending view)
        const post = createPostElement({
            avatar: userAvatar,
            name: userName,
            prompt: text,
            image: hasImage ? image : null,
            isPending: true
        });
        postsContainer.prepend(post);

        // Reset Input
        userRequest.value = '';
        imagePreview.src = '';
        imagePreview.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');

        // 2. Add loading comment
        const commentsSection = post.querySelector('.comments-section');
        const loadingId = 'loading-' + Date.now();
        commentsSection.innerHTML = `
            <div id="${loadingId}" class="comment">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=BananaBoss" class="comment-avatar">
                <div class="comment-content">
                    <span class="comment-author">포토샵 해드립니다</span>
                    <div class="comment-loading">
                        <div class="loading-dots">
                            <div class="dot"></div>
                            <div class="dot"></div>
                            <div class="dot"></div>
                        </div>
                        <span>완벽한 편집을 진행중입니다...</span>
                    </div>
                </div>
            </div>
        `;

        try {
            // 3. Call Backend Proxy
            const result = await callGeminiNanoBanana(image, text, userAvatar, userName);

            // Save ID to LocalStorage
            if (result.id) {
                let myPostIds = localStorage.getItem('myPostIds') ? localStorage.getItem('myPostIds').split(',') : [];
                myPostIds.push(result.id);
                localStorage.setItem('myPostIds', myPostIds.join(','));
            }

            // 4. Update UI with AI result
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            const aiComment = createCommentElement(result.text, result.image);
            commentsSection.appendChild(aiComment);

            const alertMsg = document.createElement('div');
            alertMsg.style.cssText = 'font-size: 11px; color: #f02849; margin-top: 5px; font-weight: 600; padding: 0 10px;';
            alertMsg.innerText = '⚠️ 이 게시물은 현재 검토 대기 중입니다. 관리자 승인 시 모든 사람에게 공개됩니다.';
            commentsSection.appendChild(alertMsg);

            lucide.createIcons();
        } catch (err) {
            console.error(err);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = `<p style="color:red; padding:10px;">에러가 발생했습니다: ${err.message}</p>`;
            }
        }
    }

    // --- Helper UI Functions ---
    function createPostElement({ avatar, name, prompt, image, isPending }) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-card';
        if (isPending) postDiv.style.opacity = '0.8';

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
                ${image ? `
                    <div class="post-image-container">
                        <img src="${image}" class="post-image">
                    </div>
                ` : ''}
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

    function createCommentElement(text, image) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment ai-comment-style';

        let imageHtml = '';
        if (image) {
            imageHtml = `
                <div class="comment-image-wrapper">
                    <img src="${image}" class="comment-image">
                    <a href="${image}" download="photoshop_villain_result.jpg" class="download-link">
                        <i data-lucide="download" size="14"></i> 저장하기
                    </a>
                </div>
            `;
        }

        commentDiv.innerHTML = `
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=BananaBoss" class="comment-avatar">
            <div class="comment-content">
                <span class="comment-author">포토샵 해드립니다</span>
                <span class="comment-text">${text}</span>
                ${imageHtml}
            </div>
        `;
        return commentDiv;
    }

    // Backend Proxy Call
    async function callGeminiNanoBanana(base64Image, prompt, userAvatar, userName) {
        const response = await fetch('https://dophotoshopforyou.onrender.com/api/troll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image, prompt, userAvatar, userName })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Server Error');
        }
        return await response.json();
    }

    function handleFile(e) {
        const file = (e.target && e.target.files) ? e.target.files[0] : (e.dataTransfer && e.dataTransfer.files[0]);
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
});
