const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const drivelist = require("drivelist");
const { ipcMain } = require("electron");
const imageExtensions = require("image-extensions");
const glob = require("glob");
const fs = require("fs");
const fse = require("fs-extra");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync(path.join(getAppDataPath(),"db.json"));
const db = low(adapter);
db.defaults({ output_path: "", folder_name: "", short: [] }).write();

var win = null;

const createWindow = () => {
  win = new BrowserWindow({
    resizable: false,
    width: 770,
    height: 570,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
      enableRemoteModule: true,
    },
  });

  win.loadFile("./view/index.html");
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.on("DOMContentLoaded", async (event, arg) => {
  const usbs = await usb_push();
  event.reply("usb", usbs);
  const adapter = new FileSync(path.join(getAppDataPath(),"db.json"));
  const db = low(adapter);
  win.webContents.send("db:init", db.value());
});

async function usb_push() {
  return new Promise(async (resolve, reject) => {
    const drives = await drivelist.list();
    const usbs = drives
      .filter((a) => {
        return !a.isSystem && a.isUSB;
      })
      .map((a) => {
        return a.mountpoints[0];
      });
    resolve(usbs);
  });
}

ipcMain.on("db:output_path", (event, arg) => {
  const adapter = new FileSync(path.join(getAppDataPath(),"db.json"));
  const db = low(adapter);

  db.set('output_path', arg)
  .write()
});

ipcMain.on("db:short", (event, arg) => {
  const adapter = new FileSync(path.join(getAppDataPath(),"db.json"));
  const db = low(adapter);

  db.set(`short.${arg.key}`, arg.short)
  .write()
});

ipcMain.on("db:folder_name", (event, arg) => {
  const adapter = new FileSync(path.join(getAppDataPath(),"db.json"));
  const db = low(adapter);

  db.set('folder_name', arg)
  .write()
});

ipcMain.on("search", async (event, ...args) => {
  glob(
    `${args[0]}/**/*.@(${imageExtensions.join("|")}|${imageExtensions
      .map((a) => {
        return a.toUpperCase();
      })
      .join("|")})`,
    { strict: true },
    async (er, files) => {
      const out = await asyncFilter(files, async (a) => {
        var stats = fs.statSync(a);
        var mtime = stats.birthtime;
        var dd = String(mtime.getDate()).padStart(2, "0");
        var mm = String(mtime.getMonth() + 1).padStart(2, "0"); //January is 0!
        var yyyy = mtime.getFullYear();
        var date = yyyy + "-" + mm + "-" + dd;
        var target = args[1];
        return date == target;
      });
      win.webContents.send("number:photo", out);
    }
  );
});

ipcMain.on("move", async (event, arg) => {
  if (!fs.existsSync(path.join(arg.output_path, arg.file_name))) {
    fs.mkdirSync(path.join(arg.output_path, arg.file_name), (err) => {
      if (err) {
        return console.error(err);
      }
      console.log("Directory created successfully!");
    });
  }
  for (var [key, value] of Object.entries(arg.input_data)) {
    if (value["nackName"] !== undefined) {
      key = value["nackName"];
    }
    if (!fs.existsSync(path.join(arg.output_path, arg.file_name, key))) {
      fs.mkdirSync(path.join(arg.output_path, arg.file_name, key));
    }
    value.forEach((element) => {
      event.reply("moving:count", element.split("/").pop());
      fse.copySync(
        element,
        path.join(
          arg.output_path,
          arg.file_name,
          key,
          element.split("/").pop()
        ),
        { preserveTimestamps: true }
      );
    });
  }
  event.reply("moving:done");
  shell.openPath(path.join(arg.output_path, arg.file_name));
});

app.on("window-all-closed", () => {
  app.quit();
});

const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
};

function getAppDataPath() {
  switch (process.platform) {
    case "darwin": {
      return path.join(process.env.HOME, "Library", "Application Support", "image-backup");
    }
    case "win32": {
      return path.join(process.env.APPDATA, "image-backup");
    }
    case "linux": {
      return path.join(process.env.HOME, ".image-backup");
    }
    default: {
      console.log("Unsupported platform!");
      process.exit(1);
    }
  }
}