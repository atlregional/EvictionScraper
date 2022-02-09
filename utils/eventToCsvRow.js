// EXPORT MODULE TO WRITE CSV ROWS FROM CASE RECORD AND EVENT
module.exports = (fields, caseRecord, event, num) =>
  [...fields].map((field, i) =>
    field.search('event') < 0 ?
      `"${caseRecord[field] ? caseRecord[field] : ''}"${i !== fields.length - 1 ? '' : '\n'}`
      : `"${
      field === 'eventNumber' ? eval(num + 1)
        : field === 'eventDate' &&
          event.date ?
          event.date
          : field === 'eventName' &&
            event.name ?
            event.name
            : field === 'eventDescription' &&
              event.description ?
              event.description
              : ''
      }"${i !== fields.length - 1 ? '' : '\n'}`
  );