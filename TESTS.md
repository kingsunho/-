# 테스트

전부 [jsdom](https://github.com/jsdom/jsdom) 위에서 실제 화면을 띄워 검사한다.
빌드가 없으므로 `index.html` 을 그대로 읽어 돌린다.

```bash
npm install          # jsdom 한 번만
node lintcheck.js    # 정적 점검 (선언 사라진 함수 · 중복 CSS · 중복 키 · 용량)
node verify.js index.html   # 엔진 캘리브레이션 6개 지표
node soaktest.js     # 풀 시즌을 실제 UI 경로로 완주 — 가장 중요한 통합 테스트
```

## 전부 돌리기

```bash
for f in lintcheck verify vernotetest mgrtest kakaotest careertest nametest \
         awardtest kingtest savediet loadtest sorttest phototest bgmtest \
         iostest galaxytest compattest boxtest pcardtest feattest \
         unhappytest hometest namecheck smoketest fixtest recruittest \
         traintest2 vartest wltest advtest dectest2 subtest resumetest; do
  printf "%-13s " $f
  if [ "$f" = "verify" ]; then node verify.js index.html >/dev/null 2>&1 && echo OK || echo FAIL
  else node $f.js >/dev/null 2>&1 && echo OK || echo FAIL; fi
done
node soaktest.js
```

## 무엇을 보는지

| 파일 | 검사 대상 |
|---|---|
| `lintcheck` | 선언이 사라진 채 호출되는 함수 · 중복 CSS 셀렉터 · 객체 중복 키 · 용량 |
| `verify` | 엔진 캘리브레이션 — K% · BB% · BABIP · 2루타 · 3루타 · 홈런 비율 |
| `soaktest` | 풀 시즌 완주(주 시작 → 우천 → 용병 → 경기 → 확정) · 세이브 왕복 · 새 시즌 이월 |
| `compattest` | 구버전 세이브 호환 · 인원 부족 · 0 나눗셈 · 플레이오프 |
| `smoketest` | UI 3경기 + 전 화면 훑기 |
| `boxtest` | 박스스코어 — 선발 + 대타 전원 기록 |
| `pcardtest` | 선수 카드 (타자/투수 구분) |
| `feattest` | 진기록 16종 판정 · 보관 |
| `awardtest` `kingtest` | 구간 시상 · 시즌 종합왕 · 포디움 |
| `dectest2` | 직접 지휘 — 지시없음이 판단 횟수를 안 먹는지 · 투수 교체 상시 버튼 |
| `subtest` | 투수 교체 시 타순·수비 정리 · 지명타자 소멸 (지타 유무 모두) |
| `resumetest` | 경기 중 다른 탭 갔다 와도 이어서 진행 · 재굴림 차단 |
| `careertest` | 통산 연도별/총합 · 시즌 로그 |
| `sorttest` | 표 정렬 · 구단 통산 1위 |
| `unhappytest` | 불만 규칙 (등판 면제 · 본인 면제 · 라이벌) |
| `nametest` | 화면별 선수 이름 클릭 |
| `mgrtest` | 감독 액션 · 물통 자해 · 상황별 답변 |
| `kakaotest` | 단톡 대사 다양도 측정 |
| `vernotetest` | 튜토리얼 · 업데이트 안내 모달 |
| `bgmtest` `iostest` | 사운드 · 아이폰 해금 경로 |
| `galaxytest` | 갤럭시(삼성인터넷) 대응 |
| `loadtest` | 대기화면 |
| `phototest` | 선수 사진 |
| `hometest` | 홈/원정 · 라인스코어 정합성 |
| `namecheck` | AI 투수 이름 생성 |
| `savediet` | 세이브 감량이 무손실인지 |
| `perftest` | 화면 렌더 · 경기 시뮬 속도 (참고용) |
| `wintest` | 승리·패전투수 판정 (결승점 기준) |
| `dectest` | 직접 지휘 판단창 — 오늘 기록 표시 · 상황별 지시 |
| `scouttest` | 스카우트 투수 · 선수 카드 몸값 |
| `begtest` | 인원 부족 대응 — 사정하기 확률·순서 · 라인업 보존 |
| `itptest` | 그라운드 홈런 — 주력 조건 · 리그 비율 |

## 가끔 실패하는 것

확률 기반 단정문이 들어 있어 간헐적으로 실패한다. **3회 재실행해서 판단한다.**

`advtest` `traintest2` `wltest` `recruittest` `fintest` `awardtest` `mgrtest`

## 구버전 테스트

`finaltest` `hltest` `fintest` 는 v1.5.1 의 '라인업 발표' 게이트를 안 타서
한동안 깨져 있었다. 지금은 고쳐서 다 돈다.
`enterGame()` 헬퍼로 경기 화면을 거쳐서 시작한다.
