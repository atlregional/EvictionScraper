const fs = require('fs');
const csv = require('csv-parser');
const through2 = require('through2')

module.exports = async configObj => {

  const {
    startCase,
    prevFilepath,
    filepath,
    monthsToRescrape,
    fresh,
    onlynew,
    year,
    county,
    closedCasesTerm,
    fields,
    caseNumberSliceIndex,
    append  
  } = configObj;

  const returnObj = {};

  var lastScrapeEnd = 0;
  var dateCutOff = new Date();
  var currentCaseNumber = startCase;
  var appendStartCase = null;

  const updateList = [];
  dateCutOff.setMonth(dateCutOff.getMonth() - monthsToRescrape);
  dateCutOff.setDate(1);
  
  console.log('Update Start Date:', dateCutOff)

  const setCaseNumberFromAppenedFile = () => new Promise((resolve, reject) => {
    var lastCaseNumber = 0; 
      fs.createReadStream(filepath)
        .pipe(csv())
        .on('data', row => {
          const rowObj = new Object(row);
          const caseID = rowObj['caseID'] ? rowObj['caseID'] : null;
          const caseNumber = caseID ? parseInt(rowObj['caseID'].slice(caseNumberSliceIndex)) : null;
          lastCaseNumber = caseNumber
        })
        .on('end', () => {
          console.log('Appended file max case number:', lastCaseNumber);
          appendStartCase = lastCaseNumber + 1;
          resolve();
        })
        .on('error', err => {
          console.log('Error in initator:', err);
          reject();
        })
  });

  // setTimeout(() => {
  // try { 
  const buildUpdateList = () => new Promise((resolve, reject) => {
    if (!fresh && prevFilepath) {

      fs.createReadStream(prevFilepath)
        .pipe(csv())
        .on('data', row => {
          const rowObj = new Object(row);
          const caseID = rowObj['caseID'] ? rowObj['caseID'] : null;
          const caseStatus = rowObj['caseStatus'] ? rowObj['caseStatus'] : null

          var yearInCaseID =  county != 'Chatham'?
          rowObj['caseID'].slice(0, 2)
          :rowObj['caseID'].slice(4, 6)
        
          if (yearInCaseID == year.toString().slice(2) || !fresh){
          
            const caseNumber = caseID ? parseInt(rowObj['caseID'].slice(caseNumberSliceIndex)) : null;
            // find the last case number
            if (lastScrapeEnd < caseNumber){
              lastScrapeEnd = caseNumber
            }

            var dateCase = new Date(rowObj['fileDate']);

          if( !append) { 
            // COPY RECORDS FROM PREVIOUS SCRAPE TO CURRENT SCRAPE CSV
            onlynew
            // IF ONLYNEW THEN COPY ALL RECORDS
              ? fs.appendFile(
                filepath,
                fields.map((field, i) =>
                  `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
                ).toString(),
                err => err ?
                  console.log(err)
                  : null
              )
            // IF UPDATE (DEFAULT) THEN COPY CLOSED RECORDS OR CASES BEFORE THE CUTOFF
              : ( 
                  caseStatus.includes(closedCasesTerm) || 
                  dateCase < dateCutOff
                )
                ? fs.appendFile(
                    filepath,
                    fields.map((field, i) =>
                      `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
                    ).toString(),
                    err => err ?
                      console.log(err)
                      : null
                  )
                : null
            }
            // CREATE ARRAY OF CASES TO UPDATE
            onlynew ?
              // PUSH ALL CASE NUMBERS TO ARRAY TO EVALUATE MAX FOR ONLYNEW
              !updateList.includes(caseNumber) ?
                  updateList.push(caseNumber)
              : null
            : (!caseStatus.includes(closedCasesTerm) && dateCase >= dateCutOff)?
              // PUSH OPEN (NON-CLOSED) CASES TO ARRAY TO LIMIT SCRAPER TO ONLY THOSE CASES
              !updateList.includes(caseNumber) ?
                updateList.push(caseNumber)
              : null 
            : null;
          }
        })
        .on('end', () => {
          console.log(updateList);
          console.log(lastScrapeEnd);
          // updateList.sort((a,b) => a - b)
          // tabke care of the all cases have been closed from the previous scrape 
          if (updateList.length > 0){
            lastScrapeEnd = Math.max(...updateList);
            const updateMinCaseNumber = Math.min(...updateList);
            const startCaseNumber = updateMinCaseNumber > currentCaseNumber 
            ? updateMinCaseNumber 
            : currentCaseNumber;
            
            // console.log(lastScrapeEnd);
            onlynew ?
              currentCaseNumber = 
                currentCaseNumber < lastScrapeEnd ? 
                  lastScrapeEnd + 1
                : currentCaseNumber
              : currentCaseNumber = currentCaseNumber > startCaseNumber
                ? currentCaseNumber
                : startCaseNumber;
          } else {
            // county === 'Fulton' ?
            // currentCaseNumber = 173560
            currentCaseNumber = lastScrapeEnd + 1
          }

          returnObj.currentCaseNumber = appendStartCase > currentCaseNumber
            ? appendStartCase
            : currentCaseNumber;
          returnObj.updateList = updateList;
          returnObj.lastScrapeEnd = lastScrapeEnd;
          
          
          // return ({
          //   currentCaseNumber: currentCaseNumber,
          //   updateList: updateList,
          //   lastScrapeEnd: lastScrapeEnd,
          // })
            // scrape(currentCaseNumber);
          resolve();
        })
        .on('error', err => {
          console.log('Error in initator:', err);
          reject();
        })
    }
  });

  if (!append) {
    const headerRow = fields.map((field, i) =>
      `${field}${i !== fields.length - 1 ? '' : '\n'}`
    );

    fs.writeFile(filepath, headerRow.toString(), err => {
      err ? console.log(err) : null});
  } else {
    await setCaseNumberFromAppenedFile()
  }

  await buildUpdateList();
  return returnObj;

 
  // setTimeout(() => {return returnObj}, 10000)
  // } catch (err) {
  //   throw err
  // }finally {
    
  // }
  // }, 5000)
};