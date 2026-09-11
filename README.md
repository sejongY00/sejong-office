# sejong-office

임시 세션 기반 문서·도면·스캔 웹앱입니다.

- **오피스 / PDF** → [Euro-Office Document Server](https://github.com/Euro-Office/DocumentServer)
- **HWP / HWPX** → [rhwp](https://github.com/edwardkim/rhwp) (`@rhwp/editor`)
- **다이어그램** → Excalidraw · Mermaid · draw.io (브라우저)
- **CAD** → [MLightCAD](https://github.com/mlightcad/cad-viewer) (DXF/DWG, LibreDWG)
- **3D** → [Online 3D Viewer](https://github.com/kovacsv/Online3DViewer) (glTF, OBJ, STEP, IFC, STL, 3DM 등)
- **문서 스캐너** → jscanify + OpenCV.js · [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) (PP-OCRv5 한국어) · PDF.js

서버에 문서를 **영구 저장하지 않습니다**. 오피스·PDF는 세션 동안만 tmpfs에 두고, 브라우저 종료·TTL로 삭제합니다. HWP/HWPX·CAD·3D·스캐너는 기본적으로 브라우저 메모리에서만 다룹니다. 결과는 **다운로드**로만 가져가세요.

## 스택

- Vue 3 + Vite + TypeScript (프론트)
- Express + TypeScript (API·정적 서빙)
- Docker Compose (앱 + Document Server)
- 뷰어·OCR·PDF.js worker 등은 `/viewer-assets/`에 **자체 호스팅** (CDN 런타임 fetch 없음)

## 빠른 시작 (Docker)

```bash
cp .env.example .env
# JWT_SECRET 을 긴 임의 문자열로 바꾸세요

# 로컬에서 이미지 빌드 (레지스트리 없이 테스트할 때)
docker build -t docker.sejong.dev/sejong-office:latest .

docker compose up -d
```

프로덕션(레지스트리 pull):

```bash
# 이미지: docker.sejong.dev/sejong-office:latest (호스트 고정)
docker compose pull
docker compose up -d
```

- 앱: http://localhost:3000
- Document Server: http://localhost:8080

첫 Document Server 기동은 수 분 걸릴 수 있습니다. 프론트 빌드 시 Paddle OCR 모델·ORT WASM을 내려받으므로 네트워크와 디스크 여유가 필요합니다.

### docker-compose 예시

[`docker-compose.yml`](docker-compose.yml) — backend는 `docker.sejong.dev/sejong-office:latest`를 pull합니다. (아래는 값 고정 예시)

```yaml
services:
  backend:
    # 고정: 레지스트리 호스트 docker.sejong.dev, 이미지 sejong-office:latest
    image: docker.sejong.dev/sejong-office:latest
    ports:
      # 변경: 호스트 포트 (왼쪽). 컨테이너는 3000 고정
      - '3000:3000'
    environment:
      # 변경(필수): backend ↔ Document Server 공유 JWT. 긴 임의 문자열
      JWT_SECRET: change-me-to-a-long-random-secret
      # 변경: 브라우저가 접근하는 앱 공개 URL
      PUBLIC_URL: https://office.example.com
      # 보통 유지: compose 네트워크 안에서 backend 컨테이너 주소
      INTERNAL_URL: http://backend:3000
      # 변경: 브라우저가 접근하는 Document Server 공개 URL
      ONLYOFFICE_URL: https://office.example.com/ds
      # 보통 유지: compose 네트워크 안 Document Server 주소
      ONLYOFFICE_INTERNAL_URL: http://documentserver
      # 변경 가능: 세션 TTL(ms). 기본 15분
      SESSION_TTL_MS: '900000'
      # 유지: 컨테이너 내 임시 문서 경로 (아래 tmpfs와 맞출 것)
      TEMP_DIR: /tmp/sejong
      # 유지: 컨테이너 리스닝 포트
      PORT: 3000
      # 변경 가능: 업로드 최대 크기(MB)
      MAX_UPLOAD_MB: '50'
    tmpfs:
      # 변경 가능: 임시 저장 용량. TEMP_DIR 과 경로 일치
      - /tmp/sejong:size=512m,mode=1777
    depends_on:
      - documentserver
    restart: unless-stopped

  documentserver:
    # 유지 권장: 버전 태그 pin
    image: ghcr.io/euro-office/documentserver:v9.3.2
    ports:
      # 변경: 호스트 포트 (왼쪽). 프록시만 쓸 거면 공개 안 해도 됨
      - '8080:80'
    environment:
      JWT_ENABLED: 'true'
      # 변경(필수): backend 의 JWT_SECRET 과 반드시 동일
      JWT_SECRET: change-me-to-a-long-random-secret
      JWT_HEADER: Authorization
      JWT_IN_BODY: 'true'
    volumes:
      - documentserver_data:/var/www/onlyoffice/Data
    restart: unless-stopped

volumes:
  documentserver_data:
```

## CI/CD (Jenkins)

[`Jenkinsfile`](Jenkinsfile) 이 `main` PR/브랜치에서 `npm ci` + `npm run build`를 돌리고, **`main` 브랜치 빌드**(PR 제외)에서만 이미지를 push한 뒤 서버에 SSH로 배포합니다.

에이전트에 Docker가 있어야 합니다. Node 22는 `node:22-bookworm` 컨테이너로 돌리며, Vite 힙 한도는 `NODE_OPTIONS=--max-old-space-size=8192`입니다.

푸시 태그: `docker.sejong.dev/sejong-office:latest`, `docker.sejong.dev/sejong-office:sha-<commit>`

배포는 [Publish Over SSH](https://plugins.jenkins.io/publish-over-ssh/)로 파일을 올리지 않고, 서버에 이미 있는 `docker-compose.yml` 디렉터리에서 `docker compose pull && docker compose up -d`만 실행합니다.

### Jenkins Credentials

Username/password 자격 증명 ID: `docker-sejong-dev`

| 필드 | 설명 |
|------|------|
| Username | push 전용 계정 |
| Password | push 전용 토큰 (write) |

레지스트리 호스트는 `docker.sejong.dev`로 고정입니다. PR 빌드는 이 자격 증명을 쓰지 않습니다. 에이전트에 상시 `docker login` 하지 마세요.

Multibranch Pipeline(또는 Gitea/Git 브랜치 소스)로 이 레포를 연결하면 PR과 `main`이 각각 잡으로 뜹니다.

### Publish Over SSH

1. Jenkins에 **Publish Over SSH** 플러그인 설치
2. **Manage Jenkins → System → Publish over SSH** 에 배포 서버 등록 (호스트, 사용자, 키 또는 비밀번호)
3. 등록한 **Name**이 Jenkinsfile의 `SSH_CONFIG_NAME`과 같아야 함 (`SEJONG-NAS`)
4. 배포 명령은 SSH 접속 후 `sudo -n su -c '...'` 로 root에서 실행함. 대화형 `sudo su`와 비밀번호 입력은 CI에서 불가
5. Publish Over SSH에 넣은 **그 계정**으로 서버에 로그인한 뒤, 한 번만 NOPASSWD를 설정:

```bash
sudo visudo -f /etc/sudoers.d/sejong-office-deploy
```

파일 내용 (SSH 사용자 이름으로 바꿀 것):

```
youruser ALL=(ALL) NOPASSWD: /bin/su, /usr/bin/su
```

저장 후 비밀번호 없이 root가 되는지 확인:

```bash
sudo -n su -c 'whoami'
# root
```

`sudo -n`은 비밀번호를 묻지 않고, 설정이 안 되어 있으면 바로 실패합니다. Jenkinsfile에 비밀번호를 넣지 마세요.

비로그인 SSH의 PATH에는 `/usr/local/bin`이 없어서 시놀로지의 `docker`를 못 찾습니다. 그래서 배포 명령이 PATH를 직접 지정합니다. 다음이 같은 결과여야 합니다:

```bash
ssh -T youruser@nas "sudo -n su -c 'export PATH=/usr/local/bin:/usr/bin:/bin; command -v docker'"
# /usr/local/bin/docker
```

서버 compose 경로는 Jenkinsfile `DEPLOY_DIR` (`/volume1/docker/sejong-office`)입니다. 이름이나 경로가 다르면 Jenkinsfile을 수정하면 됩니다.

### 서버 배포 체크리스트

1. 배포 디렉터리에 `docker-compose.yml`과 `.env`를 두고, **pull 전용** 토큰으로 `docker login docker.sejong.dev` (CI push 토큰과 분리)
2. `.env`에 `JWT_SECRET`, URL 설정
3. `main` 배포 잡이 이미지 push 후 그 디렉터리에서 compose pull/up 실행
4. `JWT_SECRET`은 Git·이미지·Jenkins Credential에 넣지 않음 (서버 `.env`만)

## 로컬 개발

```bash
npm install
cp .env.example .env

# 터미널 1 — API (포트 3000)
npm run dev:backend

# 터미널 2 — Vite (포트 5173, /api 프록시)
# predev 가 viewer-assets(CAD·3D·스캐너·OCR 모델)를 복사합니다
npm run dev:frontend
```

Euro-Office Document Server는 Docker로만 띄워도 됩니다.

```bash
docker compose up documentserver
```

## 문서 스캐너 (`/tools/scanner`)

브라우저에서만 동작합니다.

- **입력**: PNG/JPEG/WebP 등 이미지, 카메라, **다페이지 PDF**(PDF.js로 페이지 래스터화)
- **보정**: 문서 코너 검출·드래그 수정·원근 보정 (jscanify / OpenCV.js)
- **OCR**: PP-OCRv5 Korean (한글·영문), ONNX Runtime Web (WebGPU 우선)
- **목록**: 하단 드롭으로 추가, 드래그로 **순서 변경**
- **저장**: 목록 순서대로 검색 가능 PDF(투명 텍스트 레이어), 또는 PNG로 저장

## 소스 저장소 링크

프론트 [`packages/frontend/src/config/app.ts`](packages/frontend/src/config/app.ts) 의 `APP_GIT_URL` 에 Git URL을 넣으면 푸터에 **소스 코드** 링크가 표시됩니다.

## 라이선스 고지

앱 내 [/licenses](http://localhost:3000/licenses) 에서 상세 고지를 볼 수 있습니다.

- **본 앱: GPL-3.0-only** (LibreDWG / MLightCAD DWG 경로 포함)
- Euro-Office Document Server: AGPL-3.0 (배포 시 의무 확인)
- rhwp: MIT — Hancom 상표와 무관한 독립 프로젝트
- Online 3D Viewer · ppu-paddle-ocr · pdf-lib 등: 각 패키지 라이선스(MIT/Apache-2.0 등)
- PDF.js: Apache-2.0 · PaddleOCR 모델: Apache-2.0

## 포맷 안내

| 확장자 | 엔진 | 비고 |
|--------|------|------|
| hwp, hwpx | rhwp | 원본 확장자로 export |
| pdf, docx, xlsx, pptx 등 | Euro-Office | 세션 tmpfs · `forcesave` / ConvertService |
| dxf, dwg | MLightCAD | 클라이언트 뷰어 · 한글 폴백 글꼴(Noto Sans KR) |
| glTF, OBJ, STEP, IFC, STL, 3DM 등 | Online 3D Viewer | `/viewer-assets/o3dv/` 자체 호스팅 |
| png, jpg, webp, … / pdf(스캐너) | 문서 스캐너 | OCR PDF·PNG 다운로드 |

홈에서 PDF를 열면 Document Server 편집으로 가고, 스캐너에서 PDF를 열면 **페이지 이미지로 변환 후 OCR·재저장**합니다.

rhwp는 v0.7.x 기준이며, 복잡한 공공문서에서 한컴과 조판이 다를 수 있습니다.
