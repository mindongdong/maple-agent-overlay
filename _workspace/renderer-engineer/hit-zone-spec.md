# Hit-Zone 토글 시퀀스

투명 위젯이 작업을 방해하지 않으려면 click-through 가 기본이고, 캐릭터/말풍선 영역에 마우스가 들어올 때만 잠깐 꺼야 한다.

## 시퀀스

```
사용자 마우스 이동
    │
    ▼
캐릭터 영역 진입 ─ onMouseEnter ─▶ debounce 16ms ─▶ window.overlay.setMouseIgnore(false)
                                                          │
                                                          ▼
                                              ipcRenderer.send('mouse:set-ignore', false)
                                                          │
                                                          ▼
                                          win.setIgnoreMouseEvents(false, { forward: true })
                                                          │
                                                          ▼
                                          캐릭터에서 클릭/드래그 가능
                                                          │
캐릭터 영역 이탈 ─ onMouseLeave ─▶ debounce 16ms ─▶ setMouseIgnore(true)
                                                          │
                                                          ▼
                                                다시 click-through 복귀
```

## 디바운스 16ms

마우스가 영역 경계를 빠르게 넘나들 때 IPC 폭주 방지. `requestAnimationFrame` 한 프레임 budget(약 16ms). 구현: [`src/renderer/src/components/HitZone.tsx:4`](../../src/renderer/src/components/HitZone.tsx#L4).

## 적용 영역

**투명 배경에 HitZone 을 적용하면 위젯이 작업을 방해한다.** 보이는 영역 (캐릭터 + 말풍선) 만 감싸야 한다.

- Phase 1 현재: 캐릭터 컴포넌트만 감싸고 있음 ([`Character.tsx`](../../src/renderer/src/components/Character.tsx))
- Phase 2 에서 말풍선 추가 시: 말풍선도 같은 HitZone 안에 (캐릭터+말풍선이 같이 감싸지도록)

## 드래그 핸들

`-webkit-app-region: drag` 가 적용된 영역 안에서는 onMouseEnter/Leave 가 정상 동작. 단, 클릭 이벤트는 막힌다 (드래그용이라 OS 레벨에서 처리). 인터랙션 요소(버튼)가 생기면 그 요소에는 `-webkit-app-region: no-drag` 를 주어야 한다.

현재 Phase 1에는 인터랙션 요소가 없어 캐릭터 본체 = 드래그 핸들. ([`index.css:18`](../../src/renderer/src/index.css#L18))

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성 | Phase 1 — Core Overlay |
