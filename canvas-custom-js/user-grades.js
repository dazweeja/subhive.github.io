/**
 // @name        Canvas JS
 // @namespace   https://github.com/dazweeja/subhive.github.io
 // @author      Darren Smith <darren@spacedog.com.au>
 //
 //
 //
 **/
(function () {
  'use strict';

  const baseUrl = window.location.protocol + '//' + window.location.host;
  const dateOptions = { timeZone: 'Australia/Melbourne' };

  function init(mutations, observer) {
    const viewer = document.getElementById('view_grades');
    if (!viewer && typeof observer === 'undefined') {
      const obs = new MutationObserver(init);
      obs.observe(document.body, {'childList': true});
    }
    if (viewer) {
      if (typeof observer !== 'undefined') {
        observer.disconnect();
      }

      addHTML(viewer);
    }
  }

  function addHTML(viewer) {
    const courseId = getCourseId();
    const courseUrl = new URL(baseUrl + '/api/v1/courses/' + courseId);

    getCourse(courseUrl)
      .then(function(course) {
        $('.page-title').html(course.name);
      })
      .catch(e => errorHandler(e));

    const url = baseUrl + '/api/v1/courses/' + courseId + '/assignment_groups?per_page=999&include[]=assignments';
    getAssignmentGroups(url)
      .then(function (groups) {
        const assignmentRegex = /^([a-zA-Z0-9]+)[\s\-]+/;
        const grades = {};
        const groupsKeyed = {};
        groups.forEach(function(group) {
          const matches = assignmentRegex.exec(group.name);
          if (matches && group.assignments && group.assignments.length) {
            const groupId = matches[1];
            const assignments = [];
            group.assignments.forEach(function(assignment) {
              assignments.push({id: assignment.id, url: assignment.html_url, name: assignment.name, due: assignment.due_at});
              grades[assignment.id] = null;
            });

            if (groupId in groupsKeyed) {
              groupsKeyed[groupId].assignments = groupsKeyed[groupId].assignments.concat(assignments);
            }
            else {
              groupsKeyed[groupId] = { name: groupId, assignments };
            }
          }
        })

        const subUrl = new URL(baseUrl + '/api/v1/courses/' + courseId + '/students/submissions');
        subUrl.searchParams.append('per_page', 999);
        Object.keys(grades).forEach(val => subUrl.searchParams.append('assignment_ids[]', val));

        getStatuses(subUrl)
          .then(statuses => {
            parseStatuses(statuses, grades);

            let content = '';
            Object.values(groupsKeyed).forEach(function(group) {
              content += `<h3>${group.name}</h3>`;
              content += createTable(group, grades);
            });

            let isProgress = false;
            let isIncompetent = false;
            for (const assId in grades) {
              const grade = grades[assId];
              if (grade === 'submitted' || grade === 'not submitted' || grade === 'NA') isProgress = true;
              else if (grade !== 'satisfactory') isIncompetent = true;
            }

            const result = isProgress ? 'In Progress' : (isIncompetent ? 'Not Competent' : 'Competent');
            content += createResultTable(result);

            $(viewer).html(content);
          })
          .catch(e => errorHandler(e));
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

  function getCourse(url) {
    return new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve(
              JSON.parse(xhr.responseText)
            )
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

  function getAssignmentGroups(url) {
    return getAssignmentGroupsPage(url)
      .then(function (page) {
        if (page.url) {
          return getAssignmentGroups(page.url)
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

  function getAssignmentGroupsPage(url) {
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

  function getStatuses(url) {
    return getStatusPage(url)
      .then(page => {
        if (page.url) {
          return getStatuses(page.url)
            .then(nextPage => page.data.concat(nextPage));
        }
        else {
          return page.data;
        }
      })
      .catch(e => errorHandler(e));
  }

  function getStatusPage(url) {
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

  function parseStatuses(statuses, grades) {
    statuses.forEach(status => {
      // workflow state: “submitted”, “unsubmitted”, “graded”, “pending_review”
      let grade = status.excused ? 'excused' : status.grade;
      if (status.workflow_state === 'submitted') {
        grade = 'submitted';
      }
      else if (grade == null) {
        grade = status.workflow_state === 'graded' ? 'submitted' : 'not submitted';
      }

      grades[status.assignment_id] = grade.toLowerCase().trim();
    });
  }

  function createTable(group, grades) {
    let table = '<table class="ic-Table ic-Table--hover-row"><thead><tr>';
    table += '<th style="width: 60%;" scope="col">Assessment</th>';
    table += '<th style="width: 20%;" scope="col">Due Date</th>';
    table += '<th style="width: 20%;" scope="col">Grade</th>';
    table += '</tr></thead>';
    table += '<tbody>';

    group.assignments.sort((a, b) => {
      if (a.name.toLowerCase().indexOf('declaration') < b.name.toLowerCase().indexOf('declaration')) {
        return 1;
      }
      if (a.name.toLowerCase().indexOf('declaration') > b.name.toLowerCase().indexOf('declaration')) {
        return -1;
      }
      return 0;
    });

    let isProgress = false;
    let isIncompetent = false;

    group.assignments.forEach((assignment) => {
      const due = assignment.due ? new Date(assignment.due).toLocaleDateString('en-GB', dateOptions)  : '';
      const grade = assignment.id in grades ? grades[assignment.id] : 'NA';
      if (grade === 'submitted' || grade === 'not submitted' || grade === 'NA') isProgress = true;
      else if (grade !== 'satisfactory') isIncompetent = true;
      table += '<tr>';
      table += `<td><a href="${assignment.url}">${assignment.name}</a></td>`;
      table += `<td>${due}</td>`;

      let prettyGrade = '';
      if (grade === 'satisfactory') {
        prettyGrade = '<span style="color: #32b332;">Satisfactory</span>';
      }
      else if (grade === 'not yet satisfactory') {
        prettyGrade = '<span style="color: #ee3a3d;">Not Yet Satisfactory</span>';
      }
      else if (grade === 'submitted') {
        prettyGrade = '<span style="color: #2f74f4;">Submitted</span>';
      }
      else {
        prettyGrade = `<span style="text-transform: capitalize;">${grade}</span>`;
      }
      table += `<td><p>${prettyGrade}</p></td>`;
      table += '</tr>';
    });

    const result = isProgress ? 'In Progress' : (isIncompetent ? 'Not Competent' : 'Competent');
    table += '<tr style="font-size: 1.1rem;">';
    table += '<td>&nbsp;</td>';
    table += '<td style="text-align: right;"><p><strong>Unit Result:&nbsp;</strong></p></td>';
    table += `<td><p>${result}</p></td>`;
    table += '</tr></tbody></table><p>&nbsp;</p>';

    return table;
  }

  function createResultTable(result) {
    let table = '<table className="ic-Table" style="width: 100%; border-top-color: #c7cdd1; border-top-style: double; font-size: 1.5rem;">';
    table += '<tbody><tr>';
    table += '<td style="width: 60%;">&nbsp;</td>';
    table += '<td style="width: 20%; text-align: right;"><p><strong>Course Result:&nbsp;</strong></p></td>';
    table += `<td style="width: 20%;"><p>${result}</p></td>`;
    table += '</tr></tbody></table>';

    return table;
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