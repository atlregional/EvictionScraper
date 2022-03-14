// IMPORT DEPENDENCIES
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
var Nightmare = require('nightmare');
require('nightmare-window-manager')(Nightmare)
const moment = require('moment');
const fs = require('fs');
const initiate = require('../utils/initiate');

// IMPORT UTILITY MODULES
const caseEventsToCSV = require('../utils/caseEventsToCSV');
const cheerio = require('cheerio');

Nightmare.action('clearCache',
  function(name, options, parent, win, renderer, done) {
 
    parent.respondTo('clearCache', function(done) {
      win.webContents.session.clearCache(done);
      done();
    });
    done();
  },
  function(done) {
  
    this.child.call('clearCache', done);
});

// EXPORT ODYSSEY SCRAPER MODULE
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
  const startURL = config.starturl;
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

  // FUNCTION TO LOG CASE NUMBER OF ERRORS TO CSV
  const logError = (caseNumber, err) => {
    var caseID = `${year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`;

    fs.appendFile(errorListFilepath,
    `${caseID}, ${err} \n`
    , err => err ? console.log(err) : null);
  };


  const nextSearch = () => {

    currentCaseNumber++;

    consecutiveErrors < consecutiveErrorThreshold
      ? fresh || 
        onlynew || 
        currentCaseNumber > lastScrapeEnd ||
        (currentCaseNumber <= lastScrapeEnd && updateList.includes(currentCaseNumber)) 
        ? nightmare
            .clearCache()
            .goto(startURL)
            .wait('body')
            .wait(`a[href="${config.searchpath}"]`)
            .click(`a[href="${config.searchpath}"]`)
            .wait("input[name='caseCriteria.SearchCriteria']")
            .then(() => extract(currentCaseNumber))
            .catch(err => {
              consecutiveErrors++;
              console.log("consecutiveErrors", consecutiveErrors);
              console.log("currentCaseNumber",currentCaseNumber);
              logError(currentCaseNumber, err);
              nextSearch();
            })
        : nextSearch()
      : nightmare
          .end()
          .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  const getCaseRecord = (searchResultRow, caseID, eventDetails) => {
    // console.log(searchResultRow)
    const $ = cheerio.load(searchResultRow);

    const fileDate = $(`.k-master-row`).find('span').text();
    const caseStatus = $(`.party-case-status`).text();
    const names = $(`.k-master-row`).find('div').text().split("vs.");
    const eventList = [];

    if (eventDetails) {
      const $ = cheerio.load(eventDetails);
      $(`.roa-event-info`).each((index, tr ) => {
        var eventName;

        if($('.roa-event-date-col',tr).text()){
        
          const eventDate = $('.roa-event-date-col',tr).text().split("\n")
          .map((item) => item.trim().replace(/["]/g, ''))
          .filter(item => item !== '').toString();

          if($('[data-rem-class="roa-event-content"]',tr).text()){
            eventName = $('[data-rem-class="roa-event-content"]',tr).text().split("\n")
            .map((item) => item.trim().replace(/["]/g, ''))
            .filter(item => item !== '').toString();
          }else{
            eventName = $('.roa-event-content',tr).text().split("\n")
            .map((item) => item.trim().replace(/["]/g, ''))
            .filter(item => item !== '').toString();
          }

          eventList.push({
            date: eventDate,
            name: eventName,
          })
        }else{
          return null;
        }
      })
    }

    const caseRecordObjFulton = {
            fileDate: fileDate,
            caseID: caseID,
            plaintiff: names[0].replace(/"/g, "\'"),
            plaintiffAddress: '',
            plaintiffCity: '',
            plaintiffPhone: '',
            plaintiffAttorney: '',
            defendantName1: names[1].replace(/"/g, "\'"),
            defendantAddress1: '',
            defendantCity1: '',
            defendantPhone1: '',
            defendantAttorney1: '',
            defendantName2: '',
            defendantAddress2: '',
            defendantCity2: '',
            defendantPhone2: '',
            defendantAttorney2: '',
            caseStatus: caseStatus,
            address: '',
            judgmentType: '',
            judgmentFor:'',
            judgmentComp: '',
            events: eventList,
          };

    return caseRecordObjFulton;
  };

  // FUNCTION TO SEARCH BY CASE NUMBER AND RUN EXTRACTOR
  const extract = caseNumber => {
    var caseID = `${year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`;
    nightmare
      .wait("#btnSSSubmit")
      .evaluate(() =>
        document.querySelector(
          "input[name='caseCriteria.SearchCriteria']"
        ).value = null
      )
      .insert("input[name='caseCriteria.SearchCriteria']", caseID)
      .click("#btnSSSubmit")
      .wait('tr.k-master-row')
      .wait(`a[title='${caseID}']`)
      .evaluate(() => document.querySelector('#CasesGrid').innerHTML)
      .then(searchResultRow => {
        nightmare
          .windowManager() 
          .click(`a[title='${caseID}']`)
          .waitWindowLoad()
          .currentWindow()
          .then(window => {
            nightmare
            .goto(window.url)
            .wait(`div[ng-if='(data.combinedEvents.Count > 0)']`)
            .wait('div.roa-event-info')
            .evaluate(() => document.querySelector(`div[ng-if='(data.combinedEvents.Count > 0)']`).innerHTML)
            .then(eventDetails => {
              const caseRecord =  getCaseRecord(searchResultRow,caseID,eventDetails)
              caseEventsToCSV(caseRecord, filepath, fields)
              consecutiveErrors = 0;
              nextSearch();
            }).catch(err => {
              console.Con
              if (!`${err}`.includes('(data.combinedEvents.Count > 0)') &&
                  !`${err}`.includes('roa-event-info')) {
                consecutiveErrors++;
                console.log("consecutiveErrors", consecutiveErrors);
                console.log("currentCaseNumber",currentCaseNumber);
                logError(currentCaseNumber, err);;
                nextSearch();
              } else {
                const caseRecord =  getCaseRecord(searchResultRow,caseID)
                caseEventsToCSV(caseRecord, filepath, fields)
                consecutiveErrors = 0;
                nextSearch();
              }
            })
          })
      })      
      .catch(err => {
        consecutiveErrors++;
        console.log("consecutiveErrors", consecutiveErrors);
        console.log("currentCaseNumber",currentCaseNumber);
        logError(currentCaseNumber, err);
        nextSearch();
      })
  };

  // FUNCTION TO HANDLE SCRAPE SEQUENCE AND ENDING
  const scrape = caseNumber => {
    consecutiveErrors < consecutiveErrorThreshold 
      ? fresh ||
        onlynew ||
        caseNumber > lastScrapeEnd ||
        (caseNumber <= lastScrapeEnd && updateList.includes(caseNumber))
          ? extract(caseNumber)
          : nextSearch()
      : nightmare
        .end()
        .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  var loginFailCount = 0;

  // FUNCTION TO LOGIN WITH TYLER ACCOUNT
  const odysseyLogin = ({currentCaseNumber, USERNAME, PASSWORD}) => 
    new Promise((resolve, reject) => {
      nightmare
        .goto(startURL)
        .wait('body')
        .wait(`a[href="${config.loginpath}"]`)
        .click(`a[href="${config.loginpath}"]`)
        .insert('#UserName', USERNAME)
        .insert('#Password', PASSWORD)
        .click('button')
        .wait(`a[href="${config.searchpath}"]`)
        .click(`a[href="${config.searchpath}"]`)
        .then(()=> resolve(currentCaseNumber))
        .catch(err => reject(err))
    });

  // INITIATE FILES, LOGIN, and BEGIN SCRAPING
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
      odysseyLogin({
        nightmare: nightmare,
        currentCaseNumber: currentCaseNumber,
        USERNAME: process.env.USERNAME,
        PASSWORD: process.env.PASSWORD,
        config: config,
        startURL: startURL
      })
        .then(startCaseNumber => scrape(startCaseNumber))
        .catch(err =>{ 

          console.log("loginFailCount",loginFailCount);
          console.log("currentCaseNumber",currentCaseNumber);
          logError(currentCaseNumber,`FATAL LOGIN ${err}`);
  
          nightmare
            .end()
            .then(() =>
              console.log(`${county} County Scrape Failed @ ${moment().format('hh:mm [on] M/D/YY')}`)
            )
          
        })
  }).catch(err => console.log('Error initiating:', err));
  
}

