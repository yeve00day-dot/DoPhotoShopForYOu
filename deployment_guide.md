# 🚀 배포 가이드 (최종 완성본)

프로젝트에 **백엔드(Node.js)**가 추가되었으므로, 이제 두 단계를 거쳐 배포해야 합니다.

## 1단계: 백엔드 서버 배포 (Render.com 추천)
가장 쉽고 무료로 Node.js 서버를 운영할 수 있는 방법입니다.

1.  **코드를 GitHub에 올리기**: `posts.json`과 `.env` 파일을 제외한 모든 파일을 GitHub 저장소에 올립니다.
2.  **Render 가입 및 웹 서비스 생성**: [Render](https://render.com/)에 가입하고 **New > Web Service**를 누른 뒤 GitHub 저장소를 연결합니다.
3.  **환경 변수(Environment Variables) 설정**: Render 설정 페이지에서 아래 두 값을 입력합니다. (매우 중요!)
    - `GEMINI_API_KEY`: 발급받으신 Gemini API 키
    - `ADMIN_PASSWORD`: 관리자 페이지 비밀번호 (`GgIdSml...`)
4.  **배포 완료**: Render에서 주소(예: `https://my-villain-bot.onrender.com`)가 나오면 성공입니다.

---

## 2단계: 프론트엔드 코드 수정 (매우 중요!)
서버 주소가 생겼으므로, 내 컴퓨터(`localhost`)가 아닌 **실제 서버 주소**를 바라보게 코드를 한 줄 고쳐야 합니다.

1.  `script.js` 파일에서 `http://localhost:3000` 부분을 찾습니다.
2.  해당 부분을 Render에서 받은 **실제 서버 주소**로 모두 바꿉니다.
    - 예: `fetch('https://dophotoshopforyou.onrender.com/api/troll', ...)`
3.  `admin.html` 파일의 자바스크립트 부분에 있는 주소도 똑같이 바꿔줍니다.

---

## 3단계: 프론트엔드 배포 (GitHub Pages / Netlify)
이제 수정된 파일을 평소처럼 배포하면 됩니다.

- **GitHub Pages**: 저장소 설정에서 Pages 기능을 켭니다.
- **Netlify**: 폴더를 드래그 앤 드롭으로 업로드합니다.

---

> [!IMPORTANT]
> **보안 확인**
> 이제 API 키가 소스코드(`script.js`)가 아닌 서버 환경변수에 숨겨져 있어 매우 안전합니다! 마음껏 공유하셔도 됩니다.

> [!TIP]
> **데이터 유실 주의**
> 무료 호스팅(Render 등)은 서버가 잠자기 모드에 들어갈 때 `posts.json` 파일이 초기화될 수 있습니다. 만약 게시글을 영구적으로 보관하고 싶다면 나중에 MongoDB 같은 데이터베이스 서비스 연결이 필요합니다.
