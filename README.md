# 메모장 (Memo-Note)

마크다운처럼 입력하면 바로 서식이 적용되는 개인 메모장. 메모는 브라우저(IndexedDB)에 저장하고, 구글로 로그인하면 구글 드라이브의 앱 전용 숨김 폴더(appDataFolder)로 기기 간 동기화한다. Park-Hub 가 같은 파일로 마지막 백업 시각을 보여준다.

## 실행

Node **20.12 이상**.

```bash
cp .env.example .env   # 구글 OAuth 값 채우기 (비워 두면 이 브라우저에만 저장)
npm install
npm run dev            # 프론트 http://localhost:5182 + API 서버 :8790
npm run build          # 타입체크 + vite build
```

## 입력 서식

TipTap(ProseMirror) 에디터의 입력 규칙으로, 아래처럼 치는 순간 서식으로 바뀐다.

| 입력 | 결과 |
|---|---|
| `# ` / `## ` / `### ` | 제목 1~3 |
| `- ` 또는 `* ` | 글머리 목록 |
| `1. ` | 번호 목록 |
| `[ ] ` / `[x] ` | 체크리스트 |
| `> ` | 인용 |
| ` ``` ` | 코드 블록 |
| `---` | 구분선 |
| `**굵게**` `*기울임*` `` `코드` `` `~~취소선~~` | 글자 서식 |

단축키(`Ctrl+B`, `Ctrl+I`, `Ctrl+Z` 등)도 쓸 수 있다. 메모는 HTML 로 저장한다(마크다운 원문을 보관하지 않는다).

## 링크 카드 (`src/editor/LinkCard.tsx`, `server/linkPreview.ts`)

- 빈 줄에 주소 하나만 붙여넣으면 썸네일·제목·설명 카드가 된다. 문장 중간에 붙여넣은 주소는 평범한 링크로 둔다.
- 서버의 `GET /api/link-preview?url=` 가 페이지 앞부분(최대 1MB)을 읽어 og 태그(없으면 `<title>`·meta description)를 돌려준다. 브라우저는 CORS 때문에 남의 페이지를 직접 못 읽는다.
- 카드 정보는 메모 HTML 의 `data-` 속성으로 저장돼 동기화된다. 썸네일은 원본 이미지 주소를 그대로 보여준다(파일을 받아 두지 않음).
- 서버가 남 대신 요청을 보내는 API 라 **허용 계정으로 로그인해야** 쓸 수 있다. 로그인 설정이 없으면 로컬 개발에서만 열린다.
- 내부망 차단: http·https 만, 주소를 DNS 로 풀어 사설·루프백·링크로컬 대역이면 거절, 리다이렉트는 최대 3번 직접 따라가며 매번 다시 검사, 5초 타임아웃. 검사와 실제 연결 사이에 DNS 가 바뀌는 공격(DNS rebinding)까지는 막지 않는다.
- 유튜브 등은 일반 봇에게 og 태그를 안 줘서, User-Agent 에 `facebookexternalhit` 를 넣는다.
- 로그인해야 보이는 페이지(인스타 등)나 og 태그가 없는 페이지는 실패 카드(주소 + 이유 + 다시 시도)로 남는다.

## 동작

- 첫 줄이 목록의 제목, 나머지가 미리보기. 고정한 메모가 위, 그 안은 최근 수정순.
- 입력 후 0.4초 뒤 자동 저장. 아무것도 안 적고 나간 새 메모는 지운다.
- 767px 이하에서는 목록과 에디터를 한 화면씩 보여준다.

## 드라이브 동기화 (`src/sync/`)

- 파일은 appDataFolder 의 `memo-note-data.json` 하나(`{ version, notes, tombstones }`). **Park-Hub `src/services.ts` 의 `mainFile` 과 이름이 같아야 한다.**
- 메모 단위로 합친다: 같은 메모는 `updatedAt` 이 늦은 쪽, 삭제 기록이 마지막 수정보다 늦으면 삭제가 이긴다. 삭제 기록은 90일 뒤 정리.
- 언제: 로그인 확인 직후, 이 기기에서 바꾼 뒤 2초, 탭으로 돌아올 때(30초 간격), 헤더 구름 버튼.
- 열어 둔 메모가 다른 기기에서 바뀌면, 입력 중이 아닐 때 에디터에 반영한다.

## 환경변수 (`.env`, 서버만 읽음)

| 이름 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 구글 OAuth 웹 클라이언트. **Park-Hub·노벨벙커·레시피노트와 같은 클라이언트**여야 Park-Hub 에서 백업이 보인다. 비우면 로그인·동기화가 꺼진다 |
| `ALLOWED_EMAILS` | 로그인을 허용할 구글 계정(쉼표 구분) |
| `SESSION_SECRET` | 로그인 쿠키 서명 키 (`openssl rand -base64 32`) |
| `APP_ORIGIN` | 로그인 콜백 기준 주소. 프록시 뒤라 요청 주소가 틀릴 때만 |
| `API_PORT` | 로컬 API 포트 (기본 8790) |

## 배포 (Vercel)

1. 구글 클라우드 콘솔에서 위 OAuth 클라이언트에 리디렉션 URI 추가: `http://localhost:5182/api/auth/callback`, `https://<도메인>/api/auth/callback`
2. Vercel 환경변수에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `SESSION_SECRET` 설정
3. 레포를 연결하면 `vercel.json` 대로 Vite 빌드는 정적으로, `api/index.ts` 는 함수로 올라간다.

## 알려진 한계

- 같은 메모를 두 기기에서 동시에 고치면 늦게 고친 쪽만 남는다.
- 두 기기가 같은 순간에 올리면 나중 업로드가 덮는다. 덮인 쪽 변경은 그 기기의 다음 동기화 때 다시 합쳐진다.
- 이미지 붙여넣기는 아직 없다.

스택: Vite 5 + React 18 + TypeScript + TipTap 3 / 저장: Dexie(IndexedDB) + 구글 드라이브 REST / 서버: Hono (Vercel 함수 또는 Node). 로그인·동기화 코드는 Recipe-Note 에서 가져왔다.
