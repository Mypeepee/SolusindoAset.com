import { Fragment } from "react";
import { emojiSegments } from "@/lib/chatbot/emoji-text";
import styles from "./emoji.module.css";

export default function EmojiText({ text }: { text: string }) {
  return <>{emojiSegments(text).map((part, index) => part.emoji
    ? <span key={index} className={styles.emoji}>{part.text}</span>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
