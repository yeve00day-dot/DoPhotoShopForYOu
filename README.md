# 😈 포토샵 해드립니다 (Photoshop Villain)

세상에서 가장 킹받는 이미지 리터칭 서비스! 당신의 사진을 가장 멍청하고 기발한 방식으로 망쳐주는 AI 빌런입니다.

## 🚀 주요 기능
- **빌런 AI 리터칭**: 사용자의 요청을 물리적/직역적으로 해석하여 황당한 결과를 제공 (Gemini 2.5 Flash 기반)
- **반박 시스템 (Rebuttal)**: AI의 결과물에 항의하고 더 킹받는 결과를 유발하는 실시간 대화형 환경
- **페이스북 스타일 UI**: 익숙한 UI로 즐기는 킹받는 소셜 경험
- **관리자 승인 시스템**: 부적절한 게시물을 필터링하는 모더레이션 기능
- **SEO 최적화**: 검색 엔진 및 소셜 공유 최적화 완료

## 🛠 기술 스택
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Lucide Icons
- **Backend**: Node.js, Express
- **AI Engine**: Google Gemini API (`gemini-2.5-flash-image`)
- **Storage**: JSON-based persistent storage

## ⚙️ 로컬 실행 방법
1. 저장소를 클론합니다.
2. `.env` 파일을 생성하고 `GEMINI_API_KEY`를 설정합니다.
3. 필요한 패키지를 설치합니다: `npm install`
4. 서버를 실행합니다: `node server.js`
5. 브라우저에서 `http://localhost:3000`에 접속합니다.

## ⚠️ 주의사항
- 본 서비스는 유머와 재미를 위한 프로젝트입니다. 
- 타인의 권리를 침해하거나 부적절한 이미지를 업로드하지 마세요.
- `.env` 파일은 절대로 공유하거나 GitHub에 업로드하지 마세요.
