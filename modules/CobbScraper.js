const Nightmare = require('nightmare');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const csv = require('csv-parser');
const eventToCsvRow = require('../utils/eventToCsvRow');

module.exports = config => {

  var nightmare = Nightmare({ show: config.show });
  const county = 'Cobb';
  const prevFileList = fs.readdirSync('./csvs/prev-scrape/');
  const prevFileName = prevFileList.length > 0 &&
    prevFileList.find(filename => filename.search(county) >= 0) ?
    prevFileList.find(filename => filename.search(county) >= 0)
    : null;
  const dev = config.dev;
  const startCase = config.startcase ? config.startcase : 1;
  var year = config.year ? config.year : 2020;
  const finalYear = config.finalYear ? config.finalYear.toString() : '2020';
  const fresh = config.fresh;
  const onlynew = config.onlynew;
  const prevFilepath =
    !fresh ?
      prevFileName ?
        `./csvs/prev-scrape/${prevFileName}`
        : config.prevfilepath
      : null;
  const filetype = 'csv';
  const filename = `${dev ? 'DEV-' : ''}${year}${county}CountyEvictionCaseEvents-SCRAPE-${moment().format('MM-DD-YYYY')}`;
  const filepath = `./csvs/${dev ? 'dev/' : 'current-scrape/'}${filename}.${filetype}`;
  var prevList = [];
  var errorList = [];
  const errorListFilepath = `./csvs/errorlogs/${year}${county}CountyScrape-ERROR-LIST.csv`;

  const fields = config.fields;
  const headerRow = fields.map((field, i) =>
    `${field}${i !== fields.length - 1 ? '' : '\n'}`
  );

  const logError = caseNumber => {
    fs.appendFile(errorListFilepath,
      `${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}` + '\n'
      , err => err ? console.log(err) : null);
  }

  console.log(`Started scraping ${county} County @ ${moment().format('hh:mm [on] M/D/YY')}`)

  const caseNotFoundThreshold = 30;
  let currentCaseNumber = startCase;
  let consecutiveCasesNotFound = 0;
  let errorRescrapeCount = 0;
  let getCaseFailCount = 0;

  

  const extract = caseNumber => {

    // console.log(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_docket_report?case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)

    // setTimeout(function(){ 

    nightmare
      .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_docket_report?case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
      .wait('body')
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        // (response.search('No case was found') === -1 && response.search(/error/i) === -1) ?
        if (response.search('500 Internal Server Error') !== -1 ){
          // errorList.push(caseNumber);

          //logError(response);
          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            scrape(currentCaseNumber);
          })
        }
        // else if (response.search('session limit') !== -1 && response.search('Case ID') === -1){
        else if (response.search('session limit') !== -1 ){
          //console.log(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_docket_report?case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
          // console.log('session limit',currentCaseNumber)
          // errorList.push(caseNumber);
          //logError(response);
        
          // currentCaseNumber++;
          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            scrape(currentCaseNumber);
          })
          

          // consecutiveCasesNotFound++;

        }else{
  
          response.search('No case was found') === -1 ?
            getDataAndWriteToCSV(response)
            : consecutiveCasesNotFound++;
          currentCaseNumber++
          scrape(currentCaseNumber);
        }
      })
      .catch(err => {
        errorList.push(caseNumber);
        logError(caseNumber);
        logError(err);
        currentCaseNumber++;
        scrape(currentCaseNumber);
      })

      // }, 1000);
  };

  const reinitiateAndFinish = () => { 
    const headerRow = fields.map((field, i) =>
      `${field}${i !== fields.length - 1 ? '' : '\n'}`
    );

    fs.writeFile(filepath, headerRow.toString(), err => {
      err ? console.log(err) : null
    });

    setTimeout(function(){

    new fs.createReadStream(prevFilepath)
      .pipe(csv())
      .on('data', row => {
        const rowObj = new Object(row);
        fs.appendFile(
          filepath,
          fields.map((field, i) =>
            `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
          ).toString(),
          err => err ?
            console.log(err)
            : null
        )
      })
    },10000)
  };

  const nextScrape = () => {
    currentCaseNumber++;
    scrape(currentCaseNumber);
  };

  const extractError = caseNumber => {
    nightmare
      .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_docket_report?case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
      .wait('body')
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        // (response.search('No case was found') === -1 && response.search(/error/i) === -1) ?

        if (response.search('500 Internal Server Error') !== -1 ){
          // errorList.push(caseNumber);
          // logError(caseNumber);

          // errorRescrapeCount++

          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            currentCaseNumber = errorList[errorRescrapeCount];
            scrape(currentCaseNumber);
          })

          

          // consecutiveCasesNotFound++;
        }
        else if (response.search('session limit') !== -1){
          // console.log('session limit',currentCaseNumber)

          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            currentCaseNumber = errorList[errorRescrapeCount];
            scrape(currentCaseNumber);
          })

        }else{

        response.search('No case was found') === -1 ?
          getDataAndWriteToCSV(response)
          : consecutiveCasesNotFound++;
        errorRescrapeCount++
        currentCaseNumber = errorList[errorRescrapeCount];
        scrape(currentCaseNumber);

        }
      })
      .catch(err => {
        errorList.push(caseNumber);
        logError(caseNumber);
        logError(err);
        errorRescrapeCount++;
        currentCaseNumber = errorList[errorRescrapeCount];
        scrape(currentCaseNumber);

      })
  };

  const scrape = caseNumber => {
    consecutiveCasesNotFound < caseNotFoundThreshold ?
      prevList.includes(caseNumber) === false?
        extract(caseNumber)
        :nextScrape()
      : errorList.length > 0 && 
        errorRescrapeCount < errorList.length ?
        extractError(errorList[errorRescrapeCount])
        : scrapeUntilFinalYear()
  };

  const scrapeUntilFinalYear = () => {
    //reset error checker
    consecutiveCasesNotFound = 0;
    errorList = [];
    errorRescrapeCount = 0;
    // go to next year
    year++;
    //reset case number 
    currentCaseNumber = 1;
    prevList = [];
    // if the current year more than final year, stop
    year <= finalYear ?
    calCurrentCaseNumberForYear()
    :nightmare
    .end()
    .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  const getDataAndWriteToCSV = html => {
    consecutiveCasesNotFound = 0;
    const caseRecord = {
      fileDate: null,
      caseID: null,
      plaintiff: null,
      plaintiffAddress: null,
      plaintiffCity: null,
      plaintiffPhone: null,
      plaintiffAttorney: null,
      defendantName1: null,
      defendantAddress1: null,
      defendantCity1: null,
      defendantPhone1: null,
      defendantAttorney1: null,
      defendantName2: null,
      defendantAddress2: null,
      defendantCity2: null,
      defendantPhone2: null,
      defendantAttorney2: null,
      caseStatus: null,
      address: null,
      events: null
    };

    const $ = cheerio.load(html);

    $('table > tbody').each((i, elem) => {
      const tableInfoArray = $(elem)
        .find('tr')
        .text()
        .split('\n')
        .map(item =>
          item
            .trim()
            .replace(/["]/g, '')
        )
        .filter(item =>
          item !== '-NON JURY');

      // console.log(tableInfoArray);

      const fileDate = tableInfoArray[4].replace('Filing Date:', '').trim().split(' ').filter(item => item.length > 2);
      const plaintiffLongAddressArray = tableInfoArray
        .slice(tableInfoArray.indexOf('PLAINTIFF') + 5, tableInfoArray
          .indexOf('PLAINTIFF') + 10)
      const plaintiffLongAddress = plaintiffLongAddressArray
        .slice(0, plaintiffLongAddressArray.indexOf(''));
      const defendantLongAddress1Raw = tableInfoArray.slice(tableInfoArray.indexOf('DEFENDANT') + 5, tableInfoArray.indexOf('DEFENDANT') + 10);
      const defendantLongAddress1 = defendantLongAddress1Raw.slice(0, defendantLongAddress1Raw.indexOf(''));
      const defendantLongAddress2Raw = tableInfoArray.includes('DEFENDANT 2') ?
        tableInfoArray.slice(tableInfoArray.indexOf('DEFENDANT 2') + 5, tableInfoArray.indexOf('DEFENDANT 2') + 10) : [];

      const defendantLongAddress2 = defendantLongAddress2Raw.slice(0, defendantLongAddress2Raw.indexOf(''));

      // console.log(tableInfoArray);

      const plaintiffAddress = [];
      const defendantAddress1 = [];
      const defendantAddress2 = [];

      let plaintiffCity = null;
      let defendantCity1 = null;
      let defendantCity2 = null;

      plaintiffLongAddress.map((item, i) =>
        item.search(' GA ') === -1 ?
          !plaintiffCity ?
            plaintiffAddress.push(item)
          : null 
        : plaintiffCity = item);

      defendantLongAddress1.map((item, i) =>
        item.search(' GA ') === -1 ?
          !defendantCity1 ?
            defendantAddress1.push(item)
            : null : defendantCity1 = item);

      defendantLongAddress2.map((item, i) =>
        item.search(' GA ') === -1 ?
          !defendantCity2 ?
            defendantAddress2.push(item)
            : null : defendantCity2 = item);

      const plaintiffPhone =
        plaintiffLongAddress && plaintiffCity ?
          plaintiffLongAddress[plaintiffLongAddress.indexOf(plaintiffCity) + 1]
          : null;
      const defendantPhone1 =
        defendantLongAddress1 && defendantCity1 ?
          defendantLongAddress1[defendantLongAddress1.indexOf(defendantCity1) + 1]
          : null;
      const defendantPhone2 =
        defendantLongAddress2 && defendantCity2 ?
          defendantLongAddress2[defendantLongAddress2.indexOf(defendantCity2) + 1]
          : null;

      const events = [];

      const addEvents = (i) => 
        tableInfoArray.map((item, i) =>
          item === 'Entry:' ?
            events.push({
              date: moment(tableInfoArray[i - 7], 'DD-MMM-YYYYHH:mm A').format('M/D/YYYY'),
              name: tableInfoArray[i - 6]
            })
            : null
        );

     

      switch (i) {
        case 0:
          caseRecord.caseID = tableInfoArray[1].replace('Case ID:', '').trim();
          break;
        case 1:
          caseRecord.fileDate = moment(`${fileDate[1]} ${fileDate[2]} ${fileDate[3]}`, 'MMMM DDo, YYYY').format('M/D/YY');
          caseRecord.caseStatus = tableInfoArray[tableInfoArray.indexOf('Status:') + 1];
          break;
        case 2:
          if(tableInfoArray.indexOf('PLAINTIFF') > 0){
            caseRecord.plaintiff = tableInfoArray[tableInfoArray.indexOf('PLAINTIFF') + 2];
            caseRecord.plaintiffAddress = plaintiffAddress.join(' ');
            caseRecord.plaintiffCity = plaintiffCity ? plaintiffCity : '';
            caseRecord.plaintiffPhone = plaintiffPhone ? plaintiffPhone : '';
            caseRecord.plaintiffAttorney = tableInfoArray.includes('ATTORNEY FOR PLAINTIFF') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR PLAINTIFF') + 2] : '';
            caseRecord.defendantName1 = tableInfoArray[tableInfoArray.indexOf('DEFENDANT') + 2];
            caseRecord.defendantAddress1 = defendantAddress1.join(' ').replace('  ', ' ').replace('  ', ' ');
            caseRecord.defendantCity1 = defendantCity1 ? defendantCity1 : '';
            caseRecord.defendantPhone1 = defendantPhone1 ? defendantPhone1 : '';
            caseRecord.defendantAttorney1 = tableInfoArray.includes('ATTORNEY FOR DEFENDANT') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR DEFENDANT') + 2] : '';
            caseRecord.address = `${defendantAddress1.join(' ').replace('  ', ' ').replace('  ', ' ')}, ${defendantCity1}`;
            caseRecord.defendantName2 = tableInfoArray.includes('DEFENDANT 2') ?
              tableInfoArray[tableInfoArray.indexOf('DEFENDANT 2') + 2] : '';
            caseRecord.defendantAddress2 = tableInfoArray.includes('DEFENDANT 2') ? defendantLongAddress2.join('').replace('  ', ' ').replace('  ', ' ') : '';
            caseRecord.defendantCity2 = defendantCity2 ? defendantCity2 : '';
            caseRecord.defendantPhone2 = defendantPhone2 ? defendantPhone2 : '';
            caseRecord.defendantAttorney2 = tableInfoArray.includes('ATTORNEY FOR DEFENDANT 2') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR DEFENDANT 2') + 2] : '';
          }
          break;
        case 3:
          if(tableInfoArray.indexOf('PLAINTIFF') > 0){
            caseRecord.plaintiff = tableInfoArray[tableInfoArray.indexOf('PLAINTIFF') + 2];
            caseRecord.plaintiffAddress = plaintiffAddress.join(' ');
            caseRecord.plaintiffCity = plaintiffCity ? plaintiffCity : '';
            caseRecord.plaintiffPhone = plaintiffPhone ? plaintiffPhone : '';
            caseRecord.plaintiffAttorney = tableInfoArray.includes('ATTORNEY FOR PLAINTIFF') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR PLAINTIFF') + 2] : '';
            caseRecord.defendantName1 = tableInfoArray[tableInfoArray.indexOf('DEFENDANT') + 2];
            caseRecord.defendantAddress1 = defendantAddress1.join(' ').replace('  ', ' ').replace('  ', ' ');
            caseRecord.defendantCity1 = defendantCity1 ? defendantCity1 : '';
            caseRecord.defendantPhone1 = defendantPhone1 ? defendantPhone1 : '';
            caseRecord.defendantAttorney1 = tableInfoArray.includes('ATTORNEY FOR DEFENDANT') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR DEFENDANT') + 2] : '';
            caseRecord.address = `${defendantAddress1.join(' ').replace('  ', ' ').replace('  ', ' ')}, ${defendantCity1}`;
            caseRecord.defendantName2 = tableInfoArray.includes('DEFENDANT 2') ?
              tableInfoArray[tableInfoArray.indexOf('DEFENDANT 2') + 2] : '';
            caseRecord.defendantAddress2 = tableInfoArray.includes('DEFENDANT 2') ? defendantLongAddress2.join('').replace('  ', ' ').replace('  ', ' ') : '';
            caseRecord.defendantCity2 = defendantCity2 ? defendantCity2 : '';
            caseRecord.defendantPhone2 = defendantPhone2 ? defendantPhone2 : '';
            caseRecord.defendantAttorney2 = tableInfoArray.includes('ATTORNEY FOR DEFENDANT 2') ?
              tableInfoArray[tableInfoArray.indexOf('ATTORNEY FOR DEFENDANT 2') + 2] : '';
          }else{
            addEvents(i);
            caseRecord.events = events;
          }
            
          break;
        case 4:
          addEvents(i);
          caseRecord.events = events;
          break;
      }
    });


    const writeEventsToCSV = async () => {
      // console.log(caseRecord);
      caseRecord.caseID?getCaseFailCount = 0
      :getCaseFailCount++

      // console.log("navigationFailCount:",getCaseFailCount)
      getCaseFailCount< 20?
        null
        :nightmare
          .end()
          .then(
            
            reinitiateAndFinish(),
            console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`)
          )

      const events = await caseRecord.events;
      events ?
        events.forEach((event, i) =>
          fs.appendFile(filepath,
            eventToCsvRow(fields, caseRecord, event, i).toString(),
            err => {
              err ? console.log(err) : null
            }
          )
        ) : console.log(`No events for case ${caseRecord.caseID}`);
    };

    if (caseRecord.caseID){
      writeEventsToCSV();
    }else{
      scrape(currentCaseNumber);
    }
  };

  const calCurrentCaseNumberForYear = () =>{
    new fs.createReadStream(prevFilepath)
        .pipe(csv())
        .on('data', row => {
          const rowObj = new Object(row);
          const caseNumber = parseInt(rowObj['caseID'].slice(5));

          var dateCutOff = new Date();
          dateCutOff.setMonth(dateCutOff.getMonth() - 3);
          dateCutOff.setDate(1);
          var dateCase = new Date(rowObj['fileDate']);

          if (rowObj['caseID'].slice(0, 2) == year.toString().slice(2)){

          onlynew 
             ?
          fs.appendFile(
            filepath,
            fields.map((field, i) =>
              `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
            ).toString(),
            err => err ?
              console.log(err)
              : null
          ): dateCase < dateCutOff ? 
          fs.appendFile(
            filepath,
            fields.map((field, i) =>
              `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
            ).toString(),
            err => err ?
              console.log(err)
              : null
          ): null;

          onlynew ?
          !prevList.includes(caseNumber) ?
            prevList.push(caseNumber)
            : null
          : (dateCase < dateCutOff)?
              // PUSH OPEN (NON-CLOSED) CASES TO ARRAY TO LIMIT SCRAPER TO ONLY THOSE CASES
              !prevList.includes(caseNumber) ?
              prevList.push(caseNumber)
              : null 
            : null;
          }
        })
        .on('end', () => {
          prevList.length > 0?
          currentCaseNumber = prevList.sort(function(a, b) { return b - a; })[10]
          :currentCaseNumber = 1
       
          // year = finalYear;
          scrape(currentCaseNumber);
        })
  }

  const initiate = () => {
    fs.writeFile(filepath, headerRow.toString(), err => {
      err ? console.log(err) : null
    });
    
    setTimeout(function(){
      !fresh && 
      prevFilepath ?
      calCurrentCaseNumberForYear()
        : scrape(currentCaseNumber);
    },10000)
  };

  initiate();
}
