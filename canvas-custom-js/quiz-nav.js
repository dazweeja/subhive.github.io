// ==UserScript==
// @name        Quiz Nav
// @namespace   https://github.com/dazweeja/subhive.github.io
// @author      Darren Smith <darren@spacedog.com.au>
// @description Script for adding active enrollments to canvas user page
// @version     0.1
// @match       https://collarts.instructure.com/*
// @match       https://collarts.test.instructure.com/*
// @run-at      document-body
// ==/UserScript==
(function () {
  'use strict';

  function quizNavInit() {
    if (window.location.pathname.match(/(courses)\/[0-9]{1,}\/(quizzes)\//gi)) {
      if (!window.location.pathname.match(/new/gi) && !window.location.pathname.match(/edit/gi)) {
        const footer = document.getElementById('module_sequence_footer');
        const config = {childList: true};

        if (footer) {
          const f1 = footer.querySelector('.module-sequence-footer');
          if (!footer.querySelector('.module-sequence-footer')) {
            addQuizNav();
          }
        }
        else {
          const footerObserver = new MutationObserver(footerCallback);
          footerObserver.observe(document.body, config);
        }
      }
    }
  }

  function footerCallback(mutations, observer) {
    const footer = document.getElementById('module_sequence_footer');
    if (footer) {
      observer.disconnect();
      if (!footer.querySelector('module-sequence-footer')) {
        addQuizNav();
      }
    }
  }

  function addQuizNav() {
    let i = window.location.pathname.match(/(quizzes)\/[0-9]{1,}/gi);
    let s = i[0].split("quizzes/");
    let pageID = s[s.length - 1];
    let pageType = "Quiz";
    createNavItem(getCourseId(), pageType, pageID);
  }

  /*
   * Common functions start
   */

  function getCourseId() {
    let courseId = null;
    try {
      const courseRegex = new RegExp('/courses/([0-9]+)');
      const matches = courseRegex.exec(window.location.href);
      if (matches) {
        courseId = matches[1];
      }
      else {
        throw new Error('Unable to detect Course ID');
      }
    }
    catch (e) {
      errorHandler(e);
    }
    return courseId;
  }

  function getIsTeacher() {
    let isTeacher = false;
    const teacherExp = /"current_user_roles":\[(?:[^\]]*)"teacher"(?:[^\]]*)\]/;
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const teacherMatches = scripts[i].text.match(teacherExp);
      if (teacherMatches != null) {
        isTeacher = true;
        break;
      }
    }

    return isTeacher;
  }

  function fetchItem(url) {
    return fetchItems(url, [], true)
  }

  function fetchItems(url, items = [], singleItem = false) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.status === 200) {
          if (singleItem) {
            resolve(JSON.parse(xhr.responseText));
          }
          else {
            items = items.concat(JSON.parse(xhr.responseText));
            const url = nextURL(xhr.getResponseHeader('Link'));

            if (url) {
              fetchItems(url, items)
                .then(resolve)
                .catch(reject);
            }
            else {
              resolve(items);
            }
          }
        }
        else {
          reject(xhr.statusText);
        }
      };
      xhr.onerror = function () {
        reject(xhr.statusText);
      };
      xhr.send();
    });
  }

  function nextURL(linkTxt) {
    let nextUrl = null;
    if (linkTxt) {
      const links = linkTxt.split(',');
      const nextRegEx = /^<(.*)>; rel="next"$/;
      for (let i = 0; i < links.length; i++) {
        const matches = links[i].match(nextRegEx);
        if (matches) {
          nextUrl = matches[1];
        }
      }
    }
    return nextUrl;
  }

  function errorHandler(e) {
    console.log(e.name + ': ' + e.message);
  }

  /*
   * Common functions end
   */

  function createNavItem(id, pageType, pageID) {
    let url = "/api/v1/courses/" + id + "/module_item_sequence?asset_type=" + pageType + "&asset_id=" + pageID + "&frame_external_urls=true";
    fetchItems(url)
      .then(navItem => {
        if (navItem.items.length > 0 && navItem.items[0].prev) {
          const prev = navItem.items[0].prev.module_id;
          for (let i = 0; i < navItem.modules.length; i++) {
            if (navItem.modules[i].id == prev) {
              navItem.items[0].prev.module_title = navItem.modules[i].name;
              break;
            }
          }
        }
        if (navItem.items.length > 0 && navItem.items[0].next) {
          const next = navItem.items[0].next.module_id;
          for (let i = 0; i < navItem.modules.length; i++) {
            if (navItem.modules[i].id == next) {
              navItem.items[0].next.module_title = navItem.modules[i].name;
              break;
            }
          }
        }
        setNavHTML(navItem);
      });
  }

  function setNavHTML(navItem) {
    let html = '<div class="module-sequence-footer-content">';

    if (navItem.items.length > 0 && navItem.items[0].prev) {
      html += '<span class="module-sequence-footer-button--previous" data-tooltip="right" ';
      html += 'data-html-tooltip-title="<i class=\'icon-document\'></i> ' + navItem.items[0].prev.title + '">';
      html += '<a href="' + navItem.items[0].prev.html_url + '" role="button" class="Button" ';
      html += 'aria-describedby="msf0-previous-desc" aria-label="Previous Module Item">';
      html += '<i class="icon-mini-arrow-left"></i>Previous ';
      html += '<span id="msf0-previous-desc" class="hidden" hidden="">Previous: ';
      html += navItem.items[0].prev.title + '</span></a></span>';
    }

    if (navItem.items.length > 0 && navItem.items[0].next) {
      html += '<span class="module-sequence-footer-button--next" data-tooltip="left" ';
      html += 'data-html-tooltip-title="<i class=\'icon-document\'></i> ' + navItem.items[0].next.title + '">';
      html += '<a href="' + navItem.items[0].next.html_url + '" role="button" class="Button" ';
      html += 'aria-describedby="msf0-next-desc" aria-label="Next Module Item">';
      html += 'Next<i class="icon-mini-arrow-right"></i> ';
      html += '<span id="msf0-next-desc" class="hidden" hidden="">Next: ';
      html += navItem.items[0].next.title + '</span></a></span>';
    }

    html += '</div>';

    addNavHTML(html);
  }

  function addNavHTML(html) {
    let e = 0;
    const i = setInterval(function () {
      const footer = document.getElementById('module_sequence_footer');
      if (footer) {
        const footerParent = footer.parentNode;
        const padder = document.createElement('div');
        padder.classList.add('module-sequence-padding');
        const sequenceFooter = document.createElement('div');
        sequenceFooter.classList.add('module-sequence-footer');
        sequenceFooter.setAttribute('aria-label', 'Module Navigation');
        sequenceFooter.setAttribute('role', 'navigation');
        sequenceFooter.innerHTML = html;
        footerParent.append(padder);
        footerParent.append(sequenceFooter);
        clearInterval(i);
      }
      else if  (50 == e) {
        clearInterval(i);
      }
      else {
        e += 1;
      }
    }, 100)
  }

  quizNavInit();
})();
