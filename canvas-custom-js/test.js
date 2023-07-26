  /* STUDENT SUBMISSION PACKAGE TOOL
   *  - Add a button on the people page to download all submissions for a specific student
   *
   *  Last updated: 26.07.2023
   * /*********************/

  const baseUrl = window.location.protocol + '//' + window.location.host;
  const selector = '#main .roster';

  function init() {
    if (!window.location.pathname.match(/\/courses\/\d+\/users\/?$/)) return;
    if (!getIsTeacher()) return;

    "stream" in Blob.prototype || Object.defineProperty(Blob.prototype, "stream", {
      value() {
        return new Response(this).body
      }
    });

    let x = 0;
    let interval = setInterval(function () {
      const table = document.querySelector(selector);
      if (table || ++x === 10) {
        clearInterval(interval);
        addTableCells(table);
      }
    }, 500);
  }

  function addTableCells(table) {
    const courseId = getCourseId();

    const subUrl = new URL(baseUrl + '/api/v1/courses/' + courseId + '/students/submissions');
    subUrl.searchParams.append('per_page', 999);
    subUrl.searchParams.append('student_ids[]', 'all');
    subUrl.searchParams.append('grouped', 'true');

    const users = {};

    getSubmissions(subUrl)
      .then(submissions => {
        parseSubmissions(submissions, users);

        let hasFiles = false;
        for (const userFiles in users) {
          if (userFiles.length) {
            hasFiles = true;
            break;
          }
        }

        if (!hasFiles) return;

        const overlayBackground = overlayBackgroundFactory();
        const progress = progressFactory(5);
        const progressDialog = dialogFactory(progress);
        let overlay = null;
        document.body.append(overlayBackground);

        const rows = table.getElementsByClassName('rosterUser');

        for (const row of rows) {
          const matches = row.id.match(/^user\_(\d+)$/);
          if (!matches) continue;

          const userId = matches[1];

          if (!(userId in users) || users[userId].length === 0) continue;

          const userFiles = users[userId];

          const link = row.getElementsByClassName('admin-links');

          if (link.length > 0) {
            const parent = link[0].parentNode;

            const nameElement = row.getElementsByClassName('roster_user_name');
            const name = nameElement[0].innerText.trim() + ' (' + userId + ')';

            let finishedDialog = null;
            let startDialog = null;

            let totalBytes = 0;
            for (const file of userFiles) {
              totalBytes += file.size;
            }

            const size = formatBytes(totalBytes);

            const closeButton = document.createElement('button');
            closeButton.classList.add('ui-dialog-titlebar-close', 'ui-corner-all');
            const closeText = document.createElement('span');
            closeText.classList.add('ui-icon', 'ui-icon-closethick');
            closeText.innerText = 'Close';
            closeButton.append(closeText);
            closeButton.style.cursor = 'pointer';
            closeButton.addEventListener('click', function(event) {
              overlayBackground.style.display = 'none';
            });

            const zipIcon = iconFactory('icon-zipped', 'Download all assignment submissions for this student', async function(event) {
              overlayBackground.style.display = 'flex';

              const link = document.createElement('a');
              link.style.cursor = 'pointer';
              const linkText = document.createElement('strong');
              linkText.innerHTML = '<div><i class="icon-download" aria-hidden="true"></i>  Download Submission Package [ZIP, ' + size + ']';
              link.append(linkText);
              link.addEventListener('click', async function(event) {
                startDialog.replaceWith(progressDialog);

                const blob = await downloadZip(lazyFetch(userFiles)).blob();
                const size = formatBytes(blob.size);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = name + '.zip';
                const linkText = document.createElement('strong');
                linkText.innerText = 'download the file manually [ZIP, ' + size + ']';
                link.append(linkText);

                const finishedProgress = progressFactory(100, link);
                finishedDialog = dialogFactory(finishedProgress);
                overlay.removeChild(overlay.lastElementChild);
                overlay.append(finishedDialog);

                link.click();
              });

              if (!startDialog) {
                startDialog = dialogFactory(null, name, userFiles, size, link);
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
            });

            parent.insertBefore(zipIcon, link[0]);
          }
        }
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
        const assignments = [];

        if ('submissions' in user && Array.isArray(user.submissions) && user.submissions.length > 0) {
          user.submissions.forEach(submission => {
            if ('attachments' in submission && Array.isArray(submission.attachments) && submission.attachments.length > 0) {
              if ('assignment_id' in submission && Number.isInteger(submission.assignment_id)) {
                submission.attachments.forEach(attachment => {
                  if ('url' in attachment) {
                    console.log(attachment);
                    assignments.push({name: submission.assignment_id + '/' + attachment.display_name, size: attachment.size, input: attachment.url});
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

  const e = e => new DataView(new ArrayBuffer(e)), n = e => new Uint8Array(e.buffer || e),
    t = e => (new TextEncoder).encode(String(e));

  function r(e, r) {
    if (void 0 === r || r instanceof Date || (r = new Date(r)), e instanceof File) return {
      t: r || new Date(e.lastModified),
      o: e.stream()
    };
    if (e instanceof Response) return {t: r || new Date(e.headers.get("Last-Modified") || Date.now()), o: e.body};
    if (void 0 === r) r = new Date; else if (isNaN(r)) throw new Error("Invalid modification date.");
    if ("string" == typeof e) return {t: r, o: t(e)};
    if (e instanceof Blob) return {t: r, o: e.stream()};
    if (e instanceof Uint8Array || e instanceof ReadableStream) return {t: r, o: e};
    if (e instanceof ArrayBuffer || ArrayBuffer.isView(e)) return {t: r, o: n(e)};
    if (Symbol.asyncIterator in e) return {t: r, o: o(e)};
    throw new TypeError("Unsupported input format.")
  }

  function o(e) {
    const n = "next" in e ? e : e[Symbol.asyncIterator]();
    return new ReadableStream({
      async pull(e) {
        let t = 0;
        for (; e.desiredSize > t;) {
          const r = await n.next();
          if (!r.value) {
            e.close();
            break
          }
          {
            const n = i(r.value);
            e.enqueue(n), t += n.byteLength
          }
        }
      }, async cancel(e) {
        let t;
        try {
          await (null == (t = n.throw) ? void 0 : t.call(n, e))
        }
        catch (e) {
        }
      }
    })
  }

  function i(e) {
    return "string" == typeof e ? t(e) : e instanceof Uint8Array ? e : n(e)
  }

  function a(e, r, o) {
    let [i, a] = function (e) {
      return e ? e instanceof Uint8Array ? [e, 1] : ArrayBuffer.isView(e) || e instanceof ArrayBuffer ? [n(e), 1] : [t(e), 0] : [void 0, 0]
    }(r);
    if (e instanceof File) return {i: s(i || t(e.name)), u: e.size, l: a};
    if (e instanceof Response) {
      const n = e.headers.get("content-disposition"), r = n && n.match(/;\s*filename\*?=["']?(.*?)["']?$/i),
        f = r && r[1] || e.url && new URL(e.url).pathname.split("/").findLast(Boolean), u = f && decodeURIComponent(f),
        d = o || +e.headers.get("content-length");
      return {i: s(i || t(u)), u: d, l: a}
    }
    return i = s(i), "string" == typeof e ? {i, u: t(e).length, l: a} : e instanceof Blob ? {
      i,
      u: e.size,
      l: a
    } : e instanceof ArrayBuffer || ArrayBuffer.isView(e) ? {i, u: e.byteLength, l: a} : {i, u: f(e, o), l: a}
  }

  function f(e, n) {
    return n > -1 ? n : e ? void 0 : 0
  }

  function s(e) {
    if (!e || e.every((c => 47 === c))) throw new Error("The file must have a name.");
    for (; 47 === e[e.length - 1];) e = e.subarray(0, -1);
    return e
  }

  const u = new Uint32Array(256);
  for (let e = 0; e < 256; ++e) {
    let n = e;
    for (let e = 0; e < 8; ++e) n = n >>> 1 ^ (1 & n && 3988292384);
    u[e] = n
  }

  function d(e, n = 0) {
    n ^= -1;
    for (let t = 0, r = e.length; t < r; t++) n = n >>> 8 ^ u[255 & n ^ e[t]];
    return (-1 ^ n) >>> 0
  }

  function l(e, n, t = 0) {
    const r = e.getSeconds() >> 1 | e.getMinutes() << 5 | e.getHours() << 11,
      o = e.getDate() | e.getMonth() + 1 << 5 | e.getFullYear() - 1980 << 9;
    n.setUint16(t, r, 1), n.setUint16(t + 2, o, 1)
  }

  function y({i: e, l: n}, t) {
    return 8 * (!n || (null != t ? t : function (e) {
      try {
        w.decode(e)
      }
      catch (e) {
        return 0
      }
      return 1
    }(e)))
  }

  const w = new TextDecoder("utf8", {fatal: 1});

  function p(t, r = 0) {
    const o = e(30);
    return o.setUint32(0, 1347093252), o.setUint32(4, 335546368 | r), l(t.t, o, 10), o.setUint16(26, t.i.length, 1), n(o)
  }

  async function* b(e) {
    let {o: n} = e;
    if ("then" in n && (n = await n), n instanceof Uint8Array) yield n, e.m = d(n, 0), e.u = n.length; else {
      e.u = 0;
      const t = n.getReader();
      for (; ;) {
        const {value: n, done: r} = await t.read();
        if (r) break;
        e.m = d(n, e.m), e.u += n.length, yield n
      }
    }
  }

  function B(t) {
    const r = e(16);
    return r.setUint32(0, 1347094280), r.setUint32(4, t.m, 1), r.setUint32(8, t.u, 1), r.setUint32(12, t.u, 1), n(r)
  }

  function v(t, r, o = 0) {
    const i = e(46);
    return i.setUint32(0, 1347092738), i.setUint32(4, 352523264), i.setUint16(8, 2048 | o), l(t.t, i, 12), i.setUint32(16, t.m, 1), i.setUint32(20, t.u, 1), i.setUint32(24, t.u, 1), i.setUint16(28, t.i.length, 1), i.setUint16(40, 33204, 1), i.setUint32(42, r, 1), n(i)
  }

  function D(e) {
    return e instanceof File || e instanceof Response ? [[e], [e]] : [[e.input, e.name, e.size], [e.input, e.lastModified]]
  }

  function downloadZip(t, i = {}) {
    const f = {"Content-Type": "application/zip", "Content-Disposition": "attachment"};
    return Number.isInteger(i.length) && i.length > 0 && (f["Content-Length"] = i.length), i.metadata && (f["Content-Length"] = h(i.metadata)), new Response(o(async function* (t, r) {
      const o = [];
      let i = 0, a = 0;
      for await(const e of t) {
        const n = y(e, r.buffersAreUTF8);
        yield p(e, n), yield e.i, yield* b(e), yield B(e), o.push(v(e, i, n)), o.push(e.i), a++, i += 46 + e.i.length + e.u
      }
      let f = 0;
      for (const e of o) yield e, f += e.length;
      const s = e(22);
      s.setUint32(0, 1347093766), s.setUint16(8, a, 1), s.setUint16(10, a, 1), s.setUint32(12, f, 1), s.setUint32(16, i, 1), yield n(s)
    }(async function* (e) {
      for await(const n of e) {
        const [e, t] = D(n);
        yield Object.assign(r(...t), a(...e))
      }
    }(t), i)), {headers: f})
  }

  function iconFactory(className, title = '', handler, marginRight) {
    const icon = document.createElement('i');
    icon.classList.add('icon-Line', className);
    icon.setAttribute('aria-hidden',  'true');
    icon.style.cursor = 'pointer';
    icon.title = title;
    icon.addEventListener('click', handler);
    if (marginRight) icon.style.marginRight = marginRight;
    return icon;
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
      statusText.innerText = 'Gathering Files (' + progressValue + '%)...';
    }

    progress.append(progressBar);
    statusBox.append(statusImage, ' ', statusText);
    wrapper.append(progress, statusBox);

    return wrapper;
  }

  function dialogFactory(progress, name, userFiles, size, link) {
    const dialog = document.createElement('div');
    dialog.id = 'download_submissions_dialog';
    dialog.classList.add('ui-dialog-content', 'ui-widget-content');
    dialog.style.width = 'auto';
    dialog.style.height = 'auto';
    dialog.style.minHeight = '49px';
    if (progress) {
      dialog.innerHTML = '<strong>Your student assignment submissions are being gathered</strong> and compressed into a zip file. This may take some time, depending on the size and number of submission files.';
      dialog.append(progress);
    }
    else {
      let dialogContent = '<strong>Download a compressed zip file</strong> containing all assignment submissions for the selected student. This may take some time, depending on the size and number of submission files.</div>';
      dialogContent += '<div style="margin: 10px 0; text-align: center"><strong>Student Name:</strong> ' + name + '<br /><strong>Number of files:</strong> ' + userFiles.length + '<br /><strong>Estimated file size:</strong> ' + size + '</div>';
      dialog.innerHTML = dialogContent;

      const statusBox = document.createElement('div');
      statusBox.classList.add('status_box');
      statusBox.style.textAlign = 'center';
      const statusText = document.createElement('span');
      statusText.classList.add('status');
      statusText.append(link);
      statusBox.append(statusText);
      dialog.append(statusBox);
    }

    return dialog;
  }

  function overlayFactory(dialog, closeButton) {
    const overlay = document.createElement('div');
    overlay.classList.add('ui-dialog', 'ui-widget', 'ui-widget-content');
    overlay.style.zIndex = '999';
    overlay.style.width = '450px';
    overlay.style.padding = '0 0 10px 0';
    overlay.style.backgroundColor = 'white';
    overlay.style.border = '1px solid #bbb';
    const titleBar = document.createElement('div');
    titleBar.classList.add('ui-dialog-titlebar', 'ui-widget-header', 'ui-helper-clearfix');
    const title = document.createElement('span');
    title.classList.add('ui-dialog-title');
    title.innerText = 'Download Assignment Submissions';
    titleBar.append(title, closeButton);
    overlay.append(titleBar, dialog);

    return overlay;
  }

  function overlayBackgroundFactory() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ui-widget-overlay');
    wrapper.style.position = 'fixed';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.zIndex = '998';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.overflowX = 'hidden';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    wrapper.style.display = 'none';

    return wrapper;
  }

  async function *lazyFetch(files) {
    for (const { name, input } of files) yield { name, input: await fetch(input) }
  }

  function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  init();
