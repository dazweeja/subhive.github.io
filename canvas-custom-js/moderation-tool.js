// ==UserScript==
// @name        Moderation tool
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

  const baseUrl = window.location.protocol + '//' + window.location.host;
  const selector = '#gradebook_grid .slick-header-columns > .total_grade .Gradebook__ColumnHeaderDetail';

  function moderationToolInit() {
    if (!window.location.pathname.match(/\/courses\/\d+\/gradebook/)) return;

    const totalHeader = document.querySelector(selector);
    const config = {childList: true};

    if (totalHeader) {
      addModerationTotals(totalHeader);
    }
    else {
      const headerObserver = new MutationObserver(headerCallback);
      headerObserver.observe(document.body, config);
    }
  }

  function headerCallback(mutations, observer) {
    const totalHeader = document.querySelector(selector);
    if (totalHeader) {
      observer.disconnect();
      addModerationTotals(totalHeader);
    }
  }

  function addModerationTotals(totalHeader) {
    if (!getIsTeacher()) return;

    const courseId = getCourseId();
    const url = baseUrl + '/api/v1/courses/' + courseId + '/users?per_page=999&&enrollment_type[]=student&include[]=enrollments';

    const element = document.createElement('style');
    document.head.appendChild(element);
    let sheet = element.sheet;
    const styles = '.Gradebook__ColumnHeaderDetail i::before { font-size: 0.75rem; }';
    sheet.insertRule(styles, 0);

    const wrapper = document.createElement('div');
    wrapper.style.border = '1px solid #bbb';
    wrapper.style.zIndex = '999';
    wrapper.style.padding = '0 0 8px';
    wrapper.style.backgroundColor = '#fff';
    wrapper.style.position = 'absolute';
    wrapper.fontSize = '1rem';
    wrapper.style.top = '-169px';

    const table = document.createElement('table');
    table.style.width = '256px';
    table.style.border = '0';
    table.style.fontSize = '0.875rem';

    wrapper.append(table);

    let isConnected = false;
    let noEnrollmentsBody;

    const statsHandler = function(event) {
      if (!isConnected) {
        const header = document.querySelector(selector);
        const headerColumn = header.closest('div.slick-header-column')
        const headerRect = headerColumn.getBoundingClientRect();
        const gridWrapper = header.closest('#gradebook-grid-wrapper');
        const gridWrapperRect = gridWrapper.getBoundingClientRect();
        gridWrapper.style.position = 'relative';
        wrapper.style.left = headerRect.right - gridWrapperRect.left - 258 + 'px';
        gridWrapper.append(wrapper);
        isConnected = true;
      }

      if (table.firstChild) {
        table.removeChild(table.firstChild);
      }

      table.append(loadingBody);

      fetchItems(url)
        .then(function (users) {
          let tableBody;

          let total = 0, fails = 0, passes = 0, noScores = 0;

          users.forEach(function (user) {
            if (user.name.match(/Test\s*Student/i)) return;

            if (user.enrollments && user.enrollments.length > 0) {
              let hasActiveEnrollment = false;

              user.enrollments.forEach(function (enrollment) {
                if (hasActiveEnrollment || enrollment.enrollment_state !== 'active' || enrollment.type !== 'StudentEnrollment') return;

                total++;

                if (!enrollment.hasOwnProperty('grades') || !enrollment.grades.hasOwnProperty('current_score') || typeof enrollment.grades.current_score !== 'number') {
                  noScores++
                }
                else if (enrollment.grades.current_score < 49.5) {
                  fails++;
                }
                else {
                  passes++;
                }

                hasActiveEnrollment = true;
              });
            }
          });

          if (total > 0) {
            tableBody = tableBodyFactory(totalsCloseIcon, totalsRefreshIcon, total, fails, passes, noScores);
          }
          else {
            if (!noEnrollmentsBody) noEnrollmentsBody = tableBodyFactory(noEnrollmentsCloseIcon, noEnrollmentsRefreshIcon, 'No active enrollments');
            tableBody = noEnrollmentsBody;
          }

          table.removeChild(loadingBody);
          table.append(tableBody);
        })
        .catch(e => errorHandler(e))
    }

    const closeHandler = function(event) {
      wrapper.remove();
      isConnected = false;
    };

    const statsIcon = iconFactory('icon-stats');
    statsIcon.style.marginLeft = '0.25rem';
    statsIcon.addEventListener('click', statsHandler);

    const closeIcon = iconFactory('icon-end', closeHandler);

    const totalsCloseIcon = iconFactory('icon-end', closeHandler);
    const totalsRefreshIcon = iconFactory('icon-refresh', statsHandler, '0.25rem');

    const noEnrollmentsCloseIcon = iconFactory('icon-end', closeHandler);
    const noEnrollmentsRefreshIcon = iconFactory('icon-refresh', statsHandler, '0.25rem');

    const loadingBody = tableBodyFactory(closeIcon, null, 'Loading...');

    setTimeout(function() {
      const header = document.querySelector(selector);
      header.appendChild(statsIcon);
    }, 1500);
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

  function iconFactory(className, handler, marginRight) {
    const icon = document.createElement('i');
    icon.classList.add('icon-Solid', className);
    icon.setAttribute('aria-hidden',  'true');
    icon.style.cursor = 'pointer';
    icon.addEventListener('click', handler);
    if (marginRight) icon.style.marginRight = marginRight;
    return icon;
  }

  function tableBodyFactory(closeIcon, refreshIcon, totalOrText, fails, passes, noScores) {
    const tableBody = document.createElement('tbody');

    const iconRow = document.createElement('tr');
    const iconCell = document.createElement('td');
    iconCell.style.padding = '0 0.7rem 0 0';
    iconCell.style.lineHeight = '32px';
    iconCell.style.textAlign = 'right';
    if (refreshIcon) iconCell.append(refreshIcon);
    iconCell.append(closeIcon);
    iconRow.append(iconCell);
    tableBody.append(iconRow);

    if (typeof totalOrText === 'number') {
      iconCell.colSpan = 2;
      const firstRow = document.createElement('tr');
      const firstLabelCell = document.createElement('td');
      firstLabelCell.style.padding = ' 0 0 0 0.5rem';
      firstLabelCell.style.lineHeight = '32px';
      firstLabelCell.style.width = '85%';
      firstLabelCell.innerText = 'Total students:';
      const firstValueCell = document.createElement('td');
      firstValueCell.style.padding = ' 0';
      firstValueCell.style.lineHeight = '32px';
      firstValueCell.style.width = '15%';
      firstValueCell.style.textAlign = 'center';
      firstValueCell.innerText = totalOrText;
      firstRow.append(firstLabelCell, firstValueCell);
      const secondRow = document.createElement('tr');
      const secondLabelCell = document.createElement('td');
      secondLabelCell.style.padding = ' 0 0 0 0.5rem';
      secondLabelCell.style.lineHeight = '32px';
      secondLabelCell.style.width = '85%';
      secondLabelCell.innerText = 'Projected fails:';
      const secondValueCell = document.createElement('td');
      secondValueCell.style.padding = ' 0';
      secondValueCell.style.lineHeight = '32px';
      secondValueCell.style.width = '15%';
      secondValueCell.style.textAlign = 'center';
      secondValueCell.innerText = fails;
      secondRow.append(secondLabelCell, secondValueCell);
      const thirdRow = document.createElement('tr');
      const thirdLabelCell = document.createElement('td');
      thirdLabelCell.style.padding = ' 0 0 0 0.5rem';
      thirdLabelCell.style.lineHeight = '32px';
      thirdLabelCell.style.width = '85%';
      thirdLabelCell.innerText = 'Projected passes (49.5% +):';
      const thirdValueCell = document.createElement('td');
      thirdValueCell.style.padding = ' 0';
      thirdValueCell.style.lineHeight = '32px';
      thirdValueCell.style.width = '15%';
      thirdValueCell.style.textAlign = 'center';
      thirdValueCell.innerText = passes;
      thirdRow.append(thirdLabelCell, thirdValueCell);
      const fourthRow = document.createElement('tr');
      const fourthLabelCell = document.createElement('td');
      fourthLabelCell.style.padding = ' 0 0 0 0.5rem';
      fourthLabelCell.style.lineHeight = '32px';
      fourthLabelCell.style.width = '85%';
      fourthLabelCell.innerText = 'No grades:';
      const fourthValueCell = document.createElement('td');
      fourthValueCell.style.padding = ' 0';
      fourthValueCell.style.lineHeight = '32px';
      fourthValueCell.style.width = '15%';
      fourthValueCell.style.textAlign = 'center';
      fourthValueCell.innerText = noScores;
      fourthRow.append(fourthLabelCell, fourthValueCell);
      tableBody.append(firstRow, secondRow, thirdRow, fourthRow);
    }
    else {
      const firstRow = document.createElement('tr');
      const firstCell = document.createElement('td');
      firstCell.style.padding = ' 0 0 0 0.5rem';
      firstCell.style.lineHeight = '32px';
      firstCell.innerHTML = '&nbsp;';
      firstRow.append(firstCell);
      const secondRow = document.createElement('tr');
      const secondCell = document.createElement('td');
      secondCell.style.padding = ' 0 0 0 0.5rem';
      secondCell.style.lineHeight = '32px';
      secondCell.style.textAlign = 'center';
      secondCell.innerText = totalOrText;
      secondRow.append(secondCell);
      const thirdRow = document.createElement('tr');
      const thirdCell = document.createElement('td');
      thirdCell.style.padding = ' 0 0 0 0.5rem';
      thirdCell.style.lineHeight = '32px';
      thirdCell.innerHTML = '&nbsp;';
      thirdRow.append(thirdCell);
      const fourthRow = document.createElement('tr');
      const fourthCell = document.createElement('td');
      fourthCell.style.padding = ' 0 0 0 0.5rem';
      fourthCell.style.lineHeight = '32px';
      fourthCell.innerHTML = '&nbsp;';
      fourthRow.append(fourthCell);
      tableBody.append(firstRow, secondRow, thirdRow, fourthRow);
    }

    return tableBody;
  }

  moderationToolInit();
})();
