// ==UserScript==
// @name        Active enrollments
// @namespace   https://github.com/dazweeja/subhive.github.io
// @author      Darren Smith <darren@spacedog.com.au>
// @description Description
// @version 0.1
// @match      https://collarts.instructure.com/*
// @run-at     document-end
// ==/UserScript==
(function () {
  'use strict';

  const selector = '#main #user-info-fieldsets #courses #courses_list';

  function init() {
    if (!window.location.pathname.match(/\/users\/\d+/)) return;

    const coursesList = document.querySelector(selector);
    const config = {childList: true};

    if (coursesList) {
      addEnrollments(coursesList);
    }
    else {
      const coursesListObserver = new MutationObserver(coursesListCallback);
      coursesListObserver.observe(document.body, config);
    }
  }

  function coursesListCallback(mutations, observer) {
    const coursesList = document.querySelector(selector);
    if (coursesList) {
      observer.disconnect();
      addEnrollments(coursesList);
    }
  }

  function addEnrollments(coursesList) {
    const enrolled = {};

    const items = coursesList.querySelectorAll('li');
    for (let i = 0; i < items.length; i++) {
      const links = items[i].querySelector('a').querySelectorAll('span[class="subtitle"]');
      for (let j = 0; j < links.length; j++) {
        if (links[j].innerText.indexOf('Active') === 0) {
          let item;
          if (j > 0) {
            const matches = links[j - 1].innerText.match(/(\d+)\s+T(\d)/);
            if (matches) {
              item = items[i];
              const [match, year, trimester] = matches;

              if (!(year in enrolled)) {
                enrolled[year] = {[trimester]: [item]};
              }
              else if (!(trimester in enrolled[year])) {
                enrolled[year][trimester] = [item];
              }
              else {
                enrolled[year][trimester].push(item);
              }
            }
          }

          if (!item) {
            if ('default' in enrolled) {
              enrolled['default'].push(items[i]);
            }
            else {
              enrolled['default'] = [items[i]];
            }
          }
        }
      }
    }

    if (Object.keys(enrolled).length > 0) {
      const contentNode = document.createElement('div');
      contentNode.setAttribute('id', 'enrolled_courses_list')

      let defaultContentNode;
      if ('default' in enrolled) {
        defaultContentNode = document.createElement('div');

        const headingNode = document.createElement('h3');
        headingNode.innerText = 'Other';
        defaultContentNode.append(headingNode);

        const listNode = document.createElement('ul');
        listNode.classList.add('unstyled_list', 'context_list');

        for (let i = 0; i < enrolled.default.length; i++) {
          listNode.append(enrolled.default[i]);
        }

        defaultContentNode.append(listNode);

        delete enrolled.default;
      }

      Object.keys(enrolled).sort().forEach(function (year) {
        const trimesters = enrolled[year];
        Object.keys(trimesters).sort().forEach(function (trimester) {
          const trimesterContentNode = document.createElement('div');
          const items = trimesters[trimester];

          const headingNode = document.createElement('h3');
          headingNode.innerText = year + ' T' + trimester;
          trimesterContentNode.append(headingNode);

          const listNode = document.createElement('ul');
          listNode.classList.add('unstyled_list', 'context_list');

          for (let i = 0; i < items.length; i++) {
            listNode.append(items[i]);
          }

          trimesterContentNode.append(listNode);
          contentNode.append(trimesterContentNode);
        });
      });

      if (defaultContentNode) contentNode.append(defaultContentNode);

      coursesList.before(contentNode);
    }
  }

  init();
})();
