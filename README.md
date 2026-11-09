# 설비 비가동 집계 · 가동률 보고서

참고: https://build-2611-11.jobability.co.kr/index.html

공개 사이트의 HTML, CSS, JavaScript, 이미지와 문서를 보존한 독립 실행용 사본입니다. 원본의 제작자 표기를 유지하며 Cloudflare 방문 추적 및 원본 주소를 가리키는 canonical/일부 공유 메타데이터를 제거했습니다. 별도의 이용 허락이나 라이선스가 부여된 것으로 간주하지 않습니다.

## 실행

`public/index.html`을 브라우저에서 열고 **예제로 해보기**를 누르세요. 엑셀 업로드, 기준 설정, 가동률 차트, 보고서 인쇄 및 HTML·엑셀 내보내기가 포함됩니다. 스캔본 읽기, 사용법, 기획서는 각각 별도 페이지입니다.

일반 정적 웹 서버에서는 `public`을 문서 루트로 지정하세요. 빌드나 패키지 설치는 필요 없습니다. 스캔 AI는 서버의 OPENAI_API_KEY를 읽는 인증 중계 서버를 사용합니다. 실행·보안 설정·GitHub Pages 연결은 [SCAN_SERVER.md](SCAN_SERVER.md)를 참고하세요.

## 별도 GitHub 저장소에 올리기

이 폴더는 독립적인 Git 저장소입니다. GitHub에서 비어 있는 새 저장소를 만든 후 이 폴더에서 실행하세요.

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/equipment-downtime-report.git
git push -u origin main
```

GitHub Settings → Pages → Source에서 **GitHub Actions**를 선택하면 포함된 워크플로가 `public` 폴더를 배포합니다.

`download-reference.ps1`은 원본 공개 파일을 수집한 도구입니다. 다시 실행하면 로컬 수정 내용을 원본 파일로 덮어씁니다.
