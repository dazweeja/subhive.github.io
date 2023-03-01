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

  function init() {
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
    wrapper.style.top = '-137px';

    const table = document.createElement('table');
    table.style.width = '256px';
    table.style.border = '0';
    table.style.fontSize = '0.875rem';

    wrapper.append(table);

    let isConnected = false;
    let noResultsBody;

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

      getUsers(url)
        .then(function (users) {
          let tableBody;

          users.forEach(function (user) {
            if (user.name.match(/Test\s*Student/i)) return;

            if (user.enrollments && user.enrollments.length > 0) {
              let total = 0, fails = 0, passes = 0;
              user.enrollments.forEach(function (enrollment) {
                if (enrollment.enrollment_state !== 'active' || enrollment.type !== 'StudentEnrollment') return;

                total++;

                if (enrollment.current_score === null) {
                  // ignore
                }
                else if (enrollment.current_score < 49.5) {
                  fails++;
                }
                else {
                  passes++;
                }

                tableBody = tableBodyFactory(totalsCloseIcon, totalsRefreshIcon, total, fails, passes);
              });
            }
          });

          if (!tableBody) {
            if (!noResultsBody) noResultsBody = tableBodyFactory(noResultsCloseIcon, noResultsRefreshIcon, 'No students with results');

            tableBody = noResultsBody;
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
    const refreshIcon = iconFactory('icon-refresh', statsHandler, '0.25rem');

    const totalsCloseIcon = iconFactory('icon-end', closeHandler);
    const totalsRefreshIcon = iconFactory('icon-refresh', statsHandler, '0.25rem');

    const noResultsCloseIcon = iconFactory('icon-end', closeHandler);
    const noResultsRefreshIcon = iconFactory('icon-refresh', statsHandler, '0.25rem');

    const loadingBody = tableBodyFactory(closeIcon, null, 'Loading...');

    setTimeout(function() {
      const header = document.querySelector(selector);
      header.appendChild(statsIcon);
    }, 1000);
  }

  function iconFactory(className, handler, marginRight) {
    const icon = document.createElement('i');
    icon.classList.add('icon-Solid', className);
    icon.setAttribute('aria-hidden',  'true');
    icon.style.cursor = 'pointer';
    icon.addEventListener('click', handler);
    if (marginRight) icon.style.marginRight = marginRight;
    return icon;
  }

  function tableBodyFactory(closeIcon, refreshIcon, totalOrText, fails, passes) {
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
      const topRow = document.createElement('tr');
      const topLabelCell = document.createElement('td');
      topLabelCell.style.padding = ' 0 0 0 0.5rem';
      topLabelCell.style.lineHeight = '32px';
      topLabelCell.style.width = '85%';
      topLabelCell.innerText = 'Total students:';
      const topValueCell = document.createElement('td');
      topValueCell.style.padding = ' 0';
      topValueCell.style.lineHeight = '32px';
      topValueCell.style.width = '15%';
      topValueCell.style.textAlign = 'center';
      topValueCell.innerText = totalOrText;
      topRow.append(topLabelCell, topValueCell);
      const middleRow = document.createElement('tr');
      const middleLabelCell = document.createElement('td');
      middleLabelCell.style.padding = ' 0 0 0 0.5rem';
      middleLabelCell.style.lineHeight = '32px';
      middleLabelCell.style.width = '85%';
      middleLabelCell.innerText = 'Projected fails:';
      const middleValueCell = document.createElement('td');
      middleValueCell.style.padding = ' 0';
      middleValueCell.style.lineHeight = '32px';
      middleValueCell.style.width = '15%';
      middleValueCell.style.textAlign = 'center';
      middleValueCell.innerText = fails;
      middleRow.append(middleLabelCell, middleValueCell);
      const bottomRow = document.createElement('tr');
      const bottomLabelCell = document.createElement('td');
      bottomLabelCell.style.padding = ' 0 0 0 0.5rem';
      bottomLabelCell.style.lineHeight = '32px';
      bottomLabelCell.style.width = '85%';
      bottomLabelCell.innerText = 'Projected passes (49.5% +):';
      const bottomValueCell = document.createElement('td');
      bottomValueCell.style.padding = ' 0';
      bottomValueCell.style.lineHeight = '32px';
      bottomValueCell.style.width = '15%';
      bottomValueCell.style.textAlign = 'center';
      bottomValueCell.innerText = passes;
      bottomRow.append(bottomLabelCell, bottomValueCell);
      tableBody.append(topRow, middleRow,bottomRow);
    }
    else {
      const topRow = document.createElement('tr');
      const topCell = document.createElement('td');
      topCell.style.padding = ' 0 0 0 0.5rem';
      topCell.style.lineHeight = '32px';
      topCell.innerHTML = '&nbsp;';
      topRow.append(topCell);
      const middleRow = document.createElement('tr');
      const middleCell = document.createElement('td');
      middleCell.style.padding = ' 0 0 0 0.5rem';
      middleCell.style.lineHeight = '32px';
      middleCell.style.textAlign = 'center';
      middleCell.innerText = totalOrText;
      middleRow.append(middleCell);
      const bottomRow = document.createElement('tr');
      const bottomCell = document.createElement('td');
      bottomCell.style.padding = ' 0 0 0 0.5rem';
      bottomCell.style.lineHeight = '32px';
      bottomCell.innerHTML = '&nbsp;';
      bottomRow.append(bottomCell);
      tableBody.append(topRow, middleRow,bottomRow);
    }

    return tableBody;
  }

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

  function getUsers(url) {
    return getUsersPage(url)
      .then(function (page) {
        if (page.url) {
          return getUsersPage(page.url)
            .then(function (nextPage) {
              return page.data.concat(nextPage);
            });
        }
        else {
          return page.data;
        }
      })
      .catch(e => errorHandler(e));
  }

  function getUsersPage(url) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve({
              data: JSON.parse(xhr.responseText),
              url: nextURL(xhr.getResponseHeader('Link'))
            })
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

  init();
})();
