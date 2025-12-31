/**
 * SyncStream Automator - Auto-clicks movie and server
 */
(function() {
  'use strict';

  function clickMovie() {
    const postList = document.getElementById('postList');
    if (!postList) return false;
    const links = postList.querySelectorAll('a');
    if (links.length > 0) {
      window.location.href = links[0].href;
      return true;
    }
    return false;
  }

  function clickServer() {
    const watchArea = document.getElementById('watchareaa');
    if (!watchArea) return false;
    const tabsUl = watchArea.querySelector('ul.tabs-ul');
    if (!tabsUl) return false;
    const tabs = tabsUl.querySelectorAll('li');
    if (tabs.length >= 2) {
      tabs[1].click();
      return true;
    }
    return false;
  }

  const url = window.location.href;
  
  if (url.includes('?s=')) {
    let attempts = 0;
    const check = setInterval(() => {
      if (clickMovie() || attempts++ > 30) clearInterval(check);
    }, 300);
  } else if (url.includes('/movie/') || url.includes('/series/')) {
    setTimeout(() => {
      let attempts = 0;
      const check = setInterval(() => {
        if (clickServer() || attempts++ > 30) clearInterval(check);
      }, 300);
    }, 2000);
  }
})();
