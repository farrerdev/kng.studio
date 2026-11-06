import { button, el, icon, iconButton } from "./dom";

export type PanelAction = {
  label: string;
  primary?: boolean;
  /** Brand-coloured button with the app's logo (Instagram / Messenger). */
  brand?: "instagram" | "messenger";
  run: () => void;
};

/** One action button; brand actions get the app's colours and logo so they stand out. */
export function actionButton(action: PanelAction): HTMLButtonElement {
  if (!action.brand) return button(action.primary ? "btn btn--primary" : "btn", action.label, action.run);
  const node = el("button", `btn btn--brand btn--${action.brand}`);
  node.type = "button";
  node.append(icon(action.brand, 18), el("span", "", action.label));
  node.addEventListener("click", action.run);
  return node;
}

export type PanelView = {
  eyebrow?: string;
  title: string;
  text?: string;
  /** Products shown as the storefront's own horizontal rail of cards. */
  rail?: PanelRail;
  /** Custom DOM content (e.g. the shop owner chat), built into a host under the text. */
  mount?: (host: HTMLElement) => void;
  actions?: PanelAction[];
};

export type PanelRail = {
  productIds: string[];
  /** Numbered overlay cards, like the storefront's "Đang được yêu thích" rail. */
  featured?: boolean;
};

export type QuickAction = {
  label: string;
  /** Short hint under the label ("đi tới kệ", "mở ngay"…). */
  hint?: string;
  run: () => void;
};

type HudHandlers = {
  soundEnabled: boolean;
  /** Flips shop sounds on/off; returns the new state. */
  toggleSound: () => boolean;
  openMenu: () => void;
  openCart: () => void;
  /** Renders a product rail into `host`; returns the cleanup. */
  mountRail: (host: HTMLElement, rail: PanelRail) => () => void;
};

const CHIP_TITLE_MAX = 24;

/** DOM overlay: top bar (menu, brand, cart, help), the spot panel, toasts and the first-visit help card. */
export class Hud {
  private readonly panel: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly help: HTMLElement;
  private readonly cartBadge: HTMLElement;
  private readonly cartButton: HTMLButtonElement;
  /** "Xem · …" chip while the guest stands at a spot; the panel opens only when they ask. */
  private readonly reopenChip: HTMLButtonElement;
  private currentKey: string | null = null;
  private currentView: PanelView | null = null;
  private unmountRail: (() => void) | null = null;
  private readonly sizeObserver: ResizeObserver;
  private readonly quickButton: HTMLButtonElement;
  private readonly skipHint: HTMLElement;
  private readonly quickMenu: HTMLElement;
  private toastTimer = 0;

  constructor(
    readonly root: HTMLElement,
    private readonly handlers: HudHandlers,
  ) {
    root.classList.add("hud");
    this.cartBadge = el("span", "hud-cart__badge");
    this.cartButton = el("button", "hud-cart");
    root.append(this.buildTopBar());
    this.panel = el("section", "hud-panel");
    this.panel.setAttribute("aria-live", "polite");
    this.panel.hidden = true;
    this.toastEl = el("div", "hud-toast");
    this.toastEl.setAttribute("role", "status");
    this.reopenChip = el("button", "hud-reopen");
    this.reopenChip.type = "button";
    this.reopenChip.hidden = true;
    this.reopenChip.addEventListener("click", () => this.openCurrent());
    this.help = this.buildHelp();
    this.quickButton = el("button", "quick-go");
    this.quickMenu = el("div", "quick-go__menu");
    root.append(this.panel, this.reopenChip, this.toastEl, this.buildQuickGo(), this.help);
    // Long content (owner chat, policies, rails once images load) switches the panel to full screen.
    this.sizeObserver = new ResizeObserver(() => this.syncFullScreen());
    window.addEventListener("resize", () => this.syncFullScreen());
    this.skipHint = el("p", "hud-skip", "Chạm để bỏ qua");
    this.skipHint.hidden = true;
    root.append(this.skipHint);
  }

  /** While the entrance plays: only the top bar and a "tap to skip" hint. */
  setIntro(on: boolean): void {
    this.root.classList.toggle("is-intro", on);
    this.skipHint.hidden = !on;
  }

  /** After the walk-in: the welcome card; its "Bắt đầu mua sắm" tap also starts the music. */
  showWelcome(): void {
    this.toggleHelp(true);
  }

  get isHelpOpen(): boolean {
    return !this.help.hidden;
  }

  /**
   * Sets the spot the guest is at (or none with `null`). Called only when the spot changes. The
   * panel stays closed; a chip offers it, and tapping the spot or the chip opens it.
   */
  show(key: string | null, view: PanelView | null): void {
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.currentView = view;
    this.hidePanel();
    if (view) this.showChip(view);
    else this.reopenChip.hidden = true;
  }

