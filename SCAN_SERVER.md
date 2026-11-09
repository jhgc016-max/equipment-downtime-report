> 현재 기본 scan.html은 API 키 없이 PDF 텍스트 추출과 무료 OCR을 브라우저에서 실행합니다. 아래 서버/API 설명은 이전 방식에 관한 참고 자료이며 현재 기본 화면에서는 사용하지 않습니다.

# 스캔 AI 중계 서버

스캔 화면은 OpenAI Responses API의 `gpt-6.1-sol`만 사용합니다. 다른 모델로 자동 전환하지 않습니다. 사진(JPEG/PNG/WEBP)과 PDF를 파일별로 순차 처리하며, 파일당 최대 10MB입니다. PDF는 전체 파일을 `input_file`과 `detail: "high"`로 요청 본문에 포함합니다. 이미지는 `input_image`입니다. 별도 Files API 업로드나 영구 파일 ID는 만들지 않습니다.

## 로컬 실행

Node.js 22 이상을 설치합니다. 런타임 의존 패키지는 없으며 별도 빌드 과정도 없습니다.

```powershell
Copy-Item .env.example .env
# .env를 로컬 편집기로 열어 아래 값을 설정
npm start
```

- `OPENAI_API_KEY`: 서버에서만 읽는 실제 OpenAI API 키. 브라우저나 채팅에 입력하지 않습니다.
- `SCAN_ACCESS_TOKEN`: OpenAI 키와 별개의, 32자 이상 무작위 접근 암호. 허용한 사용자에게만 별도로 전달합니다.
- `ALLOWED_ORIGINS`: 쉼표로 구분한 정확한 사이트 origin. 로컬 기본값은 `http://localhost:8787`입니다.
- `HOST`: 로컬은 `127.0.0.1`, 컨테이너/서버 호스팅은 `0.0.0.0`.
- `PORT`: 기본 `8787`. 호스팅 서비스의 포트 환경변수를 사용할 수 있습니다.

브라우저에서 http://localhost:8787/scan.html 을 엽니다. 중계 서버 URL은 비워 두고, **중계 접근 암호**에 SCAN_ACCESS_TOKEN을 입력합니다. API 키 입력란은 없습니다. 암호는 페이지 메모리에서만 사용하고 저장하지 않습니다. 기존 스캔 화면이 저장했던 API 키 항목은 새 화면 초기화 시 삭제합니다.

## GitHub Pages + 별도 서버

GitHub Pages에서는 서버 코드를 실행할 수 없습니다. 기존 GitHub Actions는 계속 `public/`만 배포합니다. 이번 작업에서는 커밋·푸시·배포를 실행하지 않았습니다.

1. 별도 Node 호스팅/VPS에 이 프로젝트를 배치합니다. 서버에서 `server/`와 `public/`를 모두 읽을 수 있어야 합니다. 설치 명령은 필요 없습니다.
2. 호스팅 서비스의 비밀 환경변수 설정에 OPENAI_API_KEY와 SCAN_ACCESS_TOKEN을 설정합니다. 소스나 공개 배포 파일에 값을 넣지 않습니다.
3. `HOST=0.0.0.0`, `ALLOWED_ORIGINS=https://jhgc016-max.github.io`를 설정합니다. 경로 `/equipment-downtime-report`는 origin에 넣지 않습니다. 필요하면 로컬 origin도 쉼표로 추가합니다.
4. 시작 명령은 `node server/server.cjs`입니다. 호스트가 제공하는 HTTPS 주소를 사용하거나 HTTPS 리버스 프록시 뒤에 둡니다. 외부 평문 HTTP로 암호를 전송하지 않습니다.
5. Pages의 scan.html에서 **중계 서버 URL**에 예를 들어 `https://your-relay.example`을 입력합니다. 요청은 이 주소의 `/api/scan`으로 갑니다. 중계 접근 암호를 입력하고 외부 전송에 동의한 후 실행합니다. URL과 암호는 새로고침 후 다시 입력해야 합니다.
6. 운영 프록시의 요청 본문 한도는 14MB 이상, 응답 대기 시간은 200초 이상으로 설정합니다. 프록시/APM에서 Authorization 헤더·요청/응답 본문을 수집하지 않도록 설정합니다.

