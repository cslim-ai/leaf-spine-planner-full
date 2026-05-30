# Leaf-Spine 설계 계산기

노드 NIC와 네트워크 스위치 조건을 입력하면 Leaf-Spine 토폴로지의 Leaf/Spine 스위치 수, oversubscription 비율, 구성도, 포트맵, 리포트를 계산하는 정적 웹 애플리케이션입니다.

## 실행

별도 서버나 빌드 과정 없이 `index.html` 파일을 브라우저에서 열어 사용할 수 있습니다.

로컬 서버로 확인하려면 프로젝트 루트에서 아래 명령을 실행합니다.

```powershell
python -m http.server 4177 --bind 127.0.0.1
```

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:4177/index.html
```

## 오프라인 사용

현재 소스 구성은 폰트와 export용 라이브러리를 로컬 파일로 포함합니다. 아래 폴더와 파일을 그대로 복사하면 인터넷 연결 없이 동작합니다.

```text
index.html
assets/
  css/
  fonts/
  images/
  js/
  vendor/
tests/
README.md
LICENSE
```

주의할 점:

- `assets/fonts/`의 Pretendard 폰트 파일이 있어야 웹 화면, 구성도 export, 리포트 export의 글꼴이 동일하게 표시됩니다.
- `assets/vendor/`의 `jszip.min.js`, `pptxgen.min.js`가 있어야 PPTX export가 오프라인에서 동작합니다.
- 폴더 구조를 변경하면 `index.html`, 테스트 파일, export 로더의 상대 경로도 함께 수정해야 합니다.

## 주요 파일

- `assets/js/calculator.js`: Leaf/Spine 수량, 대역폭, oversubscription, multi-planar plane 계산
- `assets/js/diagram.js`: 네트워크 구성도 렌더링 및 SVG/PNG/PPT export
- `assets/js/report.js`: 리포트 SVG/PDF export
- `assets/js/portmap.js`: 포트맵 새 창, Excel/PPT export
- `assets/js/export-utils.js`: 로컬 vendor 라이브러리 로더
- `assets/js/report-font.js`: export용 Pretendard 폰트 내장 데이터
- `assets/css/styles.css`: 화면 스타일과 Pretendard 폰트 정의
- `assets/fonts/`: Pretendard 폰트 원본
- `assets/vendor/`: 오프라인 PPTX export용 JSZip, PptxGenJS
- `tests/calculator.test.js`: 계산 로직 단위 테스트
- `tests/browser-smoke.html`: 브라우저 렌더링/export smoke test

## 계산 기준

- 기본 Leaf-Spine 구성은 모든 Leaf가 모든 Spine에 연결되는 full-mesh 조건을 기준으로 합니다.
- Non-blocking은 Leaf 업링크 대역폭이 노드 다운링크 대역폭 이상이 되도록 계산합니다.
- Leaf와 Spine은 이중화와 고가용성을 위해 각각 최소 2대 이상으로 계산합니다.
- Oversubscription 구성에서도 노드 NIC는 모두 Leaf에 연결하고, Leaf-Spine 업링크 수와 대역폭을 줄여 목표 비율을 맞춥니다.
- Twin-port Transceiver를 사용하면 스위치 물리 포트를 논리 포트 2개로 계산합니다.
- Leaf-Spine 업링크에 Twin-port Transceiver를 사용하지 않는 옵션을 켜면 업링크는 입력된 포트당 링크 스피드를 그대로 사용합니다.
- Multi-planar Design은 노드 NIC 포트를 Twin-port Transceiver로 2개의 논리 링크로 분리하고, 두 링크를 각각 독립된 Leaf-Spine plane에 연결하는 방식으로 계산합니다.
- Multi-pods Design은 입력한 Pod당 노드 수를 기준으로 노드와 Leaf-Spine fabric을 독립 pod 그룹으로 나누고, 각 pod에 동일한 설계 기준을 적용합니다.

## 테스트

Node.js가 설치되어 있으면 계산 로직 테스트를 실행할 수 있습니다.

```powershell
node tests/calculator.test.js
```

브라우저 기능과 export blob 생성은 로컬 서버 실행 후 아래 파일을 브라우저에서 열어 확인합니다.

```text
http://127.0.0.1:4177/tests/browser-smoke.html
```

정상 동작하면 화면에 `PASS`가 표시됩니다. 이 테스트는 기본 계산, 구성도 SVG 렌더링, 리포트 SVG 생성, 포트맵 생성, XLSX/PPTX blob 생성을 확인합니다.

## 배포

정적 파일만 제공하면 되므로 웹 서버, NAS, 내부 포털, 정적 호스팅에 그대로 업로드할 수 있습니다.

권장 배포 방식:

1. 프로젝트 루트 전체를 배포 대상 폴더로 복사합니다.
2. `index.html`을 기본 문서로 설정합니다.
3. 배포 후 `tests/browser-smoke.html`을 한 번 실행해 상대 경로와 export 기능을 확인합니다.
4. 검증이 끝나면 운영 환경에서 `tests/` 폴더는 제거해도 됩니다.

## GitHub 버전 관리

Codex 환경에서 `git` 명령이 PATH에 없으면 Windows 기본 설치 경로를 직접 호출할 수 있습니다.

```powershell
& "C:\Program Files\Git\cmd\git.exe" status
& "C:\Program Files\Git\cmd\git.exe" add .
& "C:\Program Files\Git\cmd\git.exe" commit -m "변경 내용을 설명하는 메시지"
& "C:\Program Files\Git\cmd\git.exe" push
```
