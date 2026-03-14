import { readFileSync } from 'fs';
import { join } from 'path';
import { micromark } from 'micromark';
import { gfmHtml, gfm } from 'micromark-extension-gfm';
import { toHtml } from 'hast-util-to-html';
import { jsxs, jsx } from 'preact/jsx-runtime';

// src/pageType.ts

// src/types.ts
var CANVAS_PRESET_COLORS = {
  "1": "#fb464c",
  "2": "#e9973f",
  "3": "#e0de71",
  "4": "#44cf6e",
  "5": "#53dfdd",
  "6": "#a882ff"
};

// src/components/styles/canvas.scss
var canvas_default = `.canvas-page {
  width: 100%;
  max-width: none;
  height: 100%;
  margin: 0;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: none;
  border-radius: 0;
  background-color: var(--light);
  background-image: radial-gradient(circle, var(--lightgray) 1px, transparent 1px);
  background-size: 20px 20px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.canvas-container:active {
  cursor: grabbing;
}

.canvas-viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.canvas-nodes {
  position: absolute;
  top: 0;
  left: 0;
}

.canvas-node {
  position: absolute;
  border: 2px solid var(--canvas-node-color, var(--lightgray));
  border-radius: 6px;
  background: var(--light);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
}
.canvas-node:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.canvas-node-content {
  padding: 12px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--darkgray);
  word-wrap: break-word;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.canvas-node-text .canvas-node-content {
  white-space: pre-wrap;
}

.canvas-node-file {
  overflow: visible;
}
.canvas-node-file .canvas-file-label {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  padding: 2px 8px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}
.canvas-node-file .canvas-file-label a {
  color: var(--canvas-node-color, var(--secondary));
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.canvas-node-file .canvas-file-label a::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  background: var(--canvas-node-color, var(--secondary));
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3C/svg%3E");
  mask-size: contain;
  mask-repeat: no-repeat;
  flex-shrink: 0;
}
.canvas-node-file .canvas-file-label a:hover {
  text-decoration: underline;
}
.canvas-node-file .canvas-embed-content h1,
.canvas-node-file .canvas-embed-content h2,
.canvas-node-file .canvas-embed-content h3,
.canvas-node-file .canvas-embed-content h4,
.canvas-node-file .canvas-embed-content h5,
.canvas-node-file .canvas-embed-content h6 {
  margin-top: 0.8em;
  margin-bottom: 0.4em;
}
.canvas-node-file .canvas-embed-content h1:first-child,
.canvas-node-file .canvas-embed-content h2:first-child,
.canvas-node-file .canvas-embed-content h3:first-child,
.canvas-node-file .canvas-embed-content h4:first-child,
.canvas-node-file .canvas-embed-content h5:first-child,
.canvas-node-file .canvas-embed-content h6:first-child {
  margin-top: 0;
}
.canvas-node-file .canvas-embed-content p {
  margin: 0.5em 0;
}
.canvas-node-file .canvas-embed-content ul,
.canvas-node-file .canvas-embed-content ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.canvas-node-file .canvas-embed-content img {
  max-width: 100%;
  height: auto;
}
.canvas-node-file .canvas-embed-content pre {
  overflow-x: auto;
  padding: 0.5em;
  border-radius: 4px;
  background: var(--lightgray);
}
.canvas-node-file .canvas-embed-content code {
  font-size: 0.85em;
}
.canvas-node-file .canvas-file-subpath {
  font-size: 0.75rem;
  color: var(--gray);
  margin-left: auto;
}
.canvas-node-file .canvas-node-content > .canvas-file-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  color: var(--secondary);
  text-decoration: none;
  font-weight: 500;
}
.canvas-node-file .canvas-node-content > .canvas-file-link:hover {
  text-decoration: underline;
}

.canvas-node-link {
  overflow: visible;
}
.canvas-node-link .canvas-node-content {
  padding: 0;
  overflow: hidden;
}
.canvas-node-link .canvas-link-label {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  padding: 2px 8px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.canvas-node-link .canvas-link-label a {
  color: var(--canvas-node-color, var(--secondary));
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.canvas-node-link .canvas-link-label a::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  background: var(--canvas-node-color, var(--secondary));
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/%3E%3Cpolyline points='15 3 21 3 21 9'/%3E%3Cline x1='10' y1='14' x2='21' y2='3'/%3E%3C/svg%3E");
  mask-size: contain;
  mask-repeat: no-repeat;
  flex-shrink: 0;
}
.canvas-node-link .canvas-link-label a:hover {
  text-decoration: underline;
}
.canvas-node-link .canvas-iframe-wrapper {
  position: relative;
  padding: 0;
  overflow: hidden;
}
.canvas-node-link .canvas-iframe-wrapper iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--light);
}
.canvas-node-link .canvas-iframe-wrapper .canvas-iframe-fallback {
  display: none;
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  background: var(--light);
  font-size: 0.85rem;
}
.canvas-node-link .canvas-iframe-wrapper .canvas-iframe-fallback a {
  color: var(--secondary);
  text-decoration: underline;
}

.canvas-node-group {
  background: transparent;
  border-style: dashed;
  border-color: var(--canvas-node-color, var(--gray));
  border-radius: 12px;
  overflow: visible;
}
.canvas-node-group .canvas-group-label {
  position: absolute;
  top: -10px;
  left: 16px;
  padding: 0 8px;
  background: var(--light);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--canvas-node-color, var(--darkgray));
}

.canvas-edges {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}

.canvas-edge path {
  pointer-events: stroke;
}

.canvas-edge-label-bg {
  fill: var(--light);
  fill-opacity: 0.85;
}

.canvas-edge-label {
  font-size: 0.8rem;
  fill: var(--darkgray);
  pointer-events: none;
}

.canvas-controls {
  position: fixed;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 25;
}
.canvas-controls button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  color: var(--darkgray);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: background 0.1s ease;
}
.canvas-controls button:hover {
  background: var(--lightgray);
}
.canvas-controls .canvas-zoom-group {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  overflow: hidden;
}
.canvas-controls .canvas-zoom-group button {
  border: none;
  border-radius: 0;
}
.canvas-controls .canvas-zoom-group button:first-child {
  border-bottom: 1px solid var(--lightgray);
}

.page[data-frame=canvas] {
  --canvas-sidebar-width: 300px;
}

.page[data-frame=canvas] .canvas-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding-left: 0;
  transition: padding-left 0.2s ease;
}

.page[data-frame=canvas] .canvas-stage {
  width: 100%;
  height: 100%;
}

.page[data-frame=canvas] .canvas-sidebar {
  position: fixed;
  top: 0;
  height: 100vh;
  width: var(--canvas-sidebar-width);
  box-sizing: border-box;
  background: var(--light);
  border-right: 1px solid var(--lightgray);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  left: calc(-1 * var(--canvas-sidebar-width));
  transition: left 0.25s ease;
  z-index: 20;
}

.page[data-frame=canvas] .canvas-sidebar-toggle {
  position: fixed;
  top: 12px;
  left: 12px;
  width: 32px;
  height: 32px;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  color: var(--darkgray);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  transition: background 0.1s ease;
}
.page[data-frame=canvas] .canvas-sidebar-toggle:hover {
  background: var(--lightgray);
}

.page[data-frame=canvas] .canvas-sidebar-icon-close {
  display: none;
}

.page[data-frame=canvas].canvas-sidebar-open .canvas-frame {
  padding-left: var(--canvas-sidebar-width);
}

.page[data-frame=canvas].canvas-sidebar-open .canvas-sidebar {
  left: 0;
}

.page[data-frame=canvas].canvas-sidebar-open .canvas-sidebar-icon-open {
  display: none;
}

.page[data-frame=canvas].canvas-sidebar-open .canvas-sidebar-icon-close {
  display: block;
}

@media (max-width: 900px) {
  .page[data-frame=canvas] {
    --canvas-sidebar-width: min(320px, 85vw);
  }
  .page[data-frame=canvas].canvas-sidebar-open .canvas-frame {
    padding-left: 0;
  }
}
.page[data-frame=canvas] .canvas-sidebar {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.page[data-frame=canvas] .canvas-sidebar .spacer {
  display: none;
}
.page[data-frame=canvas] .canvas-sidebar .explorer button.desktop-explorer,
.page[data-frame=canvas] .canvas-sidebar .explorer button.mobile-explorer {
  display: none !important;
}
.page[data-frame=canvas] .canvas-sidebar .explorer {
  order: initial;
  height: auto;
  overflow-y: hidden;
  overflow: visible;
  flex: 0 1 auto;
  flex-shrink: initial;
  align-self: initial;
  margin-top: 0;
  margin-bottom: 0;
}
.page[data-frame=canvas] .canvas-sidebar .explorer .explorer-content,
.page[data-frame=canvas] .canvas-sidebar .explorer.collapsed > .explorer-content,
.page[data-frame=canvas] .canvas-sidebar .explorer:not(.collapsed) > .explorer-content {
  position: static;
  width: auto;
  max-width: none;
  height: auto;
  max-height: none;
  transform: none !important;
  visibility: visible !important;
  padding: 0;
  overflow-y: auto;
  z-index: auto;
  background-color: transparent;
}
.page[data-frame=canvas] .canvas-sidebar .explorer-content > .explorer-ul {
  overscroll-behavior: auto;
}

.transclude .canvas-page {
  height: auto;
}
.transclude .canvas-container {
  height: auto;
  min-height: 400px;
}
.transclude .canvas-controls {
  position: absolute;
}

.popover-inner .canvas-page {
  height: auto;
}
.popover-inner .canvas-container {
  height: auto;
  min-height: 200px;
  max-height: 300px;
}
.popover-inner .canvas-controls {
  display: none;
}

.page[data-frame=canvas] .canvas-fullscreen-toggle {
  display: none;
}

.canvas-container:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: unset;
  background-color: var(--light);
}
.canvas-container:fullscreen .canvas-controls {
  position: fixed;
}`;

