/**
 // @name        VET User Grades
 // @namespace   https://github.com/dazweeja/subhive.github.io
 // @author      Darren Smith <darren@spacedog.com.au>
 // @updated     02.09.2022
 //
 **/
(function () {
  'use strict';

  const baseUrl = window.location.protocol + '//' + window.location.host;

  function init() {
    const viewer = document.getElementById('view_grades');
    const menu = document.getElementsByClassName('ic-app-course-menu');
    const config = { childList: true };

    if (viewer) {
      addGrades(viewer);
    }
    else  {
      const gradesObserver = new MutationObserver(gradesCallback);
      gradesObserver.observe(document.body, config);
    }

    if (menu) {
      addMenuItem(menu[0]);
    }
    else  {
      const menuObserver = new MutationObserver(menuCallback);
      menuObserver.observe(document.body, config);
    }
  }

  function gradesCallback(mutations, observer) {
    const viewer = document.getElementById('view_grades');
    if (viewer) {
      observer.disconnect();
      addGrades(viewer);
    }
  }

  function menuCallback(mutations, observer) {
    const menu = document.getElementsByClassName('ic-app-course-menu');
    if (menu) {
      observer.disconnect();
      addMenuItem(menu[0]);
    }
  }

  function addMenuItem(menu) {

    // <a href="/courses/2523/assignments" class="assignments" tabindex="0">Assignments</a>
    const homeItem = menu.querySelector('li a.home');
    if (homeItem) {
      const item = document.createElement('li');
      item.classList.add('section');
      const link = document.createElement('a');
      link.classList.add('my-grades');
      link.setAttribute('href', homeItem.href + '/pages/my-grades');
      link.setAttribute('tabindex', '0');
      link.innerText = 'My Grades';
      item.append(link);
      homeItem.parentNode.after(item);
    }
  }

  function addGrades(viewer) {
    const courseId = getCourseId();

    const url = baseUrl + '/api/v1/courses/' + courseId + '/assignment_groups?per_page=999&include[]=assignments';
    getAssignmentGroups(url)
      .then(function (assignmentGroups) {
        const assignmentRegex = /^([a-zA-Z0-9]+)[\s\-]+/;
        const grades = {};
        const assignments = {};
        const groups = {};
        assignmentGroups.forEach(function (group) {
          console.log(group);
          const matches = assignmentRegex.exec(group.name);
          if (matches && group.assignments && group.assignments.length) {
            const groupId = matches[1];
            const groupAssignments = [];
            group.assignments.forEach(function (groupAssignment) {
              const assignment = {
                id: groupAssignment.id,
                url: groupAssignment.html_url,
                name: groupAssignment.name
              };

              if (groupAssignment.grading_type === 'points') {
                assignment.points_possible = 'points_possible' in groupAssignment ? groupAssignment.points_possible : -1;
              }

              groupAssignments.push(assignment);
              assignments[assignment.id] = assignment;
              grades[assignment.id] = null;
            });

            if (groupId in groups) {
              groups[groupId].assignments = groups[groupId].assignments.concat(groupAssignments);
            }
            else {
              groups[groupId] = {name: group.name, assignments: groupAssignments};
            }
          }
        })

        const subUrl = new URL(baseUrl + '/api/v1/courses/' + courseId + '/students/submissions');
        subUrl.searchParams.append('per_page', 999);
        Object.keys(grades).forEach(val => subUrl.searchParams.append('assignment_ids[]', val));

        getStatuses(subUrl)
          .then(statuses => {
            console.log(statuses);
            console.log(grades);
            parseStatuses(statuses, grades, assignments);

            let content = '';
            Object.values(groups).forEach(function (group) {
              content += `<h2>${group.name}</h2>`;
              content += createTable(group, grades);
            });

            let isProgress = false;
            let isIncompetent = false;
            for (const assignmentId in grades) {
              const grade = grades[assignmentId];
              if (grade === 'submitted' || grade === 'not submitted' || grade === 'NA') isProgress = true;
              else if (grade !== 'satisfactory' && grade !== 'excused') isIncompetent = true;
            }

            const result = isProgress ? 'In Progress' : (isIncompetent ? 'Not Yet Competent' : 'Competent');
            content += createResultTable(result);

            viewer.innerHTML = content;
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

  function parseStatuses(statuses, grades, assignments) {
    statuses.forEach(status => {
      // workflow state: “submitted”, “unsubmitted”, “graded”, “pending_review”
      let grade = status.excused ? 'excused' : status.grade;
      if (status.workflow_state === 'submitted') {
        grade = 'submitted';
      }
      else if (grade == null) {
        grade = status.workflow_state === 'graded' ? 'submitted' : 'not submitted';
      }
      else if (status.assignment_id in assignments && 'points_possible' in assignments[status.assignment_id]) {
        const pointsGrade = parseFloat(status.grade);
        grade = 'satisfactory';
        if (assignments[status.assignment_id].points_possible > 0 && pointsGrade < assignments[status.assignment_id].points_possible) {
          grade = 'not yet satisfactory';
        }
      }

      grades[status.assignment_id] = grade.toLowerCase().trim();
    });
  }

  function createTable(group, grades) {
    let table = '<table class="ic-Table ic-Table--hover-row"><thead><tr>';
    table += '<th style="width: 70%;" scope="col">Assessment</th>';
    table += '<th style="width: 30%;" scope="col">Grade</th>';
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
      console.log(assignment);
      const grade = assignment.id in grades ? grades[assignment.id] : 'NA';
      if (grade === 'submitted' || grade === 'not submitted' || grade === 'NA') isProgress = true;
      else if (grade !== 'satisfactory' && grade !== 'excused') isIncompetent = true;
      table += '<tr>';
      table += `<td><a href="${assignment.url}">${assignment.name}</a></td>`;

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

    const result = isProgress ? 'In Progress' : (isIncompetent ? 'Not Yet Competent' : 'Competent');
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