const CONFIG = {
  SPREADSHEET_ID: "1AdWOhatXyBGOllVxHMs1an_-osbPHtIGg8gzH6o81E8",
  SHEET_NAME: "DatosJSON",
  SECRET_TOKEN: "975787201",
};

function doGet() {
  const data = readData_();

  return jsonResponse_({
    ok: true,
    updatedAt: new Date().toISOString(),
    data,
  });
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");

    if (body.token !== CONFIG.SECRET_TOKEN) {
      return jsonResponse_({
        ok: false,
        error: "TOKEN_INVALIDO",
      });
    }

    if (!isValidData_(body.data)) {
      return jsonResponse_({
        ok: false,
        error: "ESTRUCTURA_INVALIDA",
      });
    }

    writeData_(body.data);

    return jsonResponse_({
      ok: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: "POST_INVALIDO",
      detail: String(error),
    });
  }
}

function setup() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  sheet.clear();
  sheet.getRange("A1").setValue("json");
  sheet.getRange("B1").setValue("updatedAt");
  sheet.getRange("A2").setValue("{}");
  sheet.getRange("B2").setValue(new Date().toISOString());
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function readData_() {
  const sheet = getSheet_();
  const raw = String(sheet.getRange("A2").getValue() || "{}");
  return JSON.parse(raw);
}

function writeData_(data) {
  const sheet = getSheet_();
  sheet.getRange("A1").setValue("json");
  sheet.getRange("B1").setValue("updatedAt");
  sheet.getRange("A2").setValue(JSON.stringify(data));
  sheet.getRange("B2").setValue(new Date().toISOString());
  sheet.autoResizeColumns(1, 2);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
    sheet.getRange("A1").setValue("json");
    sheet.getRange("B1").setValue("updatedAt");
  }

  return sheet;
}

function isValidData_(data) {
  return data &&
    Array.isArray(data.teams) &&
    Array.isArray(data.matches) &&
    data.finalStage &&
    data.rules &&
    data.admin;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
