// Keep variation selectors, skin tones, flags and ZWJ families in one span.
// Splitting UTF-16 code units would corrupt emoji on desktop browsers.
const emoji = /((?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*))/gu;

export function emojiSegments(text: string): { text: string; emoji: boolean }[] {
  return text.split(emoji).filter(Boolean).map((part) => ({ text: part, emoji: /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(part) }));
}
