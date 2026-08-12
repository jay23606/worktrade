export const esc = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );

export const money = (value) =>
  value ? `$${Number(value).toLocaleString()}` : "Open budget";

export const modeLabel = (mode) =>
  ({ cash: "Cash", barter: "Barter", hybrid: "Cash + barter" })[mode] || mode;

export function createModalController(root) {
  let returnFocus = null;
  let returnFocusSelector = null;

  function stableSelector(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    const attributes = ["data-action", "data-nav", "data-open", "aria-label"]
      .filter((name) => element.hasAttribute(name))
      .map(
        (name) =>
          `[${name}="${CSS.escape(element.getAttribute(name))}"]`,
      )
      .join("");
    return attributes ? `${element.localName}${attributes}` : null;
  }

  function open(content) {
    returnFocus = document.activeElement;
    returnFocusSelector = stableSelector(returnFocus);
    root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${content}<button class="modal-x" data-modal-close aria-label="Close dialog">×</button></section></div>`;
    const heading = root.querySelector("h2");
    if (heading) heading.id = "modal-title";
    setTimeout(() => root.querySelector("input, select, textarea")?.focus(), 0);
  }

  function close() {
    root.innerHTML = "";
    const selector = returnFocusSelector;
    const target = returnFocus?.isConnected
      ? returnFocus
      : selector
        ? document.querySelector(selector)
        : null;
    if (target instanceof HTMLElement) target.focus();
    if (selector)
      setTimeout(() => {
        if (
          !root.firstElementChild &&
          (document.activeElement === document.body ||
            !document.activeElement?.isConnected)
        )
          document.querySelector(selector)?.focus();
      }, 100);
    returnFocus = null;
    returnFocusSelector = null;
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !root.firstElementChild) return;
    const focusable = [
      ...root.querySelectorAll(
        "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
      ),
    ].filter((item) => item.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { open, close, trapFocus };
}
