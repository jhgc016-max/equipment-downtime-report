# 설비 비가동 집계 · 가동률 보고서

참고: https://build-2611-11.jobability.co.kr/index.html

공개 사이트의 HTML, CSS, JavaScript, 이미지와 문서를 보존한 독립 실행용 사본입니다. 원본의 제작자 표기를 유지하며 Cloudflare 방문 추적 및 원본 주소를 가리키는 canonical/일부 공유 메타데이터를 제거했습니다. 별도의 이용 허락이나 라이선스가 부여된 것으로 간주하지 않습니다.

## 실행

스캔 읽기는 API 키·결제·서버 없이 브라우저에서 무료로 처리합니다. PDF/사진 선택 → 양식 선택 → 「무료로 읽기」 → 원본과 인식 텍스트/표 확인·수정 → 확인란 선택 → 집계 전달 순서입니다. 텍스트 PDF는 PDF.js로 추출하고, 스캔/사진 및 이미지 포함 PDF 페이지는 Tesseract.js 한국어·영어 OCR을 사용합니다. 손글씨·표는 정확하지 않을 수 있으므로 누락 행과 시간·코드를 직접 확인해야 합니다.

`public/index.html`을 브라우저에서 열고 **예제로 해보기**를 누르세요. 엑셀 업로드, 기준 설정, 가동률 차트, 보고서 인쇄 및 HTML·엑셀 내보내기가 포함됩니다. 스캔본 읽기, 사용법, 기획서는 각각 별도 페이지입니다.

일반 정적 웹 서버에서는 `public`을 문서 루트로 지정하세요. 빌드나 패키지 설치는 필요 없습니다. GitHub Pages에서도 동작합니다. 최초 PDF/OCR 실행 시 고정 버전 라이브러리와 언어 데이터를 CDN에서 다운로드하므로 인터넷 연결이 필요합니다. 문서는 외부 API로 전송하지 않습니다. 파일당 10MB, PDF 최대 30쪽을 처리하고 OCR 이미지는 긴 변을 최대 3000px로 렌더링합니다. 암호 PDF는 잠금을 해제한 후 사용하세요. 기존 OpenAI/중계 모듈은 이전 버전 호환용으로 남겨 두었으나 기본 스캔 화면에서는 로드하거나 호출하지 않습니다.

## 별도 GitHub 저장소에 올리기

이 폴더는 독립적인 Git 저장소입니다. GitHub에서 비어 있는 새 저장소를 만든 후 이 폴더에서 실행하세요.

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/equipment-downtime-report.git
git push -u origin main
```

GitHub Settings → Pages → Source에서 **GitHub Actions**를 선택하면 포함된 워크플로가 `public` 폴더를 배포합니다.

`download-reference.ps1`은 원본 공개 파일을 수집한 도구입니다. 다시 실행하면 로컬 수정 내용을 원본 파일로 덮어씁니다.

## 무료 읽기 검증

`npm test`와 `npm run check`를 제공합니다(Node.js 22 이상). 제공된 Node 실행 도구에서 합성 문서와 모의 PDF/OCR 워커로 22개 검증 묶음을 실행했습니다. 텍스트 배치·스캔 분기·페이지 순서·중복 방지·실패 정리·재시도·원본 검토·집계 전달을 확인했습니다. CDN 및 한국어/영어 언어 데이터의 다운로드 주소도 확인했습니다. 실제 브라우저에서의 OCR 실행 및 실제 손글씨 정확도는 확인하지 않았습니다. 유료 API 호출은 실행하지 않았습니다.

참고: [PDF.js](https://mozilla.github.io/pdf.js/examples/), [Tesseract.js](https://github.com/naptha/tesseract.js).
