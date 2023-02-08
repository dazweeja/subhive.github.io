// ==UserScript==
// @name        Active enrollments
// @namespace   https://github.com/dazweeja/subhive.github.io
// @author      Darren Smith <darren@spacedog.com.au>
// @description Script for adding active enrollments to canvas user page
// @version     0.1
// @match       https://collarts.instructure.com/*
// @match       https://collarts.test.instructure.com/*
// @run-at      document-end
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
    for (const item of items) {
      const links = item.querySelector('a').querySelectorAll('span[class="subtitle"]');
      for (const link of links) {
        if (link.innerText.indexOf('Active') === 0) {
          const clonedItem = item.cloneNode(true);
          let matches;

          if (links.length > 0) {
            const matches = links[0].innerText.match(/(\d+)\s+T(\d)/);
            if (matches) {
              const [match, year, trimester] = matches;

              if (!(year in enrolled)) {
                enrolled[year] = {[trimester]: [clonedItem]};
              }
              else if (!(trimester in enrolled[year])) {
                enrolled[year][trimester] = [clonedItem];
              }
              else {
                enrolled[year][trimester].push(clonedItem);
              }
            }
          }

          if (!matches) {
            if ('default' in enrolled) {
              enrolled['default'].push(clonedItem);
            }
            else {
              enrolled['default'] = [clonedItem];
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
        listNode.style.fontSize = '1.08em';

        for (const defaultItem of enrolled.default) {
          listNode.append(defaultItem);
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
          listNode.style.fontSize = '1.08em';

          for (const item of items) {
            listNode.append(item);
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
