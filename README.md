# 설비 비가동 집계 · 가동률 보고서

참고: https://build-2611-11.jobability.co.kr/index.html

공개 사이트의 HTML, CSS, JavaScript, 이미지와 문서를 보존한 독립 실행용 사본입니다. 원본의 제작자 표기를 유지하며 Cloudflare 방문 추적 및 원본 주소를 가리키는 canonical/일부 공유 메타데이터를 제거했습니다. 별도의 이용 허락이나 라이선스가 부여된 것으로 간주하지 않습니다.

## ChatGPT 계정으로 사용

공개 사이트의 **스캔본 읽기 다운로드** 메뉴 → **PC 실행 프로그램 다운로드 (ZIP)** 버튼 → ZIP **모두 압축 풀기** → `equipment-downtime-report-main/start-chatgpt.cmd` 실행 순서로 시작합니다. Node.js 22.12 이상을 먼저 설치하고 풀린 폴더 전체를 유지하세요. Windows에서 `start-chatgpt.cmd`를 실행한 뒤 **ChatGPT로 로그인**하면 API 키 없이 계정의 승인된 구독 사용 권한으로 파일 읽기를 요청할 수 있습니다. Node.js 22.12 이상과 인터넷 연결이 필요합니다. 계정별 PDF·이미지 지원은 실제 로그인 후 확인해야 합니다. 설치·보안·라이선스·지원 범위는 [CHATGPT_LOGIN.md](CHATGPT_LOGIN.md)를 확인하세요.

## 자동 동기화

확인한 작업일보·엑셀 자료와 집계 설정을 이메일 인증 없이 하나의 공개 작업 공간에 자동 동기화합니다. 누구나 PC 실행 프로그램을 다운로드하고 공유 자료를 보고 수정할 수 있습니다. 원본 PDF/사진과 ChatGPT 로그인 정보는 공유하지 않습니다. 기존 프로젝트에서는 `supabase/public-sync.sql`을 한 번 실행하고 공개페이지를 배포한 뒤 새 ZIP을 받으세요. 기존 이메일 계정 자료는 자동 공개하지 않으며, 보관된 PC 화면에서 자료를 확인하고 **이 PC 자료로 저장**하면 공개 작업 공간으로 옮길 수 있습니다. 자세한 연결 방법은 [CLOUD_SYNC.md](CLOUD_SYNC.md)를 참고하세요.

## 실행

각 페이지 대제목 위에 버전이 표시됩니다. GitHub Pages 배포 시 `1.0`부터 시작하는 숫자 버전과 배포 생성 시각(한국시간)을 자동으로 넣고, 로컬 JavaScript·CSS 주소에도 커밋별 버전을 붙입니다. 저장소 파일을 로컬에서 직접 열면 `1.0 · 개발 중 (미배포)`로 표시됩니다. 표시 버전은 `release.json`의 기준 커밋 이후 첫 커밋을 `1.0`, 다음 커밋을 `1.1`, `1.2` 순서로 계산합니다. 같은 커밋을 재배포하면 버전은 그대로이며, 캐시 구분에는 계속 전체 커밋 번호를 사용합니다.

스캔 읽기는 ChatGPT 로그인 방식만 사용합니다. Windows에서 `start-chatgpt.cmd` 실행 → ChatGPT 로그인 → 모델 선택 → PDF/사진 선택 → 전송 동의 → 읽기 순서입니다. API 키 입력과 키 기반 호출 기능은 제거했습니다.

`npm.cmd run preview`로 실행하고 http://127.0.0.1:8765 에서 가동·비가동 분석을 여세요. `index.html`은 새 분석 화면이며 `import.html`에서 기존 엑셀 업로드·기준 설정·공유 동기화·내보내기를 사용할 수 있습니다. 분석 화면은 JSON 운영자료를 읽으므로 HTTP 서버가 필요합니다. 자세한 데이터 출처와 구현 결정은 [IMPLEMENTATION-NOTES.md](IMPLEMENTATION-NOTES.md)를 참고하세요.

정적 GitHub Pages에서는 수동 입력·예제·집계·내보내기를 사용할 수 있습니다. ChatGPT 로그인과 문서 읽기는 PC 실행 화면에서 이용합니다. 공개 사이트에 로컬 로그인 서버를 연결하지 않습니다.

## 별도 GitHub 저장소에 올리기

이 폴더는 독립적인 Git 저장소입니다. GitHub에서 비어 있는 새 저장소를 만든 후 이 폴더에서 실행하세요.

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/equipment-downtime-report.git
git push -u origin main
```

GitHub Settings → Pages → Source에서 **GitHub Actions**를 선택하면 포함된 워크플로가 `public` 폴더를 배포합니다.

`download-reference.ps1`은 원본 공개 파일을 수집한 도구입니다. 다시 실행하면 로컬 수정 내용을 원본 파일로 덮어씁니다.
