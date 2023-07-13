// ==UserScript==
// @name        Student Assignment Export Tool
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

  const baseUrl = window.location.protocol + '//' + window.location.host;
  const selector = '#main .roster';

  function init() {
    if (!window.location.pathname.match(/\/courses\/\d+\/users\/?$/)) return;
    if (!getIsTeacher()) return;

    /*const script = document.createElement('script');
    script.src = 'https://unpkg.com/client-zip@1.6.2/index.js';
    script.type = 'text/javascript';
    script.defer = true;

    document.getElementsByTagName('head').item(0).appendChild(script);*/

    /*navigator.serviceWorker.register('./worker.js');

    const downloadName = 'test.zip';
    const fileDownloads = [
      'https://collarts.instructure.com/files/719210/download?download_frd=1&verifier=Cgih3QKobSW3C8jrM3MRdtvzqqi2W1weUq6mbM3w',
      'https://collarts.instructure.com/files/719214/download?download_frd=1&verifier=nqRhGmK617rnNh0sFfwItlodt0I6ue1rcP2QWXSQ',
     ];

    const form = document.createElement('form')
    form.method = 'post'
    form.action = `downloadZip/test.zip`
    const button = document.createElement('button')
    button.type = 'submit'
    for (let file of fileDownloads) {
      const input = document.createElement('input')
      input.value = JSON.stringify({
        url: file.url,
        productName: file.productName,
      })
      input.name = 'url'
      input.type = 'hidden'

      form.appendChild(input)
    }

    form.appendChild(button)
    document.body.appendChild(form)
    form.submit()
    form.remove()
    return;*/

    let x = 0;
    let interval = setInterval(function () {
      const table = document.querySelector(selector);
      if (table || ++x === 10) {
        clearInterval(interval);
        addTableCells(table);
      }
    }, 500);
  }

  function tableCallback() {
    const table = document.querySelector(selector);
    if (table) {
      addTableCells(table);
    }
  }

  function addTableCells(table) {
    console.log('add');

    const courseId = getCourseId();

    const subUrl = new URL(baseUrl + '/api/v1/courses/' + courseId + '/students/submissions');
    subUrl.searchParams.append('per_page', 999);
    subUrl.searchParams.append('student_ids[]', 'all');
    subUrl.searchParams.append('grouped', 'true');

    const users = {};

    getSubmissions(subUrl)
      .then(submissions => {
        console.log(submissions);

        parseSubmissions(submissions, users);

        console.log(users);

        const rows = table.getElementsByClassName('rosterUser');
        rows.forEach(row => {
          console.log(row.id);
        });


        /*let content = '';
        groups.forEach(function (group) {
          content += `<h2>${group.name}</h2>`;
          content += createTable(group, grades);
        });*/
      })
      .catch(e => errorHandler(e));

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

  async function makeZip(filenames) {
    async function *readFiles() {
      for (const filename of filenames) {
        yield await fetch(filename);
      }
    }
    // get the ZIP stream in a Blob
    const blob = await downloadZip(readFiles()).blob()

    // make and click a temporary link to download the Blob
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "test.zip"
    link.click()
    link.remove()
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

  function getSubmissions(url) {
    return getSubmissionsPage(url)
      .then(page => {
        if (page.url) {
          return getSubmissions(page.url)
            .then(nextPage => page.data.concat(nextPage));
        }
        else {
          return page.data;
        }
      })
      .catch(e => errorHandler(e));
  }

  function getSubmissionsPage(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = () => {
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
      xhr.onerror = () => {
        reject(xhr.statusText);
      };
      xhr.send();
    });
  }

  function parseSubmissions(submissions, users) {
    submissions.forEach(user => {
      if ('user_id' in user && Number.isInteger(user.user_id)) {
        const assignments = {};

        if ('submissions' in user && Array.isArray(user.submissions) && user.submissions.length > 0) {
          user.submissions.forEach(submission => {
            if ('attachments' in submission && Array.isArray(submission.attachments) && submission.attachments.length > 0) {
              if ('assignment_id' in submission && Number.isInteger(submission.assignment_id)) {
                if (!(submission.assignment_id in assignments)) {
                  assignments[submission.assignment_id] = [];
                }

                submission.attachments.forEach(attachment => {
                  if ('url' in attachment) {
                    assignments[submission.assignment_id].push(attachment.url);
                  }
                })
              }
            }
          });
        }

        users[user.user_id] = assignments;
      }
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
