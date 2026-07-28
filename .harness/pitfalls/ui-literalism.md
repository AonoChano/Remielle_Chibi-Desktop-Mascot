# UI Literalism Pitfall | UI 字面执行主义陷阱

## Problem

When the user describes a UI concept with illustrative language (e.g., "show a lock indicator", "highlight the test mode"), it is easy to implement it as an overt visual emphasis (red borders, warning text, dedicated placeholder cards). This produces a UI that feels like a developer's internal debugging tool rather than a polished end-user product.

## Root Cause

The assistant conflates the user's **descriptive intent** with a **prescriptive visual specification**. The user says what a feature should do; the assistant turns it into an overstated visual design without considering market-standard UI conventions.

## Symptoms

- Test mode toggles rendered as alarming red-bordered cards with warning text
- Placeholder areas receiving dedicated decorative UI instead of natural whitespace
- Features described in conversation getting disproportionate visual prominence
- UI resembling internal admin/debug panels rather than consumer software

## Correct Approach

1. **Default to subtlety**: State changes should be communicated through natural affordances (disabled opacity, checked/unchecked) rather than dramatic color changes and warning banners.
2. **Whitespace is not a bug**: Empty areas are correct when no content belongs there. Do not invent placeholder cards to "fill space."
3. **Match market conventions**: Consumer software does not shout about internal state changes. A checkbox toggles; dependent controls become enabled/disabled. No prose explanation needed.
4. **Separate intent from specification**: When the user describes behavior, implement the behavior. Do not implement the description as a visual metaphor.

## Example: Test Mode Checkbox

| Incorrect | Correct |
|-----------|---------|
| Red-bordered card with "正式功能已锁定" warning text | Plain checkbox; other controls simply disabled/grayed |
| Dedicated "正式功能区域" placeholder card | Natural whitespace; features added above when they exist |
| Checkbox given special置顶 visual treatment | Checkbox sits inline as a normal setting row |
