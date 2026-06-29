# assets 폴더

학생 그림으로 만든 PNG를 여기에 넣습니다. **파일 이름 규칙은 ../ASSET_GUIDE.md 참고.**

```
assets/
  characters/
    student_01 ~ student_06/   ← 캐릭터 6슬롯 (down_idle.png 등)
  weapons/
    tool_01 ~ tool_06/         ← 도구 6슬롯 (icon.png, projectile.png 등)
  tiles/  obstacles/  bushes/  ui/   ← 추후 확장용
```

- 오늘은 비어 있어도 됩니다. 파일이 없으면 게임은 자동으로 **도형(fallback)** 으로 그립니다.
- PNG를 넣은 뒤 `index.html` 의 `ASSETS_ENABLED = true` 로 바꾸면 그림이 사용됩니다.
- 시작 화면에서 **F2** 를 누르면 어떤 슬롯이 연결됐는지 확인할 수 있습니다.
