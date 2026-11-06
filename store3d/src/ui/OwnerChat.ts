import type { FaqEntry } from "../shop/faq";
import { button, el } from "./dom";
import { actionButton, type PanelAction } from "./Hud";

const GREETING = "Chào bạn! Bạn muốn hỏi gì thì chọn câu bên dưới nha. Câu khác thì nhắn shop qua Instagram hoặc Messenger nhé.";

/**
 * Chat with the shop owner. Guests pick from the published questions only (no free typing, so
 * every answer is one the shop has actually published); anything else goes to Instagram/Messenger.
 */
export function mountOwnerChat(host: HTMLElement, faq: FaqEntry[], contacts: PanelAction[]): void {
  const log = el("div", "owner-chat__log");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollDown = () => log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  const say = (from: "owner" | "guest", text: string) => {
    log.append(el("p", `owner-chat__bubble owner-chat__bubble--${from}`, text));
    scrollDown();
  };
  /** The owner "types" for a moment (longer answers take a little longer), then answers. */
  const reply = (text: string, done?: () => void) => {
    if (reducedMotion) {
      say("owner", text);
      done?.();
      return;
    }
    const typing = el("p", "owner-chat__bubble owner-chat__bubble--owner owner-chat__typing");
    typing.setAttribute("aria-label", "Chủ tiệm đang trả lời");
    for (let i = 0; i < 3; i += 1) typing.append(el("span", "owner-chat__dot"));
    log.append(typing);
    scrollDown();
    window.setTimeout(() => {
      typing.remove();
      say("owner", text);
      done?.();
    }, 550 + Math.min(700, text.length * 5));
  };

  const questions = el("div", "owner-chat__questions");
  questions.setAttribute("aria-label", "Câu hỏi thường gặp");
  let answering = false;
  for (const entry of faq) {
    const chip = button("owner-chat__chip", entry.question, () => {
      if (answering) return; // one question at a time, like a real chat
      answering = true;
      questions.classList.add("is-busy");
      chip.classList.add("is-asked");
      say("guest", entry.question);
      reply(entry.answer, () => {
        answering = false;
        questions.classList.remove("is-busy");
      });
    });
    questions.append(chip);
  }

  const more = el("div", "owner-chat__more");
  more.append(el("p", "owner-chat__hint", "Câu khác? Nhắn shop trực tiếp:"));
  const row = el("div", "owner-chat__contacts");
  for (const contact of contacts) row.append(actionButton(contact));
  more.append(row);

  host.append(log, questions, more);
  answering = true;
  questions.classList.add("is-busy");
  reply(GREETING, () => {
    answering = false;
    questions.classList.remove("is-busy");
  });
}
