const Nightmare = require('nightmare');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const initiate = require('../utils/initiate');
const caseEventsToCSV = require('../utils/caseEventsToCSV');


module.exports = config => {
  // INITIATE WEB DRIVER
  var nightmare = new Nightmare(
    {
      show: config.show,
      waitTimeout: config.timeout ? config.timeout : 20000
    }
  );

  // SET FILE LABEL VARIABLES
  const scrapeDate = moment().format('MM-DD-YYYY');
  const scrapeTimeStart = moment().format('h:mm A');

  // GET CONFIG INFO 
  const append = config.append; 
  const county = config.name;
  // const startURL = config.starturl;
  const dev = config.dev;
  const startCase = config.startcase || 1;
  var year = config.year || 2022;
  const fresh = config.fresh;
  const onlynew = config.onlynew;
  const fields = config.fields;
  const consecutiveErrorThreshold = config.errorthreshold || 35;
  const closedCasesTerm = config.closedcasesterm;
  const caseNumberSliceIndex = config.casenumbersliceindex;
  const monthsToRescrape = config.monthstorescrape || 2;
  // const dispossessoryTerm = config.dispossessoryterm
  
  // GET FILEPATH OF PREVIOUS SCRAPE 
  const prevFileList = fs.readdirSync('./csvs/prev-scrape/');
  const prevFileName = 
    prevFileList.length > 0 &&
      prevFileList.find(filename => 
        filename.search(county) >= 0) ?
      prevFileList.find(filename => 
        filename.search(county) >= 0)
    : null;
  const prevFilepath =
    !fresh ?
      prevFileName ?
        `./csvs/prev-scrape/${prevFileName}`
        : config.prevfilepath
      : null;

  // SET FILEPATHS FOR SCRAPE AND ERROR LOG CSVS
  const errorListFilepath = `./csvs/errorlogs/${year}${county}CountyScrape-ERROR-LIST.csv`;
  const filename = `${dev ? 'DEV-' : ''}${year}${county}CountyEvictionCaseEvents-SCRAPE-${scrapeDate}`;
  const filepath = `./csvs/${dev ? 'dev/' : 'current-scrape/'}${filename}.csv`;

  // INITIATE ARRAYS, CONTROLS, AND COUNTERS 
  var updateList = [];
  let currentCaseNumber = startCase;
  let consecutiveErrors = 0;
  let lastScrapeEnd = 0;


  const logError = (caseNumber, err) => {
    const caseID = `${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}`
    
    fs.appendFile(errorListFilepath,
      `${caseID}, ${err} \n`
      , err => err ? console.log(err) : null);
  };

  const navigation = caseNumber => {
    const caseID = `${year.toString().slice(2)}-E-${caseNumber.toString().padStart(5, '0')}`
    nightmare
      .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_docket_report?case_id=${caseID}&begin_date=&end_date=`)
      .wait('body')
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        if (response.includes('500 Internal Server Error')){
          consecutiveErrors++;
          console.log("consecutiveErrors", consecutiveErrors);
          console.log("currentCaseNumber",currentCaseNumber);
          logError(currentCaseNumber, 'BAD RESPONSE: 500 Internal Server Error');
  
          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${caseID}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            scrape(currentCaseNumber);
          })
        }
        else if (response.includes('session limit')){
          consecutiveErrors++;
          console.log("consecutiveErrors", consecutiveErrors);
          console.log("currentCaseNumber",currentCaseNumber);
          logError(currentCaseNumber, 'BAD RESPONSE: session limit');
  
          nightmare
          .goto(`https://courtconnect.cobbcounty.org:4443/ccmag/ck_public_qry_doct.cp_dktrpt_srch_setup?backto=&case_id=${caseID}&begin_date=&end_date=`)
          .wait('body')
          .then(() => {
            scrape(currentCaseNumber);
          })
        }else{
          !response.includes('No case was found')
            ? ( extract(response)
                  .then(caseRecord =>
                    caseEventsToCSV(caseRecord, filepath, fields)
                  ), consecutiveErrors=0)
            : ( consecutiveErrors++,
                console.log("consecutiveErrors", consecutiveErrors),
                console.log("currentCaseNumber",currentCaseNumber),
                logError(currentCaseNumber, 'BAD RESPONSE: session limit'))
          
          currentCaseNumber++
          scrape(currentCaseNumber);
        }
      })
      .catch(err => {
        consecutiveErrors++;
        console.log("consecutiveErrors", consecutiveErrors);
        console.log("currentCaseNumber",currentCaseNumber);
        logError(currentCaseNumber, err);
        currentCaseNumber++;
        scrape(currentCaseNumber);
      })

      // }, 1000);
  };


  const extract = async html => {
    // console.log(html);
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
          item === 'Entry:'
            ? events.push({
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

    return caseRecord;

    


    // const writeEventsToCSV = async () => {
    //   // console.log(caseRecord);
    //   // caseRecord.caseID
    //   //   ? getCaseFailCount = 0
    //   //   : getCaseFailCount++

    //   // console.log("navigationFailCount:",getCaseFailCount)
    //   // getCaseFailCount< 20?
    //   //   null
    //   //   :nightmare
    //   //     .end()
    //   //     .then(
            
    //   //       reinitiateAndFinish(),
    //   //       console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`)
    //   //     )

    //   // const events = await caseRecord.events;
    //   // caseEventsToCSV(caseRecord, filepath, fields);

    //   // if (events) { events.forEach((event, i) =>
    //   //       fs.appendFile(filepath,
    //   //         eventToCsvRow(fields, caseRecord, event, i).toString(),
    //   //         err => {
    //   //           err ? console.log(err) : null
    //   //         }
    //   //       )
    //   //     ) 
    //   // } else {
    //   //   fs.appendFile(filepath,
    //   //     eventToCsvRow(fields, caseRecord, {name: '', date: '', description: ''}, -1).toString(),
    //   //     err => {
    //   //       err ? console.log(err) : null
    //   //     }
    //   //   )
    //   // }
    // };

    // if (caseRecord.caseID){
    //   caseEventsToCSV(caseRecord, filepath, fields);
    // }else{
    //   scrape(currentCaseNumber);
    // }
  };

  // FUNCTION TO CONTROL SCRAPER
  const scrape = caseNumber => {
    consecutiveErrors < consecutiveErrorThreshold 
      ? fresh ||
        onlynew ||
        caseNumber > lastScrapeEnd ||
        (caseNumber <= lastScrapeEnd && updateList.includes(caseNumber))
          ? navigation(caseNumber)
          : (currentCaseNumber++, scrape(currentCaseNumber))
      : nightmare
        .end()
        .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  initiate({
    startCase: startCase,
    prevFilepath: prevFilepath,
    monthsToRescrape :monthsToRescrape,
    fresh: fresh,
    onlynew: onlynew,
    year: year,
    county: county,
    closedCasesTerm: closedCasesTerm,
    fields: fields,
    filepath: filepath,
    caseNumberSliceIndex: caseNumberSliceIndex,
    append: append
  }).then(obj => {
      console.log(`Scrape of ${county} County started @ ${scrapeTimeStart} on ${scrapeDate}`);
      console.log('Initiation object:',obj);
      updateList = obj.updateList;
      lastScrapeEnd = obj.lastScrapeEnd;
      currentCaseNumber = obj.currentCaseNumber;
      scrape(currentCaseNumber);

  }).catch(err => console.log('Error initiating:', err));
}

