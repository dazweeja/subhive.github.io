/**
 // @name        VET Student Grades
 // @namespace   https://github.com/dazweeja/subhive.github.io
 // @author      Darren Smith <darren@spacedog.com.au>
 // @updated     07.10.2022
 //
 **/
(function () {
  'use strict';

  const baseUrl = window.location.protocol + '//' + window.location.host;

  function userGradesInit() {
    const viewer = document.getElementById('view_grades');
    const menu = document.getElementsByClassName('ic-app-course-menu');
    const config = {childList: true};

    if (viewer) {
      addGrades(viewer);
    }
    else {
      const gradesObserver = new MutationObserver(gradesCallback);
      gradesObserver.observe(document.body, config);
    }

    if (menu) {
      addMenuItem(menu[0]);
    }
    else {
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
    if (getIsTeacher()) return;

    const courseId = getCourseId();
    const href = '/courses/' + courseId + '/pages/my-grades';
    const menuItem = menu.querySelector('li a.modules');

    if (menuItem) {
      const isActive = window.location.href.indexOf(href) !== -1;
      const item = document.createElement('li');
      item.classList.add('section');
      const link = document.createElement('a');
      link.classList.add('my-grades');
      if (isActive) {
        link.classList.add('active');
      }
      link.setAttribute('href', href);
      link.setAttribute('tabindex', '0');
      link.innerText = 'My Grades';
      item.append(link);
      menuItem.parentNode.after(item);

      if(isActive) {
        const pagesItem = menu.querySelector('li a.pages');
        pagesItem.classList.remove('active');
      }
    }
  }

  function addGrades(viewer) {
    if (getIsTeacher()) {
      viewer.innerHTML = '<p>My Grades page can only be viewed by students.</p>';
      return;
    }

    viewer.innerHTML = '<p>Loading...</p>';

    const courseId = getCourseId();
    const url = baseUrl + '/api/v1/courses/' + courseId + '/assignment_groups?per_page=999&include[]=assignments';

    fetchItems(url)
      .then(function (assignmentGroups) {
        const grades = {};
        const assignments = {};
        const groups = [];

        assignmentGroups.sort((a, b) => a.position - b.position);

        assignmentGroups.forEach(function (assignmentGroup) {
          let group = null;
          if (assignmentGroup.assignments && assignmentGroup.assignments.length) {
            const groupAssignments = [];
            assignmentGroup.assignments.sort((a, b) => a.position - b.position);

            assignmentGroup.assignments.forEach(function (groupAssignment) {
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

            if (group) {
              group.assignments = group.assignments.concat(groupAssignments);
            }
            else {
              group = {name: assignmentGroup.name, assignments: groupAssignments};
            }
          }

          if (group) {
            groups.push(group);
          }
        })

        const subUrl = new URL(baseUrl + '/api/v1/courses/' + courseId + '/students/submissions');
        subUrl.searchParams.append('per_page', 999);
        Object.keys(grades).forEach(val => subUrl.searchParams.append('assignment_ids[]', val));

        fetchItems(subUrl)
          .then(statuses => {
            parseStatuses(statuses, grades, assignments);

            let content = '';
            groups.forEach(function (group) {
              content += `<h2>${group.name}</h2>`;
              content += createTable(group, grades);
            });

            viewer.innerHTML = content;
          })
          .catch(e => errorHandler(e));
      })
      .catch(e => errorHandler(e));
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

    let isProgress = false;
    let isIncompetent = false;

    group.assignments.forEach((assignment) => {
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
    //table += '<td>&nbsp;</td>';
    table += '<td style="text-align: right;"><p><strong>Unit Result:&nbsp;</strong></p></td>';
    table += `<td><p>${result}</p></td>`;
    table += '</tr></tbody></table><p>&nbsp;</p>';

    return table;
  }

  userGradesInit();
})();
