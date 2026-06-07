# Leaf-Spine Planner

Leaf-Spine Planner는 Node, Leaf, Spine 조건을 입력해 2-tier Leaf-Spine 네트워크 구성을 계산하고, 구성도, 포트맵, 보고서를 생성하는 정적 웹 애플리케이션입니다.

브라우저에서 동작하는 HTML/CSS/JavaScript 기반 프로젝트이며, 주요 계산과 export 기능은 프로젝트 내부 파일만 사용합니다. CDN이나 외부 인터넷 연결에 의존하지 않습니다.

## 주요 기능

- Node, Leaf, Spine 포트 조건 기반 구성 계산
- Non-blocking 및 Oversubscription 구성 계산
- Multi-planar Design 지원
- Multi-pods Design 지원
- 전체, 줄바꿈, 요약 구성도 보기
- 구성도 zoom, pan, 화면 맞춤, 원래 크기
- 구성도 SVG, PNG, PPT export
- Port Map 새 창 보기
- Port Map Excel, PPT export
- 보고서 SVG, PDF export
- Pretendard 폰트 내장

## 계산 검증 규모

계산식과 구성 결과 표기는 2026-06-07 기준 독립 계산 기준과 비교해 총 73,447개 케이스로 검증했습니다.

- Feasible cases: 29,317
- Infeasible cases: 44,130
- Mismatch groups: 0
- 상세 리포트: `docs/generated/calculation-cross-check-2026-06-07.md`

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
│   ├── images/
│   │   └── favicon-96x96.png
│   ├── js/
│   │   ├── app.js
│   │   ├── calculator.js
│   │   ├── diagram.js
│   │   ├── diagram-api.js
│   │   ├── diagram-geometry.js
│   │   ├── diagram-highlight.js
│   │   ├── diagram-ooxml.js
│   │   ├── diagram-pptx.js
│   │   ├── export-utils.js
│   │   ├── i18n.js
│   │   ├── input-state.js
│   │   ├── portmap.js
│   │   ├── portmap-api.js
│   │   ├── portmap-export.js
│   │   ├── render-scheduler.js
│   │   ├── result-details.js
│   │   ├── report.js
│   │   ├── report-api.js
│   │   ├── report-font.js
│   │   ├── report-layout.js
│   │   └── report-pdf.js
│   └── vendor/
│       ├── jszip.min.js
│       └── pptxgen.min.js
├── docs/
│   └── superpowers/
└── tests/
    ├── browser-smoke.html
    ├── calculator.test.js
    ├── diagram-geometry.test.js
    ├── diagram-highlight.test.js
    ├── input-state.test.js
    ├── message-copy.test.js
    ├── render-scheduler.test.js
    ├── result-details.test.js
    └── report-layout.test.js
```

## 주요 모듈

- `assets/js/calculator.js`: Leaf-Spine 구성 계산, 포트/대역폭/케이블 계산, 구성 가능 여부 검증
- `assets/js/app.js`: 입력 상태, 결과 렌더링, 구성도 제어, export 연동
- `assets/js/input-state.js`: 입력값 export/import 상태 모델
- `assets/js/i18n.js`: 한국어/영어 문구 사전
- `assets/js/diagram.js`: 구성도 SVG 렌더링, zoom/pan, 새 창 보기, 구성도 export
- `assets/js/diagram-geometry.js`: 구성도 배치와 링크 좌표 계산
- `assets/js/diagram-highlight.js`: 구성도 선택 및 링크 강조 상태 처리
- `assets/js/diagram-pptx.js`: 구성도 PPT export
- `assets/js/portmap.js`: 포트맵 데이터 생성 및 새 창 렌더링
- `assets/js/portmap-export.js`: 포트맵 Excel/PPT export
- `assets/js/report.js`: 보고서 SVG/PDF export 진입점
- `assets/js/report-layout.js`: 보고서 레이아웃, SVG/PDF 렌더링 보조 로직
- `assets/js/report-font.js`: 보고서용 Pretendard 폰트 데이터
- `assets/js/export-utils.js`: 파일명 생성, 다운로드, export 공통 유틸리티
- `assets/js/render-scheduler.js`: 입력 이벤트 기반 렌더링 debounce 스케줄러
- `assets/js/result-details.js`: 구성결과 보조 지표 포맷 및 상세 행 생성

## 유지보수 참고

- 외부 CDN 의존성을 추가하지 않습니다.
- export 기능에 필요한 vendor 파일은 `assets/vendor/`에 포함합니다.
- 실제 사용 폰트는 Pretendard woff2 subset과 보고서용 embedded font data입니다.
- 구성 계산 로직을 변경할 때는 정상 구성, 구성 불가, Multi-planar, Multi-pods, Twin-port 케이스를 함께 검증합니다.
- UI 문구를 변경할 때는 화면, 보고서, export 결과의 표현이 일관되는지 확인합니다.

## 라이선스

Copyright (c) 2026 Chaeseong Lim. All Rights Reserved.

본 소프트웨어 및 그 기반 알고리즘은 명시적인 서면 허가 없이 복사, 수정, 배포, 리버스 엔지니어링 또는 파생 저작물 제작에 사용할 수 없습니다.

자세한 내용은 [LICENSE](LICENSE)를 확인하십시오.