접근 암호 미설정/32자 미만 또는 API 키 미설정 시 서버가 시작하지 않습니다. CORS 허용 목록만으로 인증을 대신하지 않습니다. 모든 AI 요청은 접근 암호 검증 후 처리합니다. 서버 전체에 분당 5회·UTC 기준 하루 50회·동시 1회의 제한을 적용하며 실패 요청도 계산합니다. 제한은 단일 프로세스 메모리 기준으로 재시작 시 초기화됩니다. 단일 인스턴스로 운영하고, 재시작을 넘는 예산 제한이 필요하거나 여러 인스턴스를 운영할 경우 호스팅 게이트웨이/공유 저장소 기반 한도도 설정하세요. 접근 암호는 허용 사용자에게만 배포하고 노출 시 교체합니다.

## 데이터와 사람의 확인

파일과 추출 값은 서버의 처리 메모리에서만 사용하며 서버 디스크·애플리케이션 로그에 남기지 않습니다. `store:false`로 Responses 객체 저장을 요청하지 않습니다. 이것이 OpenAI의 모든 보관을 없애는 의미는 아닙니다. OpenAI API 데이터 보관·모니터링 정책과 조직 설정을 확인해야 합니다. 인프라 로그 수집도 운영자가 별도로 설정해야 합니다.

모델 출력은 strict JSON Schema로 제한하고 서버에서 다시 검사합니다. 원문 `raw`와 정규화 값, 1부터 시작하는 sourcePage, 행·필드 경로별 reviews를 유지합니다. 불확실한 원문은 null로 남고 검토 화면의 기존 입력칸에서는 빈 문자열로 표시합니다. 0으로 바꾸지 않습니다. 시간 정규화와 소요 시간 계산은 원문과 분리됩니다. 행 번호 누락·시간 오류·역전·범위 초과·비가동 중복은 검토 대상으로 표시합니다. 모델이 보고한 전체 페이지 수와 출력 페이지 순서/수가 다르면 결과를 거절합니다. 모델이 원본 자체를 잘못 판독한 누락까지 보장할 수 없으므로 사람이 실제 페이지와 행 수를 확인해야 합니다.

사진·PDF 원본은 브라우저 Blob URL로 보여 주고, PDF는 원본 페이지 번호로 열 수 있습니다. PDF 뷰어 미지원 브라우저에서는 원본 링크를 이용합니다. 읽은 원문은 수정 전 접기 영역에 보존합니다. 실패한 파일만 재시도할 수 있고 성공한 파일을 재호출하지 않습니다. 여러 파일은 선택 순서, 각 PDF는 페이지 순서로 검토합니다. 모든 페이지·검토 항목 확인 체크를 해야 집계 전달 또는 엑셀 내보내기가 가능합니다. 수정·추출·삭제 후에는 체크를 초기화합니다. 기존 집계 전달 형식과 계산/엑셀 기능을 유지하며, 확인 후 집계용 값은 기존 방식대로 브라우저 저장소에 저장됩니다. 원본 파일은 저장하지 않습니다.

## 검증

```sh
npm run check
npm test
```

테스트는 가짜 이미지/PDF 바이트, 합성 응답 및 로컬 HTTP 서버를 사용합니다. OpenAI에 연결하거나 비용을 발생시키지 않습니다. PDF/사진 요청, Structured Outputs 변환, null/행 유지, 페이지 누락·거절·불완전 응답·스키마 오류, 인증·CORS·호출 제한, 예제/기존 집계 변환, 화면 확인 체크·원본 연결·재시도·파일 순서를 검증합니다.

이번 환경은 셸 PATH에 node/npm이 없어 제공된 Node 실행 도구로 동일 테스트 함수(15개 검증 묶음)와 문법 검사를 실행했습니다. 기존 프로젝트에는 별도 테스트/빌드 명령이 없었습니다. 실제 API 모델 권한, 실제 필기 인식 품질, 실제 PDF 렌더링/페이지 판독, 토큰 한도·요금, 운영 HTTPS/CORS는 실제 호출로 확인하지 않았습니다. 실제 자료 전송/유료 검증은 별도 허락 후 진행해야 합니다. UI 검증은 가짜 DOM을 사용했으며 실제 브라우저 시각 검증은 포함하지 않습니다.

## 공식 문서

- [GPT-6.1 Sol 모델](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [PDF와 file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
