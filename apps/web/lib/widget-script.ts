function widgetBootstrap(reportOrigin: string) {
  const sourceScript = document.currentScript;

  if (!(sourceScript instanceof HTMLScriptElement)) {
    return;
  }

  const projectKeyAttribute = sourceScript.dataset.project?.trim();

  if (
    !projectKeyAttribute ||
    !/^pk_proj_[a-f0-9]{24}$/.test(projectKeyAttribute)
  ) {
    return;
  }

  const projectKey = projectKeyAttribute;
  const initializationKey = Symbol.for("aurbit.widget.initialized");

  function mountWidget() {
    if (Reflect.get(window, initializationKey) || !document.body) {
      return;
    }

    Reflect.set(window, initializationKey, true);

    const reportPageUrl = new URL(
      "/report/" + encodeURIComponent(projectKey),
      reportOrigin,
    );
    const sourcePageUrl = new URL(window.location.href);
    sourcePageUrl.username = "";
    sourcePageUrl.password = "";
    sourcePageUrl.search = "";
    sourcePageUrl.hash = "";
    reportPageUrl.searchParams.set("source", sourcePageUrl.toString());
    const reportUrl = reportPageUrl.toString();
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    const trigger = document.createElement("button");
    const overlay = document.createElement("div");
    const panel = document.createElement("div");
    const closeButton = document.createElement("button");
    const frame = document.createElement("iframe");
    const status = document.createElement("div");
    const statusTitle = document.createElement("strong");
    const statusCopy = document.createElement("span");
    const fallbackLink = document.createElement("a");

    host.dataset.aurbitWidget = "";
    style.textContent = `
      :host {
        all: initial;
        color-scheme: dark;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      button, a {
        font: inherit;
      }

      .trigger {
        all: unset;
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483000;
        display: inline-flex;
        min-height: 44px;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        border: 1px solid #3f3f46;
        border-radius: 10px;
        background: #fafafa;
        padding: 0 18px;
        color: #09090b;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        font-weight: 650;
        line-height: 1;
        letter-spacing: -0.01em;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
        transition: background-color 150ms ease, transform 150ms ease;
        -webkit-font-smoothing: antialiased;
      }

      .trigger:hover {
        background: #e4e4e7;
      }

      .trigger:active {
        transform: translateY(1px);
      }

      .trigger:focus-visible,
      .close:focus-visible,
      .fallback:focus-visible {
        outline: 2px solid #fafafa;
        outline-offset: 3px;
      }

      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483001;
        display: grid;
        place-items: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.72);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .overlay[hidden],
      .frame[hidden],
      .status[hidden] {
        display: none;
      }

      .panel {
        position: relative;
        width: min(680px, 100%);
        height: min(760px, calc(100dvh - 32px));
        overflow: hidden;
        border: 1px solid #3f3f46;
        border-radius: 14px;
        background: #09090b;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
      }

      .close {
        all: unset;
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 2;
        display: grid;
        width: 36px;
        height: 36px;
        cursor: pointer;
        place-items: center;
        border: 1px solid #3f3f46;
        border-radius: 9px;
        background: #18181b;
        color: #d4d4d8;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 24px;
        line-height: 1;
        transition: background-color 150ms ease, color 150ms ease;
      }

      .close:hover {
        background: #27272a;
        color: #fafafa;
      }

      .frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #09090b;
      }

      .status {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        padding: 32px;
        color: #a1a1aa;
        text-align: center;
      }

      .status strong {
        color: #fafafa;
        font-size: 15px;
        font-weight: 650;
      }

      .status span {
        max-width: 320px;
        font-size: 13px;
        line-height: 1.6;
      }

      .fallback {
        margin-top: 8px;
        color: #fafafa;
        font-size: 13px;
        font-weight: 600;
        text-underline-offset: 3px;
      }

      @media (max-width: 640px) {
        .trigger {
          right: 16px;
          bottom: 16px;
        }

        .overlay {
          padding: 0;
        }

        .panel {
          width: 100%;
          height: 100dvh;
          border: 0;
          border-radius: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .trigger,
        .close {
          transition: none;
        }
      }
    `;

    trigger.className = "trigger";
    trigger.type = "button";
    trigger.textContent = "Report a bug";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "dialog");

    overlay.className = "overlay";
    overlay.hidden = true;

    panel.className = "panel";
    panel.setAttribute("aria-label", "Aurbit bug report");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("role", "dialog");

    closeButton.className = "close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close bug report");

    frame.className = "frame";
    frame.hidden = true;
    frame.title = "Aurbit bug report";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute(
      "sandbox",
      "allow-forms allow-same-origin allow-scripts",
    );

    status.className = "status";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    statusTitle.textContent = "Loading report form";
    statusCopy.textContent = "Connecting securely to Aurbit.";

    fallbackLink.className = "fallback";
    fallbackLink.href = reportUrl;
    fallbackLink.rel = "noopener noreferrer";
    fallbackLink.target = "_blank";
    fallbackLink.textContent = "Open the report page";

    status.append(statusTitle, statusCopy);
    panel.append(closeButton, status, frame);
    overlay.append(panel);
    shadow.append(style, trigger, overlay);
    document.body.append(host);

    let previousFocus: HTMLElement | null = null;
    let previousOverflow = "";
    let loadTimer: number | undefined;
    let hasStartedLoading = false;

    function showLoadError() {
      window.clearTimeout(loadTimer);
      frame.hidden = true;
      status.hidden = false;
      statusTitle.textContent = "Couldn't load the report form";
      statusCopy.textContent =
        "Open the secure Aurbit report page directly or try again.";
      status.append(fallbackLink);
    }

    function startFrameLoad() {
      if (hasStartedLoading) {
        return;
      }

      hasStartedLoading = true;
      frame.src = reportUrl;
      loadTimer = window.setTimeout(showLoadError, 12_000);
    }

    function openWidget() {
      if (!overlay.hidden) {
        return;
      }

      previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      overlay.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      startFrameLoad();
      window.requestAnimationFrame(() => closeButton.focus());
    }

    function closeWidget() {
      if (overlay.hidden) {
        return;
      }

      overlay.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      document.documentElement.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      } else {
        trigger.focus();
      }
    }

    trigger.addEventListener("click", openWidget);
    closeButton.addEventListener("click", closeWidget);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeWidget();
      }
    });

    frame.addEventListener("load", () => {
      window.clearTimeout(loadTimer);
      status.hidden = true;
      frame.hidden = false;
    });

    frame.addEventListener("error", showLoadError);

    document.addEventListener("keydown", (event) => {
      if (overlay.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeWidget();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const activeElement = shadow.activeElement;
      const firstFocusable = closeButton;
      const lastFocusable = frame.hidden ? closeButton : frame;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget, { once: true });
  } else {
    mountWidget();
  }
}

export function createWidgetScript(reportOrigin: string) {
  const parsedOrigin = new URL(reportOrigin);

  if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
    throw new TypeError("Widget origin must use HTTP or HTTPS.");
  }

  return (
    "(" +
    widgetBootstrap.toString() +
    ")(" +
    JSON.stringify(parsedOrigin.origin) +
    ");"
  );
}
