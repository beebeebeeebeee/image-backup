const { ipcRenderer } = require("electron");
const { dialog } = require("electron").remote;

var arr = {};
var short = [];
var myModal;

ipcRenderer.on("usb", (event, arg) => {
  html = `<select name="paths" id="paths" class="form-select" aria-label="Default select example" onchange="set_input_path()">
    <option value="/" disabled selected>--- Select target drive ---</option>`;
  arg.forEach((element) => {
    html += `<option value="${element.path}" selected>${element.label}</option>`;
  });
  html += "</select>";
  document.getElementById("usb").innerHTML = html;

  set_input_path();
  if (arg.length > 0) search();
});

ipcRenderer.on("db:init", (event, arg) => {
  document.getElementById("file_name").value = arg.folder_name;
  document.getElementById("output_path").value = arg.output_path;
  short = arg.short;
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("date").value = new Date().toDateInputValue();

  myModal = new bootstrap.Modal(document.getElementById("exampleModal"), {
    keyboard: false,
    backdrop: "static",
  });
});

ipcRenderer.on("number:photo", (event, arg) => {
  arr = {};
  arg.forEach((a) => {
    ext = a.split("/").pop().split(".").pop();
    if (!arr[ext]) arr[ext] = [];
    arr[ext].push(a);
  });
  var str = "";
  for (const [key, value] of Object.entries(arr)) {
    var new_key = key;
    if (short.hasOwnProperty(key)) {
      new_key = short[key];
      arr[key].nackName = new_key;
    }
    str += `
    <button type="button" class="btn btn-primary photo-btn" onclick="change_tag('${key}')">
      <input type="text" id="${key}" hidden class="input-type" placeholder="${key}">
      <span id="_${key}" style="text-transform: none !important;">${new_key}</span> <span class="badge badge-white">${value.length}</span>
    </button>`;
  }
  document.getElementById("numbers").innerHTML = str.length > 0 ? str : "0";
});

function change_tag(id) {
  document.getElementById(id).hidden = false;
  document.getElementById(id).focus();
  const evt_fn = (event) => {
    document.getElementById(id).removeEventListener("focusout", () => {});
    document.getElementById(id).removeEventListener("keypress", () => {});
    document.getElementById(id).hidden = true;

    arr[id].nackName = document.getElementById(id).value;
    document.getElementById("_" + id).innerHTML =
      document.getElementById(id).value;
    document.getElementById("_" + id).hidden = false;

    short[id] = arr[id].nackName;
    ipcRenderer.send("db:short", { key: id, short: arr[id].nackName });
  };

  document.getElementById(id).addEventListener("focusout", evt_fn);
  document.getElementById(id).addEventListener("keypress", (e)=>{
    if (e.key === 'Enter') {
      evt_fn()
    }
  });
  document.getElementById("_" + id).hidden = true;
}

async function select_input_path() {
  var path = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  console.log(path.filePaths[0]);
  if (path.filePaths[0] != null) {
    set_input_path(path.filePaths[0]);
    search();
  }
}

async function select_output_path() {
  var path = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (path.filePaths[0] != null) {
    document.getElementById("output_path").value = path.filePaths[0];
    ipcRenderer.send("db:output_path", path.filePaths[0]);
  }
}

function set_input_path(path) {
  document.getElementById("input_path").value = path
    ? path
    : document.getElementById("paths").value;
}

function db_folderName() {
  ipcRenderer.send(
    "db:folder_name",
    document.getElementById("file_name").value
  );
}

function search() {
  ipcRenderer.send(
    "search",
    document.getElementById("input_path").value,
    document.getElementById("date").value
  );
}

var moving_max = 0;
var moving_count = 0;
function move() {
  myModal.show();
  ipcRenderer.send("move", {
    input_data: arr,
    file_name: document.getElementById("file_name").value,
    output_path: document.getElementById("output_path").value,
  });
  moving_count = 0;
  moving_max = 0;
  for (const [key, value] of Object.entries(arr)) {
    moving_max += value.length;
  }
}

ipcRenderer.on("moving:count", (event, arg) => {
  moving_count++;
  d = Math.round((moving_count / moving_max) * 100);
  document.getElementById(
    "progress"
  ).innerHTML = `<div class="progress-bar" role="progressbar" style="width: ${d}%" aria-valuenow="${d}" aria-valuemin="0"
  aria-valuemax="100"></div>`;
  document.getElementById(
    "progress_process"
  ).innerHTML = `copying ${arg} (${d}%)`;
});

ipcRenderer.on("moving:done", (event, arg) => {
  document.getElementById("progress").innerHTML = "";
  document.getElementById("progress_process").innerHTML = "";
  myModal.hide();
});

Date.prototype.toDateInputValue = function () {
  var local = new Date(this);
  local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
  return local.toJSON().slice(0, 10);
};