  /** Destinations for the "Đi tới" menu (walk somewhere, or open a shop screen right away). */
  setQuickActions(groups: Array<{ title: string; actions: QuickAction[] }>): void {
    const content = groups.map((group) => {
      const section = el("section", "quick-go__group");
      section.append(el("p", "quick-go__title", group.title));
      for (const action of group.actions) {
        const item = el("button", "quick-go__item");
        item.type = "button";
        item.append(el("span", "quick-go__label", action.label));
        if (action.hint) item.append(el("span", "quick-go__hint", action.hint));
        item.addEventListener("click", () => {
          this.toggleQuickMenu(false);
          action.run();
        });
        section.append(item);
      }
      return section;
    });
    this.quickMenu.replaceChildren(...content);
  }

  /** Soft fade, used when the guest jumps to another spot. */
  flash(): void {
    const veil = el("div", "hud-flash");
    this.root.append(veil);
    window.setTimeout(() => veil.remove(), 500);
  }

  /** Closes the spot panel (the chip stays to reopen it). */
  closePanel(): void {
    if (this.currentView && !this.panel.hidden) this.dismissPanel(this.currentView);
  }

  /** Swaps what the open panel shows at the current spot (e.g. counter → owner chat). */
  replaceView(view: PanelView): void {
    this.currentView = view;
    this.reopenChip.hidden = true;
    this.openPanel(view);
  }

  /** Opens the panel for the current spot. Returns false when there is none. */
  openCurrent(): boolean {
    if (!this.currentView) return false;
    if (!this.panel.hidden) return true;
    this.reopenChip.hidden = true;
    this.openPanel(this.currentView);
    return true;
  }

  private openPanel(view: PanelView): void {
    this.clearRail();
    const body = el("div", "hud-panel__body");
    body.append(this.renderPanel(view));
    this.panel.replaceChildren(body);
    this.sizeObserver.disconnect();
    this.sizeObserver.observe(body);
    const railHost = this.panel.querySelector<HTMLElement>(".hud-rail-host");
    if (railHost && view.rail) this.unmountRail = this.handlers.mountRail(railHost, view.rail);
    const customHost = this.panel.querySelector<HTMLElement>(".hud-custom");
    if (customHost && view.mount) view.mount(customHost);
    this.panel.hidden = false;
    this.panel.scrollTop = 0;
    void this.panel.offsetWidth; // commit the closed state so the open transition runs
    this.panel.classList.add("is-open");
  }

  /** Forces the next `show` to rebuild even with the same key. */
  refresh(): void {
    this.currentKey = null;
  }

  setCartCount(count: number): void {
    this.cartBadge.textContent = String(count);
    this.cartBadge.hidden = count === 0;
    this.cartButton.setAttribute("aria-label", count ? `Giỏ hàng, ${count} sản phẩm` : "Giỏ hàng trống");
  }

  bumpCart(): void {
    this.cartButton.classList.remove("is-bumped");
    void this.cartButton.offsetWidth;
    this.cartButton.classList.add("is-bumped");
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add("is-visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("is-visible"), 2600);
  }

  private dismissPanel(view: PanelView): void {
    this.hidePanel();
    this.showChip(view);
  }

  private showChip(view: PanelView): void {
    // Short titles ("Cổ sen phối ren") read best; long ones fall back to the eyebrow ("Đang được yêu thích").
    const label = view.title.length <= CHIP_TITLE_MAX || !view.eyebrow ? view.title : view.eyebrow;
    this.reopenChip.replaceChildren(el("span", "hud-reopen__dot"), el("span", "", `Xem · ${label}`));
    this.reopenChip.setAttribute("aria-label", `Mở bảng ${label}`);
    this.reopenChip.hidden = false;
  }

  /** Full screen when the content is taller than the normal card allows (it has its own close button). */
  private syncFullScreen(): void {
    const body = this.panel.firstElementChild as HTMLElement | null;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const limit = window.innerHeight * (phone ? 0.46 : 0.58);
    const full = !this.panel.hidden && !!body && body.scrollHeight > limit;
    this.panel.classList.toggle("is-full", full);
    this.root.classList.toggle("has-full-panel", full);
  }

  private clearRail(): void {
    this.unmountRail?.();
    this.unmountRail = null;
  }

  private hidePanel(): void {
    this.clearRail();
    this.sizeObserver.disconnect();
    this.panel.classList.remove("is-open", "is-full");
    this.root.classList.remove("has-full-panel");
    this.panel.hidden = true;
  }

  private renderPanel(view: PanelView): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const header = el("header", "hud-panel__header");
    const heading = el("div", "hud-panel__heading");
    if (view.eyebrow) heading.append(el("p", "hud-eyebrow", view.eyebrow));
    heading.append(el("h2", "hud-title", view.title));
    if (view.text) heading.append(el("p", "hud-text", view.text));
    // Closing keeps the guest where they are; the chip (or tapping the spot again) opens it again.
    header.append(heading, iconButton("hud-panel__close", "x", "Đóng", () => this.dismissPanel(view)));
    fragment.append(header);

    if (view.rail?.productIds.length) fragment.append(el("div", "hud-rail-host"));
    if (view.mount) fragment.append(el("div", "hud-custom"));
    if (view.actions?.length) {
      const actions = el("div", "hud-actions");
      for (const action of view.actions) actions.append(actionButton(action));
      fragment.append(actions);
    }
    return fragment;
  }

