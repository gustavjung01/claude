(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function setMiniStatus(text, ok) {
    var el = $("status");
    if (!el) return;
    el.className = "status " + (ok ? "ok" : "warn");
    el.textContent = text;
  }

  function getFullConversationText() {
    var bubbles = Array.from(document.querySelectorAll("#chat .bubble"));
    return bubbles
      .map(function (b) {
        var role = "CLAUDE";
        if (b.classList.contains("user")) role = "USER";
        if (b.classList.contains("error")) role = "ERROR";

        var text = (b.innerText || "").trim();
        if (!text) return "";
        return "### " + role + "\n" + text;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  async function copyFullConversation() {
    var text = getFullConversationText();
    if (!text) {
      setMiniStatus("Chưa có nội dung để copy.", false);
      return;
    }

    await navigator.clipboard.writeText(text);
    setMiniStatus("Đã copy toàn bộ nội dung để chuyển qua GPT/preview.", true);
  }

  function addCopyFullButton() {
    var saveBtn = $("saveBtn");
    if (!saveBtn || $("copyFullBtn")) return;

    var btn = document.createElement("button");
    btn.className = "secondary";
    btn.id = "copyFullBtn";
    btn.textContent = "Copy toàn bộ";
    saveBtn.parentNode.insertBefore(btn, saveBtn);
    btn.onclick = copyFullConversation;

    var toolbar = document.querySelector(".toolbar");
    if (toolbar) {
      toolbar.style.gridTemplateColumns = "1fr auto auto auto auto";
    }
  }

  function addAutoCopyToggle() {
    if ($("autoCopyFull")) return;

    var aside = document.querySelector("aside");
    var status = $("status");
    if (!aside || !status) return;

    var wrap = document.createElement("label");
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    wrap.style.marginTop = "12px";
    wrap.style.color = "var(--muted)";
    wrap.style.fontSize = "12px";
    wrap.style.cursor = "pointer";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "autoCopyFull";
    cb.style.width = "auto";

    var span = document.createElement("span");
    span.textContent = "Auto copy toàn bộ sau reply";

    wrap.appendChild(cb);
    wrap.appendChild(span);
    aside.insertBefore(wrap, status);
  }

  function wrapSendPrompt() {
    if (window.__claudePanelPatched) return;
    if (typeof window.sendPrompt !== "function") return;

    var originalSendPrompt = window.sendPrompt;

    window.sendPrompt = async function (promptOverride) {
      var promptBox = $("prompt");
      var shouldClearPrompt = !promptOverride;
      var result = await originalSendPrompt(promptOverride);

      if (shouldClearPrompt && promptBox) {
        promptBox.value = "";
        promptBox.focus();
      }

      var autoCopy = $("autoCopyFull");
      if (autoCopy && autoCopy.checked) {
        await copyFullConversation();
      }

      return result;
    };

    var sendBtn = $("sendBtn");
    if (sendBtn) {
      sendBtn.onclick = function () {
        window.sendPrompt();
      };
    }

    var pingBtn = $("pingBtn");
    if (pingBtn) {
      pingBtn.onclick = function () {
        window.sendPrompt("ping");
      };
    }

    var copyBtn = $("copyBtn");
    if (copyBtn) {
      copyBtn.textContent = "Copy reply";
    }

    window.__claudePanelPatched = true;
  }

  function boot() {
    addCopyFullButton();
    addAutoCopyToggle();
    wrapSendPrompt();
    setMiniStatus("Desktop patch đã bật: auto clear prompt + copy toàn bộ.", true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.copyFullConversation = copyFullConversation;
})();
