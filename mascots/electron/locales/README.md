# Translation Contribution Guide | 翻译贡献指南

Thank you for contributing translations to Remielle Desktop Mascot!

感谢你为蕾米埃尔桌宠贡献翻译！

## How to Add a New Language | 如何添加新语言

1. **Copy** `en-US.json` and rename it with your locale code (e.g. `ja-JP.json`, `ko-KR.json`, `fr-FR.json`)
2. **Edit** the `_meta` section:
   - `locale`: must match the filename (without `.json`)
   - `display_name`: the language name written **in that language** (e.g. `日本語`, `한국어`)
3. **Translate** all values — keep the keys unchanged
4. **Submit** a Pull Request

## Rules | 规则

- **Filename**: IETF language tag (e.g. `zh-CN`, `en-US`, `ja-JP`)
- **`_meta.locale`**: must match the filename
- **`_meta.display_name`**: written in the target language itself
- **Untranslated keys**: you may omit keys you haven't translated yet — the system will fall back automatically
- **Do not modify keys** — only translate values
- **Do not modify `_meta` structure** — only change `locale` and `display_name`

## Fallback Order | 回退顺序

When a key is missing in the current language, the system falls back in this order:

```
Current language → en-US → zh-CN → raw key
```

This means:
- If you don't finish translating, users will see English for missing keys
- `zh-CN` is the development baseline (most complete)

## Available Keys | 可用键

See `en-US.json` or `zh-CN.json` for the full list of translation keys.

## Example | 示例

```json
{
  "_meta": {
    "locale": "ja-JP",
    "display_name": "日本語"
  },
  "app": {
    "title": "レミエル管理パネル"
  },
  "nav": {
    "main": "メインパネル",
    "settings": "設定"
  }
}
```