// src/components/scripts/canvas.inline.ts
var canvas_inline_default = 'function K(){let g=document.querySelectorAll(".canvas-container");if(g.length!==0)for(let t of Array.from(g)){if(t.dataset.initialized==="true")continue;t.dataset.initialized="true";let M=t.querySelector(".canvas-viewport");if(!M)continue;let j=t.dataset.enableInteraction!=="false",w=parseFloat(t.dataset.minZoom??"")||.1,H=parseFloat(t.dataset.maxZoom??"")||5,o=parseFloat(t.dataset.initialZoom??"")||1,c=0,l=0,Y=!1,D=0,O=0,E=()=>{M.style.transform=`translate(${c}px, ${l}px) scale(${o})`},X=()=>{let n=t.getBoundingClientRect(),i=parseFloat(M.style.width)||1e3,u=parseFloat(M.style.height)||1e3,d=n.width/i,r=n.height/u;o=Math.min(d,r,1)*.9,o=Math.max(w,Math.min(H,o)),c=(n.width-i*o)/2,l=(n.height-u*o)/2,E()};X();let b=o,x=c,B=l,L=t.querySelector(".canvas-reset-view"),m=()=>{if(!L)return;let n=Math.abs(o-b)>.001||Math.abs(c-x)>1||Math.abs(l-B)>1;L.style.display=n?"flex":"none"},f=[];if(j){let n=e=>{let s=e.target instanceof HTMLElement?e.target.closest(".canvas-node-content"):null;if(s&&s.scrollHeight>s.clientHeight){let q=s.scrollTop<=0,A=s.scrollTop+s.clientHeight>=s.scrollHeight-1,F=e.deltaY>0,J=e.deltaY<0;if(!(q&&J)&&!(A&&F))return}e.preventDefault();let a=t.getBoundingClientRect(),T=e.clientX-a.left,h=e.clientY-a.top,p=o,S=e.deltaY>0?.9:1.1;o=Math.max(w,Math.min(H,o*S)),c=T-(T-c)*(o/p),l=h-(h-l)*(o/p),E(),m()},i=e=>{if(e.button===0&&!(e.target instanceof HTMLElement&&(e.target.closest("a")||e.target.closest("button")))){if(e.target instanceof HTMLElement){let s=e.target.closest(".canvas-node-content");if(s&&s.scrollHeight>s.clientHeight){let a=s.getBoundingClientRect();if(e.clientX>=a.right-16)return}}Y=!0,D=e.clientX-c,O=e.clientY-l,t.setPointerCapture(e.pointerId)}},u=e=>{Y&&(c=e.clientX-D,l=e.clientY-O,E(),m())},d=()=>{Y=!1};t.addEventListener("wheel",n,{passive:!1}),t.addEventListener("pointerdown",i),t.addEventListener("pointermove",u),t.addEventListener("pointerup",d);let r=0,v=0,z=0,P=!1,N=e=>{if(e.length<2||!e[0]||!e[1])return 0;let s=e[0].clientX-e[1].clientX,a=e[0].clientY-e[1].clientY;return Math.sqrt(s*s+a*a)},U=e=>{if(e.touches.length===2){let s=e.touches[0],a=e.touches[1];if(!s||!a)return;e.preventDefault(),P=!0,Y=!1,r=N(e.touches),v=(s.clientX+a.clientX)/2,z=(s.clientY+a.clientY)/2}},W=e=>{if(e.touches.length===2&&P){let s=e.touches[0],a=e.touches[1];if(!s||!a)return;e.preventDefault();let T=N(e.touches),h=(s.clientX+a.clientX)/2,p=(s.clientY+a.clientY)/2,S=t.getBoundingClientRect(),R=h-S.left,q=p-S.top,A=T/r,F=o;o=Math.max(w,Math.min(H,o*A)),c=R-(R-c)*(o/F),l=q-(q-l)*(o/F),c+=h-v,l+=p-z,r=T,v=h,z=p,E(),m()}},V=e=>{e.touches.length<2&&(P=!1)};t.addEventListener("touchstart",U,{passive:!1}),t.addEventListener("touchmove",W,{passive:!1}),t.addEventListener("touchend",V),f.push(()=>{t.removeEventListener("wheel",n),t.removeEventListener("pointerdown",i),t.removeEventListener("pointermove",u),t.removeEventListener("pointerup",d),t.removeEventListener("touchstart",U),t.removeEventListener("touchmove",W),t.removeEventListener("touchend",V)})}let k=t.closest(\'.page[data-frame="canvas"]\'),C=k?.querySelector(".canvas-sidebar-toggle");if(k&&C){let n=()=>{k.classList.toggle("canvas-sidebar-open"),X(),b=o,x=c,B=l,m()};C.addEventListener("click",n),f.push(()=>{C.removeEventListener("click",n)})}let Z=t.querySelector(".canvas-zoom-in"),I=t.querySelector(".canvas-zoom-out"),$=n=>{let i=t.getBoundingClientRect(),u=i.width/2,d=i.height/2,r=o;o=Math.max(w,Math.min(H,o*n)),c=u-(u-c)*(o/r),l=d-(d-l)*(o/r),E(),m()};if(Z){let n=()=>{$(1.25)};Z.addEventListener("click",n),f.push(()=>Z.removeEventListener("click",n))}if(I){let n=()=>{$(.8)};I.addEventListener("click",n),f.push(()=>I.removeEventListener("click",n))}if(L){let n=()=>{X(),b=o,x=c,B=l,m()};L.addEventListener("click",n),f.push(()=>L.removeEventListener("click",n))}let y=t.querySelector(".canvas-fullscreen-toggle");if(y){let n=y.querySelector(".canvas-fullscreen-enter"),i=y.querySelector(".canvas-fullscreen-exit"),u=()=>{let v=document.fullscreenElement===t;n&&(n.style.display=v?"none":""),i&&(i.style.display=v?"":"none")},d=()=>{document.fullscreenElement===t?document.exitFullscreen():t.requestFullscreen()},r=()=>{u(),requestAnimationFrame(()=>{X(),b=o,x=c,B=l,m()})};y.addEventListener("click",d),document.addEventListener("fullscreenchange",r),f.push(()=>{y.removeEventListener("click",d),document.removeEventListener("fullscreenchange",r)})}let G=t.querySelectorAll(".canvas-iframe-wrapper iframe");for(let n of Array.from(G))n.addEventListener("error",()=>{let i=n.parentElement?.querySelector(".canvas-iframe-fallback");i&&(n.style.display="none",i.style.display="flex")});typeof window<"u"&&window.addCleanup&&window.addCleanup(()=>{for(let n of f)n();t.dataset.initialized="false"})}}if(typeof document<"u"){let g=()=>{K()};document.addEventListener("nav",g),document.addEventListener("render",g)}\n';
function resolveColor(color) {
  if (!color) return void 0;
  if (color.startsWith("#")) return color;
  return CANVAS_PRESET_COLORS[color] ?? void 0;
}
function getEdgeAnchor(node, side) {
  const border = node.type === "group" ? 2 : 2;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  switch (side) {
    case "top":
      return { x: cx, y: node.y - border };
    case "bottom":
      return { x: cx, y: node.y + node.height + border };
    case "left":
      return { x: node.x - border, y: cy };
    case "right":
      return { x: node.x + node.width + border, y: cy };
    default:
      return { x: cx, y: cy };
  }
}
function renderNode(node, renderedTexts, embeddedContent) {
  const color = resolveColor(node.color);
  const baseStyle = {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`
  };
  if (color) {
    baseStyle["--canvas-node-color"] = color;
  }
  const styleStr = Object.entries(baseStyle).map(([k, v]) => `${k}:${v}`).join(";");
  switch (node.type) {
    case "text": {
      const html = renderedTexts[node.id];
      return /* @__PURE__ */ jsx("div", { class: "canvas-node canvas-node-text", "data-node-id": node.id, style: styleStr, children: html ? /* @__PURE__ */ jsx("div", { class: "canvas-node-content", dangerouslySetInnerHTML: { __html: html } }) : /* @__PURE__ */ jsx("div", { class: "canvas-node-content", children: node.text }) });
    }
    case "file": {
      const filename = node.file.split("/").pop()?.replace(/\.md$/, "") ?? node.file;
      const embedded = embeddedContent[node.id];
      return /* @__PURE__ */ jsxs("div", { class: "canvas-node canvas-node-file", "data-node-id": node.id, style: styleStr, children: [
        /* @__PURE__ */ jsxs("div", { class: "canvas-file-label", children: [
          /* @__PURE__ */ jsx(
            "a",
            {
              href: `/${node.file.replace(/\.md$/, "")}`,
              class: "canvas-file-link internal",
              "data-slug": node.file.replace(/\.md$/, ""),
              children: filename
            }
          ),
          node.subpath && /* @__PURE__ */ jsx("span", { class: "canvas-file-subpath", children: node.subpath })
        ] }),
        /* @__PURE__ */ jsx("div", { class: "canvas-node-content", children: embedded ? /* @__PURE__ */ jsx("div", { class: "canvas-embed-content", dangerouslySetInnerHTML: { __html: embedded } }) : /* @__PURE__ */ jsx(
          "a",
          {
            href: `/${node.file.replace(/\.md$/, "")}`,
            class: "canvas-file-link internal",
            "data-slug": node.file.replace(/\.md$/, ""),
            children: filename
          }
        ) })
      ] });
    }
    case "link": {
      let hostname;
      try {
        hostname = new URL(node.url).hostname;
      } catch {
        hostname = node.url;
      }
      return /* @__PURE__ */ jsxs("div", { class: "canvas-node canvas-node-link", "data-node-id": node.id, style: styleStr, children: [
        /* @__PURE__ */ jsx("div", { class: "canvas-link-label", children: /* @__PURE__ */ jsx(
          "a",
          {
            href: node.url,
            class: "canvas-link external",
            target: "_blank",
            rel: "noopener noreferrer",
            children: hostname
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { class: "canvas-node-content canvas-iframe-wrapper", children: [
          /* @__PURE__ */ jsx(
            "iframe",
            {
              src: node.url,
              title: hostname,
              sandbox: "allow-scripts allow-same-origin allow-popups",
              loading: "lazy",
              referrerpolicy: "no-referrer"
            }
          ),
          /* @__PURE__ */ jsx("div", { class: "canvas-iframe-fallback", children: /* @__PURE__ */ jsxs("a", { href: node.url, target: "_blank", rel: "noopener noreferrer", children: [
            "Open ",
            hostname,
            " in new tab"
          ] }) })
        ] })
      ] });
    }
    case "group":
      return /* @__PURE__ */ jsx("div", { class: "canvas-node canvas-node-group", "data-node-id": node.id, style: styleStr, children: node.label && /* @__PURE__ */ jsx("div", { class: "canvas-group-label", children: node.label }) });
    default:
      return null;
  }
}
function renderEdge(edge, nodeMap) {
  const fromNode = nodeMap.get(edge.fromNode);
  const toNode = nodeMap.get(edge.toNode);
  if (!fromNode || !toNode) return null;
  const from = getEdgeAnchor(fromNode, edge.fromSide);
  const to = getEdgeAnchor(toNode, edge.toSide);
  const color = resolveColor(edge.color);
  const hasFromArrow = edge.fromEnd === "arrow";
  const hasToArrow = (edge.toEnd ?? "arrow") === "arrow";
  const markerId = `arrow-${edge.id}`;
  const markerStartId = `arrow-start-${edge.id}`;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = from.x + dx / 2;
  const midY = from.y + dy / 2;
  const pathD = `M ${from.x} ${from.y} Q ${midX} ${from.y}, ${midX} ${midY} T ${to.x} ${to.y}`;
  return /* @__PURE__ */ jsxs("g", { class: "canvas-edge", "data-edge-id": edge.id, children: [
    /* @__PURE__ */ jsxs("defs", { children: [
      hasToArrow && /* @__PURE__ */ jsx(
        "marker",
        {
          id: markerId,
          viewBox: "0 0 10 10",
          refX: "9",
          refY: "5",
          markerWidth: "6",
          markerHeight: "6",
          orient: "auto-start-reverse",
          children: /* @__PURE__ */ jsx("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color ?? "var(--darkgray)" })
        }
      ),
      hasFromArrow && /* @__PURE__ */ jsx(
        "marker",
        {
          id: markerStartId,
          viewBox: "0 0 10 10",
          refX: "1",
          refY: "5",
          markerWidth: "6",
          markerHeight: "6",
          orient: "auto-start-reverse",
          children: /* @__PURE__ */ jsx("path", { d: "M 10 0 L 0 5 L 10 10 z", fill: color ?? "var(--darkgray)" })
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "path",
      {
        d: pathD,
        fill: "none",
        stroke: color ?? "var(--darkgray)",
        "stroke-width": "2",
        "marker-end": hasToArrow ? `url(#${markerId})` : void 0,
        "marker-start": hasFromArrow ? `url(#${markerStartId})` : void 0
      }
    ),
    edge.label && /* @__PURE__ */ jsxs("g", { class: "canvas-edge-label-group", children: [
      /* @__PURE__ */ jsx(
        "rect",
        {
          x: midX - edge.label.length * 3.5 - 4,
          y: midY - 20,
          width: edge.label.length * 7 + 8,
          height: 16,
          rx: "3",
          class: "canvas-edge-label-bg"
        }
      ),
      /* @__PURE__ */ jsx("text", { x: midX, y: midY, class: "canvas-edge-label", "text-anchor": "middle", dy: "-8", children: edge.label })
    ] })
  ] });
}
var CanvasBody_default = ((userOpts) => {
  const Component = (props) => {
    const fileData = props.fileData;
    const canvasData = fileData.canvasData;
    if (!canvasData) {
      return /* @__PURE__ */ jsx("article", { class: "canvas-page popover-hint", children: /* @__PURE__ */ jsx("p", { children: "No canvas data found." }) });
    }
    const nodes = canvasData.nodes ?? [];
    const edges = canvasData.edges ?? [];
    const renderedTexts = canvasData.renderedTexts ?? {};
    const embeddedContent = fileData.embeddedContent ?? {};
    const nodeMap = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    if (nodes.length === 0) {
      minX = minY = 0;
      maxX = maxY = 100;
    }
    const padding = 50;
    const viewWidth = maxX - minX + padding * 2;
    const viewHeight = maxY - minY + padding * 2;
    const opts = userOpts ?? {};
    const enableInteraction = opts.enableInteraction ?? true;
    const initialZoom = opts.initialZoom ?? 1;
    const minZoom = opts.minZoom ?? 0.1;
    const maxZoom = opts.maxZoom ?? 5;
    return /* @__PURE__ */ jsx("article", { class: "canvas-page popover-hint", children: /* @__PURE__ */ jsxs(
      "div",
      {
        class: "canvas-container",
        "data-enable-interaction": enableInteraction.toString(),
        "data-initial-zoom": initialZoom.toString(),
        "data-min-zoom": minZoom.toString(),
        "data-max-zoom": maxZoom.toString(),
        children: [
          /* @__PURE__ */ jsxs("div", { class: "canvas-controls", children: [
            /* @__PURE__ */ jsxs("div", { class: "canvas-zoom-group", children: [
              /* @__PURE__ */ jsx("button", { class: "canvas-zoom-in", type: "button", "aria-label": "Zoom in", children: /* @__PURE__ */ jsxs(
                "svg",
                {
                  xmlns: "http://www.w3.org/2000/svg",
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  children: [
                    /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "8" }),
                    /* @__PURE__ */ jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }),
                    /* @__PURE__ */ jsx("line", { x1: "11", y1: "8", x2: "11", y2: "14" }),
                    /* @__PURE__ */ jsx("line", { x1: "8", y1: "11", x2: "14", y2: "11" })
                  ]
                }
              ) }),
              /* @__PURE__ */ jsx("button", { class: "canvas-zoom-out", type: "button", "aria-label": "Zoom out", children: /* @__PURE__ */ jsxs(
                "svg",
                {
                  xmlns: "http://www.w3.org/2000/svg",
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  children: [
                    /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "8" }),
                    /* @__PURE__ */ jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }),
                    /* @__PURE__ */ jsx("line", { x1: "8", y1: "11", x2: "14", y2: "11" })
                  ]
                }
              ) })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                class: "canvas-reset-view",
                type: "button",
                "aria-label": "Reset view",
                style: "display:none",
                children: /* @__PURE__ */ jsxs(
                  "svg",
                  {
                    xmlns: "http://www.w3.org/2000/svg",
                    width: "16",
                    height: "16",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                    children: [
                      /* @__PURE__ */ jsx("path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
                      /* @__PURE__ */ jsx("path", { d: "M3 3v5h5" })
                    ]
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs("button", { class: "canvas-fullscreen-toggle", type: "button", "aria-label": "Toggle fullscreen", children: [
              /* @__PURE__ */ jsxs(
                "svg",
                {
                  xmlns: "http://www.w3.org/2000/svg",
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  class: "canvas-fullscreen-enter",
                  children: [
                    /* @__PURE__ */ jsx("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }),
                    /* @__PURE__ */ jsx("path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }),
                    /* @__PURE__ */ jsx("path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }),
                    /* @__PURE__ */ jsx("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "svg",
                {
                  xmlns: "http://www.w3.org/2000/svg",
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  "stroke-width": "2",
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  class: "canvas-fullscreen-exit",
                  style: "display:none",
                  children: [
                    /* @__PURE__ */ jsx("path", { d: "M8 3v3a2 2 0 0 1-2 2H3" }),
                    /* @__PURE__ */ jsx("path", { d: "M21 8h-3a2 2 0 0 1-2-2V3" }),
                    /* @__PURE__ */ jsx("path", { d: "M3 16h3a2 2 0 0 1 2 2v3" }),
                    /* @__PURE__ */ jsx("path", { d: "M16 21v-3a2 2 0 0 1 2-2h3" })
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { class: "canvas-viewport", style: `width:${viewWidth}px;height:${viewHeight}px`, children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                class: "canvas-nodes",
                style: `transform:translate(${-minX + padding}px,${-minY + padding}px)`,
                children: nodes.map((node) => renderNode(node, renderedTexts, embeddedContent))
              }
            ),
            /* @__PURE__ */ jsx(
              "svg",
              {
                class: "canvas-edges",
                width: viewWidth,
                height: viewHeight,
                viewBox: `${minX - padding} ${minY - padding} ${viewWidth} ${viewHeight}`,
                children: edges.map((edge) => renderEdge(edge, nodeMap))
              }
            )
          ] })
        ]
      }
    ) });
  };
  Component.css = canvas_default;
  Component.afterDOMLoaded = canvas_inline_default;
  return Component;
});

// src/pageType.ts
function renderMarkdown(text) {
  return micromark(text, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()]
  });
}
function preprocessCanvasData(data) {
  const renderedTexts = {};
  for (const node of data.nodes ?? []) {
    if (node.type === "text" && node.text) {
      renderedTexts[node.id] = renderMarkdown(node.text);
    }
  }
  return { ...data, renderedTexts };
}
function buildEmbeddedContent(data, content) {
  const embeddedHtml = {};
  for (const node of data.nodes ?? []) {
    if (node.type !== "file") continue;
    const fileRef = node.file.replace(/\.md$/, "");
    const match = content.find(([, vfile]) => {
      const slug = vfile.data.slug;
      if (!slug) return false;
      return slug === fileRef || slug.endsWith(`/${fileRef}`);
    });
    if (match) {
      const [, vfile] = match;
      const htmlAst = vfile.data.htmlAst;
      if (htmlAst) {
        embeddedHtml[node.id] = toHtml(htmlAst, {
          allowDangerousHtml: true
        });
      }
    }
  }
  return embeddedHtml;
}
var canvasMatcher = ({ fileData }) => {
  return "canvasData" in fileData;
};
var CanvasPage = (opts) => ({
  name: "CanvasPage",
  priority: 20,
  fileExtensions: [".canvas"],
  match: canvasMatcher,
  generate({ ctx, content }) {
    const canvasFiles = ctx.allFiles.filter((fp) => fp.endsWith(".canvas"));
    const virtualPages = [];
    for (const filePath of canvasFiles) {
      const fullPath = join(ctx.argv.directory, filePath);
      let canvasData;
      try {
        const raw = readFileSync(fullPath, "utf-8");
        canvasData = JSON.parse(raw);
      } catch {
        continue;
      }
      const slug = filePath.replace(/\.canvas$/, "");
      const baseName = slug.split("/").pop() ?? "Canvas";
      const processedData = preprocessCanvasData(canvasData);
      const embeddedContent = buildEmbeddedContent(canvasData, content);
      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          canvasData: processedData,
          canvasOptions: opts,
          embeddedContent
        }
      });
    }
    return virtualPages;
  },
  layout: "canvas",
  frame: "canvas",
  body: CanvasBody_default
});
var CanvasFrame = {
  name: "canvas",
  css: `
.page[data-frame="canvas"] {
  max-width: none;
  margin: 0;
  min-height: 100vh;
}

.page[data-frame="canvas"] > #quartz-body {
  grid-template-columns: auto;
  grid-template-rows: 1fr;
  grid-template-areas:
    "grid-center";
  height: 100vh;
  padding: 0;
}

.page[data-frame="canvas"] > #quartz-body > .center.canvas-frame {
  max-width: 100%;
  min-width: 100%;
  height: 100%;
  margin: 0;
}

.page[data-frame="canvas"] > #quartz-body.lock-scroll > * {
  transform: none;
}
`,
  render({ componentData, pageBody: Content, left }) {
    const renderSlot = (Component) => Component(componentData);
    return /* @__PURE__ */ jsxs("div", { class: "center canvas-frame", children: [
      /* @__PURE__ */ jsxs("button", { class: "canvas-sidebar-toggle", type: "button", "aria-label": "Toggle sidebar", children: [
        /* @__PURE__ */ jsxs(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            class: "canvas-sidebar-icon-open",
            children: [
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
              /* @__PURE__ */ jsx("line", { x1: "3", y1: "18", x2: "21", y2: "18" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            class: "canvas-sidebar-icon-close",
            children: [
              /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("aside", { class: "canvas-sidebar", children: left.map((BodyComponent) => renderSlot(BodyComponent)) }),
      /* @__PURE__ */ jsx("div", { class: "canvas-stage", children: renderSlot(Content) })
    ] });
  }
};

export { CanvasBody_default as CanvasBody, CanvasFrame, CanvasPage };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map