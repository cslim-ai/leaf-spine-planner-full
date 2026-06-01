# Leaf-Spine Planner

Leaf-Spine Planner는 노드, Leaf, Spine 조건을 입력해 2-tier Leaf-Spine 구성을 산정하고, 구성도와 포트맵을 오프라인에서 생성하는 정적 웹 애플리케이션입니다.

이 프로젝트는 브라우저에서 직접 실행되는 HTML/CSS/JavaScript 기반 앱입니다. 실행과 주요 export 기능은 프로젝트 내부 파일만 사용하며 CDN이나 인터넷 연결에 의존하지 않습니다.

## 주요 기능

- 노드 수, 노드당 연결 포트 수, 노드 연결 포트당 링크 스피드 입력
- Leaf와 Spine의 포트 수, 포트당 링크 스피드, Twin-port Transceiver 조건 분리 입력
- Leaf/Spine 수 자동 산정 또는 Custom 수동 검증
- Non-blocking 및 Oversubscription 구성 산정
- Multi-planar Design 구성
  - 2-plane 기준으로 구성
  - 노드 연결 포트에 Twin-port Transceiver를 강제 적용
  - 노드 연결 포트의 논리 링크를 서로 다른 plane에 분산
- Multi-pods Design 구성
  - pod당 노드 수 기준으로 독립 fabric 그룹 구성
- Full, Wrapped, Summary 구성도 보기
- 구성도 zoom, pan, 가운데 정렬, 화면 맞춤
- 구성도 export: SVG, PNG, PPT
- Port Map 새 창 보기 및 export: Excel, PPT
- Report export: SVG, PDF
- Pretendard 폰트 내장으로 웹 화면, SVG/PNG export, 리포트 표시 일관성 유지

## 오프라인 동작 조건

다음 파일이 프로젝트 내부에 있으면 인터넷 연결 없이 동작합니다.

- `index.html`
- `assets/css/styles.css`
- `assets/js/*.js`
- `assets/vendor/jszip.min.js`
- `assets/vendor/pptxgen.min.js`
- `assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/*.woff2`

PPT/Excel 생성은 내장된 vendor 스크립트를 사용합니다. 웹 폰트, 구성도 SVG/PNG, 리포트 SVG/PDF는 프로젝트 내부 Pretendard subset 폰트를 사용합니다.

## 구성 산정 기준

- 기본 구성은 모든 Leaf가 모든 Spine에 연결되는 2-tier Leaf-Spine 구조입니다.
- 고가용성을 위해 Leaf와 Spine은 가능한 경우 각각 최소 2대 이상으로 산정합니다.
- Non-blocking은 전체 Leaf-Spine 업링크 대역폭이 전체 노드-Leaf 다운링크 대역폭 이상이 되도록 구성합니다.
- Oversubscription은 노드 연결 포트는 모두 Leaf에 연결하고, Leaf-Spine 업링크 수와 대역폭을 줄여 목표 비율에 맞춥니다.
- Leaf-Spine 링크는 Spine 측 Twin-port 사용 여부와 양쪽 포트 속도 조건을 기준으로 논리 링크 수와 물리 포트 사용량을 분리 산정합니다.
- 예를 들어 Leaf 400G, Spine 800G, Spine Twin-port 사용 구성에서는 논리 링크 속도를 400G로 맞추고 Spine 물리 포트 사용량만 절감합니다.
- Multi-planar Design에서는 노드 연결 포트를 Twin-port로 논리 분리해 각 plane에 연결합니다.

## 폴더 구조

```text
.
├─ index.html
├─ README.md
├─ scenario-analysis.md
├─ assets/
│  ├─ css/
│  │  └─ styles.css
│  ├─ fonts/
│  │  └─ Pretendard-1.3.9/
│  │     ├─ LICENSE.txt
│  │     └─ web/static/woff2-subset/
│  ├─ images/
│  │  └─ favicon-96x96.png
│  ├─ js/
│  │  ├─ app.js
│  │  ├─ calculator.js
│  │  ├─ diagram.js
│  │  ├─ diagram-helpers.js
│  │  ├─ export-utils.js
│  │  ├─ portmap.js
│  │  ├─ portmap-export.js
│  │  ├─ report.js
│  │  ├─ report-font.js
│  │  └─ report-layout.js
│  └─ vendor/
│     ├─ jszip.min.js
│     └─ pptxgen.min.js
└─ tests/
   ├─ browser-smoke.html
   └─ calculator.test.js
```

## 핵심 소스

- `assets/js/calculator.js`: Leaf-Spine 구성 산정, 포트/대역폭/케이블 산정, 구성 가능 여부 검증
- `assets/js/app.js`: 입력 폼, 결과 렌더링, 구성도 컨트롤, export 연동
- `assets/js/diagram.js`: 구성도 SVG 모델 생성, zoom/pan/export 기준 데이터 구성
- `assets/js/portmap.js`: 포트맵 데이터 생성 및 새 창 렌더링
- `assets/js/portmap-export.js`: 포트맵 Excel/PPT export
- `assets/js/report.js`: SVG/PDF 리포트 생성
- `assets/js/report-layout.js`: 리포트 레이아웃 렌더링
- `assets/js/report-font.js`: 리포트용 Pretendard 폰트 데이터

## 배포

정적 파일만 제공하면 되므로 GitHub Pages, 사내 정적 웹 서버, 로컬 파일 공유 경로에서 실행할 수 있습니다.

GitHub Pages에 배포하는 경우 저장소의 Pages 설정에서 배포 브랜치와 루트 경로를 지정하면 됩니다.

## 라이선스

Copyright © 2026 Chaeseong Lim. All Rights Reserved.

이 소프트웨어와 그 기반 알고리즘은 명시적인 서면 허가 없이 복사, 수정, 배포, 리버스 엔지니어링하거나 파생 저작물을 만드는 데 사용할 수 없습니다.

자세한 내용은 [LICENSE](LICENSE)를 확인하세요.

## 유지보수 참고

- 외부 CDN 의존성을 추가하지 않습니다.
- export 기능에 필요한 vendor 파일은 `assets/vendor/`에 유지합니다.
- 폰트는 실제 사용하는 Pretendard woff2 subset만 유지합니다.
- 구성 산정 로직 수정 시 `tests/calculator.test.js`에 회귀 케이스를 추가합니다.
- UI 문구 변경 시 웹 화면, 리포트, export 결과의 용어가 일관되는지 함께 확인합니다.
