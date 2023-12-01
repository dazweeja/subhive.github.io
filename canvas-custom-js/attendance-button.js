// ==UserScript==
// @name        Attendance button
// @namespace   https://github.com/dazweeja/subhive.github.io
// @author      Darren Smith <darren@spacedog.com.au>
// @description Script for adding an attendance button to Canvas
// @version     0.1
// @match       https://collarts.instructure.com/*
// @match       https://collarts.test.instructure.com/*
// @run-at      document-body
// ==/UserScript==
(function () {
  'use strict';

  function attendanceInit() {
    if (window.location.pathname.match(/(courses)\/[0-9]{1,}/gi)) {
      if (!window.location.pathname.match(/new/gi) && !window.location.pathname.match(/edit/gi)) {
        const studentButton = document.getElementById('easy_student_view');
        const config = {childList: true};

        if (studentButton) {
          addAttendanceButton(studentButton);
        }
        else {
          const buttonObserver = new MutationObserver(buttonCallback);
          buttonObserver.observe(document.body, config);
        }
      }
    }
  }

  function buttonCallback(mutations, observer) {
    const studentButton = document.getElementById('easy_student_view');
    if (studentButton) {
      observer.disconnect();
      addAttendanceButton(studentButton);
    }
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

  function addAttendanceButton(button) {
    if (!getIsTeacher()) return;

    const courseId = getCourseId();
    const url = "/api/v1/courses/" + courseId;
    fetchItem(url)
      .then(course => {
        // the current state of the course one of 'unpublished', 'available',
        // 'completed', or 'deleted'
        if (course && course.hasOwnProperty('workflow_state') && course.workflow_state === 'available'
        && course.hasOwnProperty('enrollment_term_id') && course.enrollment_term_id !== 1) {
          const newButton  = createButton('Attendance', 'attendance_button', 'https://collarts.force.com/portal/s/attendance');
          button.parentNode.insertBefore(newButton, button.nextSibling);
        }
      });
  }

  function createButton(title, id, href) {
    const button = document.createElement('a');
    button.classList.add('btn');
    button.id = id;
    button.href = href;
    button.setAttribute('rel', 'nofollow');
    button.setAttribute('target', '_blank');
    button.innerHTML = '<i class="icon-user"></i> ' + title;

    return button;
  }

  attendanceInit();
})();
