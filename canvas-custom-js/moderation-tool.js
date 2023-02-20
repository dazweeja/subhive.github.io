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

    const totalHeading = document.querySelector(selector);
    const config = {childList: true};

    if (totalHeading) {
      addModerationTotals(totalHeading);
    }
    else {
      const headingObserver = new MutationObserver(headingCallback);
      headingObserver.observe(document.body, config);
    }
  }

  function headingCallback(mutations, observer) {
    const totalHeading = document.querySelector(selector);
    if (totalHeading) {
      observer.disconnect();
      addModerationTotals(totalHeading);
    }
  }

  function addModerationTotals(totalHeading) {
    if (!getIsTeacher()) return;

    const courseId = getCourseId();
    const url = baseUrl + '/api/v1/courses/' + courseId + '/users?per_page=999&&enrollment_type[]=student&include[]=enrollments';

    const element = document.createElement('style');
    document.head.appendChild(element);
    let sheet = element.sheet;
    const styles = '.Gradebook__ColumnHeaderDetail i::before { font-size: 0.75rem; }';
    sheet.insertRule(styles, 0);

    const icon = document.createElement('i');
    icon.classList.add('icon-Solid', 'icon-updown');
    icon.setAttribute('aria-hidden',  'true');
    icon.style.cursor = 'pointer';
    icon.style.marginLeft = '0.25rem';

    const wrapper = document.createElement('div');
    wrapper.style.border = '1px solid #bbb';
    wrapper.style.zIndex = '999';
    wrapper.style.padding = '0 0 0.5rem';
    wrapper.style.backgroundColor = '#fff';
    wrapper.style.position = 'absolute';
    wrapper.fontSize = '1rem';

    const bodyRect = document.body.getBoundingClientRect();
    const headingRect = totalHeading.closest('div.slick-header-column').getBoundingClientRect();
    wrapper.style.right = (bodyRect.right - headingRect.right) + 'px';
    wrapper.style.top = (headingRect.bottom - bodyRect.top - 1) + 'px';

    const table = document.createElement('table');
    table.style.width = '16rem';
    table.style.border = '0';
    table.style.fontSize = '0.875rem';

    const tableBody = document.createElement('tbody');
    const loadingBody = createLoadingTableBody();

    icon.addEventListener('click', function(event) {
      if (!document.body.append(wrapper)) {
        table.append(tableBody);
        wrapper.append(table);
        document.body.append(wrapper);
      }

      tableBody.innerHTML = loadingBody;

        getUsers(url)
        .then(function (users) {
          let content;

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

                tableBody.innerHTML = createResultsTableBody(total, fails, passes);
              });
            }
          });

          if (!content) content = createEmptyTableBody();
          tableBody.innerHTML = content;
        })
        .catch(e => errorHandler(e))
    });

    setTimeout(function() {
      const heading = document.querySelector(selector);
      heading.appendChild(icon);
    }, 1000);
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

  function createResultsTableBody(total, fails, passes) {
    let content = `<tr><td colspan="2" style="text-align: right"><i class="icon-Solid icon-refresh" aria-hidden="true"></i>&nbsp;<i class="icon-Solid icon-end" aria-hidden="true"></i></td></tr>`;
    content += `<tr><td style="width: 85%; padding: 0.5rem 0 0 0.5rem;">Total students:</td><td style="width: 15%; text-align: center; padding: 0;">${total}</td></tr>`;
    content += `<tr><td style="width: 85%; padding: 0.5rem 0 0 0.5rem;">Projected fails:</td><td style="width: 15%; text-align: center; padding: 0;">${fails}</td></tr>`;
    content += `<tr><td style="width: 85%; padding: 0.5rem 0 0 0.5rem;">Projected passes (49.5% +):</td><td style="width: 15%; text-align: center; padding: 0;">${passes}</td></tr>`;

    return content;
  }

  function createLoadingTableBody() {
    let content = `<tr><td style="padding: 0.5rem 0 0 0.5rem;">&nbsp;</td></tr>`;
    content += `<tr><td style="padding: 0.5rem 0 0 0.5rem;  text-align: center;">Loading...</td></tr>`;
    content += `<tr><td style="padding: 0.5rem 0 0 0.5rem;">&nbsp;</td></tr>`;
    return content;
  }

  function createEmptyTableBody() {
    let content = `<tr><td style="padding: 0.5rem 0 0 0.5rem;">&nbsp;</td></tr>`;
    content += `<tr><td style="padding: 0.5rem 0 0 0.5rem;  text-align: center;">No students with results</td></tr>`;
    content += `<tr><td style="padding: 0.5rem 0 0 0.5rem;">&nbsp;</td></tr>`;
    return content;
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
