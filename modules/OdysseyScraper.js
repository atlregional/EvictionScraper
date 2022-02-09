// IMPORT DEPENDENCIES
// change the location of the .env
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });


var Nightmare = require('nightmare');
require('nightmare-window-manager')(Nightmare)
const moment = require('moment');
const fs = require('fs');
const csv = require('csv-parser');

// IMPORT UTILITY MODULES
const extractCaseRecord = require('../utils/extractCaseRecord');
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
  const county = config.name;
  const startURL = config.starturl;
  const dev = config.dev;
  const startCase = config.startcase ? config.startcase : 1;
  var year = config.year ? config.year.toString() : '2020';
  const finalYear = config.finalYear ? config.finalYear.toString() : '2020';
  const errorCleanup = config.errorcleanup;
  const fresh = config.fresh;
  const onlynew = config.onlynew;
  const fields = config.fields;
  const consecutiveErrorThreshold = config.errorthreshold ? config.errorthreshold : 35;
  const consecutiveEventErrorThreshold = 10;
  const closedCasesTerm = config.closedcasesterm;
  const caseNumberSliceIndex = config.casenumbersliceindex;
  const dispossessoryTerm = config.dispossessoryterm ? config.dispossessoryterm : null
  
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
  var errorList = [];
  
  let errorScrape = false;
  let currentCaseNumber = startCase;
  let consecutiveErrors = 0;
  let lastScrapeEnd = 0;
  let errorCasesScraped = 0;
  let errorScraperCounting = 0;
  let errorScraperLimit = 200;
  let navigationFailCount = 0;

  // FUNCTION TO LOG CASE NUMBER OF ERRORS TO CSV
  const logError = caseNumber => {
    var caseID = "";

    if (county == "Fulton"){
       caseID = `${year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "DeKalb"){
       caseID = `${year.toString().slice(2)}D${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "Gwinnett"){
       caseID =  `${year.toString().slice(2)}-M-${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "Chatham"){
      caseID =  `MGCV${year.toString().slice(2)}-${caseNumber.toString().padStart(5, '0')}`;
   }
    

    fs.appendFile(errorListFilepath,
    `${caseID}` + '\n'
    , err => err ? console.log(err) : null);
  };

  // FUNCTION TO MOVE TO THE CASE SEARCH
  const nextSearch = () => {
    !errorScrape ? 
      currentCaseNumber++ 
    : errorCasesScraped++ ;
    // console.log(currentCaseNumber)
    nightmare
      .wait('#tcControllerLink_0')
      .click('#tcControllerLink_0')
      .wait("input[name='caseCriteria.SearchCriteria']")
      .evaluate(() =>
        document.querySelector(
          "input[name='caseCriteria.SearchCriteria']"
        ).value = null)
      .then(() => scrape(
        !errorScrape ? 
          currentCaseNumber 
          : errorList[errorCasesScraped]
        )
      )
      .catch(err => {
        console.log("next search fail");
        console.log(err);
        
            // !errorScrape ? consecutiveErrors++ : null;
            console.log(consecutiveErrors, currentCaseNumber)
            // console.log('Hit fatal navigation error on: ', currentCaseNumber);
            // console.log('Restarting application');

            // fresh ||
            // onlynew ||
            // currentCaseNumber > lastScrapeEnd ||
            // currentCaseNumber <= lastScrapeEnd &&
            // updateList.includes(currentCaseNumber) ?
            // nightmare
            // .goto(startURL)
            // .wait('body')
            // .wait(`a[href="${config.searchpath}"]`)
            // .click(`a[href="${config.searchpath}"]`)
            // .then(() => scrape(currentCaseNumber))
            // .catch(err2 => {
            //   console.log("restart after next search fail");
            //   console.log(err2)
            //   nightmare
            //   .goto(startURL)
            //   .wait('body')
            //   .wait(`a[href="${config.loginpath}"]`)
            //   .click(`a[href="${config.loginpath}"]`)
            //   .insert('#UserName', process.env.USERNAMEE)
            //   .insert('#Password', process.env.PASSWORD)
            //   .click('button')
            //   .wait(`a[href="${config.searchpath}"]`)
            //   .click(`a[href="${config.searchpath}"]`).
            //   then(() => scrape(currentCaseNumber))
            //   .catch(err3 => {
            //     console.log("login after next search fail");
            //     console.log(err3);
                reLoginScrape();
            //    });
          
            // })
            // :decideIfScrapeForReloginScrape()

      })
  };

  const decideIfScrapeForReloginScrape = () => {
    !errorScrape ? 
    currentCaseNumber++ 
    : errorCasesScraped++ ;

    fresh ||
    onlynew ||
    currentCaseNumber > lastScrapeEnd ||
    currentCaseNumber <= lastScrapeEnd &&
    updateList.includes(currentCaseNumber) ?
    extract(!errorScrape ? 
      currentCaseNumber 
      : errorList[errorCasesScraped])
    :decideIfScrapeForReloginScrape()

  };



  const nextSearchFulton = () => {
    !errorScrape ? 
      currentCaseNumber++ 
    : errorCasesScraped++ ;
    // console.log(currentCaseNumber)
    // console.log("nextSearchFulton")

    errorCleanup &&
    consecutiveErrors === consecutiveErrorThreshold ?
      errorScrape = true 
    : null;



    consecutiveErrors < consecutiveErrorThreshold ?
      fresh ||
      onlynew ||
      currentCaseNumber > lastScrapeEnd ||
      currentCaseNumber <= lastScrapeEnd &&
      updateList.includes(currentCaseNumber) ?
      nightmare
      .clearCache()
      .goto(startURL)
      .wait('body')
      .wait(`a[href="${config.searchpath}"]`)
      .click(`a[href="${config.searchpath}"]`)
      .wait("input[name='caseCriteria.SearchCriteria']")
      // .evaluate(() =>
      //   document.querySelector(
      //     "input[name='caseCriteria.SearchCriteria']"
      //   ).value = null)
      .then(() => extract(
        !errorScrape ? 
          currentCaseNumber 
          : errorList[errorCasesScraped]
        )
      )
      .catch(err => {
        console.log("next search fail fulton");
        console.log(err);
        
            // !errorScrape ? consecutiveErrors++ : null;
            console.log(consecutiveErrors, currentCaseNumber)
            // console.log('Hit fatal navigation error on: ', currentCaseNumber);
            // console.log('Restarting application');

            // nightmare
            // .goto(startURL)
            // .wait('body')
            // .wait(`a[href="${config.searchpath}"]`)
            // .click(`a[href="${config.searchpath}"]`)
            // .then(() => extract(currentCaseNumber))
            // .catch(err2 => {
            //   console.log("restart after next search fail");
            //   // console.log(err2)
            //   nightmare
            //   .goto(startURL)
            //   .wait('body')
            //   .wait(`a[href="${config.loginpath}"]`)
            //   .click(`a[href="${config.loginpath}"]`)
            //   .insert('#UserName', process.env.USERNAMEE)
            //   .insert('#Password', process.env.PASSWORD)
            //   .click('button')
            //   .wait(`a[href="${config.searchpath}"]`)
            //   .click(`a[href="${config.searchpath}"]`).
            //   then(() => extract(currentCaseNumber))
            //   .catch(err3 => {
            //     console.log("login after next search fail");
                // console.log(err3);
                reLoginScrapeFulton();
            //    });
          
            // })

      })
      : nextSearchFulton()
    : errorScrape &&
      // errorList.length - consecutiveErrorThreshold > 0 && 
      errorCasesScraped < errorList.length ?
      unlimitedTryForErrorList()
      : scrapeUntilFinalYear()

    
  };

  const trySearchAgain = () => {

    nightmare
      .wait('#tcControllerLink_0')
      .click('#tcControllerLink_0')
      .wait("input[name='caseCriteria.SearchCriteria']")
      .evaluate(() =>
        document.querySelector(
          "input[name='caseCriteria.SearchCriteria']"
        ).value = null)
      .then(() => scrape(
        !errorScrape ? 
          currentCaseNumber 
          : errorList[errorCasesScraped]
        )
      )
      .catch(err => {
        //can not find the smart search button 
        console.log("trySearchAgain fail");
        console.log(err);
        // !errorScrape ? consecutiveErrors++ : null;
        console.log(consecutiveErrors, currentCaseNumber)
        console.log('Hit fatal navigation error on: ', currentCaseNumber);
        console.log('Restarting application');

     
        reLoginScrape()
        

      })
  };

  const addIDOnlyForFulton = (searchResultRow, caseID, caseDetailsHTML) => {
    // console.log(searchResultRow)
    var $ = cheerio.load(searchResultRow);

    const fileDate = $(`.k-master-row`).find('span').text();
    const caseStatus = $(`.party-case-status`).text();
    const names = $(`.k-master-row`).find('div').text().split("vs.");

    $ = cheerio.load(caseDetailsHTML);

    const eventList = [];
    var eventName;

    $(`.roa-event-info`).each((index, tr ) => {

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
  }

  const addSummaryOnlyForFulton = (searchResultRow, caseID) => {
    // console.log(searchResultRow)
    var $ = cheerio.load(searchResultRow);

    const fileDate = $(`.k-master-row`).find('span').text();
    const caseStatus = $(`.party-case-status`).text();
    const names = $(`.k-master-row`).find('div').text().split("vs.");

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
            //events: '',
          };

          fs.appendFile(
            filepath,
            fields.map((field, i) =>
             `"${caseRecordObjFulton[field] ? caseRecordObjFulton[field] : ''}"${i !== fields.length - 1 ? '' : '\n'}`
             ).toString(),
            (err) => {
              err ? console.log(err) : null;
            }
          )  
 
  }

  // FUNCTION TO SEARCH BY CASE NUMBER AND RUN EXTRACTOR
  const extract = caseNumber => {
    var caseID = "";
   
    if (county == "Fulton"){
       caseID = `${year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "DeKalb"){
       caseID = `${year.toString().slice(2)}D${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "Gwinnett"){
       caseID =  `${year.toString().slice(2)}-M-${caseNumber.toString().padStart(5, '0')}`;
    }else if(county == "Chatham"){
      caseID =  `MGCV${year.toString().slice(2)}-${caseNumber.toString().padStart(5, '0')}`;
   }
    // console.log("extract")
    // console.log(caseID)
    nightmare
      .wait("#btnSSSubmit")
      .evaluate(() =>
        document.querySelector(
          "input[name='caseCriteria.SearchCriteria']"
        ).value = null)
      .insert(
        "input[name='caseCriteria.SearchCriteria']", 
        caseID
      )
      //for random error first click submit button does not work 
      .click("#btnSSSubmit")
      .wait('tr.k-master-row')
      .wait(`a[title='${caseID}']`)
      .evaluate(() =>
        document.querySelector('#CasesGrid').innerHTML
      )
      .then(searchResultRow => {
        
        const isDispossessory = 
          dispossessoryTerm &&
          searchResultRow ?
            searchResultRow.search(dispossessoryTerm) !== -1
          : true;


        var caseMatch = true;
        
        // console.log(isDispossessory)
        isDispossessory ? 
          county === 'Fulton' ? 
        //addIDOnlyForFulton(searchResultRow,caseID)
          nightmare
            .windowManager() 
            .click(`a[title='${caseID}']`)
            .waitWindowLoad()
            .currentWindow()
            .then(function(window){
              //window contains useful information about the newly-opened window,
              //including the window ID

              nightmare
              .goto(window.url)
              .wait(`div[ng-if='(data.combinedEvents.Count > 0)']`)
              .evaluate(() => document.querySelector(`div[ng-if='(data.combinedEvents.Count > 0)']`).innerHTML)
              .then(caseDetailsHTML => {
                
                const caseRecord =  addIDOnlyForFulton(searchResultRow,caseID,caseDetailsHTML)
                // console.log(caseRecord)
                //handle clicking id to event page, the server response fail
                if (caseRecord.events.length > 0){
                  caseEventsToCSV(caseRecord, filepath, fields)
                  !errorScrape ? consecutiveErrors = 0 : null;
                  navigationFailCount = 0;

                   // go to the next id by visit the homepage as there is no back button
                  nextSearchFulton()
                }else{
                  // console.log("event page reponse error, rescape")
                  // console.log(consecutiveErrors, currentCaseNumber)
                  !errorScrape ? consecutiveErrors++ : null;
                  if(consecutiveErrors < consecutiveEventErrorThreshold){
                    reLoginScrapeFulton()
                  }else{
                    // errorList.push(caseNumber);
                    console.log("retry failed!")
                    console.log(errorList)
                    !errorScrape ? consecutiveErrors = 0 : null;
                    if(updateList.includes(caseNumber)){
                      // errorList.push(caseNumber);
                
                      reLoginScrapeFulton()
                    
                    }else{
                      errorListhandler(caseNumber);
                      nextSearchFulton();

                    }
                    
                  }
                }
                  

              }).catch(err => {
                // failed on getting case details for fulton
                console.log("failed on getting case details for fulton") 
                console.log(err)
                // !errorScrape ? errorList.push(currentCaseNumber) : null;
                !errorScrape ? consecutiveErrors++ : null;
                console.log(consecutiveErrors, caseNumber)
                // logError(caseNumber);

                if(consecutiveErrors < 3){
                  reLoginScrapeFulton()
                }else{
                  addSummaryOnlyForFulton(searchResultRow,caseID);
              
                  !errorScrape ? consecutiveErrors = 0 : null;
                  nextSearchFulton();
                }
                
              })
            })
          :nightmare 
            .wait(`a[title='${caseID}']`)
          //for random error first click case id does not work 
            .click(`a[title='${caseID}']`)
            .wait(`#${config.divIDs.caseInfo}`)
            .evaluate(() => document.querySelector('body').innerHTML)
            .then(caseDetailsHTML => {
              const caseRecord = extractCaseRecord(caseDetailsHTML, config);

              navigationFailCount = 0;

              caseRecord.caseID == caseID?
              caseEventsToCSV(caseRecord, filepath, fields)
              :caseMatch = false

              caseMatch?
              null
              :trySearchAgain()
            })
            .then(() => {      
              !errorScrape ? consecutiveErrors = 0 : null;
              caseMatch?      
              nextSearch()
              :null
            })
            .catch(err => {
              // long waiting time then time out
              console.log("long waiting time then time out") 
              console.log(err)
              // !errorScrape ? errorList.push(currentCaseNumber) : null;
              !errorScrape ? consecutiveErrors++ : null;
              console.log(consecutiveErrors, caseNumber)
              // logError(caseNumber);
              consecutiveErrors < consecutiveEventErrorThreshold?
              reLoginScrape():
              nextSearch()
            })
          
        : (county === 'Fulton' ? 
            nextSearchFulton()
            :nextSearch()
          );
      })      
      .catch(err => {
        console.log(err)
        navigationFailCount = 0;
        nightmare
        .evaluate(() => document.querySelector('body').innerHTML)
        .then(errorsHTML => {
         
          if (errorsHTML.search('No cases match your search') !== -1){
              // no case match case id
            console.log("no case match case id")

            
            // handle case ID has been changed in the system 
            if(updateList.includes(caseNumber) && consecutiveErrors < consecutiveEventErrorThreshold){
              // errorList.push(caseNumber);
              county === 'Fulton' ? 
              reLoginScrapeFulton()
              :reLoginScrape()
              
            }
            //errorList.push(caseNumber);
            
            !errorScrape ? consecutiveErrors++ : null;
          
          }else{
            console.log("server error")
            updateList.includes(caseNumber)?
            county === 'Fulton' ? 
              reLoginScrapeFulton()
              :reLoginScrape()
            :errorListhandler(caseNumber);
          }

          console.log(consecutiveErrors, caseNumber);

          console.log(errorList);
          // logError(caseNumber);
          updateList.includes(caseNumber) && consecutiveErrors < consecutiveEventErrorThreshold?
          null
          :county === 'Fulton' ? 
              nextSearchFulton()
              :nextSearch()
          ;

        })
        .catch(err2 => {
          console.log(err2)
          console.log("not sure if no id match or server error")
          !errorScrape ? consecutiveErrors++ : null;

          updateList.includes(caseNumber)?
            county === 'Fulton' ? 
              reLoginScrapeFulton()
              :reLoginScrape()
            :errorListhandler(caseNumber);

          console.log(consecutiveErrors, caseNumber)
          console.log(errorList)
          // logError(caseNumber);
          updateList.includes(caseNumber)?
          null
          :county === 'Fulton' ? 
              nextSearchFulton()
              :nextSearch()
          ;
        })


        
      })
    
  };

  // handling the endless scraping for some odd cases
  const errorListhandler= caseNumber => {
    errorScrape?
    errorScraperCounting++
    :null

    errorScraperCounting < errorScraperLimit?
    errorList.push(caseNumber)
    :logError(caseNumber)
  }

  // FUNCTION TO CONTROL SCRAPER
  const scrape = caseNumber => {
    errorCleanup &&
    consecutiveErrors === consecutiveErrorThreshold ?
      errorScrape = true 
    : null;

    errorScrape?
    console.log(errorList[errorCasesScraped])
    :null

    errorScrape?
    console.log(errorList)
    :null

    consecutiveErrors < consecutiveErrorThreshold ?
      fresh ||
      onlynew ||
      caseNumber > lastScrapeEnd ||
      caseNumber <= lastScrapeEnd &&
      updateList.includes(caseNumber) ?
        extract(caseNumber)
      : nextSearch()
    : errorScrape &&
      // errorList.length - consecutiveErrorThreshold > 0 && 
      errorCasesScraped < errorList.length ?
      extract(errorList[errorCasesScraped])
      : scrapeUntilFinalYear()
  };

  const unlimitedTryForErrorList = () =>{
    
    // console.log(errorScrape)
    
    console.log(errorList[errorCasesScraped])
    console.log(errorList)

    nightmare
        .end()
        .then(
          // console.log('refresh nighmare session')
          )

    nightmare = new Nightmare(
      {
        show: config.show,
        waitTimeout: config.timeout ? config.timeout : 20000
      }
    );

    nightmare
      .goto(startURL)
      .wait('body')
      .click(`a[href="${config.loginpath}"]`)
      .insert('#UserName', process.env.USERNAMEE)
      .insert('#Password', process.env.PASSWORD)
      .click('button')
      .wait(`a[href="${config.searchpath}"]`)
      .click(`a[href="${config.searchpath}"]`)
      .then(() => scrape(!errorScrape ? 
        currentCaseNumber 
        : errorList[errorCasesScraped]
        ))
      .catch(err => {
        // console.log(err)
        // !errorScrape ? errorList.push(currentCaseNumber) : null;
        // !errorScrape ? consecutiveErrors++ : null;
        console.log(consecutiveErrors, errorList[errorCasesScraped])
        // logError(errorList[errorCasesScraped]);
        // consecutiveErrors < consecutiveErrorThreshold ?
        unlimitedTryForErrorList();
        // : scrapeUntilFinalYear()
      });
  }

  // FUNCTION TO LOGIN WITH TYLER ACCOUNT
  const login = () => {
    nightmare
      .goto(startURL)
      .wait('body')
      .click(`a[href="${config.loginpath}"]`)
      .insert('#UserName', process.env.USERNAMEE)
      .insert('#Password', process.env.PASSWORD)
      .click('button')
      .wait(`a[href="${config.searchpath}"]`)
      .click(`a[href="${config.searchpath}"]`)
      .then(()=>{
        initiate();
      })
      .catch(err => {
        console.log(err)
        console.log("login fail:",navigationFailCount)
        // !errorScrape ? errorList.push(currentCaseNumber) : null;
        // !errorScrape ? consecutiveErrors++ : null;
        // loginFailCount++;
        // // logError(currentCaseNumber);
        // loginFailCount < 20 ?
        // login()
        // : scrapeUntilFinalYear()
        navigationFailCount ++;
        navigationFailCount< 60?
        nightmare
        .end()
        .then(() => {
          nightmare = new Nightmare(
            {
              show: config.show,
              waitTimeout: config.timeout ? config.timeout : 20000
            }
          )
          // console.log('refresh nighmare session')
        }).then(() => {
          
          login()
        })
        :nightmare
              .end()
              .then(
                
                reinitiateAndFinish(),
                console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`)
              )

      });
    
  };

  const reLoginScrape = () => {

    nightmare
        .end()
        .then(() => {
          nightmare = new Nightmare(
            {
              show: config.show,
              waitTimeout: config.timeout ? config.timeout : 20000
            }
          )
          // console.log('refresh nighmare session')
        }).then(() => {
          nightmare
          .goto(startURL)
          .wait('body')
          .wait(`a[href="${config.loginpath}"]`)
          .click(`a[href="${config.loginpath}"]`)
          .insert('#UserName', process.env.USERNAMEE)
          .insert('#Password', process.env.PASSWORD)
          .click('button')
          .wait(`a[href="${config.searchpath}"]`)
          .click(`a[href="${config.searchpath}"]`)
          .then(() => scrape(currentCaseNumber))
          .catch(err => {
            navigationFailCount ++;
            console.log("navigationFailCount:",navigationFailCount)
            navigationFailCount< 60?
              consecutiveErrors < consecutiveErrorThreshold ?
                reLoginScrape()
                : scrapeUntilFinalYear()
              :nightmare
              .end()
              .then(
                
                reinitiateAndFinish(),
                console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`)
              )

            console.log(err)
            // !errorScrape ? errorList.push(currentCaseNumber) : null;
            // !errorScrape ? consecutiveErrors++ : null;
            console.log(consecutiveErrors, currentCaseNumber)
            // logError(currentCaseNumber);
            
          });
        })
        .catch(err => {
          
          console.log(err)
          console.log(consecutiveErrors, currentCaseNumber)
          consecutiveErrors < consecutiveErrorThreshold ?
            reLoginScrape()
            : scrapeUntilFinalYear()
        });

    

    
  };

  const reLoginScrapeFulton = () => {

    nightmare
        .end()
        .then(() => {
          // console.log('refresh nighmare session')
          nightmare = new Nightmare(
            {
              show: config.show,
              waitTimeout: config.timeout ? config.timeout : 20000
            }
          );
      
          
        })
        .then(() => {
          nightmare
            .goto(startURL)
            .wait('body')
            .wait(`a[href="${config.loginpath}"]`)
            .click(`a[href="${config.loginpath}"]`)
            .insert('#UserName', process.env.USERNAMEE)
            .insert('#Password', process.env.PASSWORD)
            .click('button')
            .wait(`a[href="${config.searchpath}"]`)
            .click(`a[href="${config.searchpath}"]`)
            .then(() => extract(currentCaseNumber))
            .catch(err => {
              console.log(err)
              // !errorScrape ? errorList.push(currentCaseNumber) : null;
              // !errorScrape ? consecutiveErrors++ : null;
              console.log(consecutiveErrors, currentCaseNumber)
              // logError(currentCaseNumber);
              navigationFailCount ++;
              console.log("navigationFailCount:",navigationFailCount)
              navigationFailCount< 60?
                consecutiveErrors < consecutiveErrorThreshold ?
                reLoginScrapeFulton()
                : nextSearchFulton()
                :nightmare
                .end()
                .then(
                  
                  reinitiateAndFinish(),
                  console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`)
                )
            });
        })
        .catch(err => {
          console.log(err)
          console.log(consecutiveErrors, currentCaseNumber)
          consecutiveErrors < consecutiveErrorThreshold ?
              reLoginScrapeFulton()
              : nextSearchFulton();
        });
    
  };
  

  // FUNCTION TO CREATE FILE STRUCTURE AND BEGIN SCRAPING
  const initiate = () => { 
    
    const headerRow = fields.map((field, i) =>
      `${field}${i !== fields.length - 1 ? '' : '\n'}`
    );

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

  const calCurrentCaseNumberForYear = () =>{

    new fs.createReadStream(prevFilepath)
          .pipe(csv())
          .on('data', row => {
            const rowObj = new Object(row);
            const caseID = rowObj['caseID'] ? rowObj['caseID'] : null;
            const caseStatus = rowObj['caseStatus'] ? rowObj['caseStatus'] : null

            var yearInCaseID =  county != 'Chatham'?
            rowObj['caseID'].slice(0, 2)
            :rowObj['caseID'].slice(4, 6)
          
            if (yearInCaseID == year.slice(2)){
           
              const caseNumber = caseID ? parseInt(rowObj['caseID'].slice(caseNumberSliceIndex)) : null;
              // find the last case number
              if (lastScrapeEnd < caseNumber){
                lastScrapeEnd = caseNumber
              }

              // var today = Date.now();
              var dateCutOff = new Date();
              dateCutOff.setMonth(dateCutOff.getMonth() - 3);
              dateCutOff.setDate(1);
              // console.log(dateCutOff.toLocaleDateString());
              var dateCase = new Date(rowObj['fileDate']);
              // var dateCase = new Date('9/3/21');
              // console.log(dateCutOff > dateCase);

              // COPY RECORDS FROM PREVIOUS SCRAPE TO CURRENT SCRAPE CSV
              (onlynew) ?
              // IF ONLYNEW THEN COPY ALL RECORDS
              fs.appendFile(
                filepath,
                fields.map((field, i) =>
                  `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
                ).toString(),
                err => err ?
                  console.log(err)
                  : null
              )
              // IF UPDATE (DEFAULT) THEN COPY CLOSED RECORDS OR CASES BEFORE THE CUTOFF
              : (caseStatus.search(closedCasesTerm) >= 0 || dateCase < dateCutOff)?
                  fs.appendFile(
                    filepath,
                    fields.map((field, i) =>
                      `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
                    ).toString(),
                    err => err ?
                      console.log(err)
                      : null
                  )
                : null
    
              // CREATE ARRAY OF CASES
              onlynew ?
                // PUSH ALL CASE NUMBERS TO ARRAY TO EVALUATE MAX FOR ONLYNEW
                !updateList.includes(caseNumber) ?
                    updateList.push(caseNumber)
                : null
              : (caseStatus.search(closedCasesTerm) === -1 && dateCase >= dateCutOff)?
                // PUSH OPEN (NON-CLOSED) CASES TO ARRAY TO LIMIT SCRAPER TO ONLY THOSE CASES
                !updateList.includes(caseNumber) ?
                  updateList.push(caseNumber)
                : null 
              : null;
            }
          })
          .on('end', () => {
            // console.log(updateList)
            // tabke care of the all cases have been closed from the previous scrape 
            if (updateList.length > 0){
              lastScrapeEnd = Math.max(...updateList);
              // console.log(lastScrapeEnd);
              onlynew ?
                currentCaseNumber = 
                  currentCaseNumber < lastScrapeEnd ? 
                    lastScrapeEnd + 1
                  : currentCaseNumber
                : currentCaseNumber = Math.min(...updateList);
              }else{
                // county === 'Fulton' ?
                // currentCaseNumber = 173560
                currentCaseNumber = lastScrapeEnd + 1
              }
        
              reLoginScrape();
            })
  }

  const scrapeUntilFinalYear = () => {
    //reset error checker
    consecutiveErrors = 0;
    errorScrape = false; 
    errorCasesScraped = 0;
    errorList = [];
    // go to next year
    year = (parseInt(year) + 1).toString()
    // reset last scrape end for new year
    county !== 'Fulton' ?
    lastScrapeEnd = 0
    : null;
    // reset the updatelist for new year
    updateList = [];
    currentCaseNumber = 1;
    // if the current year more than final year, stop
    parseInt(year) <= parseInt(finalYear) ?
    calCurrentCaseNumberForYear()
    :nightmare
    .end()
    .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  console.log(`Scrape of ${county} County started @ ${scrapeTimeStart} on ${scrapeDate}`);

  // RUN APPLICATION
  login();
  
}

