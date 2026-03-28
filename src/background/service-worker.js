import { storage } from '../shared/storage';

const tabCounts = new Map();

function badgeColorForSeverity(sev) {
  switch (sev) {
    case 'CRITICAL':
      return '#b91c1c';
    case 'HIGH':
      return '#ea580c';
    case 'MEDIUM':
      return '#ca8a04';
    default:
      return '#2563eb';
  }
}

function openSidePanelForSender(sender) {
  if (sender.tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    return;
  }
  chrome.windows.getCurrent((w) => {
    if (w?.id != null) chrome.sidePanel.open({ windowId: w.id });
  });
}

function setSidePanelBehavior() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
}

function ensureContextMenu() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create(
      {
        id: 'sentientcy-scan-selection',
        title: 'Scan selection with Sentiency',
        contexts: ['selection'],
      },
      () => void chrome.runtime.lastError,
    );
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setSidePanelBehavior();
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  setSidePanelBehavior();
  ensureContextMenu();
});

setSidePanelBehavior();
ensureContextMenu();

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'sentientcy-scan-selection' || !tab?.id) return;
    const text = info.selectionText || '';
    if (text.trim().length < 4) return;
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'SCAN_SELECTION', text },
      () => void chrome.runtime.lastError,
    );
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'scan-selection') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs[0]?.id;
    if (id != null) {
      chrome.tabs.sendMessage(id, { type: 'SCAN_KEYBOARD' }, () => void chrome.runtime.lastError);
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GET_TAB_ID') {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }
  if (msg?.type === 'OPEN_SIDE_PANEL') {
    openSidePanelForSender(sender);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'THREAT_DETECTED' && sender.tab?.id != null) {
    const id = sender.tab.id;
    const next = (tabCounts.get(id) || 0) + 1;
    tabCounts.set(id, next);
    chrome.action.setBadgeText({ text: String(next), tabId: id });
    chrome.action.setBadgeBackgroundColor({
      color: badgeColorForSeverity(msg.threat?.severity),
      tabId: id,
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'CLEAR_THREATS') {
    storage.clearThreats().then(() => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  storage.clearSession(tabId);
  tabCounts.delete(tabId);
});
