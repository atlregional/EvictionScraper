// IMPORT FILE SYSTEM DEPENDENCY
const fs = require('fs');

// IMPORT MODULE TO WRITE CSV ROWS FROM CASE RECORD AND EVENT
const eventToCsvRow = require('./eventToCsvRow');

// EXPORT MODULE TO LOOP OVER EVENTS AND APPEND TO CSV
module.exports = (caseRecord, filepath, fields) => {
  caseRecord.events.length > 0
    ? caseRecord.events.forEach((event, i) =>
      fs.appendFile(
        filepath,
        eventToCsvRow(fields, caseRecord, event, i).toString(),
        (err) => {
          err ? console.log(err) : null;
        }
      )
    )
    : fs.appendFile(
      filepath,
      eventToCsvRow(
        fields,
        caseRecord, 
        {name: '', date: '', description: ''} //No event info
        , -1
      ).toString(),
      (err) => {
        err ? console.log(err) : null;
      }
    );
};