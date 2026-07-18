import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  MAX_CHAT_MESSAGE_LENGTH,
  type ChatMessageSnapshot,
} from "../room";

export const CHAT_BUBBLE_DURATION_MS = 5_000;

export interface ChatPanelProps {
  messages: readonly ChatMessageSnapshot[];
  playerDisplayNames: Readonly<Record<string, string>>;
  connected: boolean;
  busy?: boolean;
  onSend?: (text: string) => void;
}

export function messagesAfterSequence(
  messages: readonly ChatMessageSnapshot[],
  sequence: number,
): ChatMessageSnapshot[] {
  return messages.filter((message) => message.sequence > sequence);
}

export function usePlayerChatBubbles(
  messages: readonly ChatMessageSnapshot[],
): Readonly<Record<string, ChatMessageSnapshot>> {
  const [bubbles, setBubbles] = useState<Record<string, ChatMessageSnapshot>>({});
  const seenSequence = useRef<number | undefined>(undefined);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const latestSequence = messages.at(-1)?.sequence ?? 0;
    if (seenSequence.current === undefined) {
      seenSequence.current = latestSequence;
      return;
    }

    const freshMessages = messagesAfterSequence(messages, seenSequence.current);
    seenSequence.current = Math.max(seenSequence.current, latestSequence);
    if (freshMessages.length === 0) return;

    setBubbles((current) => {
      const next = { ...current };
      for (const message of freshMessages) next[message.playerId] = message;
      return next;
    });

    for (const message of freshMessages) {
      const previousTimer = timers.current.get(message.playerId);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      const timer = window.setTimeout(() => {
        setBubbles((current) => {
          if (current[message.playerId]?.sequence !== message.sequence) return current;
          const next = { ...current };
          delete next[message.playerId];
          return next;
        });
        timers.current.delete(message.playerId);
      }, CHAT_BUBBLE_DURATION_MS);
      timers.current.set(message.playerId, timer);
    }
  }, [messages]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  return bubbles;
}

export function PlayerChatBubble({ message }: { message?: ChatMessageSnapshot }) {
  return message ? (
    <div className="player-chat-bubble" role="status">
      {message.text}
    </div>
  ) : null;
}

export function ChatPanel({
  messages,
  playerDisplayNames,
  connected,
  busy = false,
  onSend,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = text.trim();
    if (!onSend || !normalized || busy || !connected) return;
    onSend(normalized);
    setText("");
  };

  return (
    <section className="chat-panel" aria-label="聊天">
      <header>
        <h2>聊天</h2>
        <small>{messages.length} 条</small>
      </header>
      <ol aria-live="polite" ref={listRef}>
        {messages.map((message) => (
          <li key={message.sequence}>
            <div>
              <strong>{playerDisplayNames[message.playerId] ?? message.playerId}</strong>
              <time dateTime={new Date(message.sentAt).toISOString()}>
                {new Date(message.sentAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p>{message.text}</p>
          </li>
        ))}
        {messages.length === 0 && <li className="chat-panel__empty">暂无消息</li>}
      </ol>
      {onSend && (
        <form onSubmit={submit}>
          <input
            aria-label="聊天消息"
            disabled={!connected}
            onChange={(event) => {
              const next = event.target.value;
              if (Array.from(next).length <= MAX_CHAT_MESSAGE_LENGTH) setText(next);
            }}
            placeholder="输入消息…"
            value={text}
          />
          <button disabled={busy || !connected || text.trim().length === 0} type="submit">
            发送
          </button>
        </form>
      )}
    </section>
  );
}
