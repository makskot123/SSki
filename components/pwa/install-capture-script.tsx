// Chrome fires `beforeinstallprompt` once, often before React has hydrated. This tiny inline script keeps
// the event so the "Install app" button can use it later (and suppresses Chrome's own mini-infobar).
const script = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__faInstall=e;window.dispatchEvent(new Event("fa-installable"))});window.addEventListener("appinstalled",function(){window.__faInstall=null;window.dispatchEvent(new Event("fa-installable"))});`;

export function InstallCaptureScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
