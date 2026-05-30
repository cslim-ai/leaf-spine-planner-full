# Leaf-Spine 설계 계산기

서버 NIC와 네트워크 스위치 조건을 입력하면 Leaf-Spine 토폴로지의 Leaf/Spine 스위치 수, oversubscription 비율, 간단한 구성도를 계산하는 정적 웹 앱입니다.

## 실행

`index.html` 파일을 브라우저에서 열면 바로 사용할 수 있습니다.

웹 서버로 배포할 때는 `index.html`, `styles.css`, `app.js` 세 파일을 같은 디렉터리에 두고 정적 파일로 서비스하면 됩니다.

## 계산 기준

- 모든 Leaf는 모든 Spine에 연결되는 기본 Leaf-Spine 구조를 기준으로 하되, Leaf와 Spine 사이에는 필요 시 여러 업링크를 분산할 수 있다고 봅니다.
- Non-blocking은 Leaf당 업링크 대역폭이 다운링크 대역폭 이상인 구성을 찾습니다.
- 이중화와 고가용성을 위해 Leaf와 Spine은 각각 최소 2대 기준으로 계산합니다.
- Spine 대수는 Leaf당 업링크 수와 별개로, 전체 Leaf-Spine 업링크를 수용할 수 있는 최소 대수로 계산합니다.
- Oversubscribed는 입력한 목표 비율 이하에서 전체 스위치 수가 가장 적은 구성을 찾고 실제 `1:n` 비율을 표시합니다.
- 트윈포트 트랜시버를 사용하면 Leaf의 서버 다운링크 연결 가능 수를 물리 포트당 2개로 계산합니다.
- 구성도 박스는 고정되고, 박스 안의 구성도만 버튼과 마우스 휠로 확대/축소됩니다. 확대된 구성도는 마우스 드래그로 이동해 볼 수 있습니다.
- 구성도 확대/축소는 CSS 스케일이 아니라 SVG `viewBox`를 조정해 벡터로 다시 렌더링하므로 글꼴과 선명도를 더 잘 유지합니다.
- Leaf-Spine 사이의 병렬 링크 수를 선 개수로 표현합니다.
- 구성도는 고해상도 PNG 또는 PowerPoint에서 편집 가능한 PPTX 도형 파일로 다운로드할 수 있습니다.
- 결과 상세에는 서버당 대역폭과 총 서버 대역폭을 별도로 표시합니다.

## 계산 로직 테스트

계산 로직은 `calculator.js`에 분리되어 있고, 기본 검증 케이스는 `tests/calculator.test.js`에 있습니다. 구성도 렌더링과 토폴로지 PPT export는 `diagram.js`, PDF 리포트 export는 `report.js`, 공통 export 로더는 `export-utils.js`, 포트맵 창과 포트맵 Excel/PPT export는 `portmap.js`에 분리되어 있습니다.

Node.js가 PATH에 잡혀 있으면 아래 명령으로 테스트합니다.

```powershell
node tests/calculator.test.js
```

현재 테스트는 HA 최소 Leaf/Spine 수, Twin-port Transceiver 계산, 288대 서버 구성의 균등 Leaf-Spine 링크, multi-planar pod 계산, oversubscription에서 서버 NIC 링크가 줄지 않는 조건을 확인합니다.

브라우저 기능과 export smoke test는 `tests/browser-smoke.html`을 브라우저에서 열어 확인합니다. 이 테스트는 기본 계산, 구성도 SVG 렌더링, PDF 리포트 SVG, 포트맵 XLSX, 토폴로지/포트맵 PPTX blob 생성을 점검합니다.

## GitHub 버전 관리 루틴

작업 후 아래 순서로 변경 내용을 확인하고 GitHub에 올립니다.

```powershell
git status
git add .
git commit -m "변경 내용을 설명하는 메시지"
git push
```

Codex 환경에서 `git` 명령이 PATH에 잡히지 않으면 Windows 기본 설치 경로를 직접 호출할 수 있습니다.

```powershell
& "C:\Program Files\Git\cmd\git.exe" status
& "C:\Program Files\Git\cmd\git.exe" add .
& "C:\Program Files\Git\cmd\git.exe" commit -m "변경 내용을 설명하는 메시지"
& "C:\Program Files\Git\cmd\git.exe" push
```
