# Leaf-Spine Planner

Leaf-Spine Planner는 노드, Leaf, Spine 조건을 입력해 2-tier Leaf-Spine 구성을 산정하고, 구성도와 포트맵을 오프라인 환경에서 생성하는 정적 웹 애플리케이션입니다.

브라우저에서 동작하는 HTML/CSS/JavaScript 기반 프로젝트이며, 주요 계산과 export 기능은 프로젝트 내부 파일만 사용합니다. CDN이나 외부 인터넷 연결에 의존하지 않습니다.

## 주요 기능

- 노드 수, 노드당 연결 포트 수, 노드 연결 포트당 링크 스피드 입력
- Leaf/Spine 포트 수, 포트당 링크 스피드, Twin-port Transceiver 조건 분리 입력
- Leaf/Spine 수 자동 산정 또는 Custom 수동 검증
- Leaf당 최소 예비 포트 조건 반영
- Non-blocking 및 Oversubscription 구성 산정
- Multi-planar Design 구성
  - 2-plane 기준 구성
  - 노드 연결 포트에 Twin-port Transceiver 강제 적용
  - 노드 연결 포트를 논리 분리해 서로 다른 plane에 연결
- Multi-pods Design 구성
  - pod당 노드 수 기준으로 독립 fabric 그룹 구성
- Full, Stacked, Compact 구성도 보기
- 구성도 zoom, pan, 가운데 정렬, 화면 맞춤
- 구성도 장비 강조
  - Node, Leaf, Spine 선택 시 연결된 링크와 직접 연결 장비 강조
  - 선택되지 않은 장비와 링크는 흐리게 표시
  - 강조 상태는 화면 확인용이며 SVG/PNG/PPT export 결과에는 적용하지 않음
- 구성도 export
  - SVG
  - PNG
  - PPT
- Port Map 새 창 보기
  - 필터
  - 검색
  - Excel/PPT export
- Report export
  - SVG
  - PDF
- Pretendard 폰트 내장
  - 웹 화면
  - 구성도 SVG/PNG export
  - SVG/PDF report

## 오프라인 동작 조건

다음 파일들이 프로젝트 내부에 포함되어 있으면 인터넷 연결 없이 동작합니다.

- `index.html`
- `assets/css/styles.css`
- `assets/js/*.js`
- `assets/vendor/jszip.min.js`
- `assets/vendor/pptxgen.min.js`
- `assets/fonts/Pretendard-1.3.9/web/static/woff2-subset/*.woff2`

PPT/Excel 생성은 내장 vendor 스크립트를 사용합니다. 화면, 구성도 SVG/PNG, report SVG/PDF는 프로젝트 내부 Pretendard subset 폰트를 사용합니다.

## 구성 산정 기준

- 기본 구성은 모든 Leaf가 모든 Spine에 연결되는 2-tier Leaf-Spine 구조입니다.
- 고가용성을 위해 가능한 경우 Leaf와 Spine은 각각 최소 2대 이상으로 구성합니다.
- Non-blocking은 전체 Leaf-Spine 업링크 대역폭이 전체 노드-Leaf 다운링크 대역폭 이상이 되도록 구성합니다.
- Oversubscription은 노드 연결 포트는 모두 Leaf에 연결하고, Leaf-Spine 업링크 수와 대역폭을 줄여 목표 비율을 맞춥니다.
- Leaf-Spine 링크는 Leaf 측과 Spine 측의 포트 속도, Twin-port Transceiver 사용 여부, 물리 포트 사용량을 분리해 계산합니다.
- Multi-planar Design에서는 노드 연결 포트를 Twin-port Transceiver로 논리 분리해 각 plane에 연결합니다.
- 구성 불가, 불균등 링크, 포트 낭비 가능성 등은 구성 결과 메시지로 표시합니다.

## 파일 구조

```text
.
├── index.html
├── README.md
├── LICENSE
├── CNAME
├── scenario-analysis.md
├── scenario-analysis-2026-06-02.md
├── scenario-cross-validation-2026-06-02.md
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── fonts/
│   │   └── Pretendard-1.3.9/
│   │       ├── LICENSE.txt
│   │       └── web/static/woff2-subset/
│   ├── images/
│   │   └── favicon-96x96.png
│   ├── js/
│   │   ├── app.js
│   │   ├── calculator.js
│   │   ├── diagram.js
│   │   ├── diagram-api.js
│   │   ├── diagram-geometry.js
│   │   ├── diagram-ooxml.js
│   │   ├── diagram-pptx.js
│   │   ├── export-utils.js
│   │   ├── i18n.js
│   │   ├── input-state.js
│   │   ├── portmap.js
│   │   ├── portmap-api.js
│   │   ├── portmap-export.js
│   │   ├── report.js
│   │   ├── report-api.js
│   │   ├── report-font.js
│   │   ├── report-layout.js
│   │   ├── report-pdf.js
│   │   └── render-scheduler.js
│   └── vendor/
│       ├── jszip.min.js
│       └── pptxgen.min.js
└── tests/
    ├── browser-smoke.html
    ├── calculator.test.js
    ├── input-state.test.js
    └── message-copy.test.js
```

## 핵심 모듈

- `assets/js/calculator.js`: Leaf-Spine 구성 산정, 포트/대역폭/케이블 계산, 구성 가능 여부 검증
- `assets/js/app.js`: 입력 상태, 구성 결과 렌더링, 구성도 제어, export 연동
- `assets/js/input-state.js`: 입력값 export/import 상태 모델
- `assets/js/i18n.js`: 한국어/영문 문구 사전
- `assets/js/diagram.js`: 구성도 SVG 모델 생성, zoom/pan, 강조, 새 창 보기
- `assets/js/diagram-geometry.js`: 구성도 배치와 링크 좌표 계산
- `assets/js/diagram-pptx.js`: 구성도 PPT export
- `assets/js/portmap.js`: 포트맵 데이터 생성 및 새 창 렌더링
- `assets/js/portmap-export.js`: 포트맵 Excel/PPT export
- `assets/js/report.js`: SVG/PDF report 생성
- `assets/js/report-layout.js`: report 레이아웃 렌더링
- `assets/js/report-font.js`: report용 Pretendard 폰트 데이터
- `assets/js/export-utils.js`: 파일명 생성, 파일 다운로드, export 공통 유틸리티
- `assets/js/render-scheduler.js`: 입력 이벤트 렌더링 debounce 스케줄러

## 배포

정적 파일만 제공하면 GitHub Pages, 사내 정적 웹 서버, 로컬 파일 공유 경로에서 사용할 수 있습니다.

GitHub Pages에 배포하는 경우 저장소의 Pages 설정에서 배포 브랜치와 루트 경로를 지정합니다.

## 라이선스

Copyright © 2026 Chaeseong Lim. All Rights Reserved.

본 소프트웨어 및 그 기반 알고리즘은 명시적인 서면 허가 없이 복사, 수정, 배포, 리버스 엔지니어링 또는 파생 저작물 제작에 사용할 수 없습니다.

자세한 내용은 [LICENSE](LICENSE)를 확인하십시오.

## 유지보수 참고

- 외부 CDN 의존성을 추가하지 않습니다.
- export 기능에 필요한 vendor 파일은 `assets/vendor/`에 유지합니다.
- 폰트는 실제 사용되는 Pretendard woff2 subset만 유지합니다.
- 구성 산정 로직을 수정할 때는 대표 구성 케이스와 구성 불가 케이스를 함께 확인합니다.
- UI 문구를 변경할 때는 웹 화면, report, export 결과의 표현이 일관되는지 함께 확인합니다.
