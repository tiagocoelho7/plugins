"use strict";

const FAVICON_COLORS = new Set([
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange"
]);

const requestedColor = new URLSearchParams(location.search).get("color");
const faviconColor = FAVICON_COLORS.has(requestedColor) ? requestedColor : "grey";
const favicon = document.querySelector("#group-favicon");
const faviconUrl = browser.runtime.getURL(`icons/group-${faviconColor}.svg`);
favicon.href = faviconUrl;

globalThis.groupFaviconReady = new Promise((resolve) => {
  const image = new Image();
  image.addEventListener("load", resolve, { once: true });
  image.addEventListener("error", resolve, { once: true });
  image.src = faviconUrl;
});