  private buildTopBar(): HTMLElement {
    const bar = el("header", "hud-top");
    const left = el("div", "hud-top__actions");
    left.append(iconButton("hud-icon-btn", "menu", "Mở menu sản phẩm", () => this.handlers.openMenu()));
    left.append(el("span", "hud-brand", "KNG.studio"));
    bar.append(left);
    const right = el("div", "hud-top__actions");
    this.cartButton.type = "button";
    this.cartButton.append(icon("bag", 20), this.cartBadge);
    this.cartButton.addEventListener("click", () => this.handlers.openCart());
    const helpButton = button("hud-icon-btn", "?", () => this.toggleHelp(true), "Cách di chuyển");
    const soundButton = el("button", "hud-icon-btn hud-icon-btn--svg");
    soundButton.type = "button";
    const renderSound = (on: boolean) => {
      soundButton.replaceChildren(icon(on ? "sound" : "mute", 18));
      soundButton.setAttribute("aria-label", on ? "Tắt âm thanh" : "Bật âm thanh");
      soundButton.setAttribute("aria-pressed", String(on));
    };
    renderSound(this.handlers.soundEnabled);
    soundButton.addEventListener("click", () => renderSound(this.handlers.toggleSound()));
    right.append(this.cartButton, soundButton, helpButton);
    bar.append(right);
    this.setCartCount(0);
    return bar;
  }

  private buildQuickGo(): HTMLElement {
    const wrap = el("div", "quick-go-wrap");
    this.quickButton.type = "button";
    this.quickButton.setAttribute("aria-expanded", "false");
    this.quickButton.setAttribute("aria-haspopup", "true");
    this.quickButton.append(icon("pin", 18), el("span", "", "Đi tới"));
    this.quickButton.addEventListener("click", () => this.toggleQuickMenu(this.quickMenu.hidden));
    this.quickMenu.hidden = true;
    this.quickMenu.setAttribute("role", "menu");
    wrap.append(this.quickMenu, this.quickButton);
    // Clicks elsewhere and Escape close the menu.
    document.addEventListener("pointerdown", (event) => {
      if (!this.quickMenu.hidden && !wrap.contains(event.target as Node)) this.toggleQuickMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.quickMenu.hidden) this.toggleQuickMenu(false);
    });
    return wrap;
  }

  private toggleQuickMenu(open: boolean): void {
    this.quickMenu.hidden = !open;
    this.quickButton.setAttribute("aria-expanded", String(open));
    this.quickButton.classList.toggle("is-open", open);
    this.root.classList.toggle("quick-open", open);
  }

  private buildHelp(): HTMLElement {
    const help = el("div", "hud-help");
    help.hidden = true;
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-label", "Cách di chuyển");
    const card = el("div", "hud-help__card");
    const list = el("ul", "hud-help__list");
    for (const item of [
      "Chạm hoặc bấm xuống sàn để đi tới đó",
      "Kéo để xoay góc nhìn, cuộn hoặc chụm hai ngón để phóng to",
      "Trên điện thoại: kéo nút tròn góc trái để đi. Máy tính: phím W A S D hoặc mũi tên",
      "Chỗ có chấm tròn nổi là xem được: chạm vào kệ, bục, quầy hay bé Min để đi tới và mở bảng",
    ]) {
      list.append(el("li", "", item));
    }
    card.append(el("h2", "hud-title", "Chào bạn ghé tiệm"), list, button("btn btn--primary", "Bắt đầu mua sắm", () => this.toggleHelp(false)));
    help.append(card);
    help.addEventListener("click", (event) => {
      if (event.target === help) this.toggleHelp(false);
    });
    help.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.toggleHelp(false);
    });
    return help;
  }

  private toggleHelp(open: boolean): void {
    this.help.hidden = !open;
    if (open) this.help.querySelector("button")?.focus();
  }
}
