// ==UserScript==
// @name        Embedded Tool Finder for Canvas
// @namespace   https://github.com/dazweeja/subhive.github.io
// @author      Darren Smith <darren@spacedog.com.au>
// @icon        https://spacedog.com.au/apple-icon.png
// @description Script for adding an Embed Finder button to Canvas
// @version     0.1
// @match       https://collarts.instructure.com/accounts/*
// @match       https://collarts.test.instructure.com/accounts/*
// @run-at      document-body
// ==/UserScript==
(function () {
  'use strict';

  const baseUrl = window.location.protocol + '//' + window.location.host;

  /*
   * We try to keep all code relating to each feature in a separate section and then add a single function call
   * for each feature to this init function
   */
  function init() {
    // Begin moderation tool feature
    embedFinderInit();
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

  /*
   * EmbedFinder Button start
   */

  const targetClass = ".right-of-crumbs";

  const embedFinderSelectId = 'embed-finder-select';

  const regexes = {
    atomic_journal: {
      name: "Atomic Journal",
      regex: /<iframe [^>]*src=["|'][^"|']+resource_link_lookup_uuid=[^"|']+["|'][^>]*>/g
    },
    echo_public_embed: {
      name: "EchoVideo (Public Embed)",
      regex: /<iframe [^>]*src=["|']https:\/\/echo360\.net\.au\/[^"|']+["|'][^>]*>/g
    },
    echo_Lti_embed: {
      name: "EchoVideo (LTI Embed)",
      regex: /<iframe [^>]*src=["|'][^"|']+https%3A%2F%2Fecho360\.net\.au%2F[^"|']+["|'][^>]*>/g
    },
    flip: {name: "Flip", regex: /<iframe [^>]*src=["|']https:\/\/flipgrid\.com\/[^"|']+["|'][^>]*>/g},
    h5p_public_embed: {
      name: "H5P (Public Embed)",
      regex: /<iframe [^>]*src=["|']https:\/\/collarts\.h5p\.com\/[^"|']+["|'][^>]*>/g
    },
    h5p_lti_embed: {
      name: "H5P (LTI Embed)",
      regex: /<iframe [^>]*src=["|'][^"|']+https%3A%2F%2Fcollarts\.h5p\.com%2F[^"|']+["|'][^>]*>/g
    },
    learning_journal: {
      name: "Learning Journal",
      regex: /<iframe [^>]*src=["|'][^"|']+https%3A%2F%2Fthelearningjournal\.co%2F[^"|']+["|'][^>]*>/g
    },
    miro: {name: "Miro", regex: /<iframe [^>]*src=["|']https:\/\/miro\.com\/[^"|']+["|'][^>]*>/g},
    padlet: {name: "Padlet", regex: /<iframe [^>]*src=["|']https:\/\/collarts\.padlet\.org\/[^"|']+["|'][^>]*>/g},
    wakelet: {name: "Wakelet", regex: /<iframe [^>]*src=["|']https:\/\/embed\.wakelet\.com\/[^"|']+["|'][^>]*>/g},
    zoom: {name: "Zoom", regex: /https:\/\/collarts\.zoom\.us\/rec\/share\//g}
  };

  function embedFinderInit() {
    if (!window.location.pathname.match(/^\/accounts\//)) return;

    const crumbsDiv = document.querySelector(targetClass);
    const config = {childList: true};

    if (crumbsDiv) {
      addEmbedFinderButton(crumbsDiv);
    }
    else {
      const crumbsObserver = new MutationObserver(buttonCallback);
      crumbsObserver.observe(document.body, config);
    }
  }

  function buttonCallback(mutations, observer) {
    const crumbsDiv = document.querySelector(targetClass);
    if (crumbsDiv) {
      observer.disconnect();
      addEmbedFinderButton(crumbsDiv);
    }
  }

  function addEmbedFinderButton(div) {
    if (!getIsTeacher()) return;

    let isConnected = false;

    const overlayBackground = overlayBackgroundFactory();
    const progress = progressFactory(5);
    const progressDialog = dialogFactory(progress);
    let overlay = null;

    const embedButtonClickHandler = function (event) {
      let finishedDialog = null;
      let startDialog = null;

      if (!isConnected) {
        const body = document.querySelector('body');
        body.append(overlayBackground);
        isConnected = true;
      }

      const closeHandler = function (event) {
        overlayBackground.remove();
        isConnected = false;
      };

      const closeButton = document.createElement('button');
      closeButton.classList.add('ui-dialog-titlebar-close', 'ui-corner-all');
      const closeText = document.createElement('span');
      closeText.classList.add('ui-icon', 'ui-icon-closethick');
      closeText.innerText = 'Close';
      closeButton.append(closeText);
      closeButton.style.cursor = 'pointer';
      closeButton.addEventListener('click', function (event) {
        overlayBackground.remove();
        isConnected = false;
      });

      const input = document.createElement("textarea");
      input.style.width = '100%';
      input.style.height = '106px';
      input.style.boxSizing = 'border-box';
      const inputError = document.createElement("p");
      inputError.style.display = "none";
      inputError.style.color = "red";
      input.addEventListener('input', function (event) {
        if (inputError.style.display === "block") {
          inputError.style.display = "none";
        }
      });

      const select = document.createElement("select");
      select.id = embedFinderSelectId;
      select.style.width = '100%';
      const option = document.createElement("option");
      option.value = "";
      option.text = " -- Select type -- ";
      select.append(option);
      for (const [key, value] of Object.entries(regexes)) {
        const option = document.createElement("option");
        option.value = key;
        option.text = value.name;
        select.append(option);
      }

      select.addEventListener('change', function (event) {
        if (selectError.style.display === "block") {
          selectError.style.display = "none";
        }
      });

      const selectError = document.createElement("p");
      selectError.style.display = "none";
      selectError.style.color = "red";

      const findButton = createButton('Find Embeds', 'finder_button', async function (event) {
        if (!select.value) {
          selectError.innerText = "Please select a type";
          selectError.style.display = "block";
          console.log('No select');
          return;
        }

        const regex = regexes[select.value].regex;
        const rows = [];
        const validCourses = [];
        let hasCourseError = false;

        if (input.value) {
          const numericRegex = new RegExp('^\\d+$');
          const courses = input.value.split(',').map(v => v.trim());
          courses.forEach(course => {
            if (numericRegex.exec(course)) {
              validCourses.push(course);
            }
            else {
              hasCourseError = true;
            }
          });
        }

        if (hasCourseError || validCourses.length === 0) {
          inputError.innerText = "Course IDs must be numeric and not empty.";
          inputError.style.display = "block";
          console.log('Course IDs must be numeric and not empty.');
          return;
        }

        startDialog.replaceWith(progressDialog);

        const coursePromises = validCourses.map(c => findCourse(c, regex).catch(e => e));
        Promise.all(coursePromises).then(values => {
          const courseNames = {};
          const pagePromises = [];

          values.forEach(courseResult => {
            if (courseResult.courseName) {
              courseNames[courseResult.courseId] = courseResult.courseName;
              pagePromises.push(findMatches(courseResult.courseId, regex));
            }
          });

          const failedCourseNames = validCourses.filter(c => !(c in courseNames));

          if (pagePromises.length === 0) {
            progressDialog.replaceWith(startDialog)
            inputError.innerText = "Could not load course data. Please check that Course IDs are valid.";
            inputError.style.display = "block";
            console.log('Could not load course data. Please check that Course IDs are valid.');
            return;
          }

          Promise.all(pagePromises).then((values) => {
            rows.push("course id, course name, page id, page URL, matches");
            values.forEach(matches => {
              if (!Array.isArray(matches)) {
                const courseId = parseInt(matches);
                rows.push(`${courseId}, ${courseNames[courseId]}, Invalid course,`);
              }
              else {
                matches.forEach(match => rows.push(`${match.courseId},${courseNames[match.courseId]},${match.pageId},${match.url},${match.total}`));
              }
            });

            failedCourseNames.forEach(failedCourseId => {
              rows.push(`${failedCourseId},, Invalid course,`);
            });

            const csvContent = "data:text/csv;charset=utf-8," + rows.join("\r\n");
            const link = document.createElement('a');
            link.href = encodeURI(csvContent);
            link.download = select.value + '.csv';
            const linkText = document.createElement('strong');
            linkText.innerText = 'download the CSV file manually';
            link.append(linkText);

            const finishedProgress = progressFactory(100, link);
            finishedDialog = dialogFactory(finishedProgress);
            overlay.removeChild(overlay.lastElementChild);
            overlay.append(finishedDialog);

            link.click();
          })
        });
      });

      if (!startDialog) {
        startDialog = dialogFactory(null, input, inputError, select, selectError, findButton);
      }

      if (overlay) {
        if (overlay.children.length > 1) {
          overlay.removeChild(overlay.lastElementChild);
        }

        overlay.append(startDialog);
      }
      else {
        overlay = overlayFactory(startDialog, closeButton);
        overlayBackground.append(overlay);
      }
    }

    const newButton = createButton('Embed Finder', 'embed_finder_button', embedButtonClickHandler, true);
    newButton.style.padding = '4px 12px';
    newButton.style.fontSize = '0.875rem;';
    div.append(newButton);
  }

  const findMatches = function (courseId, regex) {
    return new Promise(function (resolve, reject) {
      const url = baseUrl + '/api/v1/courses/' + courseId + '/pages?per_page=999&include[]=body';

      try {
        fetchItems(url)
          .then(pages => {
            const matches = [];
            for (const page of pages) {
              if (page.body) {
                const bodyMatches = page.body.match(regex);
                if (bodyMatches) {
                  matches.push({courseId, pageId: page.page_id, url: page.html_url, total: bodyMatches.length});
                }
              }
            }

            if (matches.length === 0) {
              matches.push({courseId, pageId: 'No matches', url: '', total: ''});
            }

            resolve(matches);
          })
          .catch((err) => {
            console.log(err);
            reject(courseId);
          })
      }
      catch (err) {
        console.log(err);
        reject(courseId);
      }
    });
  }

  const findCourse = function (courseId, regex) {
    return new Promise(function (resolve, reject) {
      const url = baseUrl + '/api/v1/courses/' + courseId + '';

      try {
        fetchItem(url)
          .then(course => {
            resolve({courseId, courseName: course.name});
          })
          .catch((err) => {
            console.log(err);
            reject(courseId);
          })
      }
      catch (err) {
        console.log(err);
        reject(courseId);
      }
    });
  }

  function progressFactory(progressValue, link) {
    const wrapper = document.createElement('div');
    const progress = document.createElement('div');
    progress.classList.add('progress', 'ui-progressbar', 'ui-widget', 'ui-widget-content', 'ui-corner-all');
    progress.style.margin = '10px 5px';
    const progressBar = document.createElement('div');
    progressBar.classList.add('ui-progressbar-value', 'ui-widget-header', 'ui-corner-left');
    progressBar.style.display = 'block';
    progressBar.style.width = progressValue + '%';
    const statusBox = document.createElement('div');
    statusBox.classList.add('status_box');
    statusBox.style.textAlign = 'center';
    const statusImage = document.createElement('img');
    statusImage.classList.add('status_loader');
    statusImage.src = 'https://du11hjcvx0uqb.cloudfront.net/dist/images/ajax-loader-small-5ae081ad76.gif';
    if (progressValue == 100) statusImage.style.visibility = 'hidden';
    const statusText = document.createElement('span');
    statusText.classList.add('status');
    if (progressValue == 100) {
      statusText.innerHTML = 'Your download will begin automatically.<br />If it does\'t start, ';
      statusText.append(link);
    }
    else {
      statusText.innerText = 'Creating CSV (' + progressValue + '%)...';
    }

    progress.append(progressBar);
    statusBox.append(statusImage, ' ', statusText);
    wrapper.append(progress, statusBox);

    return wrapper;
  }

  function dialogFactory(progress, input, inputError, select, selectError, button) {
    const dialog = document.createElement('div');
    dialog.classList.add('ui-dialog-content', 'ui-widget-content');
    dialog.style.width = 'auto';
    dialog.style.height = 'auto';
    dialog.style.minHeight = '49px';
    if (progress) {
      dialog.innerHTML = 'Your CSV file is being created. This may take some time, depending on the number of courses required.';
      dialog.append(progress);
    }
    else {
      const content = document.createElement('div');
      content.style.margin = '10px';
      const inputLabel = document.createElement('p');
      inputLabel.innerText = 'Course ID(s):';
      inputLabel.style.margin = '4px 0px';
      inputLabel.style.fontWeight = 'bold';
      content.append(inputLabel);
      content.append(inputError);
      content.append(input);
      const inputInstruction = document.createElement('p');
      inputInstruction.innerText = 'Enter multiple Course IDs as a comma-separated list.';
      inputInstruction.style.margin = '0 0 12px';
      inputInstruction.style.fontSize = '12px';
      content.append(inputInstruction);
      content.append(inputError);
      content.append(input);
      const selectLabel = document.createElement('p');
      selectLabel.innerText = 'Embedded Tool:';
      selectLabel.style.fontWeight = 'bold';
      content.append(selectLabel);
      content.append(selectError);
      content.append(select);
      dialog.append(content);

      const statusBox = document.createElement('div');
      statusBox.classList.add('status_box');
      statusBox.style.textAlign = 'center';
      const statusText = document.createElement('span');
      statusText.classList.add('status');
      statusText.append(button);
      statusBox.append(statusText);
      dialog.append(statusBox);
    }

    return dialog;
  }

  function overlayFactory(dialog, closeButton) {
    const overlay = document.createElement('div');
    overlay.classList.add('ui-dialog', 'ui-widget', 'ui-widget-content');
    overlay.style.zIndex = '999';
    overlay.style.width = '400px';
    overlay.style.padding = '0 0 10px 0';
    overlay.style.backgroundColor = 'white';
    overlay.style.border = '1px solid #bbb';
    const titleBar = document.createElement('div');
    titleBar.classList.add('ui-dialog-titlebar', 'ui-widget-header', 'ui-helper-clearfix');
    const title = document.createElement('span');
    title.classList.add('ui-dialog-title');
    title.innerText = 'Embedded Tool Finder';
    title.style.paddingLeft = '10px';
    titleBar.append(title, closeButton);
    overlay.append(titleBar, dialog);

    return overlay;
  }

  function overlayBackgroundFactory() {
    const wrapper = document.createElement('div');
    wrapper.style.border = '1px solid #bbb';
    wrapper.style.zIndex = '999';
    wrapper.style.padding = '0 0 8px';
    wrapper.style.backgroundColor = '#fff';
    wrapper.style.position = 'fixed';
    wrapper.fontSize = '1rem';
    wrapper.style.width = 'fit-content';
    wrapper.style.height = 'fit-content';
    wrapper.style.maxWidth = '100vw';
    wrapper.style.maxHeight = '100dvh';
    wrapper.style.left = '45%';
    wrapper.style.top = '15%';
    wrapper.style.transform = 'translate(-50%, -50%)';

    return wrapper;
  }

  function createButton(title, id, clickHandler, showIcon) {
    const button = document.createElement('a');
    button.classList.add('btn');
    button.id = id;
    button.onclick = clickHandler;
    button.innerHTML = (showIcon ? '<i class="icon-code"></i> ' : '') + title;

    return button;
  }

  init();
})();
